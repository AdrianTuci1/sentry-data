import { buildAdjustedDataEntry, buildMockYaml } from './builders';
import { contactsActionType, contactsConnector, contactsGoldViews, contactsSourceId, contactsSourceMetadata, contactsTransformations } from './contacts';
import { groups } from './groups';
import { insights } from './insights';
import { marketingActionType, marketingConnector, marketingGoldViews, marketingSourceId, marketingSourceMetadata, marketingTransformations } from './marketing';
import { ordersActionType, ordersConnector, ordersGoldViews, ordersSourceId, ordersSourceMetadata, ordersTransformations } from './orders';
import { warehouseActionType, warehouseConnector, warehouseGoldViews, warehouseSourceId, warehouseSourceMetadata, warehouseTransformations } from './warehouse';

const sourceMetadata = [
    ordersSourceMetadata,
    contactsSourceMetadata,
    marketingSourceMetadata,
    warehouseSourceMetadata
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
            [contactsSourceId]: contactsTransformations,
            [marketingSourceId]: marketingTransformations,
            [warehouseSourceId]: warehouseTransformations
        },
        gold: {
            [ordersSourceId]: ordersGoldViews,
            [contactsSourceId]: contactsGoldViews,
            [marketingSourceId]: marketingGoldViews,
            [warehouseSourceId]: warehouseGoldViews
        },
        groups,
        insights
    }
};

const buildRuntimePayload = (projectLabel, overrides = {}) => ({
    connector: [
        ordersConnector,
        contactsConnector,
        marketingConnector,
        warehouseConnector
    ],
    actionType: [
        ordersActionType,
        contactsActionType,
        marketingActionType,
        warehouseActionType
    ],
    origin: [],
    adjustedData: [
        buildAdjustedDataEntry(ordersGoldViews[0], ordersSourceId),
        buildAdjustedDataEntry(ordersGoldViews[1], ordersSourceId),
        buildAdjustedDataEntry(contactsGoldViews[0], contactsSourceId),
        buildAdjustedDataEntry(marketingGoldViews[0], marketingSourceId),
        buildAdjustedDataEntry(warehouseGoldViews[0], warehouseSourceId)
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
    },
    ...overrides
});

export const getParrotRuntimeMockPlaybackStages = () => ([
    { label: 'Initializing workspace', durationMs: 1800 },
    { label: 'Discovering sources', durationMs: 2200 },
    { label: 'Profiling commerce layer', durationMs: 2600 },
    { label: 'Joining CRM discovery', durationMs: 2400 },
    { label: 'Expanding revenue ops', durationMs: 2800 },
    { label: 'Surfacing recommendations', durationMs: 2200 }
]);

export const createParrotRuntimeMockPlaybackStep = (projectId = 'parrot-demo', stage = 0) => {
    const projectLabel = projectId.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    const fullData = buildRuntimePayload(projectLabel);
    const stageConfigs = [
        {
            label: 'Initializing workspace',
            connectorIds: [],
            adjustedIds: [],
            groupIds: [],
            insightIds: []
        },
        {
            label: 'Discovering sources',
            connectorIds: [ordersSourceId, contactsSourceId],
            adjustedIds: [],
            groupIds: [],
            insightIds: []
        },
        {
            label: 'Profiling commerce layer',
            connectorIds: [ordersSourceId, contactsSourceId],
            adjustedIds: [ordersGoldViews[0].id, ordersGoldViews[1].id],
            groupIds: ['grp-operational'],
            insightIds: [
                `ins-${ordersSourceId}-volume`,
                `ins-${ordersSourceId}-freshness`
            ]
        },
        {
            label: 'Joining CRM discovery',
            connectorIds: [ordersSourceId, contactsSourceId],
            adjustedIds: [ordersGoldViews[0].id, ordersGoldViews[1].id, contactsGoldViews[0].id],
            groupIds: ['grp-operational'],
            insightIds: [
                `ins-${ordersSourceId}-volume`,
                `ins-${ordersSourceId}-freshness`,
                `ins-${contactsSourceId}-segment-overview`
            ]
        },
        {
            label: 'Expanding revenue ops',
            connectorIds: [ordersSourceId, contactsSourceId, marketingSourceId, warehouseSourceId],
            adjustedIds: [
                ordersGoldViews[0].id,
                ordersGoldViews[1].id,
                contactsGoldViews[0].id,
                marketingGoldViews[0].id,
                warehouseGoldViews[0].id
            ],
            groupIds: ['grp-operational', 'grp-revenue-ops'],
            insightIds: [
                `ins-${ordersSourceId}-volume`,
                `ins-${ordersSourceId}-freshness`,
                `ins-${contactsSourceId}-segment-overview`,
                `ins-${marketingSourceId}-channel-performance`,
                `ins-${warehouseSourceId}-revenue-quality`,
                `ins-${warehouseSourceId}-cohort-risk`
            ]
        },
        {
            label: 'Surfacing recommendations',
            connectorIds: [ordersSourceId, contactsSourceId, marketingSourceId, warehouseSourceId],
            adjustedIds: [
                ordersGoldViews[0].id,
                ordersGoldViews[1].id,
                contactsGoldViews[0].id,
                marketingGoldViews[0].id,
                warehouseGoldViews[0].id
            ],
            groupIds: ['grp-operational', 'grp-revenue-ops', 'grp-ml-recommended', 'grp-reverse-etl-recommended'],
            insightIds: fullData.insight.map((entry) => entry.id)
        }
    ];

    const safeStage = Math.max(0, Math.min(stage, stageConfigs.length - 1));
    const config = stageConfigs[safeStage];
    const connectorIdSet = new Set(config.connectorIds);
    const adjustedIdSet = new Set(config.adjustedIds);
    const groupIdSet = new Set(config.groupIds);
    const insightIdSet = new Set(config.insightIds);
    const filteredManifest = {
        ...manifest,
        layers: {
            ...manifest.layers,
            sources: manifest.layers.sources.filter((entry) => connectorIdSet.has(entry.id)),
            transformations: Object.fromEntries(
                Object.entries(manifest.layers.transformations).filter(([sourceId]) => connectorIdSet.has(sourceId))
            ),
            gold: Object.fromEntries(
                Object.entries(manifest.layers.gold)
                    .map(([sourceId, views]) => [sourceId, views.filter((entry) => adjustedIdSet.has(entry.id))])
                    .filter(([, views]) => views.length > 0)
            ),
            groups: manifest.layers.groups.filter((entry) => groupIdSet.has(entry.id)),
            insights: manifest.layers.insights.filter((entry) => insightIdSet.has(entry.id))
        }
    };

    return buildRuntimePayload(projectLabel, {
        connector: fullData.connector.filter((entry) => connectorIdSet.has(entry.id)),
        actionType: fullData.actionType.filter((entry) => connectorIdSet.has(entry.connector_id)),
        adjustedData: fullData.adjustedData.filter((entry) => adjustedIdSet.has(entry.id)),
        group: fullData.group.filter((entry) => groupIdSet.has(entry.id)),
        insight: fullData.insight.filter((entry) => insightIdSet.has(entry.id)),
        sourceMetadata: fullData.sourceMetadata.filter((entry) => connectorIdSet.has(entry.sourceId)),
        mindmapManifest: filteredManifest,
        mindmapYaml: buildMockYaml(filteredManifest),
        meta: {
            ...fullData.meta,
            discoveryPlayback: {
                stage: safeStage,
                totalStages: stageConfigs.length,
                label: config.label,
                isComplete: safeStage === stageConfigs.length - 1
            }
        }
    });
};

export const createParrotRuntimeMock = (projectId = 'parrot-demo') => (
    createParrotRuntimeMockPlaybackStep(projectId, getParrotRuntimeMockPlaybackStages().length - 1)
);
