import { buildFinding, buildSuggestion, buildValidation } from './builders';

export const contactsSourceId = 'crm-contacts';

export const contactsTransformations = [
    {
        id: `transform-${contactsSourceId}-harmonize`,
        title: 'Identity Harmonize',
        intent: 'Unify CRM identity fields and lifecycle stages into a stable customer schema.',
        code: [
            'import pandas as pd',
            '',
            "contacts = bronze_contacts.rename(columns={",
            "    'id': 'contact_id',",
            "    'account': 'account_id',",
            "    'score': 'lead_score'",
            '})',
            '',
            "contacts['lifecycle_stage'] = contacts['lifecycle_stage'].str.lower().fillna('unknown')",
            "contacts['owner_name'] = contacts['owner_name'].fillna('unassigned')",
            '',
            "harmonized_contacts = contacts[['contact_id', 'account_id', 'first_seen_at', 'lifecycle_stage', 'owner_name', 'lead_score']]"
        ].join('\n'),
        editMode: 'intent',
        compiledCode: [
            'import pandas as pd',
            '',
            "contacts = bronze_contacts.rename(columns={",
            "    'id': 'contact_id',",
            "    'account': 'account_id',",
            "    'score': 'lead_score'",
            '})',
            '',
            "contacts['lifecycle_stage'] = contacts['lifecycle_stage'].str.lower().fillna('unknown')",
            "contacts['owner_name'] = contacts['owner_name'].fillna('unassigned')",
            '',
            "harmonized_contacts = contacts[['contact_id', 'account_id', 'first_seen_at', 'lifecycle_stage', 'owner_name', 'lead_score']]"
        ].join('\n'),
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

export const contactsGoldViews = [
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
            intent: 'Project the normalized CRM silver layer into a gold customer and lifecycle contract.',
            code: [
                'SELECT',
                '    contact_id,',
                '    account_id,',
                '    first_seen_at,',
                '    lifecycle_stage,',
                '    owner_name,',
                '    lead_score',
                'FROM silver_contacts_normalized'
            ].join('\n'),
            compiled_code: [
                'WITH silver_contacts_normalized AS (',
                '    SELECT',
                '        contact_id,',
                '        account_id,',
                '        first_seen_at,',
                '        lifecycle_stage,',
                '        owner_name,',
                '        lead_score',
                '    FROM harmonized_contacts',
                ')',
                'SELECT',
                '    contact_id,',
                '    account_id,',
                '    first_seen_at,',
                '    lifecycle_stage,',
                '    owner_name,',
                '    lead_score',
                'FROM silver_contacts_normalized'
            ].join('\n')
        },
        virtualization: {
            timeWindow: '365d rolling',
            cachePolicy: 'Cache lifecycle snapshots older than 3d',
            incrementalStrategy: 'Recompute last 3d and merge into cached customer state',
            version: 'virt-crm-contacts@v7',
            contractRevision: 'crm-contacts.contract.r2',
            materializationHint: 'stateful-cache'
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
            { name: 'lineage', status: 'passed', message: 'CRM gold view preserves lineage to the normalized silver contacts layer.' },
            { name: 'widget_contract', status: 'passed', message: 'Fields are suitable for segmentation and score widgets.' }
        ])
    }
];

export const contactsSourceMetadata = {
    sourceId: contactsSourceId,
    sourceName: 'CRM Contacts',
    sourceType: 's3_parquet',
    uri: 's3://demo-bronze/crm_contacts/',
    schedule: {
        frequency: 'daily',
        lookbackWindow: '365d',
        refreshLag: '1h'
    },
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
};

export const contactsConnector = {
    id: contactsSourceId,
    name: 'CRM Contacts',
    type: 'api',
    status: 'ok',
    uri: 's3://demo-bronze/crm_contacts/'
};

export const contactsActionType = {
    id: `action-${contactsSourceId}`,
    name: 'Virtualize CRM',
    connector_id: contactsSourceId,
    status: 'ok'
};
