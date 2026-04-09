import { ConnectorCatalogEntry, ConnectorFieldDefinition, ConnectorProfileDefinition } from '../../types/connectors';

const CONNECTOR_ICON_BASE = '/connector-assets/icons';

const buildIconPath = (filename: string): string => `${CONNECTOR_ICON_BASE}/${filename}`;

const buildFields = (fields: ConnectorFieldDefinition[]): ConnectorFieldDefinition[] => fields;

const SUPPORTED_PROFILES: ConnectorProfileDefinition[] = [
    {
        id: 'ga4',
        name: 'GA4',
        iconPath: buildIconPath('ga4.png'),
        sourceType: 'ga4',
        description: 'Events and ecommerce exports from Google Analytics 4.',
        fields: buildFields([
            { canonicalName: 'event_timestamp', label: 'Event Timestamp', semanticType: 'timestamp', aliases: ['event_timestamp', 'event_date', 'event_time', 'datehour'], required: true },
            { canonicalName: 'user_pseudo_id', label: 'User ID', semanticType: 'id', aliases: ['user_pseudo_id', 'user_id', 'ga_session_id', 'stream_id'] },
            { canonicalName: 'event_name', label: 'Event Name', semanticType: 'dimension', aliases: ['event_name'] },
            { canonicalName: 'session_source', label: 'Session Source', semanticType: 'dimension', aliases: ['session_source', 'source', 'traffic_source_source'] },
            { canonicalName: 'sessions', label: 'Sessions', semanticType: 'metric', aliases: ['sessions', 'ga_sessions', 'session_count'] },
            { canonicalName: 'total_revenue', label: 'Revenue', semanticType: 'metric', aliases: ['totalrevenue', 'purchase_revenue', 'event_value_in_usd', 'revenue'] }
        ])
    },
    {
        id: 'facebook_ads',
        name: 'Facebook Ads',
        iconPath: buildIconPath('facebook-ads.png'),
        sourceType: 'facebook_ads',
        description: 'Campaign, ad set, ad, spend, clicks, and conversion exports from Meta Ads.',
        fields: buildFields([
            { canonicalName: 'date_start', label: 'Date', semanticType: 'timestamp', aliases: ['date_start', 'date_stop', 'date', 'report_date'], required: true },
            { canonicalName: 'campaign_id', label: 'Campaign ID', semanticType: 'id', aliases: ['campaign_id', 'adset_id', 'ad_id'], required: true },
            { canonicalName: 'campaign_name', label: 'Campaign Name', semanticType: 'dimension', aliases: ['campaign_name', 'adset_name', 'ad_name'] },
            { canonicalName: 'spend', label: 'Spend', semanticType: 'metric', aliases: ['spend', 'amount_spent'], required: true },
            { canonicalName: 'clicks', label: 'Clicks', semanticType: 'metric', aliases: ['clicks', 'inline_link_clicks'] },
            { canonicalName: 'impressions', label: 'Impressions', semanticType: 'metric', aliases: ['impressions', 'reach'] }
        ])
    },
    {
        id: 'shopify',
        name: 'Shopify',
        iconPath: buildIconPath('shopify.png'),
        sourceType: 'shopify',
        description: 'Orders, line items, customers, refunds, and catalog exports from Shopify.',
        fields: buildFields([
            { canonicalName: 'order_id', label: 'Order ID', semanticType: 'id', aliases: ['order_id', 'id', 'admin_graphql_api_id'], required: true },
            { canonicalName: 'created_at', label: 'Created At', semanticType: 'timestamp', aliases: ['created_at', 'processed_at', 'updated_at'], required: true },
            { canonicalName: 'customer_id', label: 'Customer ID', semanticType: 'id', aliases: ['customer_id', 'customer.id', 'customer_admin_graphql_api_id'] },
            { canonicalName: 'financial_status', label: 'Financial Status', semanticType: 'dimension', aliases: ['financial_status', 'fulfillment_status'] },
            { canonicalName: 'total_price', label: 'Total Price', semanticType: 'metric', aliases: ['total_price', 'current_total_price', 'subtotal_price', 'gross_sales'], required: true },
            { canonicalName: 'currency', label: 'Currency', semanticType: 'dimension', aliases: ['currency', 'presentment_currency'] }
        ])
    },
    {
        id: 'tiktok_ads',
        name: 'TikTok Ads',
        iconPath: buildIconPath('tiktok-ads.png'),
        sourceType: 'tiktok_ads',
        description: 'Spend, impressions, clicks, conversions, and campaign breakdowns from TikTok Ads.',
        fields: buildFields([
            { canonicalName: 'stat_time_day', label: 'Stat Date', semanticType: 'timestamp', aliases: ['stat_time_day', 'date', 'report_date'], required: true },
            { canonicalName: 'campaign_id', label: 'Campaign ID', semanticType: 'id', aliases: ['campaign_id', 'adgroup_id', 'ad_id'], required: true },
            { canonicalName: 'campaign_name', label: 'Campaign Name', semanticType: 'dimension', aliases: ['campaign_name', 'adgroup_name', 'ad_name'] },
            { canonicalName: 'spend', label: 'Spend', semanticType: 'metric', aliases: ['spend', 'cost'], required: true },
            { canonicalName: 'clicks', label: 'Clicks', semanticType: 'metric', aliases: ['clicks', 'ctr_clicks'] },
            { canonicalName: 'impressions', label: 'Impressions', semanticType: 'metric', aliases: ['impressions'] }
        ])
    },
    {
        id: 'stripe',
        name: 'Stripe',
        iconPath: buildIconPath('stripe.png'),
        sourceType: 'stripe',
        description: 'Payments, invoices, subscriptions, MRR, and customer billing events from Stripe.',
        fields: buildFields([
            { canonicalName: 'payment_intent_id', label: 'Payment Intent ID', semanticType: 'id', aliases: ['payment_intent_id', 'charge_id', 'invoice_id', 'subscription_id', 'customer_id'], required: true },
            { canonicalName: 'created', label: 'Created At', semanticType: 'timestamp', aliases: ['created', 'created_at', 'invoice_created', 'period_start'], required: true },
            { canonicalName: 'status', label: 'Status', semanticType: 'dimension', aliases: ['status', 'invoice_status', 'subscription_status'] },
            { canonicalName: 'amount', label: 'Amount', semanticType: 'metric', aliases: ['amount', 'amount_paid', 'amount_due', 'mrr', 'arr'], required: true },
            { canonicalName: 'currency', label: 'Currency', semanticType: 'dimension', aliases: ['currency'] },
            { canonicalName: 'customer_email', label: 'Customer Email', semanticType: 'dimension', aliases: ['customer_email', 'email'] }
        ])
    },
    {
        id: 'hubspot',
        name: 'HubSpot',
        iconPath: buildIconPath('hubspot.png'),
        sourceType: 'hubspot',
        description: 'Contacts, companies, deals, lifecycle stages, and CRM activity exports from HubSpot.',
        fields: buildFields([
            { canonicalName: 'hs_object_id', label: 'Object ID', semanticType: 'id', aliases: ['hs_object_id', 'contact_id', 'deal_id', 'company_id'], required: true },
            { canonicalName: 'createdate', label: 'Created Date', semanticType: 'timestamp', aliases: ['createdate', 'closedate', 'hs_lastmodifieddate'], required: true },
            { canonicalName: 'dealstage', label: 'Deal Stage', semanticType: 'dimension', aliases: ['dealstage', 'lifecyclestage', 'pipeline'] },
            { canonicalName: 'dealname', label: 'Deal Name', semanticType: 'dimension', aliases: ['dealname', 'deal_name', 'company', 'hs_lead_name'] },
            { canonicalName: 'amount', label: 'Amount', semanticType: 'metric', aliases: ['amount', 'annualrevenue', 'mrr', 'hs_arr'], required: true },
            { canonicalName: 'email', label: 'Email', semanticType: 'dimension', aliases: ['email'] }
        ])
    }
];

const CAPABILITY_ENTRIES: ConnectorCatalogEntry[] = [
    {
        id: 'object-storage-s3-compatible',
        name: 'S3 / R2 Object Storage',
        description: 'Connect a customer-owned S3-compatible bucket and discover datasets directly from landed files.',
        category: 'object_storage',
        supportLevel: 'ready',
        sourceType: 'parquet',
        connectionStrategy: 'user_owned_storage',
        frontendAction: 'configure_object_storage',
        discoveryMode: 'bucket_prefix_scan',
        requiresCredentials: true,
        supportsAutoDiscovery: true,
        supportsRuntimeRefresh: true,
        iconPath: buildIconPath('object-storage.png'),
        supportedProfiles: SUPPORTED_PROFILES,
        notes: [
            'Best fit for BYOB when AppFlow, Data Exchange, Fivetran, Airbyte, or internal jobs already land files in a bucket.',
            'Pick a connector profile when you know the source system so discovery can map fields into the mindmap more accurately.'
        ]
    },
    {
        id: 'managed-landing-zone',
        name: 'Managed Landing Zone',
        description: 'We manage ingestion into an object-storage landing zone, then run the same zero-ETL discovery flow.',
        category: 'managed_ingestion',
        supportLevel: 'assisted',
        sourceType: 'parquet',
        connectionStrategy: 'managed_bucket_landing',
        frontendAction: 'ops_assisted',
        discoveryMode: 'landing_zone_scan',
        requiresCredentials: false,
        supportsAutoDiscovery: true,
        supportsRuntimeRefresh: true,
        iconPath: buildIconPath('managed-landing-zone.png'),
        supportedProfiles: SUPPORTED_PROFILES,
        notes: [
            'Works today when data lands in the agreed bucket or prefix and a runtime trigger is configured.',
            'GA4, Facebook Ads, Shopify, TikTok Ads, Stripe, and HubSpot can already use dedicated schema hints once the landed files are connected.'
        ]
    },
    {
        id: 'postgres-direct',
        name: 'Postgres Database',
        description: 'Direct database connectivity for discovery without an intermediate landing bucket.',
        category: 'database',
        supportLevel: 'planned',
        sourceType: 'postgres',
        connectionStrategy: 'direct_database',
        frontendAction: 'coming_soon',
        discoveryMode: 'manual_registration',
        requiresCredentials: true,
        supportsAutoDiscovery: false,
        supportsRuntimeRefresh: false,
        iconPath: buildIconPath('postgres.png'),
        notes: [
            'The current analytics worker is optimized for object storage scans and does not yet execute direct Postgres discovery.',
            'Near-term recommendation is to land extracts into object storage and run zero-ETL projections from there.'
        ]
    },
    {
        id: 'kafka-direct',
        name: 'Kafka / Event Streams',
        description: 'Direct streaming discovery from topics and schemas without first landing batches to storage.',
        category: 'streaming',
        supportLevel: 'planned',
        sourceType: 'kafka',
        connectionStrategy: 'streaming_topic',
        frontendAction: 'coming_soon',
        discoveryMode: 'not_available',
        requiresCredentials: true,
        supportsAutoDiscovery: false,
        supportsRuntimeRefresh: false,
        iconPath: buildIconPath('kafka.png'),
        notes: [
            'The current runtime expects files in object storage, not live topic readers.',
            'For now, stream sinks should land parquet or JSON snapshots into a bucket and then use storage discovery.'
        ]
    }
];

export class ConnectorCatalogService {
    public listCatalog(): ConnectorCatalogEntry[] {
        return CAPABILITY_ENTRIES;
    }

    public getConnectorProfile(connectorId?: string): ConnectorProfileDefinition | undefined {
        if (!connectorId) {
            return undefined;
        }

        return SUPPORTED_PROFILES.find((profile) => profile.id === connectorId);
    }

    public resolveConnectorProfile(connectorId: string | undefined, sourceName: string, uri: string): ConnectorProfileDefinition | undefined {
        if (connectorId) {
            return this.getConnectorProfile(connectorId);
        }

        const haystack = `${sourceName} ${uri}`.toLowerCase();
        return SUPPORTED_PROFILES.find((profile) => {
            const normalizedId = profile.id.replace(/_/g, ' ');
            const normalizedName = profile.name.toLowerCase();
            return haystack.includes(normalizedId) || haystack.includes(normalizedName);
        });
    }
}
