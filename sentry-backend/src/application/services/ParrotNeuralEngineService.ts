import { createHash } from 'crypto';
import { config } from '../../config';
import { RuntimeContext } from '../../types/runtime';
import { ParrotExecutionPlan, ParrotExecutionScore, ReverseEtlStreamPlan } from '../../types/parrot';

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

    private buildLocalExecutionScore(ctx: RuntimeContext, requestId: string, reverseEtl: ReverseEtlStreamPlan): ParrotExecutionScore {
        const sourceFingerprint = this.computeSourceFingerprint(ctx.rawSourceUris, ctx.sourceNames);
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

    private computeSourceFingerprint(rawSourceUris: string[], sourceNames: string[]): string {
        const hash = createHash('sha256');
        hash.update(JSON.stringify({
            uris: rawSourceUris,
            sourceNames
        }));
        return hash.digest('hex');
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
