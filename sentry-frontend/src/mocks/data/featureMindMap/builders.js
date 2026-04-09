export const buildValidation = (status, checks) => ({
    status,
    checks
});

export const buildSuggestion = (id, source, mode, title, rationale, extra = {}) => ({
    id,
    source,
    mode,
    title,
    rationale,
    ...extra
});

export const buildFinding = (id, severity, status, title, detail, extra = {}) => ({
    id,
    severity,
    status,
    title,
    detail,
    ...extra
});

export const buildMockYaml = (manifest) => {
    const sourceLines = manifest.layers.sources.map((source) => [
        `    - id: ${source.id}`,
        `      name: ${source.name}`,
        `      type: ${source.type}`
    ].join('\n')).join('\n');

    const groupLines = manifest.layers.groups.map((group) => [
        `    - id: ${group.id}`,
        `      title: ${group.title}`,
        `      status: ${group.status}`
    ].join('\n')).join('\n');

    const insightLines = manifest.layers.insights.map((insight) => [
        `    - id: ${insight.id}`,
        `      title: ${insight.title}`,
        `      widget_type: ${insight.widget_type}`,
        `      activationMode: ${insight.activationMode}`
    ].join('\n')).join('\n');

    return [
        'version: 1.0',
        'runtime:',
        '  mode: parrot_os',
        `  executionEngine: ${manifest.runtime.executionEngine}`,
        `  decisionEngine: "${manifest.runtime.decisionEngine}"`,
        'editing:',
        `  sentinelGuard: "${manifest.editing.sentinelGuard}"`,
        'layers:',
        '  sources:',
        sourceLines,
        '  groups:',
        groupLines,
        '  insights:',
        insightLines
    ].join('\n');
};

export const buildAdjustedDataEntry = (view, sourceId) => ({
    id: view.id,
    name: view.title,
    title: view.title,
    origin_id: sourceId,
    action_type_id: `action-${sourceId}`,
    status: 'ok',
    columns: view.columns.map((column) => ({
        id: `${view.id}-${column.name}`,
        name: column.name,
        title: column.name,
        type: column.type,
        status: 'ok'
    }))
});
