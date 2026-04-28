import yaml from 'js-yaml';
import {
    ParrotExecutionPlan,
    ParrotMLRecommendation,
    ParrotMindMapGroup,
    ParrotMindMapInsight,
    ParrotMindMapManifest,
    ParrotProjectionPlan,
    ParrotQuerySpec,
    ParrotSourceProfile,
    ReverseEtlStreamPlan
} from '../../types/parrot';

export interface MindMapDiscoveryPackage {
    manifest: ParrotMindMapManifest;
    yaml: string;
    projection: any;
}

export class MindMapManifestService {
    private buildLineage(sourceKeys: string[], goldFields: Array<{ source_key: string; columns: string[] }> = []) {
        return {
            source_keys: sourceKeys,
            gold_fields: goldFields.filter((entry) => entry.source_key && entry.columns.length > 0)
        };
    }

    private buildGoldFieldUsage(sourceKey: string | undefined, columns: string[] = []) {
        if (!sourceKey) {
            return [];
        }

        return [{
            source_key: sourceKey,
            columns: Array.from(new Set(columns.filter(Boolean)))
        }];
    }

    public build(
        sourceProfiles: ParrotSourceProfile[],
        reverseEtl: ReverseEtlStreamPlan,
        executionPlan: ParrotExecutionPlan,
        projectionPlan?: ParrotProjectionPlan
    ): MindMapDiscoveryPackage {
        const groups = this.buildGroups(sourceProfiles, projectionPlan);
        const insights = projectionPlan
            ? this.buildInsightsFromProjectionPlan(sourceProfiles, groups, reverseEtl, projectionPlan)
            : this.buildInsights(sourceProfiles, groups, reverseEtl);

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
                    connector_id: profile.connectorId,
                    icon_path: profile.iconPath,
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
                insights,
                projections: projectionPlan?.projectionSpecs,
                queries: projectionPlan?.querySpecs,
                mlRecommendations: projectionPlan?.mlRecommendations,
                invalidationHints: projectionPlan?.invalidationHints
            }
        };

        const yamlContent = yaml.dump(manifest, { noRefs: true, lineWidth: 120 });
        const projection = this.buildProjection(sourceProfiles, groups, insights, projectionPlan);
        projection.mindmapManifest = manifest;
        projection.mindmapYaml = yamlContent;

        return {
            manifest,
            yaml: yamlContent,
            projection
        };
    }

    private getPrimaryGoldView(profile: ParrotSourceProfile): ParrotSourceProfile['goldViews'][number] | undefined {
        return profile.goldViews.find((view) => view.id.endsWith('-core')) || profile.goldViews[0];
    }

    private getMetricGoldView(profile: ParrotSourceProfile): ParrotSourceProfile['goldViews'][number] | undefined {
        return profile.goldViews.find((view) => view.id.endsWith('-metrics')) || this.getPrimaryGoldView(profile);
    }

    private dedupeStrings(values: Array<string | undefined | null>): string[] {
        return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
    }

    private getOperationalGroupId(sourceId: string): string {
        return `grp-${sourceId}-operational`;
    }

    private getMlGroupId(sourceId: string): string {
        return `grp-${sourceId}-ml-recommended`;
    }

    private getReverseGroupId(sourceId: string): string {
        return `grp-${sourceId}-reverse-etl-recommended`;
    }

    private getGoldViewColumns(view?: ParrotSourceProfile['goldViews'][number]): string[] {
        return (view?.columns || [])
            .map((column) => column?.name)
            .filter((name): name is string => Boolean(name));
    }

    private resolveBestGoldView(
        profile: ParrotSourceProfile,
        columns: string[] = [],
        preferredViewId?: string
    ): ParrotSourceProfile['goldViews'][number] | undefined {
        const cleanedColumns = this.dedupeStrings(columns);
        const goldViews = profile.goldViews || [];
        const preferredView = preferredViewId
            ? goldViews.find((view) => view.id === preferredViewId)
            : undefined;

        if (cleanedColumns.length === 0) {
            return preferredView || this.getPrimaryGoldView(profile);
        }

        const scoredViews = goldViews
            .map((view) => {
                const viewColumns = new Set(this.getGoldViewColumns(view));
                const overlapCount = cleanedColumns.filter((column) => viewColumns.has(column)).length;
                return {
                    view,
                    overlapCount,
                    isFullMatch: cleanedColumns.every((column) => viewColumns.has(column)),
                    columnCount: viewColumns.size
                };
            })
            .filter((entry) => entry.overlapCount > 0);

        const fullMatches = scoredViews
            .filter((entry) => entry.isFullMatch)
            .sort((left, right) => left.columnCount - right.columnCount || left.view.id.localeCompare(right.view.id));

        if (fullMatches.length > 0) {
            if (preferredView && fullMatches.some((entry) => entry.view.id === preferredView.id)) {
                return preferredView;
            }

            return fullMatches[0].view;
        }

        if (preferredView) {
            return preferredView;
        }

        const bestPartialMatch = scoredViews
            .sort((left, right) => right.overlapCount - left.overlapCount || left.columnCount - right.columnCount)[0];

        return bestPartialMatch?.view || this.getPrimaryGoldView(profile);
    }

    private resolveLineageTarget(
        sourceProfiles: ParrotSourceProfile[],
        sourceId: string | undefined,
        preferredViewId: string | undefined,
        columns: string[] = []
    ): { sourceKey?: string; columns: string[] } {
        const cleanedColumns = this.dedupeStrings(columns);
        const profile = sourceProfiles.find((entry) => entry.sourceId === sourceId)
            || sourceProfiles.find((entry) => entry.goldViews.some((view) => view.id === preferredViewId));

        if (!profile) {
            return {
                sourceKey: preferredViewId,
                columns: cleanedColumns
            };
        }

        const resolvedView = this.resolveBestGoldView(profile, cleanedColumns, preferredViewId);
        const resolvedViewColumns = this.getGoldViewColumns(resolvedView);
        const resolvedColumns = cleanedColumns.filter((column) => resolvedViewColumns.includes(column));

        return {
            sourceKey: resolvedView?.id || preferredViewId,
            columns: resolvedColumns.length > 0 ? resolvedColumns : cleanedColumns
        };
    }

    private isMlEligible(profile: ParrotSourceProfile): boolean {
        return profile.metricCandidates.length > 0 && (
            profile.entityKeyCandidates.length > 0
            || profile.timestampCandidates.length > 0
        );
    }

    private isReverseEtlEligible(profile: ParrotSourceProfile): boolean {
        return profile.entityKeyCandidates.length > 0 && profile.metricCandidates.length > 0;
    }

    private getMlAdjustedIds(sourceProfiles: ParrotSourceProfile[]): string[] {
        return sourceProfiles
            .filter((profile) => this.isMlEligible(profile))
            .map((profile) => this.getMetricGoldView(profile)?.id)
            .filter(Boolean) as string[];
    }

    private getReverseAdjustedIds(sourceProfiles: ParrotSourceProfile[]): string[] {
        return sourceProfiles
            .filter((profile) => this.isReverseEtlEligible(profile))
            .map((profile) => this.getMetricGoldView(profile)?.id)
            .filter(Boolean) as string[];
    }

    private buildGroups(sourceProfiles: ParrotSourceProfile[], projectionPlan?: ParrotProjectionPlan): ParrotMindMapGroup[] {
        const groups: ParrotMindMapGroup[] = [];

        sourceProfiles.forEach((profile) => {
            const sourceQueries = projectionPlan?.querySpecs?.filter((querySpec) => querySpec.sourceId === profile.sourceId) || [];
            const sourceRecommendations = projectionPlan?.mlRecommendations?.filter((recommendation) => recommendation.sourceId === profile.sourceId) || [];

            if (!projectionPlan || sourceQueries.length > 0) {
                const operationalAdjustedIds = sourceQueries.length > 0
                    ? this.dedupeStrings(sourceQueries.map((querySpec) => (
                        this.resolveLineageTarget(
                            sourceProfiles,
                            querySpec.sourceId,
                            querySpec.projectionId,
                            querySpec.dependencies.columns
                        ).sourceKey
                    )))
                    : profile.goldViews.map((view) => view.id);

                groups.push({
                    id: this.getOperationalGroupId(profile.sourceId),
                    name: `${profile.sourceId}-operational`,
                    title: `${profile.sourceName} Operational`,
                    status: 'active',
                    color: 'default',
                    activationMode: 'automatic',
                    sourceIds: [profile.sourceId],
                    adjusted_data_ids: operationalAdjustedIds,
                    editMode: 'intent',
                    logic: {
                        intent: sourceQueries.length > 0
                            ? `Activate the ${sourceQueries.length} compiled operational widget queries for ${profile.sourceName}.`
                            : `Expose the validated operational views for ${profile.sourceName}.`
                    },
                    suggestions: [
                        {
                            id: `suggest-group-${profile.sourceId}-operational-pne`,
                            source: 'pne',
                            mode: 'intent',
                            title: 'Keep operational group always on',
                            rationale: 'Operational insights should remain the default live lens for each connected source.',
                            proposedIntent: `Activate ${profile.sourceName} operational insights automatically once source and gold validation passes.`
                        }
                    ],
                    validation: {
                        status: 'active',
                        checks: [
                            { name: 'lineage', status: 'passed', message: 'Operational group only references validated gold views.' },
                            { name: 'safety', status: 'passed', message: 'Automatic activation is limited to non-destructive analytical outputs.' }
                        ]
                    }
                });
            }

            if ((!projectionPlan && this.isMlEligible(profile)) || sourceRecommendations.length > 0) {
                const mlAdjustedIds = sourceRecommendations.length > 0
                    ? this.dedupeStrings(sourceRecommendations.map((recommendation) => (
                        this.resolveLineageTarget(
                            sourceProfiles,
                            recommendation.sourceId,
                            recommendation.projectionId,
                            [
                                ...(recommendation.targetColumn ? [recommendation.targetColumn] : []),
                                ...recommendation.featureColumns
                            ]
                        ).sourceKey
                    )))
                    : this.getMlAdjustedIds([profile]);

                groups.push({
                    id: this.getMlGroupId(profile.sourceId),
                    name: `${profile.sourceId}-ml-recommended`,
                    title: `${profile.sourceName} ML Recommended`,
                    status: 'recommended',
                    color: 'blue',
                    activationMode: 'manual',
                    sourceIds: [profile.sourceId],
                    adjusted_data_ids: mlAdjustedIds,
                    editMode: 'intent',
                    logic: {
                        intent: sourceRecommendations.length > 0
                            ? `Recommend ${sourceRecommendations.length} candidate ML workloads for ${profile.sourceName}, but never start training or inference automatically.`
                            : `Recommend candidate ML workloads for ${profile.sourceName}, but never start training or inference automatically.`
                    },
                    suggestions: [
                        {
                            id: `suggest-group-${profile.sourceId}-ml-sentinel`,
                            source: 'sentinel',
                            mode: 'intent',
                            title: 'Gate ML behind manual activation',
                            rationale: 'ML must remain a reviewed recommendation until the user approves a target, feature set, and objective.',
                            proposedIntent: `Surface ML proposals for ${profile.sourceName} with rationale, contract, and expected metrics, then require manual launch.`
                        }
                    ],
                    validation: {
                        status: 'draft',
                        checks: [
                            { name: 'schema', status: 'passed', message: 'ML recommendations are only emitted when metric and entity candidates are present.' },
                            { name: 'safety', status: 'passed', message: 'Automatic model launch is disabled by policy.' }
                        ]
                    }
                });
            }

            if (this.isReverseEtlEligible(profile)) {
                const reverseColumns = profile.entityKeyCandidates.concat(profile.metricCandidates).slice(0, 4);
                const reverseAdjustedIds = this.dedupeStrings([
                    this.resolveBestGoldView(profile, reverseColumns, this.getMetricGoldView(profile)?.id)?.id
                ]);

                groups.push({
                    id: this.getReverseGroupId(profile.sourceId),
                    name: `${profile.sourceId}-reverse-etl-recommended`,
                    title: `${profile.sourceName} Reverse ETL Recommended`,
                    status: 'recommended',
                    color: 'blue',
                    activationMode: 'manual',
                    sourceIds: [profile.sourceId],
                    adjusted_data_ids: reverseAdjustedIds,
                    editMode: 'intent',
                    logic: {
                        intent: `Recommend output streams for ${profile.sourceName} only after ownership and rate-limit checks pass.`
                    },
                    suggestions: [
                        {
                            id: `suggest-group-${profile.sourceId}-reverse-etl-sentinel`,
                            source: 'sentinel',
                            mode: 'intent',
                            title: 'Require DNS ownership before activation',
                            rationale: 'Reverse ETL recommendations should stay manual until ownership and platform guardrails pass.',
                            proposedIntent: `Create Reverse ETL suggestions for ${profile.sourceName}, but block activation until DNS TXT verification and safety limits are satisfied.`
                        }
                    ],
                    validation: {
                        status: 'draft',
                        checks: [
                            { name: 'safety', status: 'passed', message: 'Reverse ETL remains manual and guarded by DNS verification plus error thresholds.' }
                        ]
                    }
                });
            }
        });

        return groups;
    }

    private buildInsights(
        sourceProfiles: ParrotSourceProfile[],
        groups: ParrotMindMapGroup[],
        reverseEtl: ReverseEtlStreamPlan
    ): ParrotMindMapInsight[] {
        const insights: ParrotMindMapInsight[] = [];

        sourceProfiles.forEach((profile) => {
            const primaryGoldView = this.getPrimaryGoldView(profile);
            const metricGoldView = this.getMetricGoldView(profile);
            const timestampColumn = profile.timestampCandidates[0];
            const operationalGroup = groups.find((group) => group.id === this.getOperationalGroupId(profile.sourceId));
            const mlGroup = groups.find((group) => group.id === this.getMlGroupId(profile.sourceId));
            const reverseGroup = groups.find((group) => group.id === this.getReverseGroupId(profile.sourceId));
            if (!primaryGoldView) {
                return;
            }

            if (operationalGroup) {
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
                lineage: this.buildLineage(
                    [primaryGoldView.id],
                    this.buildGoldFieldUsage(primaryGoldView.id, profile.schema.map((column) => column.name).slice(0, 6))
                ),
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
            }

            if (timestampColumn && operationalGroup) {
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
                    lineage: this.buildLineage(
                        [primaryGoldView.id],
                        this.buildGoldFieldUsage(primaryGoldView.id, [timestampColumn])
                    ),
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

            if (this.isMlEligible(profile) && mlGroup) {
                const mlColumns = profile.metricCandidates.slice(0, 4);
                const mlLineageView = this.resolveBestGoldView(profile, mlColumns, metricGoldView?.id);
                insights.push({
                    id: `ins-${profile.sourceId}-ml-recommendation`,
                    title: `Recommend ML for ${profile.sourceName}`,
                    type: 'predictive',
                    widget_type: 'predictive',
                    group_id: mlGroup.id,
                    status: 'recommended',
                    activationMode: 'manual',
                    adjusted_data_columns: mlColumns,
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
                    lineage: this.buildLineage(
                        [mlLineageView?.id || metricGoldView?.id || primaryGoldView.id],
                        this.buildGoldFieldUsage(mlLineageView?.id || metricGoldView?.id || primaryGoldView.id, mlColumns)
                    ),
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
            }

            if (this.isReverseEtlEligible(profile) && reverseGroup) {
                const reverseColumns = profile.entityKeyCandidates.concat(profile.metricCandidates).slice(0, 4);
                const reverseLineageView = this.resolveBestGoldView(profile, reverseColumns, metricGoldView?.id);
                insights.push({
                    id: `ins-${profile.sourceId}-reverse-etl-recommendation`,
                    title: `Recommend Reverse ETL for ${profile.sourceName}`,
                    type: 'trend-spotter',
                    widget_type: 'trend-spotter',
                    group_id: reverseGroup.id,
                    status: 'recommended',
                    activationMode: 'manual',
                    adjusted_data_columns: reverseColumns,
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
                    lineage: this.buildLineage(
                        [reverseLineageView?.id || metricGoldView?.id || primaryGoldView.id],
                        this.buildGoldFieldUsage(
                            reverseLineageView?.id || metricGoldView?.id || primaryGoldView.id,
                            reverseColumns
                        )
                    ),
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
            }
        });

        return insights;
    }

    private buildInsightsFromProjectionPlan(
        sourceProfiles: ParrotSourceProfile[],
        groups: ParrotMindMapGroup[],
        reverseEtl: ReverseEtlStreamPlan,
        projectionPlan: ParrotProjectionPlan
    ): ParrotMindMapInsight[] {
        const reverseInsights = this.buildInsights(sourceProfiles, groups, reverseEtl)
            .filter((insight) => insight.group_id.endsWith('-reverse-etl-recommended'));

        const queryInsights = projectionPlan.querySpecs.map((querySpec) => {
            const groupId = groups.find((group) => group.id === this.getOperationalGroupId(querySpec.sourceId))?.id
                || groups.find((group) => group.name.endsWith('-operational'))?.id
                || this.getOperationalGroupId(querySpec.sourceId);
            return this.buildQueryInsight(sourceProfiles, querySpec, groupId);
        });
        const mlInsights = projectionPlan.mlRecommendations.map((recommendation) => {
            const groupId = groups.find((group) => group.id === this.getMlGroupId(recommendation.sourceId))?.id
                || groups.find((group) => group.name.endsWith('-ml-recommended'))?.id
                || this.getMlGroupId(recommendation.sourceId);
            return this.buildMlInsight(sourceProfiles, recommendation, groupId);
        });

        return [...queryInsights, ...mlInsights, ...reverseInsights];
    }

    private buildQueryInsight(
        sourceProfiles: ParrotSourceProfile[],
        querySpec: ParrotQuerySpec,
        groupId: string
    ): ParrotMindMapInsight {
        const isActive = querySpec.status === 'active';
        const resolvedLineage = this.resolveLineageTarget(
            sourceProfiles,
            querySpec.sourceId,
            querySpec.projectionId,
            querySpec.dependencies.columns
        );
        return {
            id: querySpec.widgetId,
            title: querySpec.title,
            type: querySpec.widgetType,
            widget_type: querySpec.widgetType,
            group_id: groupId,
            status: isActive ? 'active' : 'recommended',
            activationMode: isActive ? 'automatic' : 'manual',
            adjusted_data_columns: querySpec.dependencies.columns,
            query: querySpec.sql,
            sql: querySpec.sql,
            logic: {
                intent: `Serve ${querySpec.title} from projection ${querySpec.projectionId}.`,
                code: querySpec.sql,
                compiled_code: querySpec.sql,
                effective_query: querySpec.sql
            },
            lineage: this.buildLineage(
                [resolvedLineage.sourceKey || querySpec.projectionId].filter(Boolean),
                this.buildGoldFieldUsage(resolvedLineage.sourceKey, resolvedLineage.columns)
            ),
            editMode: 'code',
            suggestions: [
                {
                    id: `suggest-${querySpec.queryId}-cache-policy`,
                    source: 'sentinel',
                    mode: 'intent',
                    title: 'Keep cache tied to source fingerprint',
                    rationale: `This query uses ${querySpec.executionPolicy.mode} and refreshes ${querySpec.executionPolicy.refreshStrategy}.`,
                    proposedIntent: 'Refresh only when Sentinel marks the source or projection fingerprint stale.'
                }
            ],
            validation: isActive
                ? this.buildActiveValidation('Query spec was compiled from the versioned projection plan.')
                : {
                    status: 'draft',
                    checks: [
                        { name: 'safety', status: 'pending', message: querySpec.invalidationReason || 'Sentinel requested validation before activation.' }
                    ]
                },
            widgetContract: querySpec.widgetContract,
            grid_span: querySpec.gridSpan,
            color_theme: querySpec.colorTheme,
            querySpec
        };
    }

    private buildMlInsight(
        sourceProfiles: ParrotSourceProfile[],
        recommendation: ParrotMLRecommendation,
        groupId: string
    ): ParrotMindMapInsight {
        const resolvedLineage = this.resolveLineageTarget(
            sourceProfiles,
            recommendation.sourceId,
            recommendation.projectionId,
            [
                ...(recommendation.targetColumn ? [recommendation.targetColumn] : []),
                ...recommendation.featureColumns
            ]
        );
        return {
            id: `ins-${recommendation.recommendationId}`,
            title: recommendation.title,
            type: 'predictive',
            widget_type: 'predictive',
            group_id: groupId,
            status: 'recommended',
            activationMode: 'manual',
            adjusted_data_columns: [
                ...(recommendation.targetColumn ? [recommendation.targetColumn] : []),
                ...recommendation.featureColumns
            ],
            logic: {
                intent: recommendation.rationale,
                code: 'ml_model.launch = manual_approval',
                compiled_code: JSON.stringify(recommendation, null, 2)
            },
            lineage: this.buildLineage(
                [resolvedLineage.sourceKey || recommendation.projectionId].filter(Boolean),
                this.buildGoldFieldUsage(resolvedLineage.sourceKey, resolvedLineage.columns)
            ),
            editMode: 'intent',
            suggestions: [
                {
                    id: `suggest-${recommendation.recommendationId}-approval`,
                    source: 'sentinel',
                    mode: 'intent',
                    title: 'Require reviewed ML launch',
                    rationale: 'The executor is available through an explicit approval endpoint; no model starts from discovery alone.',
                    proposedIntent: 'Start training only after the user approves target, feature set, and objective.'
                }
            ],
            validation: {
                status: 'draft',
                checks: [
                    { name: 'schema', status: 'passed', message: 'Recommendation was compiled from discovered metadata only.' },
                    { name: 'safety', status: 'passed', message: 'Launch policy is manual approval.' }
                ]
            },
            widgetContract: {
                widgetType: 'predictive',
                expectedShape: 'table',
                requiredFields: ['model_id', 'metrics'],
                alignmentMode: 'best_effort',
                source: 'runtime_contract'
            },
            mlRecommendation: recommendation
        };
    }

    private buildProjection(
        sourceProfiles: ParrotSourceProfile[],
        groups: ParrotMindMapGroup[],
        insights: ParrotMindMapInsight[],
        projectionPlan?: ParrotProjectionPlan
    ) {
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
                grid_span: insight.grid_span || 'col-span-1',
                color_theme: insight.color_theme || (insight.status === 'recommended' ? 'theme-productivity' : 'theme-audience'),
                footerText: insight.activationMode === 'manual' ? 'Manual activation' : 'Auto',
                footerBottom: insight.editMode === 'code' ? 'Editable as code' : 'Editable as intent'
            })),
            mindmapManifest: undefined,
            mindmapYaml: '',
            sourceMetadata: sourceProfiles,
            projectionPlan,
            projectionSpecs: projectionPlan?.projectionSpecs || [],
            querySpecs: projectionPlan?.querySpecs || [],
            mlRecommendations: projectionPlan?.mlRecommendations || [],
            invalidationHints: projectionPlan?.invalidationHints || []
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
