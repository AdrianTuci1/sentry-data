export const getDataProfilerPrompt = (dataUri: string): string => `
You are a Staff Data Engineer. Your goal is to analyze the dataset located at "${dataUri}".
1. Read the schema of the data.
2. Generate 3 useful SQL aggregations compatible with DuckDB that a business user would want to see.
3. Output ONLY a valid JSON array matching this format: [{ "widgetId": "string", "sqlString": "string" }]
`;
