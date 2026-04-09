import { buildFinding, buildSuggestion, buildValidation } from './builders';
import { contactsGoldViews, contactsSourceId } from './contacts';
import { marketingGoldViews, marketingSourceId } from './marketing';
import { ordersGoldViews, ordersSourceId } from './orders';
import { warehouseGoldViews, warehouseSourceId } from './warehouse';

export const insights = [
    {
        id: `ins-${ordersSourceId}-volume`,
        title: 'Orders Volume',
        type: 'technical-health',
        widget_type: 'technical-health',
        group_id: 'grp-operational',
        status: 'active',
        activationMode: 'automatic',
        adjusted_data_columns: ['order_id', 'gross_amount', 'region'],
        query: "SELECT COUNT(*) AS total_rows FROM read_parquet('s3://demo-bronze/orders_stream/')",
        sql: "SELECT COUNT(*) AS total_rows FROM read_parquet('s3://demo-bronze/orders_stream/')",
        logic: {
            intent: 'Measure current order volume for the primary commerce stream.',
            code: "SELECT COUNT(*) AS total_rows FROM read_parquet('s3://demo-bronze/orders_stream/')",
            compiled_code: "SELECT COUNT(*) AS total_rows FROM read_parquet('s3://demo-bronze/orders_stream/')",
            effective_query: "SELECT COUNT(*) AS total_rows FROM read_parquet('s3://demo-bronze/orders_stream/')"
        },
        lineage: {
            source_keys: [ordersGoldViews[0].id]
        },
        editMode: 'code',
        suggestions: [
            buildSuggestion(
                'mock-ins-volume',
                'pne',
                'code',
                'Add rolling 24h volume',
                'A rolling window helps the user compare the raw count with recent ingestion pace.',
                {
                    proposedCode: "SELECT COUNT(*) AS total_rows_24h FROM read_parquet('s3://demo-bronze/orders_stream/') WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL 1 DAY"
                }
            )
        ],
        validation: buildValidation('active', [
            { name: 'syntax', status: 'passed', message: 'Compiled query is valid.' },
            { name: 'lineage', status: 'passed', message: 'Insight is anchored to the Orders Core View.' },
            { name: 'dry_run', status: 'pending', message: 'Dry-run should occur before a draft replaces the active query.' }
        ]),
        widgetContract: {
            widgetType: 'technical-health',
            expectedShape: 'scalar',
            requiredFields: ['total_rows'],
            alignmentMode: 'strict',
            source: 'catalog_manifest'
        }
    },
    {
        id: `ins-${ordersSourceId}-freshness`,
        title: 'Orders Freshness',
        type: 'weather',
        widget_type: 'weather',
        group_id: 'grp-operational',
        status: 'active',
        activationMode: 'automatic',
        adjusted_data_columns: ['created_at'],
        query: "SELECT MAX(created_at) AS latest_event_at FROM read_parquet('s3://demo-bronze/orders_stream/')",
        sql: "SELECT MAX(created_at) AS latest_event_at FROM read_parquet('s3://demo-bronze/orders_stream/')",
        logic: {
            intent: 'Track the freshest order event detected in the stream.',
            code: "SELECT MAX(created_at) AS latest_event_at FROM read_parquet('s3://demo-bronze/orders_stream/')",
            compiled_code: "SELECT MAX(created_at) AS latest_event_at FROM read_parquet('s3://demo-bronze/orders_stream/')",
            effective_query: "SELECT MAX(created_at) AS latest_event_at FROM read_parquet('s3://demo-bronze/orders_stream/')"
        },
        sentinelFindings: [
            buildFinding(
                'finding-ins-freshness-lag',
                'warning',
                'open',
                'Lag should be shown, not only timestamp',
                'Sentinel detected that freshness is outside the target window, but the current widget only surfaces the last event time.',
                {
                    resolution: 'PNE can extend the widget with a lag field once the recommendation is approved.'
                }
            )
        ],
        lineage: {
            source_keys: [ordersGoldViews[0].id]
        },
        editMode: 'code',
        suggestions: [
            buildSuggestion(
                'mock-ins-freshness',
                'sentinel',
                'intent',
                'Expose freshness lag',
                'Freshness becomes more actionable if the user sees the delay, not only the raw timestamp.',
                {
                    proposedIntent: 'Show the latest order timestamp and the lag since the most recent event.'
                }
            )
        ],
        validation: buildValidation('active', [
            { name: 'syntax', status: 'passed', message: 'Compiled query is valid.' },
            { name: 'widget_contract', status: 'passed', message: 'Weather widget contract is satisfied.' }
        ]),
        widgetContract: {
            widgetType: 'weather',
            expectedShape: 'scalar',
            requiredFields: ['latest_event_at'],
            alignmentMode: 'strict',
            source: 'catalog_manifest'
        }
    },
    {
        id: `ins-${contactsSourceId}-segment-overview`,
        title: 'CRM Segment Overview',
        type: 'audience-copilot',
        widget_type: 'audience-copilot',
        group_id: 'grp-operational',
        status: 'active',
        activationMode: 'automatic',
        adjusted_data_columns: ['lifecycle_stage', 'lead_score', 'owner_name'],
        query: "SELECT lifecycle_stage, AVG(lead_score) AS avg_score, COUNT(*) AS contacts FROM read_parquet('s3://demo-bronze/crm_contacts/') GROUP BY lifecycle_stage",
        sql: "SELECT lifecycle_stage, AVG(lead_score) AS avg_score, COUNT(*) AS contacts FROM read_parquet('s3://demo-bronze/crm_contacts/') GROUP BY lifecycle_stage",
        logic: {
            intent: 'Summarize CRM segments by lifecycle stage and score.',
            code: "SELECT lifecycle_stage, AVG(lead_score) AS avg_score, COUNT(*) AS contacts FROM read_parquet('s3://demo-bronze/crm_contacts/') GROUP BY lifecycle_stage",
            compiled_code: "SELECT lifecycle_stage, AVG(lead_score) AS avg_score, COUNT(*) AS contacts FROM read_parquet('s3://demo-bronze/crm_contacts/') GROUP BY lifecycle_stage",
            effective_query: "SELECT lifecycle_stage, AVG(lead_score) AS avg_score, COUNT(*) AS contacts FROM read_parquet('s3://demo-bronze/crm_contacts/') GROUP BY lifecycle_stage"
        },
        lineage: {
            source_keys: [contactsGoldViews[0].id]
        },
        editMode: 'code',
        suggestions: [
            buildSuggestion(
                'mock-ins-segment',
                'pne',
                'intent',
                'Add owner breakdown',
                'Users often want to compare lifecycle-stage performance by owner after initial segmentation.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'widget_contract', status: 'passed', message: 'Segment widget contract is satisfied.' },
            { name: 'lineage', status: 'passed', message: 'Insight uses the CRM Contacts View.' }
        ]),
        widgetContract: {
            widgetType: 'audience-copilot',
            expectedShape: 'table',
            requiredFields: ['lifecycle_stage', 'avg_score', 'contacts'],
            alignmentMode: 'strict',
            source: 'runtime_contract'
        }
    },
    {
        id: `ins-${ordersSourceId}-ml-recommendation`,
        title: 'Recommend ML for Orders',
        type: 'predictive',
        widget_type: 'predictive',
        group_id: 'grp-ml-recommended',
        status: 'recommended',
        activationMode: 'manual',
        adjusted_data_columns: ['customer_id', 'gross_amount', 'discount_amount', 'region'],
        logic: {
            intent: 'Recommend a spend-propensity or churn-risk model for the commerce flow, but keep execution manual.',
            code: 'ml_model.launch = manual_only',
            compiled_code: JSON.stringify({
                executor: 'modal_ml_executor',
                launch: 'manual_only',
                proposed_target: 'gross_amount',
                proposed_features: ['discount_amount', 'region', 'customer_id']
            }, null, 2)
        },
        sentinelFindings: [
            buildFinding(
                'finding-ins-ml-manual-gate',
                'info',
                'resolved',
                'Automatic training disabled',
                'Sentinel confirmed this ML recommendation should stay manual until a human reviews the objective and metrics.',
                {
                    resolution: 'The compiled plan keeps launch mode as manual_only.'
                }
            )
        ],
        lineage: {
            source_keys: [ordersGoldViews[1].id]
        },
        editMode: 'intent',
        suggestions: [
            buildSuggestion(
                'mock-ins-ml',
                'sentinel',
                'intent',
                'Rank model candidates by metadata only',
                'Sentinel should learn user preferences from accepted or rejected recommendations without seeing raw rows.'
            )
        ],
        validation: buildValidation('draft', [
            { name: 'schema', status: 'passed', message: 'Numeric and entity features exist for a candidate model.' },
            { name: 'safety', status: 'passed', message: 'Training is still manual.' }
        ]),
        widgetContract: {
            widgetType: 'predictive',
            expectedShape: 'table',
            requiredFields: ['model_id', 'metrics'],
            alignmentMode: 'best_effort',
            source: 'runtime_contract'
        }
    },
    {
        id: `ins-${marketingSourceId}-channel-performance`,
        title: 'Campaign Channel Performance',
        type: 'audience-copilot',
        widget_type: 'audience-copilot',
        group_id: 'grp-revenue-ops',
        status: 'active',
        activationMode: 'automatic',
        adjusted_data_columns: ['channel', 'spend', 'clicks', 'conversions'],
        query: "SELECT channel, SUM(spend) AS spend, SUM(clicks) AS clicks, SUM(conversions) AS conversions FROM read_json_auto('https://ads.internal/api/v1/performance') GROUP BY channel",
        sql: "SELECT channel, SUM(spend) AS spend, SUM(clicks) AS clicks, SUM(conversions) AS conversions FROM read_json_auto('https://ads.internal/api/v1/performance') GROUP BY channel",
        logic: {
            intent: 'Compare paid channel efficiency by spend, clicks, and conversions.',
            code: "SELECT channel, SUM(spend) AS spend, SUM(clicks) AS clicks, SUM(conversions) AS conversions FROM read_json_auto('https://ads.internal/api/v1/performance') GROUP BY channel",
            compiled_code: "SELECT channel, SUM(spend) AS spend, SUM(clicks) AS clicks, SUM(conversions) AS conversions FROM read_json_auto('https://ads.internal/api/v1/performance') GROUP BY channel",
            effective_query: "SELECT channel, SUM(spend) AS spend, SUM(clicks) AS clicks, SUM(conversions) AS conversions FROM read_json_auto('https://ads.internal/api/v1/performance') GROUP BY channel"
        },
        lineage: {
            source_keys: [marketingGoldViews[0].id]
        },
        editMode: 'code',
        suggestions: [
            buildSuggestion(
                'mock-ins-marketing-channel',
                'pne',
                'intent',
                'Add conversion rate and CPC',
                'Operators usually need efficiency ratios alongside raw spend and conversions.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'widget_contract', status: 'passed', message: 'Campaign performance fields satisfy the widget contract.' },
            { name: 'lineage', status: 'passed', message: 'Insight is anchored to the Marketing Performance View.' }
        ]),
        widgetContract: {
            widgetType: 'audience-copilot',
            expectedShape: 'table',
            requiredFields: ['channel', 'spend', 'clicks', 'conversions'],
            alignmentMode: 'strict',
            source: 'runtime_contract'
        }
    },
    {
        id: `ins-${warehouseSourceId}-revenue-quality`,
        title: 'Revenue Quality Monitor',
        type: 'technical-health',
        widget_type: 'technical-health',
        group_id: 'grp-revenue-ops',
        status: 'active',
        activationMode: 'automatic',
        adjusted_data_columns: ['mrr', 'churn_risk_band', 'expansion_score'],
        query: "SELECT SUM(mrr) AS total_mrr FROM warehouse.revenue_quality_view",
        sql: "SELECT SUM(mrr) AS total_mrr FROM warehouse.revenue_quality_view",
        logic: {
            intent: 'Track the current warehouse-backed MRR surface used by revenue ops.',
            code: "SELECT SUM(mrr) AS total_mrr FROM warehouse.revenue_quality_view",
            compiled_code: "SELECT SUM(mrr) AS total_mrr FROM warehouse.revenue_quality_view",
            effective_query: "SELECT SUM(mrr) AS total_mrr FROM warehouse.revenue_quality_view"
        },
        sentinelFindings: [
            buildFinding(
                'finding-ins-warehouse-mrr-latency',
                'warning',
                'open',
                'MRR view reflects delayed warehouse sync',
                'The finance mart is slightly behind, so this monitor should surface delay state next to total MRR.',
                {
                    resolution: 'Sentinel suggests keeping freshness metadata visible until warehouse sync stabilizes.'
                }
            )
        ],
        lineage: {
            source_keys: [warehouseGoldViews[0].id]
        },
        editMode: 'code',
        suggestions: [
            buildSuggestion(
                'mock-ins-warehouse-revenue-quality',
                'sentinel',
                'intent',
                'Add freshness badge to revenue KPI',
                'Revenue operators need to know if the number is slightly stale.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'syntax', status: 'passed', message: 'Compiled query is valid.' },
            { name: 'widget_contract', status: 'passed', message: 'Revenue KPI shape is valid.' }
        ]),
        widgetContract: {
            widgetType: 'technical-health',
            expectedShape: 'scalar',
            requiredFields: ['total_mrr'],
            alignmentMode: 'strict',
            source: 'catalog_manifest'
        }
    },
    {
        id: `ins-${warehouseSourceId}-cohort-risk`,
        title: 'Cohort Risk Overview',
        type: 'weather',
        widget_type: 'weather',
        group_id: 'grp-revenue-ops',
        status: 'active',
        activationMode: 'automatic',
        adjusted_data_columns: ['billing_month', 'mrr', 'churn_risk_band'],
        query: "SELECT billing_month, churn_risk_band, SUM(mrr) AS mrr FROM warehouse.revenue_quality_view GROUP BY billing_month, churn_risk_band",
        sql: "SELECT billing_month, churn_risk_band, SUM(mrr) AS mrr FROM warehouse.revenue_quality_view GROUP BY billing_month, churn_risk_band",
        logic: {
            intent: 'Summarize cohort revenue by billing month and churn risk band.',
            code: "SELECT billing_month, churn_risk_band, SUM(mrr) AS mrr FROM warehouse.revenue_quality_view GROUP BY billing_month, churn_risk_band",
            compiled_code: "SELECT billing_month, churn_risk_band, SUM(mrr) AS mrr FROM warehouse.revenue_quality_view GROUP BY billing_month, churn_risk_band",
            effective_query: "SELECT billing_month, churn_risk_band, SUM(mrr) AS mrr FROM warehouse.revenue_quality_view GROUP BY billing_month, churn_risk_band"
        },
        lineage: {
            source_keys: [warehouseGoldViews[0].id]
        },
        editMode: 'code',
        suggestions: [
            buildSuggestion(
                'mock-ins-cohort-risk',
                'pne',
                'intent',
                'Overlay expansion score next',
                'Risk and expansion context together make cohort reviews more actionable.'
            )
        ],
        validation: buildValidation('active', [
            { name: 'widget_contract', status: 'passed', message: 'Risk cohort widget contract is satisfied.' },
            { name: 'lineage', status: 'passed', message: 'Insight uses the Warehouse Revenue View.' }
        ]),
        widgetContract: {
            widgetType: 'weather',
            expectedShape: 'table',
            requiredFields: ['billing_month', 'churn_risk_band', 'mrr'],
            alignmentMode: 'strict',
            source: 'runtime_contract'
        }
    },
    {
        id: `ins-${ordersSourceId}-reverse-etl`,
        title: 'Recommend Reverse ETL',
        type: 'trend-spotter',
        widget_type: 'trend-spotter',
        group_id: 'grp-reverse-etl-recommended',
        status: 'recommended',
        activationMode: 'manual',
        adjusted_data_columns: ['customer_id', 'gross_amount', 'region'],
        logic: {
            intent: 'Prepare a user-owned Reverse ETL stream once DNS TXT ownership is verified.',
            code: 'reverse_etl.launch = manual_only',
            compiled_code: JSON.stringify({
                dns_verified: false,
                launch: 'manual_only',
                stop_on_errors: ['not allowed', 'too many requests'],
                active_vm_limit_without_verification: 2
            }, null, 2)
        },
        sentinelFindings: [
            buildFinding(
                'finding-ins-reverse-etl-gated',
                'warning',
                'open',
                'Reverse ETL still gated',
                'VM launch is blocked until DNS verification succeeds and the destination passes rate-limit safety rules.',
                {
                    resolution: 'Sentinel will keep the recommendation pending until ownership and error thresholds are satisfied.'
                }
            )
        ],
        lineage: {
            source_keys: [ordersGoldViews[1].id]
        },
        editMode: 'intent',
        suggestions: [
            buildSuggestion(
                'mock-ins-reverse-etl',
                'pne',
                'intent',
                'Expose delivery targets before activation',
                'The user should understand exactly where the stream will push data before a VM is launched.'
            )
        ],
        validation: buildValidation('draft', [
            { name: 'safety', status: 'passed', message: 'DNS TXT verification and rate limits still gate activation.' }
        ]),
        widgetContract: {
            widgetType: 'trend-spotter',
            expectedShape: 'table',
            requiredFields: ['target', 'status'],
            alignmentMode: 'best_effort',
            source: 'runtime_contract'
        }
    },
    {
        id: `ins-${marketingSourceId}-budget-pacing`,
        title: 'Budget Pacing Alert',
        type: 'trend-spotter',
        widget_type: 'trend-spotter',
        group_id: 'grp-revenue-ops',
        status: 'recommended',
        activationMode: 'manual',
        adjusted_data_columns: ['channel', 'spend', 'event_date'],
        logic: {
            intent: 'Recommend a pacing alert when paid channels overspend relative to conversion velocity.',
            code: 'budget_alert.launch = manual_only',
            compiled_code: JSON.stringify({
                launch: 'manual_only',
                threshold_mode: 'channel_relative',
                required_fields: ['channel', 'spend', 'conversions']
            }, null, 2)
        },
        sentinelFindings: [
            buildFinding(
                'finding-ins-budget-pacing-threshold',
                'warning',
                'open',
                'Threshold still needs review',
                'Sentinel wants a human-reviewed overspend threshold before enabling budget pacing alerts.',
                {
                    resolution: 'Recommendation remains manual until threshold policy is reviewed.'
                }
            )
        ],
        lineage: {
            source_keys: [marketingGoldViews[0].id]
        },
        editMode: 'intent',
        suggestions: [
            buildSuggestion(
                'mock-ins-budget-pacing',
                'sentinel',
                'intent',
                'Review pacing threshold by channel',
                'Different channels have different acceptable overspend envelopes.'
            )
        ],
        validation: buildValidation('draft', [
            { name: 'schema', status: 'passed', message: 'Spend and conversion fields are available for pacing logic.' },
            { name: 'safety', status: 'passed', message: 'Alerting remains manual.' }
        ]),
        widgetContract: {
            widgetType: 'trend-spotter',
            expectedShape: 'table',
            requiredFields: ['channel', 'spend'],
            alignmentMode: 'best_effort',
            source: 'runtime_contract'
        }
    }
];
