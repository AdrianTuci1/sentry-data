package statsparrot

import (
	"context"
	"testing"

	runtimev1 "github.com/staticlabs/statsparrot/proto/gen/statsparrot/runtime/v1"
	"github.com/staticlabs/statsparrot/runtime/drivers"
	"github.com/staticlabs/statsparrot/runtime/testruntime"
	"github.com/stretchr/testify/require"
)

func TestFetchSourceRowsNonDevTokenReachesMapper(t *testing.T) {
	// A source with a real (non-placeholder) token must reach the per-source mapper.
	cfg := map[string]any{
		"registered": true,
		"token":      "shpat_real_token_123",
	}
	objects := []map[string]any{
		{
			"id":          "1001",
			"created_at":  "2025-01-01T00:00:00Z",
			"total_price": "99.50",
			"currency":    "USD",
			"status":      "paid",
			"line_items":  []any{map[string]any{"id": "li_1"}},
		},
	}

	rows, err := fetchSourceRows(context.Background(), "shopify", cfg, objects)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "1001", rows[0]["id"])
	require.Equal(t, "USD", rows[0]["currency"])
	require.Equal(t, 1, rows[0]["line_items_count"])
}

func TestFetchSourceRowsRegistrationOnlyReturnsEmpty(t *testing.T) {
	// A registration-only source (registered but no real credentials) yields an explicit
	// empty result rather than being silently swallowed (nil, nil).
	cfg := map[string]any{
		"registered": true,
		"token":      "dev",
	}
	rows, err := fetchSourceRows(context.Background(), "shopify", cfg, []map[string]any{{"id": "1"}})
	require.NoError(t, err)
	require.NotNil(t, rows)
	require.Empty(t, rows)
}

func TestFetchSourceRowsUnknownConnector(t *testing.T) {
	// The default branch must fail with a clear "no ingestion mapper" error.
	_, err := fetchSourceRows(context.Background(), "not_a_connector", map[string]any{"token": "abc"}, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no ingestion mapper")
}

func TestMapperForSource(t *testing.T) {
	// Every Statsparrot connector must have a mapper.
	for _, connector := range []string{"shopify", "woocommerce", "google_analytics4", "meta_ads", "tiktok_ads", "stripe"} {
		_, err := mapperForSource(connector)
		require.NoError(t, err, "expected a mapper for %q", connector)
	}
}

func TestStripeObjectTypes(t *testing.T) {
	// Defaults to charges, customers and invoices.
	objects, err := stripeObjectTypes(map[string]any{})
	require.NoError(t, err)
	require.Equal(t, []string{"charges", "customers", "invoices"}, objects)

	// Honours the source's objects config instead of hard-coding /v1/charges.
	objects, err = stripeObjectTypes(map[string]any{"objects": []any{"customers", "invoices"}})
	require.NoError(t, err)
	require.Equal(t, []string{"customers", "invoices"}, objects)
	require.Equal(t, "/v1/customers", stripeEndpoint(objects[0]))

	// Unsupported object types are rejected.
	_, err = stripeObjectTypes(map[string]any{"objects": []any{"subscriptions"}})
	require.Error(t, err)
}

func TestWriteRowsToOLAP(t *testing.T) {
	rt, instanceID := testruntime.NewInstance(t)
	olap, release, err := rt.OLAP(context.Background(), instanceID, "")
	require.NoError(t, err)
	defer release()

	schema := &runtimev1.StructType{
		Fields: []*runtimev1.StructType_Field{
			{Name: "id", Type: &runtimev1.Type{Code: runtimev1.Type_CODE_INT64}},
			{Name: "country", Type: &runtimev1.Type{Code: runtimev1.Type_CODE_STRING}},
			{Name: "revenue", Type: &runtimev1.Type{Code: runtimev1.Type_CODE_FLOAT64}},
		},
	}
	rows := []map[string]any{
		{"id": int64(1), "country": "US", "revenue": 100.5},
		{"id": int64(2), "country": "CA", "revenue": 200.25},
	}

	err = writeRowsToOLAP(context.Background(), olap, "source_rows", schema, rows)
	require.NoError(t, err)

	res, err := olap.Query(context.Background(), &drivers.Statement{Query: "SELECT id, country, revenue FROM source_rows ORDER BY id"})
	require.NoError(t, err)
	defer res.Close()

	var got []map[string]any
	for res.Next() {
		row := make(map[string]any)
		require.NoError(t, res.MapScan(row))
		got = append(got, row)
	}
	require.NoError(t, res.Err())
	require.Len(t, got, 2)
	require.Equal(t, "US", got[0]["country"])
	require.Equal(t, int64(2), got[1]["id"])
}
