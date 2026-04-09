import { createHash } from 'crypto';
import { config } from '../../config';
import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { RuntimeContext, RuntimeSourceDescriptor } from '../../types/runtime';
import { ObjectStorageConfig } from '../../types/storage';
import {
    ParrotGoldView,
    ParrotSchemaColumn,
    ParrotSourceProfile,
    ParrotSourceTransformation
} from '../../types/parrot';
import { ObjectStorageService } from './ObjectStorageService';
import { ConnectorCatalogService } from './ConnectorCatalogService';
import { ConnectorProfileDefinition } from '../../types/connectors';

interface WorkerQueryResult {
    widgetId: string;
    data: Array<Record<string, unknown>> | null;
    error?: string | null;
}

interface WorkerExecuteResponse {
    results?: WorkerQueryResult[];
}

export class BronzeDiscoveryService {
    private readonly analyticsWorkerUrl: string;
    private readonly workerSecret: string;

    constructor(
        private readonly r2StorageService: R2StorageService,
        private readonly objectStorageService: ObjectStorageService,
        private readonly connectorCatalogService: ConnectorCatalogService
    ) {
        this.analyticsWorkerUrl = process.env.ANALYTICS_WORKER_URL || config.worker.url;
        this.workerSecret = process.env.INTERNAL_API_SECRET || config.worker.secret;
    }

    public async discoverSources(ctx: RuntimeContext): Promise<ParrotSourceProfile[]> {
        const profiles: ParrotSourceProfile[] = [];
        const descriptors: RuntimeSourceDescriptor[] = ctx.sourceDescriptors && ctx.sourceDescriptors.length > 0
            ? ctx.sourceDescriptors
            : ctx.rawSourceUris.map((uri, index) => ({
                sourceName: ctx.sourceNames[index] || `source_${index + 1}`,
                uri,
            }));

        for (let index = 0; index < descriptors.length; index += 1) {
            const descriptor = descriptors[index];
            const uri = descriptor.uri;
            const sourceName = descriptor.sourceName;
            const sourceId = descriptor.sourceId || this.slugify(sourceName);
            const connectorProfile = this.connectorCatalogService.resolveConnectorProfile(descriptor.connectorId, sourceName, uri);

            const introspection = await this.inspectSource(ctx.tenantId, ctx.projectId, sourceId, uri, descriptor.storageConfig, connectorProfile);
            const schema = introspection.schema.length > 0 ? introspection.schema : this.buildFallbackSchema(connectorProfile);
            const entityKeyCandidates = schema.filter((column) => column.semanticType === 'id').map((column) => column.name);
            const timestampCandidates = schema.filter((column) => column.semanticType === 'timestamp').map((column) => column.name);
            const metricCandidates = schema.filter((column) => column.semanticType === 'metric').map((column) => column.name);
            const transformations = this.buildTransformations(sourceId, entityKeyCandidates, timestampCandidates, metricCandidates);
            const goldViews = this.buildGoldViews(sourceId, sourceName, schema, metricCandidates);
            const fingerprint = this.computeFingerprint(uri, schema);
            const storageMetrics = await this.collectStorageMetrics(
                ctx.tenantId,
                ctx.projectId,
                sourceId,
                uri,
                descriptor.storageConfig,
                entityKeyCandidates[0]
            );

            const profile: ParrotSourceProfile = {
                sourceId,
                sourceName,
                sourceType: connectorProfile?.sourceType || descriptor.type || this.inferSourceType(uri),
                connectorId: connectorProfile?.id || descriptor.connectorId,
                connectorName: connectorProfile?.name,
                iconPath: connectorProfile?.iconPath,
                uri,
                fingerprint,
                schema,
                sampleRows: introspection.sampleRows,
                entityKeyCandidates,
                timestampCandidates,
                metricCandidates,
                transformations,
                goldViews,
                storageMetrics
            };

            const { uri: metadataUri } = await this.r2StorageService.saveJson(
                ctx.tenantId,
                ctx.projectId,
                'runtime',
                profile,
                'source-profiles',
                sourceId,
                'profile.json'
            );
            profile.metadataUri = metadataUri;
            profiles.push(profile);
        }

        return profiles;
    }

    private async inspectSource(
        tenantId: string,
        projectId: string,
        sourceId: string,
        uri: string,
        storageConfig?: ObjectStorageConfig,
        connectorProfile?: ConnectorProfileDefinition
    ): Promise<{ schema: ParrotSchemaColumn[]; sampleRows: Array<Record<string, unknown>> }> {
        try {
            const sqlUri = this.escapeSqlString(uri);
            const response = await fetch(this.analyticsWorkerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': this.workerSecret
                },
                body: JSON.stringify({
                    tenantId,
                    projectId,
                    storageConfig: this.objectStorageService.buildWorkerStorageConfig(storageConfig),
                    queries: [
                        {
                            widgetId: `${sourceId}_describe`,
                            sqlString: `DESCRIBE SELECT * FROM read_parquet('${sqlUri}')`
                        },
                        {
                            widgetId: `${sourceId}_sample`,
                            sqlString: `SELECT * FROM read_parquet('${sqlUri}') LIMIT 5`
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`analytics_worker_${response.status}`);
            }

            const payload = await response.json() as WorkerExecuteResponse;
            const schemaResult = payload.results?.find((item) => item.widgetId === `${sourceId}_describe`);
            const sampleResult = payload.results?.find((item) => item.widgetId === `${sourceId}_sample`);

            return {
                schema: this.parseSchemaRows(schemaResult?.data || [], connectorProfile),
                sampleRows: Array.isArray(sampleResult?.data) ? sampleResult!.data! : []
            };
        } catch (error) {
            console.warn(`[BronzeDiscoveryService] Falling back to heuristic discovery for ${uri}:`, error);
            return {
                schema: [],
                sampleRows: []
            };
        }
    }

    private async collectStorageMetrics(
        tenantId: string,
        projectId: string,
        sourceId: string,
        uri: string,
        storageConfig: ObjectStorageConfig | undefined,
        entityKeyCandidate?: string
    ): Promise<NonNullable<ParrotSourceProfile['storageMetrics']>> {
        const baseMetrics = await this.collectObjectMetrics(uri, storageConfig);
        const queryMetrics = await this.collectQueryMetrics(tenantId, projectId, sourceId, uri, storageConfig, entityKeyCandidate);

        return {
            ...baseMetrics,
            ...queryMetrics,
            scannedAt: new Date().toISOString(),
        };
    }

    private async collectObjectMetrics(
        uri: string,
        storageConfig?: ObjectStorageConfig
    ): Promise<Pick<NonNullable<ParrotSourceProfile['storageMetrics']>, 'objectCount' | 'totalBytes' | 'latestModifiedAt' | 'sourcePrefix'>> {
        if (!uri.startsWith('s3://') && !storageConfig) {
            return {
                objectCount: 0,
                totalBytes: 0,
                latestModifiedAt: undefined,
                sourcePrefix: undefined,
            };
        }

        try {
            const inspection = await this.objectStorageService.inspectSource({ uri, storageConfig });
            return {
                objectCount: inspection.metrics.objectCount,
                totalBytes: inspection.metrics.totalBytes,
                latestModifiedAt: inspection.metrics.latestModifiedAt,
                sourcePrefix: inspection.metrics.sourcePrefix,
            };
        } catch (error) {
            console.warn(`[BronzeDiscoveryService] Object storage metrics unavailable for ${uri}:`, error);
            return {
                objectCount: 0,
                totalBytes: 0,
                latestModifiedAt: undefined,
                sourcePrefix: undefined,
            };
        }
    }

    private async collectQueryMetrics(
        tenantId: string,
        projectId: string,
        sourceId: string,
        uri: string,
        storageConfig?: ObjectStorageConfig,
        entityKeyCandidate?: string
    ): Promise<Pick<NonNullable<ParrotSourceProfile['storageMetrics']>, 'rowCountEstimate' | 'distinctEntityCountEstimate'>> {
        try {
            const sqlUri = this.escapeSqlString(uri);
            const queries: Array<{ widgetId: string; sqlString: string }> = [
                {
                    widgetId: `${sourceId}_row_count`,
                    sqlString: `SELECT COUNT(*) AS row_count FROM read_parquet('${sqlUri}')`
                }
            ];

            if (entityKeyCandidate) {
                queries.push({
                    widgetId: `${sourceId}_distinct_entities`,
                    sqlString: `SELECT APPROX_COUNT_DISTINCT(${this.quoteIdentifier(entityKeyCandidate)}) AS distinct_entities FROM read_parquet('${sqlUri}')`
                });
            }

            const response = await fetch(this.analyticsWorkerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': this.workerSecret
                },
                body: JSON.stringify({
                    tenantId,
                    projectId,
                    storageConfig: this.objectStorageService.buildWorkerStorageConfig(storageConfig),
                    queries
                })
            });

            if (!response.ok) {
                throw new Error(`analytics_worker_${response.status}`);
            }

            const payload = await response.json() as WorkerExecuteResponse;
            const rowCount = Number(payload.results?.find((item) => item.widgetId === `${sourceId}_row_count`)?.data?.[0]?.row_count || 0);
            const distinctEntities = Number(payload.results?.find((item) => item.widgetId === `${sourceId}_distinct_entities`)?.data?.[0]?.distinct_entities || 0);

            return {
                rowCountEstimate: Number.isFinite(rowCount) ? rowCount : 0,
                distinctEntityCountEstimate: Number.isFinite(distinctEntities) ? distinctEntities : 0,
            };
        } catch (error) {
            console.warn(`[BronzeDiscoveryService] Query metrics unavailable for ${uri}:`, error);
            return {
                rowCountEstimate: 0,
                distinctEntityCountEstimate: 0,
            };
        }
    }

    private parseSchemaRows(rows: Array<Record<string, unknown>>, connectorProfile?: ConnectorProfileDefinition): ParrotSchemaColumn[] {
        return rows.map((row) => {
            const name = String(row.column_name || row.name || row.column || '').trim();
            const type = String(row.column_type || row.type || row.columnType || 'UNKNOWN').trim();

            return {
                name,
                type,
                semanticType: this.inferSemanticType(name, type, connectorProfile)
            };
        }).filter((column) => column.name.length > 0);
    }

    private inferSemanticType(name: string, type: string, connectorProfile?: ConnectorProfileDefinition): ParrotSchemaColumn['semanticType'] {
        const lowerName = name.toLowerCase();
        const lowerType = type.toLowerCase();
        const connectorField = this.matchConnectorField(name, connectorProfile);

        if (connectorField) {
            return connectorField.semanticType;
        }

        if (lowerName.endsWith('id') || lowerName.includes('_id')) return 'id';
        if (lowerName.includes('time') || lowerName.includes('date') || lowerName.endsWith('_at')) return 'timestamp';
        if (lowerType.includes('json') || lowerType.includes('struct') || lowerType.includes('map') || lowerType.includes('list')) return 'json';
        if (
            lowerType.includes('int') ||
            lowerType.includes('double') ||
            lowerType.includes('float') ||
            lowerType.includes('decimal') ||
            lowerType.includes('numeric') ||
            lowerType.includes('bigint')
        ) {
            return 'metric';
        }

        return 'dimension';
    }

    private buildTransformations(
        sourceId: string,
        entityKeyCandidates: string[],
        timestampCandidates: string[],
        metricCandidates: string[]
    ): ParrotSourceTransformation[] {
        return [
            {
                id: `transform-${sourceId}-harmonize`,
                title: 'Schema Harmonize',
                intent: 'Align incoming Bronze fields into a stable virtual schema without copying the data.',
                code: 'harmonize_schema(bronze_frame)',
                editMode: 'intent',
                compiledCode: 'harmonize_schema(bronze_frame)',
                suggestions: [
                    {
                        id: `suggest-${sourceId}-harmonize-semantic`,
                        source: 'pne',
                        mode: 'intent',
                        title: 'Promote semantic alignment',
                        rationale: 'PNE can keep this layer resilient to source drift by prioritizing semantic rather than positional mapping.',
                        proposedIntent: 'Align Bronze fields by semantic meaning, preserve original lineage, and keep a stable virtual schema.'
                    }
                ],
                validation: {
                    status: 'active',
                    checks: [
                        { name: 'schema', status: 'passed', message: 'Initial schema candidates were inferred from Bronze discovery.' },
                        { name: 'safety', status: 'passed', message: 'This transformation is virtual and does not mutate the source.' }
                    ]
                }
            },
            {
                id: `transform-${sourceId}-time`,
                title: 'Temporal Alignment',
                intent: timestampCandidates.length > 0
                    ? `Normalize time columns: ${timestampCandidates.join(', ')}`
                    : 'Infer and normalize event time when a timestamp appears later.',
                code: `normalize_timestamps(${JSON.stringify(timestampCandidates)})`,
                editMode: 'intent',
                compiledCode: `normalize_timestamps(${JSON.stringify(timestampCandidates)})`,
                suggestions: [
                    {
                        id: `suggest-${sourceId}-time-sentinel`,
                        source: 'sentinel',
                        mode: 'intent',
                        title: 'Keep late timestamp inference enabled',
                        rationale: 'Sentinel should keep this rule adaptable so the flow self-heals when new time columns appear.',
                        proposedIntent: 'Normalize known timestamps and keep event-time inference enabled for future schema drift.'
                    }
                ],
                validation: {
                    status: 'active',
                    checks: [
                        { name: 'schema', status: 'passed', message: 'Timestamp candidates were detected or a fallback inference rule is active.' },
                        { name: 'lineage', status: 'passed', message: 'Temporal alignment preserves direct lineage from Bronze columns.' }
                    ]
                }
            },
            {
                id: `transform-${sourceId}-quality`,
                title: 'Quality Guard',
                intent: metricCandidates.length > 0 || entityKeyCandidates.length > 0
                    ? 'Apply null policy, semantic casting, and key validation before serving gold views.'
                    : 'Apply generic null policy and semantic validation before serving gold views.',
                code: 'apply_quality_guards(bronze_frame)',
                editMode: 'intent',
                compiledCode: 'apply_quality_guards(bronze_frame)',
                suggestions: [
                    {
                        id: `suggest-${sourceId}-quality-sentinel`,
                        source: 'sentinel',
                        mode: 'code',
                        title: 'Add dry-run quality gate',
                        rationale: 'Sentinel can reject edits that break null policies or key assumptions before activation.',
                        proposedCode: 'apply_quality_guards(bronze_frame, dry_run=True)'
                    }
                ],
                validation: {
                    status: 'active',
                    checks: [
                        { name: 'schema', status: 'passed', message: 'Key and metric candidates were profiled for this source.' },
                        { name: 'safety', status: 'passed', message: 'Quality guards are evaluated before downstream activation.' }
                    ]
                }
            }
        ];
    }

    private buildGoldViews(sourceId: string, sourceName: string, schema: ParrotSchemaColumn[], metricCandidates: string[]): ParrotGoldView[] {
        const baseView: ParrotGoldView = {
            id: `gold-${sourceId}-core`,
            title: `${sourceName} Core View`,
            description: 'Primary queryable virtual gold view generated directly from Bronze.',
            columns: schema,
            editMode: 'code',
            logic: {
                intent: `Expose a stable query layer for ${sourceName} directly from Bronze without copying the data.`,
                code: `SELECT * FROM bronze.${sourceId}`,
                compiled_code: `SELECT * FROM bronze.${sourceId}`
            },
            suggestions: [
                {
                    id: `suggest-${sourceId}-gold-core`,
                    source: 'pne',
                    mode: 'intent',
                    title: 'Keep core gold view virtual',
                    rationale: 'PNE should compile this view from Bronze so the system stays zero-copy.',
                    proposedIntent: `Serve ${sourceName} as a virtual gold layer with stable column names and preserved lineage.`
                }
            ],
            validation: {
                status: 'active',
                checks: [
                    { name: 'lineage', status: 'passed', message: 'Gold view is derived directly from Bronze lineage.' },
                    { name: 'safety', status: 'passed', message: 'The view is virtual and does not persist duplicated data.' }
                ]
            }
        };

        if (metricCandidates.length === 0) {
            return [baseView];
        }

        return [
            baseView,
            {
                id: `gold-${sourceId}-metrics`,
                title: `${sourceName} Metrics View`,
                description: 'Metric-oriented virtual view used for groups, insights, and recommendations.',
                columns: schema.filter((column) => metricCandidates.includes(column.name)),
                editMode: 'code',
                logic: {
                    intent: `Expose the metric slice of ${sourceName} for downstream groups, widgets, and recommendations.`,
                    code: `SELECT ${metricCandidates.join(', ')} FROM bronze.${sourceId}`,
                    compiled_code: `SELECT ${metricCandidates.join(', ')} FROM bronze.${sourceId}`
                },
                suggestions: [
                    {
                        id: `suggest-${sourceId}-gold-metrics`,
                        source: 'sentinel',
                        mode: 'intent',
                        title: 'Promote metric view for widget alignment',
                        rationale: 'Widgets and ML recommendations should bind to a narrower contract than the raw core view.',
                        proposedIntent: `Keep a dedicated metric-ready view for aggregations, widgets, and model recommendations.`
                    }
                ],
                validation: {
                    status: 'active',
                    checks: [
                        { name: 'schema', status: 'passed', message: 'Metric candidates were detected and isolated into a focused view.' },
                        { name: 'widget_contract', status: 'passed', message: 'This view is suitable for aggregate-oriented widgets and insights.' }
                    ]
                }
            }
        ];
    }

    private buildFallbackSchema(connectorProfile?: ConnectorProfileDefinition): ParrotSchemaColumn[] {
        if (connectorProfile) {
            return connectorProfile.fields.map((field) => ({
                name: field.canonicalName,
                type: field.semanticType === 'timestamp'
                    ? 'TIMESTAMP'
                    : field.semanticType === 'metric'
                        ? 'DOUBLE'
                        : 'VARCHAR',
                semanticType: field.semanticType
            }));
        }

        return [
            { name: 'entity_id', type: 'VARCHAR', semanticType: 'id' },
            { name: 'event_time', type: 'TIMESTAMP', semanticType: 'timestamp' },
            { name: 'payload', type: 'JSON', semanticType: 'json' }
        ];
    }

    private inferSourceType(uri: string): string {
        if (uri.includes('parquet')) return 'parquet';
        if (uri.includes('csv')) return 'csv';
        return 'object';
    }

    private matchConnectorField(name: string, connectorProfile?: ConnectorProfileDefinition) {
        if (!connectorProfile) {
            return undefined;
        }

        const normalizedName = this.normalizeIdentifier(name);
        return connectorProfile.fields.find((field) => (
            this.normalizeIdentifier(field.canonicalName) === normalizedName
            || field.aliases.some((alias) => this.normalizeIdentifier(alias) === normalizedName)
        ));
    }

    private computeFingerprint(uri: string, schema: ParrotSchemaColumn[]): string {
        const hash = createHash('sha256');
        hash.update(JSON.stringify({ uri, schema }));
        return hash.digest('hex');
    }

    private escapeSqlString(value: string): string {
        return value.replace(/'/g, "''");
    }

    private quoteIdentifier(identifier: string): string {
        return `"${identifier.replace(/"/g, '""')}"`;
    }

    private normalizeIdentifier(value: string): string {
        return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
    }

    private slugify(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            || 'source';
    }
}
