import { buildFinding, buildSuggestion, buildValidation } from './builders';

export const warehouseSourceId = 'warehouse-postgres';

export const warehouseTransformations = [
    {
        id: `transform-${warehouseSourceId}-revenue-marts`,
        title: 'Revenue Mart Alignment',
        intent: 'Align warehouse revenue marts into a stable finance and cohort analytics contract.',
        code: [
            'SELECT',
            '    account_id,',
            '    billing_month,',
            '    mrr,',
            '    churn_risk_band,',
            '    expansion_score',
            'FROM finance.monthly_revenue_mart'
        ].join('\n'),
        editMode: 'code',
        compiledCode: [
            'WITH revenue_mart AS (',
            '    SELECT',
            '        account_id,',
            '        billing_month,',
            '        mrr,',
            '        churn_risk_band,',
            '        expansion_score',
            '    FROM finance.monthly_revenue_mart',
            ')',
            'SELECT * FROM revenue_mart'
        ].join('\n'),
        suggestions: [
            buildSuggestion(
                'mock-warehouse-revenue-mart',
                'pne',
                'intent',
                'Expose revenue cohorts by account',
                'The warehouse should provide a clean account-level contract for retention and expansion analysis.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'schema', status: 'passed', message: 'Warehouse mart columns were profiled successfully.' },
            { name: 'lineage', status: 'passed', message: 'Revenue mart keeps lineage to finance warehouse tables.' }
        ])
    }
];

export const warehouseGoldViews = [
    {
        id: `gold-${warehouseSourceId}-revenue`,
        title: 'Warehouse Revenue View',
        description: 'Warehouse-backed finance contract for MRR, retention, and expansion analysis.',
        columns: [
            { name: 'account_id', type: 'VARCHAR', semanticType: 'id' },
            { name: 'billing_month', type: 'DATE', semanticType: 'timestamp' },
            { name: 'mrr', type: 'DECIMAL', semanticType: 'metric' },
            { name: 'churn_risk_band', type: 'VARCHAR', semanticType: 'dimension' },
            { name: 'expansion_score', type: 'DOUBLE', semanticType: 'metric' }
        ],
        editMode: 'code',
        logic: {
            intent: 'Expose a finance-ready view from the warehouse revenue mart.',
            code: [
                'SELECT',
                '    account_id,',
                '    billing_month,',
                '    mrr,',
                '    churn_risk_band,',
                '    expansion_score',
                'FROM revenue_mart'
            ].join('\n'),
            compiled_code: [
                'WITH revenue_mart AS (',
                '    SELECT',
                '        account_id,',
                '        billing_month,',
                '        mrr,',
                '        churn_risk_band,',
                '        expansion_score',
                '    FROM finance.monthly_revenue_mart',
                ')',
                'SELECT * FROM revenue_mart'
            ].join('\n')
        },
        virtualization: {
            timeWindow: '730d rolling',
            cachePolicy: 'Cache historical billing months older than 30d',
            incrementalStrategy: 'Refresh the latest two billing months',
            version: 'virt-warehouse-revenue@v4',
            contractRevision: 'warehouse-revenue.contract.r1',
            materializationHint: 'warehouse-cache'
        },
        sentinelFindings: [
            buildFinding(
                'finding-warehouse-revenue-month-gaps',
                'info',
                'resolved',
                'Sparse month gaps normalized',
                'Some accounts were missing intermediate billing months in the raw warehouse mart.',
                {
                    resolution: 'Sentinel approved sparse-month normalization for cohort views.'
                }
            )
        ],
        suggestions: [
            buildSuggestion(
                'mock-warehouse-revenue-view',
                'sentinel',
                'intent',
                'Keep cohort-ready revenue fields',
                'Finance and GTM widgets need stable month, MRR, and churn-band fields.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'widget_contract', status: 'passed', message: 'Revenue fields support cohort and risk widgets.' },
            { name: 'lineage', status: 'passed', message: 'Warehouse revenue view maps directly to the finance mart.' }
        ])
    }
];

export const warehouseSourceMetadata = {
    sourceId: warehouseSourceId,
    sourceName: 'Warehouse Postgres',
    sourceType: 'postgres',
    uri: 'postgres://analytics.internal:5432/warehouse',
    schedule: {
        frequency: 'manual',
        lookbackWindow: '30d',
        refreshLag: 'on-demand'
    },
    fingerprint: 'mock-warehouse-fingerprint',
    schema: warehouseGoldViews[0].columns,
    sampleRows: [
        { account_id: 'acc-3', billing_month: '2026-03-01', mrr: 4200, churn_risk_band: 'medium', expansion_score: 0.71 }
    ],
    entityKeyCandidates: ['account_id'],
    timestampCandidates: ['billing_month'],
    metricCandidates: ['mrr', 'expansion_score'],
    transformations: warehouseTransformations,
    goldViews: warehouseGoldViews,
    sentinelFindings: [
        buildFinding(
            'finding-warehouse-latency',
            'warning',
            'open',
            'Warehouse sync delayed',
            'The warehouse revenue mart is 3 hours behind the desired SLA for finance insights.',
            {
                resolution: 'Warehouse-backed cards should surface delay metadata until sync recovers.'
            }
        )
    ],
    metadataUri: 'mock://metadata/sources/warehouse-postgres/connection.json'
};

export const warehouseConnector = {
    id: warehouseSourceId,
    name: 'Warehouse Postgres',
    type: 'db',
    status: 'ok',
    uri: 'postgres://analytics.internal:5432/warehouse'
};

export const warehouseActionType = {
    id: `action-${warehouseSourceId}`,
    name: 'Virtualize Warehouse',
    connector_id: warehouseSourceId,
    status: 'ok'
};
