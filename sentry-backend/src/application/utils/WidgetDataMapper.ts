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
    static map(widgetType: string, rows: any[], definition?: any): any {
        if (!rows || rows.length === 0) return { data: [], results: [] };

        // Safety: Unmarshall any raw DynamoDB types if they leaked into the rows
        const cleanRows = rows.map(r => this.unmarshall(r));

        const firstRow = cleanRows[0];
        const aliases = Array.isArray(definition?.sql_aliases) ? definition.sql_aliases : [];
        const mappedAliases = this.extractAliasPayload(firstRow, aliases);

        if (mappedAliases) {
            return {
                data: this.normalizeNumericPrecision(mappedAliases),
                results: this.normalizeNumericPrecision(cleanRows)
            };
        }

        return {
            data: this.normalizeNumericPrecision(cleanRows),
            results: this.normalizeNumericPrecision(cleanRows)
        };
    }

    private static extractAliasPayload(row: any, aliases: Array<any>): any | null {
        if (!row || typeof row !== 'object' || Array.isArray(row) || aliases.length === 0) {
            return null;
        }

        const payload: any = {};
        let hasMappedField = false;

        for (const aliasDefinition of aliases) {
            const alias = aliasDefinition?.alias;
            if (!alias) continue;
            if (!(alias in row)) continue;

            payload[alias] = row[alias];
            hasMappedField = true;
        }

        return hasMappedField ? payload : null;
    }

    private static normalizeNumericPrecision(data: any): any {
        if (Array.isArray(data)) {
            return data.map((item) => this.normalizeNumericPrecision(item));
        }

        if (data && typeof data === 'object') {
            const result: any = {};
            for (const [key, value] of Object.entries(data)) {
                result[key] = this.normalizeNumericPrecision(value);
            }
            return result;
        }

        if (typeof data === 'number' && Number.isFinite(data)) {
            const rounded = Math.round(data * 100) / 100;
            return Number.isInteger(rounded) ? Math.trunc(rounded) : rounded;
        }

        if (typeof data === 'string' && /^-?\d+\.\d+$/.test(data.trim())) {
            const numeric = Number.parseFloat(data);
            if (Number.isFinite(numeric)) {
                const rounded = Math.round(numeric * 100) / 100;
                return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : String(rounded);
            }
        }

        return data;
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
