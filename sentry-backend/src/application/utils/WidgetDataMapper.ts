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
        if (!rows || rows.length === 0) return {};

        // Safety: Unmarshall any raw DynamoDB types if they leaked into the rows
        const cleanRows = rows.map(r => this.unmarshall(r));

        switch (widgetType) {
            case 'weather':
            case 'natural':
            case 'light-dial':
            case 'liquid-gauge':
            case 'neural-nexus':
            case 'intensity-heat':
            case 'chrono-dial':
            case 'incremental-lift':
            case 'waffle':
                // For scalar-based widgets, we take the first numeric-looking value from the first row.
                const firstRow = cleanRows[0];
                const scalarVal = this.extractNumericValue(firstRow);
                return {
                    value: this.formatNumber(scalarVal),
                    sliderValue: typeof scalarVal === 'number' ? Math.min(100, Math.max(0, scalarVal)) : 0
                };

            case 'predictive':
            case 'animated-line':
            case 'productivity-chart':
                // For time-series/list-based widgets, we extract a flat array of numbers.
                // We pick the first numeric value found in each row (usually the count/sum).
                const numericArray = cleanRows.map(row => this.extractNumericValue(row) ?? 0);

                if (widgetType === 'predictive') {
                    return {
                        historical: numericArray,
                        forecast: [] // Forecast is usually a placeholder or computed separately
                    };
                }

                if (widgetType === 'animated-line') {
                    return {
                        value: numericArray.length > 0 ? this.formatNumber(numericArray[numericArray.length - 1]) : "0",
                        dataPoints: numericArray
                    };
                }

                return { dataPoints: numericArray };

            default:
                // Fallback: return the clean rows as "data"
                return { data: cleanRows };
        }
    }

    /**
     * Finds the first numeric value in an object.
     * Prioritizes common naming conventions like 'value', 'total', 'count'.
     */
    private static extractNumericValue(row: any): number | null {
        if (typeof row !== 'object' || row === null) return null;

        // Priority keys
        const priorityKeys = ['value', 'total', 'count', 'val', 'amount', 'result'];
        for (const key of priorityKeys) {
            if (typeof row[key] === 'number') return row[key];
            if (typeof row[key] === 'string' && !isNaN(parseFloat(row[key]))) return parseFloat(row[key]);
        }

        // Generic search for any number
        const values = Object.values(row);
        for (const val of values) {
            if (typeof val === 'number') return val;
            if (typeof val === 'string' && !isNaN(parseFloat(val))) return parseFloat(val);
        }

        return null;
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

    /**
     * Nicely formats a number for display.
     */
    private static formatNumber(val: number | null): string {
        if (val === null) return "0";
        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
        if (val % 1 === 0) return val.toString();
        return val.toFixed(2);
    }
}
