package statsparrot

import (
	"context"
	"fmt"

	"github.com/staticlabs/statsparrot/runtime/drivers"
)

// pushToDestination pushes the rows produced by a model execution to a destination table.
//
// res is a ModelResult, which is metadata-only (Connector/Properties/Table/ExecDuration/Warnings);
// it does not carry row data. To perform a real reverse-ETL of the model output we therefore
// re-read the model's committed rows from its output OLAP store (res.Table on outOLAP) and write
// those derived rows to the destination. This avoids the incorrect behaviour of re-fetching the
// baseline source rows that the model consumed.
//
// outOLAP is the OLAP store that holds the model's output (identified by res.Connector/
// res.Properties). destOLAP is the destination OLAP store and destTable is the destination table.
func pushToDestination(ctx context.Context, outOLAP drivers.OLAPStore, res *drivers.ModelResult, destOLAP drivers.OLAPStore, destTable string) error {
	if res == nil || res.Table == "" {
		return fmt.Errorf("model result is missing a table to push from")
	}
	if outOLAP == nil {
		return fmt.Errorf("model output OLAP store is required")
	}
	if destOLAP == nil {
		return fmt.Errorf("destination OLAP store is required")
	}

	// Read the model's committed (derived) rows.
	result, err := outOLAP.Query(ctx, &drivers.Statement{Query: fmt.Sprintf("SELECT * FROM %s", quoteIdent(res.Table))})
	if err != nil {
		return fmt.Errorf("failed to read model output %q: %w", res.Table, err)
	}
	defer func() { _ = result.Close() }()

	// A model producing no rows is still a valid (empty) reverse-ETL push.
	rows := make([]map[string]any, 0)
	for result.Next() {
		row := make(map[string]any)
		if err := result.MapScan(row); err != nil {
			return fmt.Errorf("failed to read model output row: %w", err)
		}
		rows = append(rows, row)
	}
	if err := result.Err(); err != nil {
		return fmt.Errorf("failed to iterate model output: %w", err)
	}

	if err := writeRowsToOLAP(ctx, destOLAP, destTable, result.Schema, rows); err != nil {
		return fmt.Errorf("failed to push model output to %q: %w", destTable, err)
	}

	return nil
}
