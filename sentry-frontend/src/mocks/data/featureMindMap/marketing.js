import { buildFinding, buildSuggestion, buildValidation } from './builders';

export const marketingSourceId = 'marketing-ads';

export const marketingTransformations = [
    {
        id: `transform-${marketingSourceId}-channel-normalize`,
        title: 'Channel Normalize',
        intent: 'Normalize ad platform campaign, spend, and attribution fields into a shared demand-gen contract.',
        code: [
            'SELECT',
            '    campaign_id,',
            '    channel,',
            '    spend,',
            '    clicks,',
            '    conversions,',
            '    event_date',
            'FROM bronze.marketing_ads'
        ].join('\n'),
        editMode: 'code',
        compiledCode: [
            'WITH marketing_ads AS (',
            '    SELECT',
            '        campaign_id,',
            '        LOWER(channel) AS channel,',
            '        spend,',
            '        clicks,',
            '        conversions,',
            '        event_date',
            '    FROM bronze.marketing_ads',
            ')',
            'SELECT * FROM marketing_ads'
        ].join('\n'),
        suggestions: [
            buildSuggestion(
                'mock-marketing-channel-normalize',
                'pne',
                'intent',
                'Keep channel names consistent',
                'The same paid channel should not fork into multiple labels across widgets.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'schema', status: 'passed', message: 'Campaign and attribution fields were inferred from metadata.' },
            { name: 'safety', status: 'passed', message: 'Normalization remains virtual.' }
        ])
    }
];

export const marketingGoldViews = [
    {
        id: `gold-${marketingSourceId}-performance`,
        title: 'Marketing Performance View',
        description: 'Paid marketing performance contract for spend, clicks, and attributed conversions.',
        columns: [
            { name: 'campaign_id', type: 'VARCHAR', semanticType: 'id' },
            { name: 'channel', type: 'VARCHAR', semanticType: 'dimension' },
            { name: 'event_date', type: 'DATE', semanticType: 'timestamp' },
            { name: 'spend', type: 'DECIMAL', semanticType: 'metric' },
            { name: 'clicks', type: 'INTEGER', semanticType: 'metric' },
            { name: 'conversions', type: 'INTEGER', semanticType: 'metric' }
        ],
        editMode: 'code',
        logic: {
            intent: 'Expose a campaign performance view for paid channel analysis.',
            code: [
                'SELECT',
                '    campaign_id,',
                '    channel,',
                '    event_date,',
                '    spend,',
                '    clicks,',
                '    conversions',
                'FROM marketing_ads_normalized'
            ].join('\n'),
            compiled_code: [
                'WITH marketing_ads_normalized AS (',
                '    SELECT',
                '        campaign_id,',
                '        LOWER(channel) AS channel,',
                '        event_date,',
                '        spend,',
                '        clicks,',
                '        conversions',
                '    FROM bronze.marketing_ads',
                ')',
                'SELECT * FROM marketing_ads_normalized'
            ].join('\n')
        },
        virtualization: {
            timeWindow: '180d rolling',
            cachePolicy: 'Cache days older than 2d',
            incrementalStrategy: 'Refresh the last 2d of attribution events',
            version: 'virt-marketing-performance@v5',
            contractRevision: 'marketing-performance.contract.r2',
            materializationHint: 'hot-cache'
        },
        suggestions: [
            buildSuggestion(
                'mock-marketing-performance-view',
                'pne',
                'intent',
                'Add CAC-ready fields later',
                'This view is a good base for CAC and attribution efficiency cards.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'widget_contract', status: 'passed', message: 'Performance fields satisfy demand-gen widgets.' },
            { name: 'lineage', status: 'passed', message: 'Marketing view preserves raw campaign lineage.' }
        ])
    }
];

export const marketingSourceMetadata = {
    sourceId: marketingSourceId,
    sourceName: 'Marketing Ads',
    sourceType: 'api',
    uri: 'https://ads.internal/api/v1/performance',
    schedule: {
        frequency: 'hourly',
        lookbackWindow: '180d',
        refreshLag: '20m'
    },
    fingerprint: 'mock-marketing-fingerprint',
    schema: marketingGoldViews[0].columns,
    sampleRows: [
        { campaign_id: 'cmp-11', channel: 'paid_search', spend: 540.2, clicks: 810, conversions: 38 }
    ],
    entityKeyCandidates: ['campaign_id'],
    timestampCandidates: ['event_date'],
    metricCandidates: ['spend', 'clicks', 'conversions'],
    transformations: marketingTransformations,
    goldViews: marketingGoldViews,
    sentinelFindings: [
        buildFinding(
            'finding-marketing-attribution-window',
            'info',
            'resolved',
            'Attribution window normalized',
            'Two ad connectors reported conversions with different lookback windows.',
            {
                resolution: 'Sentinel aligned both connectors to a shared attribution window in metadata.'
            }
        )
    ],
    metadataUri: 'mock://metadata/sources/marketing-ads/profile.json'
};

export const marketingConnector = {
    id: marketingSourceId,
    name: 'Marketing Ads',
    type: 'api',
    status: 'ok',
    uri: 'https://ads.internal/api/v1/performance'
};

export const marketingActionType = {
    id: `action-${marketingSourceId}`,
    name: 'Virtualize Marketing',
    connector_id: marketingSourceId,
    status: 'ok'
};
