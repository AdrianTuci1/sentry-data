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
            case 'leads-list':
                return { leads: cleanRows, results: cleanRows, data: cleanRows };

            case 'vitals':
                return { metrics: cleanRows, results: cleanRows, data: cleanRows };

            case 'cohorts':
                return { cohorts: cleanRows, results: cleanRows, data: cleanRows };

            case 'waterfall':
                return { 
                    steps: cleanRows,
                    results: cleanRows,
                    data: cleanRows,
                    value: cleanRows.length > 0 ? this.formatNumber(this.extractNumericValue(cleanRows[cleanRows.length-1])) : "0"
                };

            case 'attribution':
            case 'shapley-attribution':
                return { models: cleanRows, rawData: cleanRows, results: cleanRows, data: cleanRows };

            case 'trend-spotter':
                return { keywords: cleanRows, results: cleanRows, data: cleanRows };

            case 'market-radar':
            case 'radar':
                return { radarData: cleanRows, indicator: this.extractIndicators(cleanRows), results: cleanRows, data: cleanRows };

            case 'funnel':
                return { funnel: cleanRows, results: cleanRows, data: cleanRows };

            case 'creative-quadrant':
                const quadrantData = cleanRows.map(r => this.extractValuesAsArray(r));
                return { creatives: quadrantData, results: cleanRows, data: quadrantData };

            case 'lead-clustering':
                const clusterData = cleanRows.map(r => this.extractValuesAsArray(r));
                return { clusteringData: clusterData, results: cleanRows, data: clusterData };

            case 'budget-sensitivity':
                const sensitivityData = cleanRows.map(r => this.extractValuesAsArray(r));
                return { curvePoints: sensitivityData, results: cleanRows, data: sensitivityData };

            case 'intent-sunburst':
                return { sunburstData: cleanRows, results: cleanRows, data: cleanRows };

            case '3d-map':
                return { locations: cleanRows, results: cleanRows, data: cleanRows };

            case 'animated-line':
                const points = cleanRows.map(r => this.extractNumericValue(r)).filter(v => v !== null);
                return { 
                    dataPoints: points,
                    results: cleanRows,
                    data: points,
                    value: cleanRows.length > 0 ? this.formatNumber(this.extractNumericValue(cleanRows[cleanRows.length-1])) : "0",
                    unit: "usr"
                };

            case 'scatter':
                const scatterData = cleanRows.map(r => this.extractValuesAsArray(r));
                return { scatterData: scatterData, results: cleanRows, data: scatterData };

            case 'intensity-heat':
                const heatData = cleanRows.map(r => this.extractValuesAsArray(r));
                const latestHeatVal = cleanRows.length > 0 ? this.extractNumericValue(cleanRows[cleanRows.length-1]) : 0;
                return { 
                    heatmapData: heatData, 
                    results: cleanRows, 
                    data: heatData,
                    value: this.formatNumber(latestHeatVal) 
                };

            case 'chrono-dial':
                // Find peak hour and event distribution
                const peakRow = cleanRows.reduce((prev, curr) => 
                    ((this.extractNumericValue(prev) || 0) > (this.extractNumericValue(curr) || 0) ? prev : curr), 
                    cleanRows[0]
                );
                const peakHourText = peakRow ? (peakRow.time?.split(':')[0] || "00") : "00";
                const peakSliderVal = (parseInt(peakHourText) / 24) * 100;
                return { 
                    data: cleanRows,
                    results: cleanRows,
                    peakHour: peakHourText,
                    sliderValue: peakSliderVal,
                    value: peakSliderVal.toFixed(0) + '%'
                };

            default:
                // Universal Fallback
                const numericValues = cleanRows.map(r => this.extractNumericValue(r)).filter(v => v !== null);
                const firstRow = cleanRows[0];
                const labelKey = Object.keys(firstRow).find(k => typeof firstRow[k] === 'string') || 'label';
                const labels = cleanRows.map(r => r[labelKey]);

                return { 
                    data: cleanRows, 
                    results: cleanRows,
                    dataPoints: numericValues,
                    labels: labels,
                    values: numericValues,
                    metrics: cleanRows.map(r => ({
                        name: r[labelKey] || 'Metric',
                        value: this.extractNumericValue(r),
                        status: (this.extractNumericValue(r) || 0) > 0 ? 'healthy' : 'degraded'
                    })),
                    value: numericValues.length > 0 ? this.formatNumber(numericValues[numericValues.length-1]) : "0"
                };
        }
    }

    /**
     * Extracts radar indicators from rows.
     */
    private static extractIndicators(rows: any[]): any[] {
        if (!rows || rows.length === 0) return [];
        const firstRow = rows[0];
        return Object.keys(firstRow)
            .filter(k => typeof firstRow[k] === 'number')
            .map(k => ({ name: k, max: 100 }));
    }

    /**
     * Extracts all values from a row as a flat array (for tuple-based widgets).
     */
    private static extractValuesAsArray(row: any): any[] {
        return Object.values(row);
    }

    /**
     * Finds the first numeric value in an object.
     * Prioritizes common naming conventions like 'value', 'total', 'count'.
     */
    private static extractNumericValue(row: any): number | null {
        if (typeof row !== 'object' || row === null) return null;

        // Priority keys
        const priorityKeys = ['value', 'weight', 'total', 'count', 'val', 'amount', 'result'];
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
