package statsparrot

import (
	"context"
	"fmt"
	"strings"

	runtimev1 "github.com/staticlabs/statsparrot/proto/gen/statsparrot/runtime/v1"
	"github.com/staticlabs/statsparrot/runtime/drivers"
)

// statsparrotDevToken is a placeholder token used to flag sources that have been
// registered with the Statsparrot control plane but have not yet been activated
// with real credentials.
const statsparrotDevToken = "dev"

// isRegistrationOnlySource reports whether a source is only a registration placeholder
// (registered but carrying no real credentials) and therefore has no data to ingest.
func isRegistrationOnlySource(cfg map[string]any) bool {
	registered, _ := cfg["registered"].(bool)
	if !registered {
		return false
	}
	tok, _ := cfg["token"].(string)
	return tok == "" || tok == statsparrotDevToken
}

// fetchSourceRows maps a connector's raw source objects into normalized rows for ingestion.
// It never performs network I/O; the upstream ingestion pipeline hands it the decoded objects.
//
// There is intentionally no blanket dev-token short-circuit: sources that carry real
// (non-placeholder) credentials always reach the per-source mapper. Only registration-only
// sources are skipped, and they return an explicit empty result rather than being silently
// swallowed.
func fetchSourceRows(ctx context.Context, connector string, cfg map[string]any, objects []map[string]any) ([]map[string]any, error) {
	if isRegistrationOnlySource(cfg) {
		// Registration-only sources have no real data yet. Return an explicit empty
		// result so the source is not silently swallowed by ingestion.
		return []map[string]any{}, nil
	}

	mapper, err := mapperForSource(connector)
	if err != nil {
		return nil, err
	}

	rows := make([]map[string]any, 0, len(objects))
	for _, obj := range objects {
		rows = append(rows, mapper(obj))
	}
	return rows, nil
}

// rowMapper maps a single raw source object to a normalized ingestion row.
type rowMapper func(obj map[string]any) map[string]any

// mapperForSource returns the row mapper for a given Statsparrot connector.
func mapperForSource(connector string) (rowMapper, error) {
	switch connector {
	case "shopify":
		return mapShopifyOrder, nil
	case "woocommerce":
		return mapWoocommerceOrder, nil
	case "google_analytics4":
		return mapGA4Event, nil
	case "meta_ads":
		return mapMetaAdInsight, nil
	case "tiktok_ads":
		return mapTikTokAdInsight, nil
	case "stripe":
		return mapStripeObject, nil
	default:
		return nil, fmt.Errorf("no ingestion mapper for connector %q", connector)
	}
}

func mapShopifyOrder(obj map[string]any) map[string]any {
	return map[string]any{
		"id":           obj["id"],
		"created_at":   obj["created_at"],
		"updated_at":   obj["updated_at"],
		"total_price":  obj["total_price"],
		"currency":     obj["currency"],
		"status":       obj["status"],
		"email":        obj["email"],
		"line_items_count": len(asSlice(obj["line_items"])),
	}
}

func mapWoocommerceOrder(obj map[string]any) map[string]any {
	return map[string]any{
		"id":           obj["id"],
		"date_created": obj["date_created"],
		"date_modified": obj["date_modified"],
		"total":        obj["total"],
		"currency":     obj["currency"],
		"status":       obj["status"],
		"billing_email": obj["billing_email"],
	}
}

func mapGA4Event(obj map[string]any) map[string]any {
	return map[string]any{
		"event_date":   obj["event_date"],
		"event_name":   obj["event_name"],
		"event_count":  obj["event_count"],
		"user_count":   obj["user_count"],
		"total_revenue": obj["total_revenue"],
	}
}

func mapMetaAdInsight(obj map[string]any) map[string]any {
	return map[string]any{
		"campaign_id":  obj["campaign_id"],
		"adset_id":     obj["adset_id"],
		"ad_id":        obj["ad_id"],
		"impressions":  obj["impressions"],
		"clicks":       obj["clicks"],
		"spend":        obj["spend"],
		"actions":      obj["actions"],
	}
}

func mapTikTokAdInsight(obj map[string]any) map[string]any {
	return map[string]any{
		"campaign_id":  obj["campaign_id"],
		"adgroup_id":   obj["adgroup_id"],
		"ad_id":        obj["ad_id"],
		"impressions":  obj["impressions"],
		"clicks":       obj["clicks"],
		"spend":        obj["spend"],
	}
}

func mapStripeObject(obj map[string]any) map[string]any {
	return map[string]any{
		"id":          obj["id"],
		"object":      obj["object"],
		"created":     obj["created"],
		"currency":    obj["currency"],
		"amount_total": obj["amount_total"],
		"status":      obj["status"],
		"customer":    obj["customer"],
	}
}

// stripeObjectTypes returns the Stripe object types (API sub-resources) to ingest,
// honouring the source's `objects` config. Defaults to charges, customers and invoices.
func stripeObjectTypes(cfg map[string]any) ([]string, error) {
	var objects []string
	if v, ok := cfg["objects"]; ok && v != nil {
		switch t := v.(type) {
		case []string:
			objects = t
		case []any:
			for _, o := range t {
				if s, ok := o.(string); ok {
					objects = append(objects, s)
				}
			}
		case string:
			for _, s := range strings.Split(t, ",") {
				if s = strings.TrimSpace(s); s != "" {
					objects = append(objects, s)
				}
			}
		default:
			return nil, fmt.Errorf("invalid 'objects' config for stripe: expected a list of strings, got %T", v)
		}
	}

	if len(objects) == 0 {
		objects = []string{"charges", "customers", "invoices"}
	}

	for _, o := range objects {
		switch o {
		case "charges", "customers", "invoices":
		default:
			return nil, fmt.Errorf("unsupported stripe object %q (supported: charges, customers, invoices)", o)
		}
	}

	return objects, nil
}

// stripeEndpoint returns the Stripe API endpoint for an object type instead of hard-coding
// a single endpoint (e.g. /v1/charges).
func stripeEndpoint(objectType string) string {
	return "/v1/" + objectType
}

// writeRowsToOLAP writes the given rows to an OLAP table, creating the table from the
// provided schema. It is used both for ingestion and for reverse-ETL.
func writeRowsToOLAP(ctx context.Context, olap drivers.OLAPStore, table string, schema *runtimev1.StructType, rows []map[string]any) error {
	if schema == nil {
		return fmt.Errorf("schema is required to write rows to %q", table)
	}

	cols := make([]string, 0, len(schema.Fields))
	colDefs := make([]string, 0, len(schema.Fields))
	for _, f := range schema.Fields {
		cols = append(cols, f.Name)
		colDefs = append(colDefs, fmt.Sprintf("%s %s", quoteIdent(f.Name), sqlTypeFor(f.Type)))
	}

	create := fmt.Sprintf("CREATE OR REPLACE TABLE %s (%s)", quoteIdent(table), strings.Join(colDefs, ", "))
	if err := olap.Exec(ctx, &drivers.Statement{Query: create}); err != nil {
		return fmt.Errorf("failed to create table %q: %w", table, err)
	}

	if len(rows) == 0 {
		return nil
	}

	for _, row := range rows {
		placeholders := make([]string, len(cols))
		args := make([]any, len(cols))
		for i, col := range cols {
			placeholders[i] = "?"
			args[i] = row[col]
		}
		query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
			quoteIdent(table),
			quoteIdentList(cols),
			strings.Join(placeholders, ", "),
		)
		if err := olap.Exec(ctx, &drivers.Statement{Query: query, Args: args}); err != nil {
			return fmt.Errorf("failed to insert row into %q: %w", table, err)
		}
	}

	return nil
}

// sqlTypeFor maps a runtime type to a SQL column type for OLAP table creation.
func sqlTypeFor(t *runtimev1.Type) string {
	if t == nil {
		return "VARCHAR"
	}
	switch t.Code {
	case runtimev1.Type_CODE_BOOL:
		return "BOOLEAN"
	case runtimev1.Type_CODE_INT8, runtimev1.Type_CODE_INT16:
		return "SMALLINT"
	case runtimev1.Type_CODE_INT32:
		return "INTEGER"
	case runtimev1.Type_CODE_INT64, runtimev1.Type_CODE_INT128, runtimev1.Type_CODE_INT256:
		return "BIGINT"
	case runtimev1.Type_CODE_UINT8, runtimev1.Type_CODE_UINT16, runtimev1.Type_CODE_UINT32,
		runtimev1.Type_CODE_UINT64, runtimev1.Type_CODE_UINT128, runtimev1.Type_CODE_UINT256:
		return "UBIGINT"
	case runtimev1.Type_CODE_FLOAT32:
		return "REAL"
	case runtimev1.Type_CODE_FLOAT64:
		return "DOUBLE"
	case runtimev1.Type_CODE_TIMESTAMP:
		return "TIMESTAMP"
	case runtimev1.Type_CODE_DATE:
		return "DATE"
	case runtimev1.Type_CODE_TIME:
		return "TIME"
	case runtimev1.Type_CODE_STRING:
		return "VARCHAR"
	case runtimev1.Type_CODE_BYTES:
		return "BLOB"
	case runtimev1.Type_CODE_DECIMAL:
		return "DECIMAL"
	case runtimev1.Type_CODE_JSON:
		return "JSON"
	case runtimev1.Type_CODE_UUID:
		return "UUID"
	default:
		return "VARCHAR"
	}
}

// quoteIdent quotes a SQL identifier with double quotes, escaping any embedded double quotes.
func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

func quoteIdentList(cols []string) string {
	q := make([]string, len(cols))
	for i, c := range cols {
		q[i] = quoteIdent(c)
	}
	return strings.Join(q, ", ")
}

func asSlice(v any) []any {
	if v == nil {
		return nil
	}
	if s, ok := v.([]any); ok {
		return s
	}
	return nil
}
