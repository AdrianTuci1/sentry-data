import { WidgetDefinition } from '../services/WidgetService';

/**
 * SDUIHydrator dynamically maps raw SQL results to React props
 * based on the YAML definitions in boilerplates/config/widgets.
 */
export class SDUIHydrator {
    /**
     * Hydrates a widget with data based on its definition.
     */
    static hydrate(definition: WidgetDefinition, rows: any[]): any {
        if (!rows || rows.length === 0) return { id: definition.id, type: definition.id };

        const sdui = definition.sdui || {};
        const rootKey = sdui.root_key || 'data';
        const mode = sdui.mapping_mode || 'list';

        let mappedData: any = {};

        switch (mode) {
            case 'list':
                mappedData[rootKey] = rows;
                break;
            case 'single':
                mappedData = { ...rows[rows.length - 1] }; // Take latest
                if (rootKey !== 'data') {
                    mappedData[rootKey] = rows[rows.length - 1];
                }
                break;
            case 'array':
                mappedData[rootKey] = rows.map(r => Object.values(r)[0]);
                break;
            case 'matrix':
                // For complex matrix components like Heatmaps, we often return clean rows
                mappedData[rootKey] = rows;
                break;
            default:
                mappedData[rootKey] = rows;
        }

        // Add standard shell metadata with redundant data keys for maximum compatibility
        return {
            id: definition.id,
            type: definition.id,
            title: definition.title,
            gridSpan: definition.grid_span,
            data: mappedData[rootKey] || [],
            results: rows || [],
            dataPoints: (rows || []).map(r => Object.values(r).find(v => typeof v === 'number') || 0),
            rawData: rows || [],
            value: mappedData.value || (rows.length > 0 ? Object.values(rows[rows.length - 1]).find(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)))) || "0" : "0"),
            unit: mappedData.unit || "",
            ...mappedData
        };
    }
}
