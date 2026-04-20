import { createHash } from 'crypto';
import { config } from '../../config';
import { RuntimeContext } from '../../types/runtime';
import {
    ParrotArtifactStatus,
    ParrotExecutionPlan,
    ParrotExecutionScore,
    ParrotMLRecommendation,
    ParrotProjectionMaterializationPolicy,
    ParrotProjectionPlan,
    ParrotProjectionSpec,
    ParrotQuerySpec,
    ParrotRuntimeState,
    ParrotSourceProfile,
    ParrotWidgetContractRef,
    ReverseEtlStreamPlan
} from '../../types/parrot';

export class ParrotNeuralEngineService {
    private readonly translatorVersion = 'pne-local-v1';
    private readonly baseUrl = config.parrot.pneApiUrl;

    public async buildExecutionScore(ctx: RuntimeContext, requestId: string, reverseEtl: ReverseEtlStreamPlan): Promise<ParrotExecutionScore> {
        if (this.baseUrl) {
            try {
                const response = await fetch(this.resolveApiUrl('compile_execution_score'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Internal-Secret': config.worker.secret
                    },
                    body: JSON.stringify({
                        requestId,
                        context: ctx,
                        reverseEtl
                    })
                });

                const payload = await response.json().catch(() => ({}));
                if (response.ok && payload.execution_score) {
                    return payload.execution_score as ParrotExecutionScore;
                }

                console.warn(`[ParrotNeuralEngineService] Remote PNE failed with status ${response.status}. Falling back to local compiler.`);
            } catch (error: any) {
                console.warn(`[ParrotNeuralEngineService] Remote PNE unavailable. Falling back to local compiler: ${error.message}`);
            }
        }

        return this.buildLocalExecutionScore(ctx, requestId, reverseEtl);
    }

    public async compileProjectionPlan(runtimeState: ParrotRuntimeState): Promise<ParrotProjectionPlan> {
        if (this.baseUrl) {
            try {
                const response = await fetch(this.resolveApiUrl('compile_projection_plan'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Internal-Secret': config.worker.secret
                    },
                    body: JSON.stringify({
                        runtime_state: runtimeState
                    })
                });

                const payload = await response.json().catch(() => ({}));
                if (response.ok && payload.projection_plan) {
                    return payload.projection_plan as ParrotProjectionPlan;
                }

                console.warn(`[ParrotNeuralEngineService] Remote projection compiler failed with status ${response.status}. Falling back to local compiler.`);
            } catch (error: any) {
                console.warn(`[ParrotNeuralEngineService] Remote projection compiler unavailable. Falling back to local compiler: ${error.message}`);
            }
        }

        return this.buildLocalProjectionPlan(runtimeState);
    }

    private buildLocalExecutionScore(ctx: RuntimeContext, requestId: string, reverseEtl: ReverseEtlStreamPlan): ParrotExecutionScore {
        const sourceFingerprint = this.computeSourceFingerprint(ctx);
        const createdAt = new Date().toISOString();
        const sourceType = this.inferSourceType(ctx.rawSourceUris);

        return {
            metadata: {
                request_id: requestId,
                priority: 'high',
                target_latency_ms: 45000,
                runtime_mode: 'parrot_os',
                translator_version: this.translatorVersion,
                source_fingerprint: sourceFingerprint,
                created_at: createdAt
            },
            source: {
                type: sourceType,
                uri: ctx.rawSourceUris[0] || '',
                uris: ctx.rawSourceUris,
                source_names: ctx.sourceNames,
                schema_discovery: 'dynamic',
                sampling_rate: 0.05
            },
            pnc_logic: {
                virtual_silver: [
                    {
                        op: 'schema_harmonize',
                        strategy: 'dynamic_inference',
                        inputs: ctx.sourceNames.length > 0 ? ctx.sourceNames : ctx.rawSourceUris,
                        sentinel_verify: true
                    },
                    {
                        op: 'null_policy',
                        strategy: 'adaptive_imputation',
                        sentinel_verify: true
                    },
                    {
                        op: 'type_cast',
                        strategy: 'best_effort_semantic_cast',
                        sentinel_verify: true
                    }
                ],
                virtual_gold_features: [
                    {
                        op: 'derive_business_features',
                        strategy: 'adaptive_feature_bundle',
                        engine: 'daft_vectorized'
                    },
                    {
                        op: 'segment_entities',
                        strategy: 'source_aware_segmentation',
                        engine: 'daft_vectorized'
                    },
                    {
                        op: 'prepare_query_views',
                        targets: ['insights', 'dashboards', 'reverse_etl'],
                        engine: 'daft_vectorized'
                    }
                ]
            },
            analysis_goal: {
                type: 'segmentation_and_insight',
                group_by: ['source_name', 'freshness_bucket'],
                metrics: ['count(*)', 'count(distinct entity_id)', 'freshness_score'],
                transformers_options: {
                    use_cross_attention: true,
                    latent_dim: 128
                }
            },
            sentinel_constraints: {
                max_null_ratio: 0.02,
                allow_outliers: false,
                expected_distribution: 'adaptive',
                fail_on_anomaly: 'trigger_llm_replan'
            },
            infrastructure: {
                engine: 'modal_compat',
                worker_type: 'modal_sandbox',
                min_workers: 1,
                max_workers: 16,
                auto_scale: true
            },
            output_streams: {
                reverse_etl: {
                    enabled: reverseEtl.enabled,
                    vm_mode: reverseEtl.vmMode,
                    dns_txt_verification: {
                        required: reverseEtl.dnsTxtVerification.required,
                        record_name: reverseEtl.dnsTxtVerification.recordName,
                        domain: reverseEtl.dnsTxtVerification.domain,
                        verified: reverseEtl.dnsTxtVerification.verified
                    },
                    delivery_targets: reverseEtl.deliveryTargets,
                    limits: reverseEtl.limits,
                    active_vm_count: reverseEtl.activeVmCount,
                    status: reverseEtl.status
                }
            }
        };
    }

    public applyExecutionPlan(executionScore: ParrotExecutionScore, executionPlan: ParrotExecutionPlan): ParrotExecutionScore {
        return {
            ...executionScore,
            infrastructure: {
                engine: executionPlan.engine,
                worker_type: executionPlan.execution_plane === 'kubernetes_ray' ? 'ray_worker' : 'modal_sandbox',
                min_workers: executionPlan.resources.min_workers,
                max_workers: executionPlan.resources.max_workers,
                auto_scale: executionPlan.scheduler.autoscaling
            }
        };
    }

    private buildLocalProjectionPlan(runtimeState: ParrotRuntimeState): ParrotProjectionPlan {
        const projectionSpecs: ParrotProjectionSpec[] = [];
        const querySpecs: ParrotQuerySpec[] = [];
        const mlRecommendations: ParrotMLRecommendation[] = [];
        const generated: string[] = [];
        const warnings: string[] = [];

        for (const profile of runtimeState.sourceProfiles) {
            const status = this.statusForSource(profile, runtimeState);
            const sourceProjectionSpecs = this.buildProjectionSpecs(profile, runtimeState.requestId, runtimeState.compiledAt, status);
            projectionSpecs.push(...sourceProjectionSpecs);

            const primaryProjection = sourceProjectionSpecs[0];
            if (!primaryProjection) {
                warnings.push(`No projection could be compiled for ${profile.sourceName}.`);
                continue;
            }

            const sourceQuerySpecs = this.buildQuerySpecs(profile, primaryProjection, runtimeState.compiledAt, status);
            querySpecs.push(...sourceQuerySpecs);
            generated.push(...sourceQuerySpecs.map((querySpec) => querySpec.widgetType));

            const recommendation = this.buildMlRecommendation(profile, primaryProjection);
            if (recommendation) {
                mlRecommendations.push(recommendation);
                generated.push('ml_recommendation');
            } else {
                warnings.push(`ML recommendation skipped for ${profile.sourceName}: no usable metric columns.`);
            }
        }

        const required = ['technical-health', 'weather', 'metric-trend', 'ml_recommendation'];
        for (const requiredItem of required) {
            if (!generated.includes(requiredItem)) {
                warnings.push(`Coverage gap: ${requiredItem} was not generated from the discovered metadata.`);
            }
        }

        return {
            version: 1,
            requestId: runtimeState.requestId,
            compiledAt: runtimeState.compiledAt,
            translatorVersion: this.translatorVersion,
            projectionSpecs,
            querySpecs,
            mlRecommendations,
            coverage: {
                required,
                generated: Array.from(new Set(generated)),
                warnings
            },
            invalidationHints: runtimeState.invalidationHints
        };
    }

    private buildProjectionSpecs(
        profile: ParrotSourceProfile,
        requestId: string,
        compiledAt: string,
        status: ParrotArtifactStatus
    ): ParrotProjectionSpec[] {
        const materialization = this.chooseMaterialization(profile);
        const goldViews = profile.goldViews.length > 0
            ? profile.goldViews
            : [{
                id: `proj-${profile.sourceId}-raw`,
                title: `${profile.sourceName} Raw Projection`,
                description: `Projection over the raw ${profile.sourceName} data.`,
                columns: profile.schema,
                logic: {
                    intent: `Expose ${profile.sourceName} without mutating the raw data.`,
                    code: `SELECT * FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                    compiled_code: `SELECT * FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                    effective_query: `SELECT * FROM read_parquet('${this.escapeSqlString(profile.uri)}')`
                }
            }];

        return goldViews.map((goldView) => {
            const dependency = {
                sourceIds: [profile.sourceId],
                columns: goldView.columns.map((column) => column.name)
            };
            const logic = goldView.logic || {
                intent: goldView.description,
                code: `SELECT ${dependency.columns.map((column) => this.quoteIdentifier(column)).join(', ')} FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                compiled_code: `SELECT ${dependency.columns.map((column) => this.quoteIdentifier(column)).join(', ')} FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                effective_query: `SELECT ${dependency.columns.map((column) => this.quoteIdentifier(column)).join(', ')} FROM read_parquet('${this.escapeSqlString(profile.uri)}')`
            };

            return {
                projectionId: goldView.id,
                title: goldView.title,
                sourceId: profile.sourceId,
                sourceName: profile.sourceName,
                version: requestId,
                rawUri: profile.uri,
                servingUri: profile.uri,
                status,
                materialization,
                inputFingerprint: profile.fingerprint,
                specHash: this.computeHash({
                    sourceId: profile.sourceId,
                    fingerprint: profile.fingerprint,
                    columns: dependency.columns,
                    logic,
                    materialization
                }),
                dependency,
                columns: goldView.columns,
                logic,
                storageMetrics: profile.storageMetrics,
                createdAt: compiledAt
            };
        });
    }

    private buildQuerySpecs(
        profile: ParrotSourceProfile,
        projectionSpec: ParrotProjectionSpec,
        compiledAt: string,
        status: ParrotArtifactStatus
    ): ParrotQuerySpec[] {
        const specs: ParrotQuerySpec[] = [];
        const readSql = `read_parquet('${this.escapeSqlString(projectionSpec.servingUri)}')`;
        const executionPolicy = this.chooseExecutionPolicy(projectionSpec);

        specs.push(this.buildQuerySpec({
            queryId: `qry-${profile.sourceId}-volume`,
            widgetId: `ins-${profile.sourceId}-volume`,
            projectionSpec,
            sourceId: profile.sourceId,
            title: `${profile.sourceName} Volume`,
            widgetType: 'technical-health',
            sql: `SELECT COUNT(*) AS total_rows FROM ${readSql}`,
            status,
            columns: projectionSpec.dependency.columns,
            executionPolicy,
            widgetContract: {
                widgetType: 'technical-health',
                expectedShape: 'scalar',
                requiredFields: ['total_rows'],
                alignmentMode: 'strict',
                source: 'catalog_manifest'
            },
            compiledAt
        }));

        const timestampColumn = profile.timestampCandidates[0];
        if (timestampColumn) {
            specs.push(this.buildQuerySpec({
                queryId: `qry-${profile.sourceId}-freshness`,
                widgetId: `ins-${profile.sourceId}-freshness`,
                projectionSpec,
                sourceId: profile.sourceId,
                title: `${profile.sourceName} Freshness`,
                widgetType: 'weather',
                sql: `SELECT MAX(${this.quoteIdentifier(timestampColumn)}) AS latest_event_at FROM ${readSql}`,
                status,
                columns: [timestampColumn],
                executionPolicy,
                widgetContract: {
                    widgetType: 'weather',
                    expectedShape: 'scalar',
                    requiredFields: ['latest_event_at'],
                    alignmentMode: 'strict',
                    source: 'catalog_manifest'
                },
                compiledAt
            }));
        }

        const metricColumn = profile.metricCandidates[0];
        if (metricColumn && timestampColumn) {
            specs.push(this.buildQuerySpec({
                queryId: `qry-${profile.sourceId}-${this.slug(metricColumn)}-trend`,
                widgetId: `ins-${profile.sourceId}-${this.slug(metricColumn)}-trend`,
                projectionSpec,
                sourceId: profile.sourceId,
                title: `${profile.sourceName} ${metricColumn} Trend`,
                widgetType: 'metric-trend',
                sql: [
                    `SELECT DATE_TRUNC('day', ${this.quoteIdentifier(timestampColumn)}) AS period,`,
                    `       AVG(${this.quoteIdentifier(metricColumn)}) AS value`,
                    `FROM ${readSql}`,
                    `WHERE ${this.quoteIdentifier(metricColumn)} IS NOT NULL`,
                    `GROUP BY 1`,
                    `ORDER BY 1 DESC`,
                    `LIMIT 90`
                ].join('\n'),
                status,
                columns: [timestampColumn, metricColumn],
                executionPolicy,
                widgetContract: {
                    widgetType: 'metric-trend',
                    expectedShape: 'timeseries',
                    requiredFields: ['period', 'value'],
                    alignmentMode: 'strict',
                    source: 'catalog_manifest'
                },
                compiledAt
            }));
        } else if (metricColumn) {
            specs.push(this.buildQuerySpec({
                queryId: `qry-${profile.sourceId}-${this.slug(metricColumn)}-snapshot`,
                widgetId: `ins-${profile.sourceId}-${this.slug(metricColumn)}-snapshot`,
                projectionSpec,
                sourceId: profile.sourceId,
                title: `${profile.sourceName} ${metricColumn} Snapshot`,
                widgetType: 'technical-health',
                sql: `SELECT AVG(${this.quoteIdentifier(metricColumn)}) AS value FROM ${readSql} WHERE ${this.quoteIdentifier(metricColumn)} IS NOT NULL`,
                status,
                columns: [metricColumn],
                executionPolicy,
                widgetContract: {
                    widgetType: 'technical-health',
                    expectedShape: 'scalar',
                    requiredFields: ['value'],
                    alignmentMode: 'strict',
                    source: 'runtime_contract'
                },
                compiledAt
            }));
        }

        return specs;
    }

    private buildQuerySpec(input: {
        queryId: string;
        widgetId: string;
        projectionSpec: ParrotProjectionSpec;
        sourceId: string;
        title: string;
        widgetType: string;
        sql: string;
        status: ParrotArtifactStatus;
        columns: string[];
        executionPolicy: ParrotQuerySpec['executionPolicy'];
        widgetContract: ParrotWidgetContractRef;
        compiledAt: string;
    }): ParrotQuerySpec {
        return {
            queryId: input.queryId,
            widgetId: input.widgetId,
            projectionId: input.projectionSpec.projectionId,
            sourceId: input.sourceId,
            title: input.title,
            widgetType: input.widgetType,
            sql: input.sql,
            status: input.status,
            queryHash: this.computeHash({
                sql: input.sql,
                widgetType: input.widgetType,
                projectionId: input.projectionSpec.projectionId,
                inputFingerprint: input.projectionSpec.inputFingerprint
            }),
            inputFingerprint: input.projectionSpec.inputFingerprint,
            dependencies: {
                sourceIds: [input.sourceId],
                columns: input.columns,
                upstreamProjectionIds: [input.projectionSpec.projectionId]
            },
            executionPolicy: input.executionPolicy,
            widgetContract: input.widgetContract,
            compiledAt: input.compiledAt
        };
    }

    private buildMlRecommendation(profile: ParrotSourceProfile, projectionSpec: ParrotProjectionSpec): ParrotMLRecommendation | null {
        const featureColumns = profile.metricCandidates.slice(0, 6);
        if (featureColumns.length === 0) {
            return null;
        }

        const targetColumn = profile.metricCandidates[0];
        const taskType = profile.timestampCandidates.length > 0 ? 'regression' : 'clustering';
        return {
            recommendationId: `ml-${profile.sourceId}-${this.slug(targetColumn || 'cluster')}`,
            sourceId: profile.sourceId,
            projectionId: projectionSpec.projectionId,
            title: taskType === 'regression'
                ? `Forecast ${targetColumn} from ${profile.sourceName}`
                : `Cluster ${profile.sourceName} records`,
            taskType,
            status: 'recommended',
            launchMode: 'manual_approval',
            datasetUri: projectionSpec.servingUri,
            targetColumn: taskType === 'regression' ? targetColumn : undefined,
            featureColumns,
            rationale: taskType === 'regression'
                ? 'Metric and timestamp candidates were detected, so a supervised forecasting/regression workflow can be approved manually.'
                : 'Metric candidates were detected without a timestamp, so an unsupervised clustering workflow can be approved manually.',
            executor: 'ml_executor',
            request: {
                testSize: 0.2,
                randomState: 42
            }
        };
    }

    private chooseMaterialization(profile: ParrotSourceProfile): ParrotProjectionMaterializationPolicy {
        const totalBytes = profile.storageMetrics?.totalBytes || 0;
        const rowCountEstimate = profile.storageMetrics?.rowCountEstimate || 0;

        if (totalBytes > 100_000_000_000 || rowCountEstimate > 50_000_000) {
            return 'incremental_partitioned';
        }

        if (totalBytes > 5_000_000_000 || rowCountEstimate > 5_000_000) {
            return 'materialized_snapshot';
        }

        return 'virtual';
    }

    private chooseExecutionPolicy(projectionSpec: ParrotProjectionSpec): ParrotQuerySpec['executionPolicy'] {
        if (projectionSpec.materialization === 'incremental_partitioned') {
            return {
                mode: 'incremental_refresh',
                refreshStrategy: 'on_source_change'
            };
        }

        if (projectionSpec.materialization === 'materialized_snapshot') {
            return {
                mode: 'cached_result',
                refreshStrategy: 'on_projection_change'
            };
        }

        return {
            mode: 'direct',
            refreshStrategy: 'always'
        };
    }

    private statusForSource(profile: ParrotSourceProfile, runtimeState: ParrotRuntimeState): ParrotArtifactStatus {
        const critical = runtimeState.invalidationHints.some((hint) => (
            hint.severity === 'critical'
            && (hint.targetId === profile.sourceId || hint.sourceId === profile.sourceId)
        ));

        return critical ? 'invalidated' : 'active';
    }

    private computeSourceFingerprint(ctx: RuntimeContext): string {
        const hash = createHash('sha256');
        hash.update(JSON.stringify({
            uris: ctx.rawSourceUris,
            sourceNames: ctx.sourceNames,
            sourceDescriptors: ctx.sourceDescriptors?.map((descriptor) => ({
                sourceId: descriptor.sourceId,
                uri: descriptor.uri,
                cursorFingerprint: descriptor.dataCursor?.fingerprint,
                objectCount: descriptor.dataCursor?.objectCount,
                totalBytes: descriptor.dataCursor?.totalBytes,
                latestModifiedAt: descriptor.dataCursor?.latestModifiedAt
            })) || [],
            invalidatedSources: ctx.invalidatedSources || []
        }));
        return hash.digest('hex');
    }

    private computeHash(input: unknown): string {
        const hash = createHash('sha256');
        hash.update(JSON.stringify(input));
        return hash.digest('hex');
    }

    private escapeSqlString(value: string): string {
        return value.replace(/'/g, "''");
    }

    private quoteIdentifier(value: string): string {
        return `"${value.replace(/"/g, '""')}"`;
    }

    private slug(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'value';
    }

    private inferSourceType(rawSourceUris: string[]): string {
        if (rawSourceUris.length === 0) return 'unknown';
        if (rawSourceUris.every((uri) => uri.endsWith('.parquet') || uri.includes('parquet'))) return 's3_parquet';
        if (rawSourceUris.every((uri) => uri.startsWith('s3://'))) return 's3_object';
        return rawSourceUris.length > 1 ? 'multi_source' : 'direct_source';
    }

    private resolveApiUrl(path: string): string {
        const normalized = this.baseUrl.replace(/\/+$/, '');
        if (normalized.endsWith('/api/v1')) {
            return `${normalized}/${path}`;
        }

        return `${normalized}/api/v1/${path}`;
    }
}
