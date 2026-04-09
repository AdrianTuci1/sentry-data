import { buildFinding, buildSuggestion, buildValidation } from './builders';

export const ordersSourceId = 'orders-stream';

export const ordersTransformations = [
    {
        id: `transform-${ordersSourceId}-harmonize`,
        title: 'Schema Harmonize',
        intent: 'Align checkout and order payload fields into a stable commerce schema.',
        code: [
            'import pandas as pd',
            '',
            "orders = bronze_orders.rename(columns={",
            "    'id': 'order_id',",
            "    'buyer_id': 'customer_id',",
            "    'total_price': 'gross_amount'",
            '})',
            '',
            "orders['status'] = orders['status'].fillna('pending')",
            "orders['region'] = orders['region'].fillna('unknown')",
            '',
            "harmonized_orders = orders[['order_id', 'customer_id', 'gross_amount', 'region', 'status', 'created_at']]"
        ].join('\n'),
        editMode: 'intent',
        compiledCode: [
            'import pandas as pd',
            '',
            "orders = bronze_orders.rename(columns={",
            "    'id': 'order_id',",
            "    'buyer_id': 'customer_id',",
            "    'total_price': 'gross_amount'",
            '})',
            '',
            "orders['status'] = orders['status'].fillna('pending')",
            "orders['region'] = orders['region'].fillna('unknown')",
            '',
            "harmonized_orders = orders[['order_id', 'customer_id', 'gross_amount', 'region', 'status', 'created_at']]"
        ].join('\n'),
        suggestions: [
            buildSuggestion(
                'mock-orders-harmonize',
                'pne',
                'intent',
                'Promote semantic order mapping',
                'Keep customer, cart, and payment semantics stable even if raw field names drift.',
                {
                    proposedIntent: 'Align Bronze order fields by semantic meaning and preserve raw lineage for audit.'
                }
            )
        ],
        validation: buildValidation('active', [
            { name: 'schema', status: 'passed', message: 'Order fields were profiled from Bronze metadata.' },
            { name: 'safety', status: 'passed', message: 'Transformation is virtual and does not rewrite source data.' }
        ])
    },
    {
        id: `transform-${ordersSourceId}-time`,
        title: 'Temporal Alignment',
        intent: 'Normalize order creation and payment timestamps into the primary event clock.',
        code: [
            'SELECT',
            '    order_id,',
            '    customer_id,',
            '    gross_amount,',
            '    region,',
            '    status,',
            "    COALESCE(paid_at, created_at) AS event_at,",
            "    DATE_TRUNC('day', COALESCE(paid_at, created_at)) AS event_day",
            'FROM harmonized_orders'
        ].join('\n'),
        editMode: 'intent',
        compiledCode: [
            'SELECT',
            '    order_id,',
            '    customer_id,',
            '    gross_amount,',
            '    region,',
            '    status,',
            "    COALESCE(paid_at, created_at) AS event_at,",
            "    DATE_TRUNC('day', COALESCE(paid_at, created_at)) AS event_day",
            'FROM harmonized_orders'
        ].join('\n'),
        sentinelFindings: [
            buildFinding(
                'finding-orders-time-alias',
                'warning',
                'resolved',
                'Timestamp alias normalized',
                'Sentinel detected a marketplace-specific event-time alias in metadata and remapped it to the primary order clock.',
                {
                    resolution: 'PNE kept the fallback event-time inference path active so the flow does not break when the alias returns.'
                }
            )
        ],
        suggestions: [
            buildSuggestion(
                'mock-orders-time',
                'sentinel',
                'intent',
                'Keep fallback event-time inference',
                'Sentinel should leave a fallback path if a marketplace-specific timestamp appears later.',
                {
                    proposedIntent: 'Normalize known timestamps and keep late-arriving event-time inference enabled.'
                }
            )
        ],
        validation: buildValidation('active', [
            { name: 'schema', status: 'passed', message: 'Timestamp candidates were inferred from metadata.' },
            { name: 'lineage', status: 'passed', message: 'Temporal alignment preserves Bronze lineage.' }
        ])
    }
];

export const ordersGoldViews = [
    {
        id: `gold-${ordersSourceId}-core`,
        title: 'Orders Core View',
        description: 'Virtual gold view for orders, customers, and monetary fields.',
        columns: [
            { name: 'order_id', type: 'VARCHAR', semanticType: 'id' },
            { name: 'customer_id', type: 'VARCHAR', semanticType: 'id' },
            { name: 'created_at', type: 'TIMESTAMP', semanticType: 'timestamp' },
            { name: 'gross_amount', type: 'DECIMAL', semanticType: 'metric' },
            { name: 'region', type: 'VARCHAR', semanticType: 'dimension' },
            { name: 'status', type: 'VARCHAR', semanticType: 'dimension' }
        ],
        editMode: 'code',
        logic: {
            intent: 'Build the gold operational order contract from the normalized silver order stream.',
            code: [
                'SELECT',
                '    order_id,',
                '    customer_id,',
                '    event_at AS created_at,',
                '    gross_amount,',
                '    region,',
                '    status',
                'FROM silver_orders_normalized',
                "WHERE status <> 'cancelled'"
            ].join('\n'),
            compiled_code: [
                'WITH silver_orders_normalized AS (',
                '    SELECT',
                '        order_id,',
                '        customer_id,',
                '        event_at,',
                '        gross_amount,',
                '        region,',
                '        status',
                '    FROM harmonized_orders_events',
                ')',
                'SELECT',
                '    order_id,',
                '    customer_id,',
                '    event_at AS created_at,',
                '    gross_amount,',
                '    region,',
                '    status',
                'FROM silver_orders_normalized',
                "WHERE status <> 'cancelled'"
            ].join('\n')
        },
        virtualization: {
            timeWindow: '365d rolling',
            cachePolicy: 'Cache partitions older than 7d',
            incrementalStrategy: 'Recompute last 7d and reuse cached historical partitions',
            version: 'virt-orders-core@v12',
            contractRevision: 'orders-core.contract.r4',
            materializationHint: 'hybrid-cache'
        },
        suggestions: [
            buildSuggestion(
                'mock-orders-core',
                'pne',
                'intent',
                'Keep orders zero-copy',
                'Serve order analytics directly from Bronze through a virtual view.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'lineage', status: 'passed', message: 'Orders gold view is directly traceable to the normalized silver order stream.' },
            { name: 'safety', status: 'passed', message: 'No persistent copy is created.' }
        ])
    },
    {
        id: `gold-${ordersSourceId}-metrics`,
        title: 'Orders Metrics View',
        description: 'Metric-oriented virtual view for spend, conversion, and growth signals.',
        columns: [
            { name: 'customer_id', type: 'VARCHAR', semanticType: 'id' },
            { name: 'created_at', type: 'TIMESTAMP', semanticType: 'timestamp' },
            { name: 'gross_amount', type: 'DECIMAL', semanticType: 'metric' },
            { name: 'discount_amount', type: 'DECIMAL', semanticType: 'metric' },
            { name: 'region', type: 'VARCHAR', semanticType: 'dimension' }
        ],
        editMode: 'code',
        logic: {
            intent: 'Derive gold metrics features from the silver-normalized order facts.',
            code: [
                'SELECT',
                '    customer_id,',
                '    event_at AS created_at,',
                '    gross_amount,',
                '    COALESCE(discount_amount, 0) AS discount_amount,',
                '    region',
                'FROM silver_orders_normalized'
            ].join('\n'),
            compiled_code: [
                'WITH silver_orders_normalized AS (',
                '    SELECT',
                '        customer_id,',
                '        event_at,',
                '        gross_amount,',
                '        CAST(COALESCE(discount_amount, 0) AS DECIMAL(18,2)) AS discount_amount,',
                '        region',
                '    FROM harmonized_orders_events',
                ')',
                'SELECT',
                '    customer_id,',
                '    event_at AS created_at,',
                '    gross_amount,',
                '    discount_amount,',
                '    region',
                'FROM silver_orders_normalized'
            ].join('\n')
        },
        virtualization: {
            timeWindow: '365d rolling',
            cachePolicy: 'Cache partitions older than 14d',
            incrementalStrategy: 'Recompute last 14d for late discounts and reuse cached history',
            version: 'virt-orders-metrics@v9',
            contractRevision: 'orders-metrics.contract.r3',
            materializationHint: 'hybrid-cache'
        },
        sentinelFindings: [
            buildFinding(
                'finding-orders-metrics-cast',
                'warning',
                'resolved',
                'Numeric cast repaired',
                'A sampled partition exposed monetary values as strings instead of numeric fields.',
                {
                    resolution: 'Sentinel approved a cast-safe virtual projection so the contract stays stable without copying data.'
                }
            )
        ],
        suggestions: [
            buildSuggestion(
                'mock-orders-metrics',
                'sentinel',
                'intent',
                'Promote metric-ready contract',
                'Widgets and ML proposals should bind to a narrower numeric contract than the full order view.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'widget_contract', status: 'passed', message: 'Orders metrics view is ready for aggregate widgets.' },
            { name: 'schema', status: 'passed', message: 'Metric candidates were isolated from the normalized silver layer.' }
        ])
    }
];

export const ordersSourceMetadata = {
    sourceId: ordersSourceId,
    sourceName: 'Orders Stream',
    sourceType: 's3_parquet',
    uri: 's3://demo-bronze/orders_stream/',
    schedule: {
        frequency: 'hourly',
        lookbackWindow: '365d',
        refreshLag: '15m'
    },
    fingerprint: 'mock-orders-fingerprint',
    schema: ordersGoldViews[0].columns,
    sampleRows: [
        { order_id: 'o-1001', customer_id: 'c-11', gross_amount: 184.2, region: 'EMEA', status: 'paid' }
    ],
    entityKeyCandidates: ['order_id', 'customer_id'],
    timestampCandidates: ['created_at'],
    metricCandidates: ['gross_amount', 'discount_amount'],
    transformations: ordersTransformations,
    goldViews: ordersGoldViews,
    sentinelFindings: [
        buildFinding(
            'finding-orders-source-freshness',
            'warning',
            'open',
            'Freshness lag above target',
            'The latest Bronze partition is 21 minutes behind the expected arrival window for this source.',
            {
                resolution: 'Sentinel is holding freshness-sensitive recommendations until the source catches up.'
            }
        ),
        buildFinding(
            'finding-orders-source-status',
            'info',
            'resolved',
            'New status enum absorbed',
            'A new order status value appeared in metadata during sampling.',
            {
                resolution: 'PNE updated the semantic mapping without changing the raw customer data.'
            }
        )
    ],
    metadataUri: 'mock://metadata/sources/orders-stream/profile.json'
};

export const ordersConnector = {
    id: ordersSourceId,
    name: 'Orders Stream',
    type: 'db',
    status: 'ok',
    uri: 's3://demo-bronze/orders_stream/'
};

export const ordersActionType = {
    id: `action-${ordersSourceId}`,
    name: 'Virtualize Orders',
    connector_id: ordersSourceId,
    status: 'ok'
};
