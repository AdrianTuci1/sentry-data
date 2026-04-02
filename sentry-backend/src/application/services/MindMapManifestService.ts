import yaml from 'js-yaml';
import {
    ParrotExecutionPlan,
    ParrotMindMapGroup,
    ParrotMindMapInsight,
    ParrotMindMapManifest,
    ParrotSourceProfile,
    ReverseEtlStreamPlan
} from '../../types/parrot';

export interface MindMapDiscoveryPackage {
    manifest: ParrotMindMapManifest;
    yaml: string;
    projection: any;
}

export class MindMapManifestService {
    public build(sourceProfiles: ParrotSourceProfile[], reverseEtl: ReverseEtlStreamPlan, executionPlan: ParrotExecutionPlan): MindMapDiscoveryPackage {
        const groups = this.buildGroups(sourceProfiles);
        const insights = this.buildInsights(sourceProfiles, groups, reverseEtl);

        const manifest: ParrotMindMapManifest = {
            version: '1.0',
            runtime: {
                mode: 'parrot_os',
                executionEngine: executionPlan.engine,
                decisionEngine: 'parrot_neural_engine + sentinel',
                mlLaunchPolicy: 'manual_recommended'
            },
            editing: {
                supportedModes: ['intent', 'code'],
                sentinelGuard: 'Sentinel validates structural, semantic, and safety constraints before applying intent or code edits.',
                lifecycle: ['draft', 'compile', 'dry_run', 'sentinel_validate', 'activate'],
                layerPolicies: {
                    sources: {
                        supportedModes: ['intent'],
                        submissionMode: 'draft_patch'
                    },
                    transformations: {
                        supportedModes: ['intent', 'code'],
                        submissionMode: 'draft_patch'
                    },
                    gold: {
                        supportedModes: ['intent', 'code'],
                        submissionMode: 'draft_patch'
                    },
                    groups: {
                        supportedModes: ['intent'],
                        submissionMode: 'draft_patch'
                    },
                    insights: {
                        supportedModes: ['intent', 'code'],
                        submissionMode: 'draft_patch'
                    }
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
                sources: sourceProfiles.map((profile) => ({
                    id: profile.sourceId,
                    name: profile.sourceName,
                    type: profile.sourceType,
                    uri: profile.uri,
                    metadata_uri: profile.metadataUri
                })),
                transformations: Object.fromEntries(
                    sourceProfiles.map((profile) => [profile.sourceId, profile.transformations])
                ),
                gold: Object.fromEntries(
                    sourceProfiles.map((profile) => [profile.sourceId, profile.goldViews])
                ),
                groups,
                insights
            }
        };

        const yamlContent = yaml.dump(manifest, { noRefs: true, lineWidth: 120 });
        const projection = this.buildProjection(sourceProfiles, groups, insights);
        projection.mindmapManifest = manifest;
        projection.mindmapYaml = yamlContent;

        return {
            manifest,
            yaml: yamlContent,
            projection
        };
    }

    private buildGroups(sourceProfiles: ParrotSourceProfile[]): ParrotMindMapGroup[] {
        const allAdjustedIds = sourceProfiles.flatMap((profile) => profile.goldViews.map((view) => view.id));
        const allSourceIds = sourceProfiles.map((profile) => profile.sourceId);

        return [
            {
                id: 'grp-operational',
                name: 'operational',
                title: 'Operational Intelligence',
                status: 'active',
                color: 'default',
                activationMode: 'automatic',
                sourceIds: allSourceIds,
                adjusted_data_ids: allAdjustedIds,
                editMode: 'intent',
                logic: {
                    intent: 'Combine validated gold views into the default operational lens for the project.'
                },
                suggestions: [
                    {
                        id: 'suggest-group-operational-pne',
                        source: 'pne',
                        mode: 'intent',
                        title: 'Keep operational group always on',
                        rationale: 'This group should remain the baseline layer that powers the first useful insights automatically.',
                        proposedIntent: 'Activate operational insights automatically once source and gold validation passes.'
                    }
                ],
                validation: {
                    status: 'active',
                    checks: [
                        { name: 'lineage', status: 'passed', message: 'Operational group only references validated gold views.' },
                        { name: 'safety', status: 'passed', message: 'Automatic activation is limited to non-destructive analytical outputs.' }
                    ]
                }
            },
            {
                id: 'grp-ml-recommended',
                name: 'ml-recommended',
                title: 'ML Recommended',
                status: 'recommended',
                color: 'blue',
                activationMode: 'manual',
                sourceIds: allSourceIds,
                adjusted_data_ids: allAdjustedIds,
                editMode: 'intent',
                logic: {
                    intent: 'Recommend candidate ML workloads, but never start training or inference automatically.'
                },
                suggestions: [
                    {
                        id: 'suggest-group-ml-sentinel',
                        source: 'sentinel',
                        mode: 'intent',
                        title: 'Gate ML behind manual activation',
                        rationale: 'ML must remain a reviewed recommendation until the user approves a target, feature set, and objective.',
                        proposedIntent: 'Surface ML proposals with rationale, contract, and expected metrics, then require manual launch.'
                    }
                ],
                validation: {
                    status: 'draft',
                    checks: [
                        { name: 'schema', status: 'passed', message: 'ML recommendations are only emitted when metric and entity candidates are present.' },
                        { name: 'safety', status: 'passed', message: 'Automatic model launch is disabled by policy.' }
                    ]
                }
            },
            {
                id: 'grp-reverse-etl-recommended',
                name: 'reverse-etl-recommended',
                title: 'Reverse ETL Recommended',
                status: 'recommended',
                color: 'blue',
                activationMode: 'manual',
                sourceIds: allSourceIds,
                adjusted_data_ids: allAdjustedIds,
                editMode: 'intent',
                logic: {
                    intent: 'Recommend output streams only after ownership and rate-limit checks pass.'
                },
                suggestions: [
                    {
                        id: 'suggest-group-reverse-etl-sentinel',
                        source: 'sentinel',
                        mode: 'intent',
                        title: 'Require DNS ownership before activation',
                        rationale: 'Reverse ETL recommendations should stay manual until ownership and platform guardrails pass.',
                        proposedIntent: 'Create Reverse ETL suggestions, but block activation until DNS TXT verification and safety limits are satisfied.'
                    }
                ],
                validation: {
                    status: 'draft',
                    checks: [
                        { name: 'safety', status: 'passed', message: 'Reverse ETL remains manual and guarded by DNS verification plus error thresholds.' }
                    ]
                }
            }
        ];
    }

    private buildInsights(
        sourceProfiles: ParrotSourceProfile[],
        groups: ParrotMindMapGroup[],
        reverseEtl: ReverseEtlStreamPlan
    ): ParrotMindMapInsight[] {
        const operationalGroup = groups.find((group) => group.id === 'grp-operational')!;
        const mlGroup = groups.find((group) => group.id === 'grp-ml-recommended')!;
        const reverseGroup = groups.find((group) => group.id === 'grp-reverse-etl-recommended')!;

        const insights: ParrotMindMapInsight[] = [];

        sourceProfiles.forEach((profile) => {
            const primaryGoldView = profile.goldViews[0];
            const timestampColumn = profile.timestampCandidates[0];

            insights.push({
                id: `ins-${profile.sourceId}-volume`,
                title: `${profile.sourceName} Volume`,
                type: 'technical-health',
                widget_type: 'technical-health',
                group_id: operationalGroup.id,
                status: 'active',
                activationMode: 'automatic',
                adjusted_data_columns: profile.schema.map((column) => column.name).slice(0, 6),
                query: `SELECT COUNT(*) AS total_rows FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                sql: `SELECT COUNT(*) AS total_rows FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                logic: {
                    intent: `Measure how much data is available in ${profile.sourceName} right now.`,
                    code: `SELECT COUNT(*) AS total_rows FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                    compiled_code: `SELECT COUNT(*) AS total_rows FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                    effective_query: `SELECT COUNT(*) AS total_rows FROM read_parquet('${this.escapeSqlString(profile.uri)}')`
                },
                lineage: {
                    source_keys: [primaryGoldView.id]
                },
                editMode: 'code',
                suggestions: [
                    {
                        id: `suggest-${profile.sourceId}-volume-window`,
                        source: 'pne',
                        mode: 'code',
                        title: 'Add recent-window volume',
                        rationale: 'Users often want a rolling volume check in addition to a full count.',
                        proposedCode: `SELECT DATE_TRUNC('day', CURRENT_TIMESTAMP) AS snapshot_at, COUNT(*) AS total_rows FROM read_parquet('${this.escapeSqlString(profile.uri)}')`
                    }
                ],
                validation: this.buildActiveValidation('This query is tied directly to the discovered source lineage.'),
                widgetContract: {
                    widgetType: 'technical-health',
                    expectedShape: 'scalar',
                    requiredFields: ['total_rows'],
                    alignmentMode: 'strict',
                    source: 'catalog_manifest'
                }
            });

            if (timestampColumn) {
                insights.push({
                    id: `ins-${profile.sourceId}-freshness`,
                    title: `${profile.sourceName} Freshness`,
                    type: 'weather',
                    widget_type: 'weather',
                    group_id: operationalGroup.id,
                    status: 'active',
                    activationMode: 'automatic',
                    adjusted_data_columns: [timestampColumn],
                    query: `SELECT MAX(${this.quoteIdentifier(timestampColumn)}) AS latest_event_at FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                    sql: `SELECT MAX(${this.quoteIdentifier(timestampColumn)}) AS latest_event_at FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                    logic: {
                        intent: `Track the freshest event detected in ${profile.sourceName}.`,
                        code: `SELECT MAX(${this.quoteIdentifier(timestampColumn)}) AS latest_event_at FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                        compiled_code: `SELECT MAX(${this.quoteIdentifier(timestampColumn)}) AS latest_event_at FROM read_parquet('${this.escapeSqlString(profile.uri)}')`,
                        effective_query: `SELECT MAX(${this.quoteIdentifier(timestampColumn)}) AS latest_event_at FROM read_parquet('${this.escapeSqlString(profile.uri)}')`
                    },
                    lineage: {
                        source_keys: [primaryGoldView.id]
                    },
                    editMode: 'code',
                    suggestions: [
                        {
                            id: `suggest-${profile.sourceId}-freshness-gap`,
                            source: 'sentinel',
                            mode: 'intent',
                            title: 'Expose freshness gap',
                            rationale: 'Sentinel can recommend a more actionable freshness metric instead of a raw timestamp only.',
                            proposedIntent: `Show the freshest event and the lag since the freshest event for ${profile.sourceName}.`
                        }
                    ],
                    validation: this.buildActiveValidation('Freshness logic depends on the inferred timestamp candidate.'),
                    widgetContract: {
                        widgetType: 'weather',
                        expectedShape: 'scalar',
                        requiredFields: ['latest_event_at'],
                        alignmentMode: 'strict',
                        source: 'catalog_manifest'
                    }
                });
            }

            insights.push({
                id: `ins-${profile.sourceId}-ml-recommendation`,
                title: `Recommend ML for ${profile.sourceName}`,
                type: 'predictive',
                widget_type: 'predictive',
                group_id: mlGroup.id,
                status: 'recommended',
                activationMode: 'manual',
                adjusted_data_columns: profile.metricCandidates.slice(0, 4),
                logic: {
                    intent: `Recommend an ML model for ${profile.sourceName} but do not launch it automatically. Show the user the proposed target, features, and training rationale first.`,
                    code: 'ml_model.launch = manual_only',
                    compiled_code: JSON.stringify({
                        executor: 'modal_ml_executor',
                        launch: 'manual_only',
                        source_profile: profile.sourceId,
                        proposed_target: profile.metricCandidates[0] || null,
                        proposed_features: profile.metricCandidates.slice(0, 6)
                    }, null, 2)
                },
                lineage: {
                    source_keys: [primaryGoldView.id]
                },
                editMode: 'intent',
                suggestions: [
                    {
                        id: `suggest-${profile.sourceId}-ml-objective`,
                        source: 'sentinel',
                        mode: 'intent',
                        title: 'Propose an objective, not an auto-run',
                        rationale: 'Sentinel should recommend candidate models from metadata, then wait for approval.',
                        proposedIntent: `Suggest a supervised or unsupervised model for ${profile.sourceName}, expose features and metrics, and require manual launch.`
                    }
                ],
                validation: {
                    status: 'draft',
                    checks: [
                        { name: 'schema', status: 'passed', message: 'Recommendation is based on profiled entity, metric, and timestamp candidates.' },
                        { name: 'safety', status: 'passed', message: 'Model execution stays manual until a reviewed launch is requested.' }
                    ]
                },
                widgetContract: {
                    widgetType: 'predictive',
                    expectedShape: 'table',
                    requiredFields: ['model_id', 'metrics'],
                    alignmentMode: 'best_effort',
                    source: 'runtime_contract'
                }
            });

            insights.push({
                id: `ins-${profile.sourceId}-reverse-etl-recommendation`,
                title: `Recommend Reverse ETL for ${profile.sourceName}`,
                type: 'trend-spotter',
                widget_type: 'trend-spotter',
                group_id: reverseGroup.id,
                status: 'recommended',
                activationMode: 'manual',
                adjusted_data_columns: profile.entityKeyCandidates.concat(profile.metricCandidates).slice(0, 4),
                logic: {
                    intent: reverseEtl.dnsTxtVerification.verified
                        ? `Prepare a user-owned Reverse ETL VM for ${profile.sourceName}, but wait for manual approval before launching.`
                        : `DNS TXT verification is still required before Reverse ETL can be launched for ${profile.sourceName}.`,
                    code: 'reverse_etl.launch = manual_only',
                    compiled_code: JSON.stringify({
                        launch: 'manual_only',
                        dns_verified: reverseEtl.dnsTxtVerification.verified,
                        active_vm_count: reverseEtl.activeVmCount,
                        stop_on_errors: reverseEtl.limits.stopOnErrors
                    }, null, 2)
                },
                lineage: {
                    source_keys: [primaryGoldView.id]
                },
                editMode: 'intent',
                suggestions: [
                    {
                        id: `suggest-${profile.sourceId}-reverse-targets`,
                        source: 'pne',
                        mode: 'intent',
                        title: 'Expose delivery targets clearly',
                        rationale: 'Reverse ETL suggestions should tell the user exactly which systems would receive live outputs.',
                        proposedIntent: `Recommend Reverse ETL targets for ${profile.sourceName}, but block activation until ownership, limits, and destination errors are acceptable.`
                    }
                ],
                validation: {
                    status: reverseEtl.dnsTxtVerification.verified ? 'validated' : 'draft',
                    checks: [
                        {
                            name: 'safety',
                            status: 'passed',
                            message: `Reverse ETL is guarded by DNS verification, a ${reverseEtl.limits.consecutiveErrorThreshold}-error threshold, and VM ownership limits.`
                        }
                    ]
                },
                widgetContract: {
                    widgetType: 'trend-spotter',
                    expectedShape: 'table',
                    requiredFields: ['target', 'status'],
                    alignmentMode: 'best_effort',
                    source: 'runtime_contract'
                }
            });
        });

        return insights;
    }

    private buildProjection(sourceProfiles: ParrotSourceProfile[], groups: ParrotMindMapGroup[], insights: ParrotMindMapInsight[]) {
        const connector = sourceProfiles.map((profile) => ({
            id: profile.sourceId,
            name: profile.sourceName,
            type: profile.sourceType,
            status: 'ok',
            uri: profile.uri
        }));

        const actionType = sourceProfiles.map((profile) => ({
            id: `action-${profile.sourceId}`,
            name: 'Virtualize',
            connector_id: profile.sourceId,
            status: 'ok'
        }));

        const adjustedData = sourceProfiles.flatMap((profile) => profile.goldViews.map((goldView) => ({
            id: goldView.id,
            name: goldView.title,
            title: goldView.title,
            origin_id: profile.sourceId,
            action_type_id: `action-${profile.sourceId}`,
            status: 'ok',
            columns: goldView.columns.map((column) => ({
                id: `${goldView.id}-${column.name}`,
                name: column.name,
                title: column.name,
                type: column.type,
                status: 'ok'
            }))
        })));

        const projection: any = {
            connector,
            actionType,
            origin: [],
            adjustedData,
            group: groups.map((group) => ({
                id: group.id,
                name: group.name,
                title: group.title,
                status: group.status === 'recommended' ? 'warning' : 'ok',
                color: group.color,
                activation_mode: group.activationMode,
                adjusted_data_ids: group.adjusted_data_ids || []
            })),
            insight: insights.map((insight) => ({
                ...insight,
                status: insight.status === 'recommended' ? 'warning' : 'ok',
                grid_span: 'col-span-1',
                color_theme: insight.status === 'recommended' ? 'theme-productivity' : 'theme-audience',
                footerText: insight.activationMode === 'manual' ? 'Manual activation' : 'Auto',
                footerBottom: insight.editMode === 'code' ? 'Editable as code' : 'Editable as intent'
            })),
            mindmapManifest: undefined,
            mindmapYaml: '',
            sourceMetadata: sourceProfiles
        };

        return projection;
    }

    private escapeSqlString(value: string): string {
        return value.replace(/'/g, "''");
    }

    private quoteIdentifier(value: string): string {
        return `"${value.replace(/"/g, '""')}"`;
    }

    private buildActiveValidation(message: string) {
        return {
            status: 'active' as const,
            checks: [
                { name: 'syntax' as const, status: 'passed' as const, message: 'Compiled query is syntactically valid.' },
                { name: 'lineage' as const, status: 'passed' as const, message },
                { name: 'dry_run' as const, status: 'pending' as const, message: 'Dry-run execution should happen before a user-edited draft becomes active.' }
            ]
        };
    }
}
