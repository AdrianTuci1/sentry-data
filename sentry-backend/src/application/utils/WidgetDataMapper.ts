/**
 * Utility to map raw analytics worker (DuckDB) results to frontend widget-specific data structures.
 */
export class WidgetDataMapper {
    /**
     * Maps raw query rows to the expected format of a specific widget type.
     * 
     * @param widgetType The type of widget (e.g., 'predictive', 'weather', 'bar-chart')
     * @param rows The raw rows returned by the DuckDB query
     * @returns A mapped object containing the data fields required by the widget
     */
    static map(widgetType: string, rows: any[]): any {
        if (!rows || rows.length === 0) return { data: [], results: [] };

        // Safety: Unmarshall any raw DynamoDB types if they leaked into the rows
        const cleanRows = rows.map(r => this.unmarshall(r));

        return {
            data: cleanRows,
            results: cleanRows
        };
    }

    /**
     * Recursively unmarshals a DynamoDB-style object (e.g., { "S": "val" } -> "val").
     * This serves as a safety net if raw DynamoDB format leaks into the payload.
     */
    public static unmarshall(data: any): any {
        if (data === null || typeof data !== 'object') return data;

        if (Array.isArray(data)) {
            return data.map(v => this.unmarshall(v));
        }

        const keys = Object.keys(data);
        if (keys.length === 1) {
            const key = keys[0];
            const value = data[key];

            switch (key) {
                case 'S':
                case 'B':
                case 'N':
                case 'BOOL':
                    return key === 'N' ? parseFloat(value) : value;
                case 'L':
                    return this.unmarshall(value);
                case 'M':
                    return this.unmarshall(value);
                case 'NULL':
                    return null;
            }
        }

        const result: any = {};
        for (const [key, value] of Object.entries(data)) {
            result[key] = this.unmarshall(value);
        }
        return result;
    }

}
