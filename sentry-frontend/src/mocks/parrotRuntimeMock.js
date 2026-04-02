const buildValidation = (status, checks) => ({
    status,
    checks
});

const buildSuggestion = (id, source, mode, title, rationale, extra = {}) => ({
    id,
    source,
    mode,
    title,
    rationale,
    ...extra
});

const buildFinding = (id, severity, status, title, detail, extra = {}) => ({
    id,
    severity,
    status,
    title,
    detail,
    ...extra
});

const buildMockYaml = (manifest) => {
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

export const createParrotRuntimeMock = (projectId = 'parrot-demo') => {
    const projectLabel = projectId.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

    const ordersSourceId = 'orders-stream';
    const contactsSourceId = 'crm-contacts';

    const ordersTransformations = [
        {
            id: `transform-${ordersSourceId}-harmonize`,
            title: 'Schema Harmonize',
            intent: 'Align checkout and order payload fields into a stable commerce schema.',
            code: 'harmonize_schema(bronze_orders)',
            editMode: 'intent',
            compiledCode: 'harmonize_schema(bronze_orders)',
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
            code: 'normalize_timestamps(["created_at","paid_at"])',
            editMode: 'intent',
            compiledCode: 'normalize_timestamps(["created_at","paid_at"])',
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

    const ordersGoldViews = [
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
                intent: 'Expose a stable query layer for order operations and growth analytics.',
                code: 'SELECT * FROM bronze.orders_stream',
                compiled_code: 'SELECT * FROM bronze.orders_stream'
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
                { name: 'lineage', status: 'passed', message: 'Orders gold view is directly traceable to Bronze.' },
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
                intent: 'Expose revenue and conversion-friendly fields for widgets and ML recommendations.',
                code: 'SELECT customer_id, created_at, gross_amount, discount_amount, region FROM bronze.orders_stream',
                compiled_code: 'SELECT customer_id, created_at, gross_amount, discount_amount, region FROM bronze.orders_stream'
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
                { name: 'schema', status: 'passed', message: 'Metric candidates were isolated from metadata.' }
            ])
        }
    ];

    const contactsTransformations = [
        {
            id: `transform-${contactsSourceId}-harmonize`,
            title: 'Identity Harmonize',
            intent: 'Unify CRM identity fields and lifecycle stages into a stable customer schema.',
            code: 'harmonize_schema(bronze_contacts)',
            editMode: 'intent',
            compiledCode: 'harmonize_schema(bronze_contacts)',
            suggestions: [
                buildSuggestion(
                    'mock-contacts-harmonize',
                    'pne',
                    'intent',
                    'Keep identity graph stable',
                    'Map contact ids, account ids, and ownership fields semantically for cross-source joins.'
                )
            ],
            validation: buildValidation('active', [
                { name: 'schema', status: 'passed', message: 'Identity metadata was profiled for CRM contact fields.' },
                { name: 'safety', status: 'passed', message: 'Transformation remains virtual.' }
            ])
        }
    ];

    const contactsGoldViews = [
        {
            id: `gold-${contactsSourceId}-core`,
            title: 'CRM Contacts View',
            description: 'Virtual customer and lifecycle view aligned with the operational graph.',
            columns: [
                { name: 'contact_id', type: 'VARCHAR', semanticType: 'id' },
                { name: 'account_id', type: 'VARCHAR', semanticType: 'id' },
                { name: 'first_seen_at', type: 'TIMESTAMP', semanticType: 'timestamp' },
                { name: 'lifecycle_stage', type: 'VARCHAR', semanticType: 'dimension' },
                { name: 'owner_name', type: 'VARCHAR', semanticType: 'dimension' },
                { name: 'lead_score', type: 'DOUBLE', semanticType: 'metric' }
            ],
            editMode: 'code',
            logic: {
                intent: 'Serve customer segmentation and lifecycle analysis directly from Bronze contacts.',
                code: 'SELECT * FROM bronze.crm_contacts',
                compiled_code: 'SELECT * FROM bronze.crm_contacts'
            },
            suggestions: [
                buildSuggestion(
                    'mock-contacts-core',
                    'sentinel',
                    'intent',
                    'Keep lifecycle stage visible',
                    'Lifecycle stage is a strong semantic anchor for both groups and widget contracts.'
                )
            ],
            validation: buildValidation('active', [
                { name: 'lineage', status: 'passed', message: 'CRM gold view preserves lineage to Bronze contacts.' },
                { name: 'widget_contract', status: 'passed', message: 'Fields are suitable for segmentation and score widgets.' }
            ])
        }
    ];

    const sourceMetadata = [
        {
            sourceId: ordersSourceId,
            sourceName: 'Orders Stream',
            sourceType: 's3_parquet',
            uri: 's3://demo-bronze/orders_stream/',
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
        },
        {
            sourceId: contactsSourceId,
            sourceName: 'CRM Contacts',
            sourceType: 's3_parquet',
            uri: 's3://demo-bronze/crm_contacts/',
            fingerprint: 'mock-contacts-fingerprint',
            schema: contactsGoldViews[0].columns,
            sampleRows: [
                { contact_id: 'ct-92', account_id: 'acc-3', lifecycle_stage: 'expansion', lead_score: 0.88 }
            ],
            entityKeyCandidates: ['contact_id', 'account_id'],
            timestampCandidates: ['first_seen_at'],
            metricCandidates: ['lead_score'],
            transformations: contactsTransformations,
            goldViews: contactsGoldViews,
            sentinelFindings: [
                buildFinding(
                    'finding-contacts-owner-normalized',
                    'info',
                    'resolved',
                    'Owner field normalized',
                    'Ownership metadata arrived under two CRM aliases during discovery.',
                    {
                        resolution: 'Sentinel aligned both aliases to a single owner dimension for downstream widgets.'
                    }
                )
            ],
            metadataUri: 'mock://metadata/sources/crm-contacts/profile.json'
        }
    ];

    const groups = [
        {
            id: 'grp-operational',
            name: 'operational',
            title: 'Operational Intelligence',
            status: 'active',
            color: 'default',
            activationMode: 'automatic',
            sourceIds: [ordersSourceId, contactsSourceId],
            adjusted_data_ids: ordersGoldViews.concat(contactsGoldViews).map((view) => view.id),
            editMode: 'intent',
            logic: {
                intent: 'Combine validated gold views into the default operational lens for the project.'
            },
            suggestions: [
                buildSuggestion(
                    'mock-group-operational',
                    'pne',
                    'intent',
                    'Keep operational lane always visible',
                    'The first layer should expose useful live analytics as soon as discovery succeeds.'
                )
            ],
            validation: buildValidation('active', [
                { name: 'lineage', status: 'passed', message: 'Operational group only references validated gold views.' },
                { name: 'safety', status: 'passed', message: 'Outputs are analytical and non-destructive.' }
            ])
        },
        {
            id: 'grp-ml-recommended',
            name: 'ml-recommended',
            title: 'ML Recommended',
            status: 'recommended',
            color: 'blue',
            activationMode: 'manual',
            sourceIds: [ordersSourceId, contactsSourceId],
            adjusted_data_ids: [ordersGoldViews[1].id, contactsGoldViews[0].id],
            editMode: 'intent',
            logic: {
                intent: 'Recommend candidate ML workloads but keep launch manual.'
            },
            suggestions: [
                buildSuggestion(
                    'mock-group-ml',
                    'sentinel',
                    'intent',
                    'Require reviewed objective before launch',
                    'Models should only run after the user reviews target, features, and expected metrics.'
                )
            ],
            validation: buildValidation('draft', [
                { name: 'schema', status: 'passed', message: 'Enough metric and entity signals exist for model recommendations.' },
                { name: 'safety', status: 'passed', message: 'Training remains manual.' }
            ])
        },
        {
            id: 'grp-reverse-etl-recommended',
            name: 'reverse-etl-recommended',
            title: 'Reverse ETL Recommended',
            status: 'recommended',
            color: 'blue',
            activationMode: 'manual',
            sourceIds: [ordersSourceId],
            adjusted_data_ids: [ordersGoldViews[1].id],
            editMode: 'intent',
            logic: {
                intent: 'Recommend output streams only after DNS ownership and rate-limit checks pass.'
            },
            sentinelFindings: [
                buildFinding(
                    'finding-group-reverse-etl-dns',
                    'warning',
                    'open',
                    'DNS ownership not verified',
                    'Reverse ETL launch is blocked until the customer publishes the TXT record for the owned domain.',
                    {
                        resolution: 'Sentinel will only allow the recommendation to move forward after DNS proof and VM guardrails pass.'
                    }
                )
            ],
            suggestions: [
                buildSuggestion(
                    'mock-group-reverse-etl',
                    'sentinel',
                    'intent',
                    'Block activation until ownership is verified',
                    'Reverse ETL should wait for DNS TXT verification, VM limits, and delivery safety checks.'
                )
            ],
            validation: buildValidation('draft', [
                { name: 'safety', status: 'passed', message: 'Reverse ETL remains blocked until DNS TXT verification succeeds.' }
            ])
        }
    ];

    const insights = [
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
        }
    ];

    const manifest = {
        version: '1.0',
        runtime: {
            mode: 'parrot_os',
            executionEngine: 'modal',
            decisionEngine: 'parrot_neural_engine + sentinel',
            mlLaunchPolicy: 'manual_recommended'
        },
        editing: {
            supportedModes: ['intent', 'code'],
            sentinelGuard: 'Sentinel validates structural, semantic, and safety constraints before applying intent or code edits.',
            lifecycle: ['draft', 'compile', 'dry_run', 'sentinel_validate', 'activate'],
            layerPolicies: {
                sources: { supportedModes: ['intent'], submissionMode: 'draft_patch' },
                transformations: { supportedModes: ['intent', 'code'], submissionMode: 'draft_patch' },
                gold: { supportedModes: ['intent', 'code'], submissionMode: 'draft_patch' },
                groups: { supportedModes: ['intent'], submissionMode: 'draft_patch' },
                insights: { supportedModes: ['intent', 'code'], submissionMode: 'draft_patch' }
            },
            widgetContracts: {
                policy: 'Every widget query must align with the widget data structure before it can become active.',
                enforcement: ['query_shape', 'field_requirements', 'fallback_template']
            },
            feedbackLoop: {
                mode: 'metadata_only',
                automaticExecution: false,
                learningScope: 'Sentinel can learn from accepted or rejected edits, activations, and source archetypes without storing raw customer data.'
            }
        },
        layers: {
            sources: sourceMetadata.map((source) => ({
                id: source.sourceId,
                name: source.sourceName,
                type: source.sourceType,
                uri: source.uri,
                metadata_uri: source.metadataUri
            })),
            transformations: {
                [ordersSourceId]: ordersTransformations,
                [contactsSourceId]: contactsTransformations
            },
            gold: {
                [ordersSourceId]: ordersGoldViews,
                [contactsSourceId]: contactsGoldViews
            },
            groups,
            insights
        }
    };

    return {
        connector: [
            { id: ordersSourceId, name: 'Orders Stream', type: 'db', status: 'ok', uri: 's3://demo-bronze/orders_stream/' },
            { id: contactsSourceId, name: 'CRM Contacts', type: 'api', status: 'ok', uri: 's3://demo-bronze/crm_contacts/' }
        ],
        actionType: [
            { id: `action-${ordersSourceId}`, name: 'Virtualize Orders', connector_id: ordersSourceId, status: 'ok' },
            { id: `action-${contactsSourceId}`, name: 'Virtualize CRM', connector_id: contactsSourceId, status: 'ok' }
        ],
        origin: [],
        adjustedData: [
            {
                id: ordersGoldViews[0].id,
                name: ordersGoldViews[0].title,
                title: ordersGoldViews[0].title,
                origin_id: ordersSourceId,
                action_type_id: `action-${ordersSourceId}`,
                status: 'ok',
                columns: ordersGoldViews[0].columns.map((column) => ({
                    id: `${ordersGoldViews[0].id}-${column.name}`,
                    name: column.name,
                    title: column.name,
                    type: column.type,
                    status: 'ok'
                }))
            },
            {
                id: ordersGoldViews[1].id,
                name: ordersGoldViews[1].title,
                title: ordersGoldViews[1].title,
                origin_id: ordersSourceId,
                action_type_id: `action-${ordersSourceId}`,
                status: 'ok',
                columns: ordersGoldViews[1].columns.map((column) => ({
                    id: `${ordersGoldViews[1].id}-${column.name}`,
                    name: column.name,
                    title: column.name,
                    type: column.type,
                    status: 'ok'
                }))
            },
            {
                id: contactsGoldViews[0].id,
                name: contactsGoldViews[0].title,
                title: contactsGoldViews[0].title,
                origin_id: contactsSourceId,
                action_type_id: `action-${contactsSourceId}`,
                status: 'ok',
                columns: contactsGoldViews[0].columns.map((column) => ({
                    id: `${contactsGoldViews[0].id}-${column.name}`,
                    name: column.name,
                    title: column.name,
                    type: column.type,
                    status: 'ok'
                }))
            }
        ],
        group: groups.map((entry) => ({
            ...entry,
            status: entry.status === 'recommended' ? 'warning' : 'ok',
            activation_mode: entry.activationMode
        })),
        insight: insights.map((entry) => ({
            ...entry,
            status: entry.status === 'recommended' ? 'warning' : 'ok',
            grid_span: 'col-span-1',
            color_theme: entry.status === 'recommended' ? 'theme-productivity' : 'theme-audience',
            footerText: entry.activationMode === 'manual' ? 'Manual activation' : 'Auto',
            footerBottom: entry.editMode === 'code' ? 'Editable as code' : 'Editable as intent'
        })),
        mindmapManifest: manifest,
        mindmapYaml: buildMockYaml(manifest),
        sourceMetadata,
        metrics: {
            precision: 0.91,
            recall: 0.84,
            roi: 4.2
        },
        features: [
            { name: 'gross_amount', val: 0.33 },
            { name: 'lead_score', val: 0.24 },
            { name: 'region', val: 0.18 },
            { name: 'lifecycle_stage', val: 0.15 }
        ],
        meta: {
            isMock: true,
            fallbackReason: 'server_unavailable',
            projectLabel
        }
    };
};
