import { makeAutoObservable } from 'mobx';
import { buildMindMapLayout } from './useMindMapLayout';

const DEFAULT_LIFECYCLE = ['draft', 'compile', 'dry_run', 'sentinel_validate', 'activate'];

const humanizeLabel = (value = '') => value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

export class FeatureMindMapDataStore {
    root;

    constructor(root) {
        this.root = root;

        makeAutoObservable(this, {
            root: false
        }, { autoBind: true });
    }

    get workspaceData() {
        return this.root.externalDataStore;
    }

    get workspaceUI() {
        return this.root.externalUI;
    }

    get connector() {
        return this.workspaceData.connector;
    }

    get actionType() {
        return this.workspaceData.actionType;
    }

    get origin() {
        return this.workspaceData.origin;
    }

    get adjustedData() {
        return this.workspaceData.adjustedData;
    }

    get group() {
        return this.workspaceData.group;
    }

    get insight() {
        return this.workspaceData.insight;
    }

    get mindmapManifest() {
        return this.workspaceData.mindmapManifest;
    }

    get mindmapYaml() {
        return this.workspaceData.mindmapYaml;
    }

    get sourceMetadata() {
        return this.workspaceData.sourceMetadata;
    }

    get layout() {
        return buildMindMapLayout({
            connector: this.connector,
            actionType: this.actionType,
            origin: this.origin,
            adjustedData: this.adjustedData,
            group: this.group,
            insight: this.insight
        });
    }

    get nodeMap() {
        return new Map(this.layout.nodes.map((node) => [node.id, node]));
    }

    get nodeConnectivityMap() {
        const connectivity = new Map();

        this.layout.nodes.forEach((node) => {
            connectivity.set(node.id, {
                hasIncoming: false,
                hasOutgoing: false
            });
        });

        this.layout.edges.forEach((edge) => {
            if (edge.sourceId && connectivity.has(edge.sourceId)) {
                connectivity.get(edge.sourceId).hasOutgoing = true;
            }

            if (edge.targetId && connectivity.has(edge.targetId)) {
                connectivity.get(edge.targetId).hasIncoming = true;
            }
        });

        return connectivity;
    }

    get manifestSources() {
        return this.mindmapManifest?.layers?.sources || [];
    }

    get manifestGroups() {
        return this.mindmapManifest?.layers?.groups || [];
    }

    get manifestInsights() {
        return this.mindmapManifest?.layers?.insights || [];
    }

    get manifestTransformations() {
        return this.mindmapManifest?.layers?.transformations || {};
    }

    get manifestGold() {
        return this.mindmapManifest?.layers?.gold || {};
    }

    get sourceLayerMap() {
        return new Map(this.manifestSources.map((entry) => [entry.id, entry]));
    }

    get sourceProfileMap() {
        return new Map((this.sourceMetadata || []).map((entry) => [entry.sourceId, entry]));
    }

    get groupMap() {
        return new Map(this.manifestGroups.map((entry) => [entry.id, entry]));
    }

    get insightMap() {
        return new Map(this.manifestInsights.map((entry) => [entry.id, entry]));
    }

    get goldMap() {
        const flatViews = Object.values(this.manifestGold).flat();
        return new Map(flatViews.map((entry) => [entry.id, entry]));
    }

    getGoldSourceId(goldId) {
        if (!goldId) {
            return null;
        }

        const directMatch = Object.entries(this.manifestGold).find(([, views]) => (
            Array.isArray(views) && views.some((view) => view.id === goldId)
        ));

        if (directMatch) {
            return directMatch[0];
        }

        const matchFromMetadata = (this.sourceMetadata || []).find((entry) => (
            Array.isArray(entry.goldViews) && entry.goldViews.some((view) => view.id === goldId)
        ));

        return matchFromMetadata?.sourceId || null;
    }

    getGoldDefinition(goldId, fallbackData = null) {
        if (!goldId) {
            return fallbackData || null;
        }

        const manifestGold = this.goldMap.get(goldId);
        if (manifestGold) {
            return manifestGold;
        }

        const metadataGold = (this.sourceMetadata || []).flatMap((entry) => entry.goldViews || []).find((view) => view.id === goldId);
        return metadataGold || fallbackData || null;
    }

    getTransformationsForGold(nodeData = {}) {
        const actionTypeId = nodeData?.action_type_id || '';
        const sourceIdFromAction = actionTypeId.replace(/^action-/, '');
        const sourceId = sourceIdFromAction || nodeData?.origin_id || this.getGoldSourceId(nodeData?.id);

        if (!sourceId) {
            return [];
        }

        return this.manifestTransformations[sourceId] || this.sourceProfileMap.get(sourceId)?.transformations || [];
    }

    getSourceId(node) {
        if (!node) {
            return null;
        }

        return node.data?.id || node.id.replace(/^conn-/, '');
    }

    getSourceLoadState(node) {
        const sourceId = this.getSourceId(node);

        if (!sourceId) {
            return {
                isLoaded: false,
                readyLabel: 'Layer pending',
                buttonLabel: 'Play'
            };
        }

        const transformCount = (this.manifestTransformations[sourceId] || []).length;
        const materializedViewCount = Math.max(
            (this.manifestGold[sourceId] || []).length,
            this.adjustedData.filter((entry) => (
                entry.origin_id === sourceId
                || entry.action_type_id === `action-${sourceId}`
            )).length
        );
        const isLoaded = transformCount > 0 || materializedViewCount > 0;

        return {
            isLoaded,
            transformCount,
            materializedViewCount,
            readyLabel: materializedViewCount > 0
                ? `${pluralize(materializedViewCount, 'view')} ready`
                : transformCount > 0
                    ? `${pluralize(transformCount, 'transform')} ready`
                    : 'Layer pending',
            buttonLabel: 'Play'
        };
    }

    isNodeRecommended(node) {
        return node.type === 'card'
            && (
                node.data?.status === 'warning'
                || node.data?.activationMode === 'manual'
                || node.data?.activation_mode === 'manual'
            );
    }

    formatStageTitle(value) {
        return humanizeLabel(value);
    }

    normalizeSentinelFinding(finding, prefix, index, fallbackTitle = 'Sentinel finding') {
        return {
            id: finding?.id || `${prefix}-${index}`,
            severity: finding?.severity || (finding?.status === 'resolved' ? 'info' : 'warning'),
            status: finding?.status === 'resolved' ? 'resolved' : 'open',
            title: finding?.title || fallbackTitle,
            detail: finding?.detail || finding?.message || '',
            resolution: finding?.resolution || '',
            source: finding?.source || 'sentinel'
        };
    }

    deriveFindingsFromChecks(checks = [], prefix, label) {
        return checks.flatMap((check, index) => {
            if (check.status === 'failed') {
                return [this.normalizeSentinelFinding({
                    severity: 'error',
                    status: 'open',
                    title: `${this.formatStageTitle(check.name || 'validation')} failed`,
                    detail: check.message || `${label} failed a Sentinel validation check.`
                }, prefix, index, label)];
            }

            if (check.status === 'pending') {
                return [this.normalizeSentinelFinding({
                    severity: 'warning',
                    status: 'open',
                    title: `${this.formatStageTitle(check.name || 'validation')} needs review`,
                    detail: check.message || `${label} is waiting for Sentinel review.`
                }, prefix, index, label)];
            }

            return [];
        });
    }

    dedupeSentinelFindings(findings) {
        const deduped = new Map();

        findings.forEach((finding) => {
            if (finding?.id && !deduped.has(finding.id)) {
                deduped.set(finding.id, finding);
            }
        });

        return Array.from(deduped.values());
    }

    collectEntrySentinelFindings(entry, prefix, label) {
        if (!entry) {
            return [];
        }

        const explicitFindings = Array.isArray(entry.sentinelFindings)
            ? entry.sentinelFindings.map((finding, index) => this.normalizeSentinelFinding(
                finding,
                `${prefix}-explicit`,
                index,
                label || entry.title || entry.sourceName || 'Sentinel finding'
            ))
            : [];

        if (explicitFindings.length > 0) {
            return explicitFindings;
        }

        return this.deriveFindingsFromChecks(
            entry.validation?.checks || [],
            `${prefix}-derived`,
            label || entry.title || entry.sourceName || 'Sentinel finding'
        );
    }

    summarizeSentinelFindings(findings = []) {
        return findings.reduce((summary, finding) => {
            if (finding.status === 'resolved') {
                summary.resolved += 1;
                return summary;
            }

            if (finding.severity === 'error') {
                summary.openErrors += 1;
            } else if (finding.severity === 'warning') {
                summary.openWarnings += 1;
            } else {
                summary.openInfos += 1;
            }

            return summary;
        }, {
            openErrors: 0,
            openWarnings: 0,
            openInfos: 0,
            resolved: 0
        });
    }

    getStatusTone(summary, fallback = {}) {
        if (summary.openErrors > 0) {
            return {
                tone: 'danger',
                label: pluralize(summary.openErrors, 'error')
            };
        }

        const openAlerts = summary.openWarnings + summary.openInfos;
        if (openAlerts > 0) {
            return {
                tone: 'warning',
                label: pluralize(openAlerts, 'alert')
            };
        }

        if (summary.resolved > 0) {
            return {
                tone: 'success',
                label: pluralize(summary.resolved, 'resolved issue', 'resolved issues')
            };
        }

        if (fallback.accepted) {
            return {
                tone: 'success',
                label: 'Accepted'
            };
        }

        if (fallback.recommended) {
            return {
                tone: 'warning',
                label: 'Pending review'
            };
        }

        return {
            tone: 'accent',
            label: fallback.activeLabel || 'Active'
        };
    }

    buildNodeContext(node) {
        if (node.type === 'source') {
            const sourceId = this.getSourceId(node);
            return {
                label: 'Source',
                details: {
                    source: this.sourceLayerMap.get(sourceId) || null,
                    profile: this.sourceProfileMap.get(sourceId) || null,
                    transformations: this.manifestTransformations[sourceId] || [],
                    gold: this.manifestGold[sourceId] || []
                }
            };
        }

        if (node.type === 'action') {
            const sourceId = node.data?.connector_id;
            return {
                label: 'Data Normalization',
                details: {
                    sourceId,
                    transformations: this.manifestTransformations[sourceId] || []
                }
            };
        }

        if (node.type === 'category') {
            const goldId = node.data?.id;
            const sourceId = node.data?.origin_id || node.data?.action_type_id?.replace(/^action-/, '') || this.getGoldSourceId(goldId);
            return {
                label: 'Virtual Layer',
                details: {
                    ...(this.getGoldDefinition(goldId, node.data) || {}),
                    ...node.data,
                    sourceId,
                    transformations: this.getTransformationsForGold({
                        ...node.data,
                        id: goldId,
                        origin_id: sourceId
                    })
                }
            };
        }

        if (node.type === 'group') {
            const groupId = node.data?.id;
            return {
                label: 'Group',
                details: this.groupMap.get(groupId) || node.data
            };
        }

        if (node.type === 'card') {
            return {
                label: 'Insight',
                details: this.insightMap.get(node.id) || node.data
            };
        }

        if (node.type === 'idea') {
            const goldId = (node.parentId || '').replace(/^adj-/, '');
            return {
                label: 'Field',
                details: {
                    column: node.data,
                    gold: this.goldMap.get(goldId) || null
                }
            };
        }

        return {
            label: 'Node',
            details: node.data || node
        };
    }

    buildNodeSuggestions(nodeContext) {
        const details = nodeContext?.details;

        if (Array.isArray(details?.transformations) && details.transformations.length > 0) {
            return details.transformations.flatMap((entry) => entry?.suggestions || []);
        }

        if (details?.suggestions?.length > 0) {
            return details.suggestions;
        }

        return [];
    }

    buildNodeValidation(nodeContext) {
        const details = nodeContext?.details;

        if (Array.isArray(details?.transformations)) {
            return {
                checks: details.transformations.flatMap((entry) => (entry?.validation?.checks || []).map((check) => ({
                    ...check,
                    name: check.name,
                    message: `${entry.title}: ${check.message}`
                })))
            };
        }

        if (details?.validation) {
            return details.validation;
        }

        return { checks: [] };
    }

    buildNodeSentinelFindings(node, nodeContext) {
        const details = nodeContext?.details;

        if (node.type === 'source') {
            return this.dedupeSentinelFindings([
                ...this.collectEntrySentinelFindings(details?.profile, `${node.id}-profile`, node.label),
                ...(details?.transformations || []).flatMap((entry) => this.collectEntrySentinelFindings(entry, `${node.id}-${entry.id}`, entry.title || node.label)),
                ...(details?.gold || []).flatMap((entry) => this.collectEntrySentinelFindings(entry, `${node.id}-${entry.id}`, entry.title || node.label))
            ]);
        }

        if (Array.isArray(details?.transformations)) {
            return this.dedupeSentinelFindings(
                details.transformations.flatMap((entry) => this.collectEntrySentinelFindings(entry, `${node.id}-${entry.id}`, entry.title || node.label))
            );
        }

        if (details?.gold || details?.column) {
            return this.dedupeSentinelFindings([
                ...this.collectEntrySentinelFindings(details?.column, `${node.id}-column`, details?.column?.name || node.label),
                ...this.collectEntrySentinelFindings(details?.gold, `${node.id}-gold`, details?.gold?.title || node.label)
            ]);
        }

        return this.dedupeSentinelFindings(
            this.collectEntrySentinelFindings(details, node.id, node.label)
        );
    }

    buildNodeCodeArtifacts(node, nodeContext) {
        const details = nodeContext?.details;

        if (node.type === 'source') {
            const profile = details?.profile || {};
            const schedule = profile.schedule || {};

            return [{
                id: `${node.id}-source-schedule`,
                title: 'Source Schedule',
                language: 'yaml',
                caption: 'Operational scheduling defined on the source connection.',
                code: [
                    `source_id: ${profile.sourceId || this.getSourceId(node) || node.id}`,
                    `source_name: ${profile.sourceName || node.label}`,
                    `source_type: ${profile.sourceType || node.data?.connector || 'unknown'}`,
                    `uri: ${profile.uri || node.data?.uri || 'unknown'}`,
                    `frequency: ${schedule.frequency || 'manual'}`,
                    `lookback_window: ${schedule.lookbackWindow || 'unspecified'}`,
                    `refresh_lag: ${schedule.refreshLag || 'unspecified'}`
                ].join('\n')
            }];
        }

        if (Array.isArray(details?.transformations)) {
            return details.transformations.map((entry) => ({
                id: entry.id,
                title: `Normalization Step · ${entry.title}`,
                language: this.detectArtifactLanguage(entry.compiledCode || entry.code || ''),
                caption: 'Normalized data logic generated from the selected transformation path.',
                code: entry.compiledCode || entry.code || 'apply_transform(bronze_frame)'
            }));
        }

        if (details?.logic) {
            const artifacts = [];

            if (node.type === 'category' && Array.isArray(details.transformations) && details.transformations.length > 0) {
                details.transformations.forEach((entry) => {
                    artifacts.push({
                        id: `${node.id}-${entry.id}-upstream`,
                        title: `Upstream Normalization · ${entry.title}`,
                        language: this.detectArtifactLanguage(entry.compiledCode || entry.code || ''),
                        caption: 'The pandas or SQL normalization step that feeds this feature engineering layer.',
                        code: entry.compiledCode || entry.code || 'apply_transform(bronze_frame)'
                    });
                });
            }

            if (node.type === 'category' && details.virtualization) {
                artifacts.push({
                    id: `${node.id}-virtualization-policy`,
                    title: 'Virtualization Policy',
                    language: 'yaml',
                    caption: 'Internal runtime policy for time window, cache reuse, incremental refresh, and versioning.',
                    code: [
                        `time_window: ${details.virtualization.timeWindow || 'unspecified'}`,
                        `cache_policy: ${details.virtualization.cachePolicy || 'unspecified'}`,
                        `incremental_strategy: ${details.virtualization.incrementalStrategy || 'unspecified'}`,
                        `version: ${details.virtualization.version || 'unspecified'}`,
                        `contract_revision: ${details.virtualization.contractRevision || 'unspecified'}`,
                        `materialization_hint: ${details.virtualization.materializationHint || 'virtual-only'}`
                    ].join('\n')
                });
            }

            if (details.logic.code) {
                artifacts.push({
                    id: `${node.id}-editable`,
                    title: node.type === 'category' ? 'Editable Feature Logic' : 'Editable Logic',
                    language: (details.logic.code || '').toLowerCase().includes('select') ? 'sql' : 'python',
                    caption: node.type === 'category'
                        ? 'Feature engineering logic the user can review or override.'
                        : 'The logic the user can review or override.',
                    code: details.logic.code
                });
            }

            if (details.logic.compiled_code) {
                artifacts.push({
                    id: `${node.id}-compiled`,
                    title: node.type === 'category' ? 'Compiled Feature Logic' : 'PNE Compiled Logic',
                    language: (details.logic.compiled_code || '').toLowerCase().includes('select') ? 'sql' : 'python',
                    caption: node.type === 'category'
                        ? 'The compiled feature engineering path prepared by PNE.'
                        : 'The current compiled path prepared by PNE.',
                    code: details.logic.compiled_code
                });
            }

            if (details.logic.effective_query) {
                artifacts.push({
                    id: `${node.id}-effective`,
                    title: 'Effective Query',
                    language: 'sql',
                    caption: 'The query currently used to drive the output.',
                    code: details.logic.effective_query
                });
            }

            return artifacts;
        }

        if (node.type === 'group') {
            return [{
                id: `${node.id}-group-plan`,
                title: 'Group Contract',
                language: 'yaml',
                caption: 'How this group bundles validated outputs downstream.',
                code: [
                    `group_id: ${details?.id || node.id}`,
                    `title: ${details?.title || node.label}`,
                    `activation_mode: ${details?.activationMode || 'automatic'}`,
                    `status: ${details?.status || 'active'}`,
                    `sources: [${(details?.sourceIds || []).join(', ')}]`,
                    `views: [${(details?.adjusted_data_ids || []).join(', ')}]`
                ].join('\n')
            }];
        }

        if (details?.gold) {
            return [{
                id: `${node.id}-field-context`,
                title: 'Field Context',
                language: 'python',
                caption: 'How this field participates in the current gold contract.',
                code: [
                    `field_name = "${details.column?.name || node.label}"`,
                    `gold_view = "${details.gold?.title || 'unknown'}"`,
                    `field_type = "${details.column?.type || 'unknown'}"`,
                    '',
                    '# Next step',
                    'sentinel_validate_field(field_name, gold_view)'
                ].join('\n')
            }];
        }

        if (node.type === 'card') {
            return [{
                id: `${node.id}-card-contract`,
                title: 'Widget Contract',
                language: 'yaml',
                caption: 'Current widget contract and exposed columns.',
                code: [
                    `insight_id: ${details?.id || node.id}`,
                    `title: ${details?.title || node.label}`,
                    `widget_type: ${details?.widget_type || details?.type || 'unknown'}`,
                    `activation_mode: ${details?.activationMode || 'automatic'}`,
                    `columns: [${(details?.adjusted_data_columns || []).join(', ')}]`
                ].join('\n')
            }];
        }

        return [];
    }

    detectArtifactLanguage(code = '') {
        const normalizedCode = String(code || '').toLowerCase();

        if (normalizedCode.includes('select ') || normalizedCode.includes(' from ') || normalizedCode.includes('join ')) {
            return 'sql';
        }

        if (
            normalizedCode.includes('pandas')
            || normalizedCode.includes('dataframe')
            || normalizedCode.includes('.merge(')
            || normalizedCode.includes('.groupby(')
            || normalizedCode.includes('.assign(')
        ) {
            return 'pandas';
        }

        return 'python';
    }

    buildProcessSteps(node, nodeContext) {
        if (node.type === 'source') {
            const details = nodeContext?.details || {};
            const profile = details.profile || {};
            const schedule = profile.schedule || {};

            return [
                {
                    id: `${node.id}-step-1`,
                    title: 'Pasul 1',
                    detail: `Conectam sursa ${profile.sourceName || node.label} si definim doar scheduling-ul operational al refresh-ului.`,
                    code: [
                        `source_name = "${profile.sourceName || node.label}"`,
                        `source_type = "${profile.sourceType || node.data?.connector || 'unknown'}"`,
                        `uri = "${profile.uri || node.data?.uri || 'unknown'}"`
                    ].join('\n'),
                    language: 'python',
                    status: profile.validation?.status || 'active'
                },
                {
                    id: `${node.id}-step-2`,
                    title: 'Pasul 2',
                    detail: `Programam frecventa ${schedule.frequency || 'manual'} cu lookback ${schedule.lookbackWindow || 'nespecificat'}.`,
                    code: [
                        `frequency = "${schedule.frequency || 'manual'}"`,
                        `lookback_window = "${schedule.lookbackWindow || 'unspecified'}"`,
                        `refresh_lag = "${schedule.refreshLag || 'unspecified'}"`
                    ].join('\n'),
                    language: 'python',
                    status: profile.validation?.status || 'active'
                },
                {
                    id: `${node.id}-step-3`,
                    title: 'Pasul 3',
                    detail: 'Restul deciziilor despre fereastra de date, cache si versioning sunt delegate layer-ului virtual downstream.',
                    code: [
                        'handoff_to_virtual_layer()',
                        '# window/cache/versioning are defined downstream'
                    ].join('\n'),
                    language: 'python',
                    status: 'active'
                }
            ];
        }

        if (node.type === 'action') {
            const transformations = nodeContext?.details?.transformations || [];

            return transformations.map((entry, index) => ({
                id: entry.id || `${node.id}-step-${index + 1}`,
                title: `Pasul ${index + 1}`,
                detail: entry.intent || entry.title || `Normalizam datele in pasul ${index + 1}`,
                code: entry.compiledCode || entry.code || 'apply_transform(bronze_frame)',
                language: this.detectArtifactLanguage(entry.compiledCode || entry.code || ''),
                status: entry.validation?.status || 'active'
            }));
        }

        if (node.type === 'category') {
            const details = nodeContext?.details || {};
            const columns = details.columns || [];
            const logicCode = details.logic?.compiled_code || details.logic?.code || 'SELECT * FROM bronze.source';
            const transformations = details.transformations || [];
            const virtualization = details.virtualization || {};

            const normalizationSteps = transformations.map((entry, index) => ({
                id: entry.id || `${node.id}-normalization-${index + 1}`,
                title: `Pasul ${index + 1}`,
                detail: entry.intent || entry.title || `Normalizam datele in pasul ${index + 1}`,
                code: entry.compiledCode || entry.code || 'apply_transform(bronze_frame)',
                language: this.detectArtifactLanguage(entry.compiledCode || entry.code || ''),
                status: entry.validation?.status || 'active'
            }));

            const featureEngineeringStart = normalizationSteps.length;

            return normalizationSteps.concat([
                {
                    id: `${node.id}-step-${featureEngineeringStart + 1}`,
                    title: `Pasul ${featureEngineeringStart + 1}`,
                    detail: `${details.logic?.intent || 'Pornim feature engineering-ul plecand de la layer-ul de date normalizate.'} Fereastra activa este ${virtualization.timeWindow || 'nespecificata'}.`,
                    code: logicCode,
                    language: this.detectArtifactLanguage(logicCode),
                    status: details.validation?.status || 'active'
                },
                {
                    id: `${node.id}-step-${featureEngineeringStart + 2}`,
                    title: `Pasul ${featureEngineeringStart + 2}`,
                    detail: `Construim si stabilizam feature-urile expuse in view: ${columns.map((column) => column.name).join(', ') || 'fara feature-uri definite'}. Cache policy: ${virtualization.cachePolicy || 'nespecificata'}.`,
                    code: columns.length > 0
                        ? columns.map((column, index) => `${index + 1}. ${column.name} :: ${column.type || 'unknown'}`).join('\n')
                        : '# No features defined yet',
                    language: 'text',
                    status: details.validation?.status || 'active'
                },
                {
                    id: `${node.id}-step-${featureEngineeringStart + 3}`,
                    title: `Pasul ${featureEngineeringStart + 3}`,
                    detail: `Publicam contractul virtual final pentru grupuri, insight-uri si restul fluxului downstream cu versiunea ${virtualization.version || 'nespecificata'}.`,
                    code: [
                        `view_id = "${details.id || node.id}"`,
                        `feature_count = ${columns.length}`,
                        `version = "${virtualization.version || 'unspecified'}"`,
                        `contract_revision = "${virtualization.contractRevision || 'unspecified'}"`,
                        'publish_virtual_contract(view_id)'
                    ].join('\n'),
                    language: 'python',
                    status: details.validation?.status || 'active'
                }
            ]);
        }

        if (node.type === 'group') {
            const details = nodeContext?.details || {};

            return [
                {
                    id: `${node.id}-step-1`,
                    title: 'Pasul 1',
                    detail: `Adunam gold view-urile validate in grupul ${details.title || node.label}.`,
                    code: `group_views = [${(details.adjusted_data_ids || []).map((viewId) => `"${viewId}"`).join(', ')}]`,
                    language: 'python',
                    status: details.validation?.status || details.status || 'active'
                },
                {
                    id: `${node.id}-step-2`,
                    title: 'Pasul 2',
                    detail: details.logic?.intent || 'Aplicam intentia declarata pentru activarea grupului.',
                    code: details.logic?.intent || '# No group intent defined',
                    language: 'text',
                    status: details.validation?.status || details.status || 'active'
                },
                {
                    id: `${node.id}-step-3`,
                    title: 'Pasul 3',
                    detail: `Publicam grupul cu activare ${details.activationMode || 'automatic'} pentru consumul downstream.`,
                    code: [
                        `group_id = "${details.id || node.id}"`,
                        `activation_mode = "${details.activationMode || 'automatic'}"`,
                        'publish_group_contract(group_id)'
                    ].join('\n'),
                    language: 'python',
                    status: details.validation?.status || details.status || 'active'
                }
            ];
        }

        if (node.type === 'card') {
            const details = nodeContext?.details || {};
            const logicCode = details.logic?.compiled_code || details.logic?.code || details.sql || details.query || '# No logic defined';
            const requiredFields = details.widgetContract?.requiredFields || [];

            return [
                {
                    id: `${node.id}-step-1`,
                    title: 'Pasul 1',
                    detail: details.logic?.intent || 'Compilam logica insight-ului pentru output-ul selectat.',
                    code: logicCode,
                    language: this.detectArtifactLanguage(logicCode),
                    status: details.validation?.status || details.status || 'active'
                },
                {
                    id: `${node.id}-step-2`,
                    title: 'Pasul 2',
                    detail: `Validam contractul widget-ului ${details.widget_type || details.type || 'unknown'} cu campurile ${requiredFields.join(', ') || 'neprecizate'}.`,
                    code: [
                        `widget_type = "${details.widget_type || details.type || 'unknown'}"`,
                        `required_fields = [${requiredFields.map((field) => `"${field}"`).join(', ')}]`,
                        `alignment_mode = "${details.widgetContract?.alignmentMode || 'strict'}"`
                    ].join('\n'),
                    language: 'python',
                    status: details.validation?.status || details.status || 'active'
                },
                {
                    id: `${node.id}-step-3`,
                    title: 'Pasul 3',
                    detail: `Expunem insight-ul ${details.title || node.label} in grupul downstream potrivit.`,
                    code: [
                        `insight_id = "${details.id || node.id}"`,
                        `group_id = "${details.group_id || 'unassigned'}"`,
                        'publish_insight(insight_id)'
                    ].join('\n'),
                    language: 'python',
                    status: details.validation?.status || details.status || 'active'
                }
            ];
        }

        if (node.type === 'idea') {
            const details = nodeContext?.details || {};
            const column = details.column || {};
            const gold = details.gold || {};

            return [
                {
                    id: `${node.id}-step-1`,
                    title: 'Pasul 1',
                    detail: `Preluam coloana ${column.name || node.label} din gold view-ul ${gold.title || 'necunoscut'}.`,
                    code: [
                        `field_name = "${column.name || node.label}"`,
                        `source_view = "${gold.title || 'unknown'}"`,
                        `field_type = "${column.type || 'unknown'}"`
                    ].join('\n'),
                    language: 'python',
                    status: gold.validation?.status || 'active'
                },
                {
                    id: `${node.id}-step-2`,
                    title: 'Pasul 2',
                    detail: `Pastram semantica ${column.semanticType || 'unknown'} pentru contractul virtual.`,
                    code: `semantic_type = "${column.semanticType || 'unknown'}"`,
                    language: 'python',
                    status: gold.validation?.status || 'active'
                },
                {
                    id: `${node.id}-step-3`,
                    title: 'Pasul 3',
                    detail: 'Validam campul inainte sa fie folosit in grupuri, insight-uri sau feature contracts.',
                    code: 'sentinel_validate_field(field_name, source_view)',
                    language: 'python',
                    status: gold.validation?.status || 'active'
                }
            ];
        }

        return [];
    }

    buildNodeDescription(node, nodeContext) {
        const details = nodeContext?.details || {};

        if (node.type === 'source') {
            const profile = details.profile || {};
            const schedule = profile.schedule || {};
            return profile.uri
                ? `${node.label} este sursa conectata de tip ${profile.sourceType || node.data?.connector || 'unknown'}, iar aici definim doar scheduling-ul: ${schedule.frequency || 'manual'} cu lookback ${schedule.lookbackWindow || 'nespecificat'}.`
                : `${node.label} este o sursa conectata care asteapta profilarea si pornirea fluxului downstream.`;
        }

        if (node.type === 'action') {
            const transformations = details.transformations || [];
            return transformations.length > 0
                ? transformations.map((entry) => entry.intent || entry.title).filter(Boolean).join(' ')
                : `${node.label} descrie pasii de normalizare a datelor pentru acest flux.`;
        }

        if (node.type === 'category') {
            return details.description || details.logic?.intent || `${node.label} este stratul virtual unificat care include normalizarea datelor, feature engineering-ul, fereastra de date, cache-ul incremental si versioning-ul intern.`;
        }

        if (node.type === 'group') {
            return details.logic?.intent || `${node.label} grupeaza output-urile care servesc acelasi obiectiv de business.`;
        }

        if (node.type === 'card') {
            return details.logic?.intent || `${node.label} descrie logica insight-ului si contractul widget-ului downstream.`;
        }

        if (node.type === 'idea') {
            return `Campul ${details.column?.name || node.label} este expus din ${details.gold?.title || 'gold view'} ca ${details.column?.semanticType || 'field'} ${details.column?.type ? `de tip ${details.column.type}` : ''}.`.trim();
        }

        return (node.data?.description || '').trim();
    }

    buildNodeSummary(node, nodeContext, suggestions, sentinelSummary) {
        const openAlerts = sentinelSummary.openErrors + sentinelSummary.openWarnings + sentinelSummary.openInfos;
        const sentinelSummaryText = openAlerts > 0
            ? ` Sentinel currently has ${pluralize(openAlerts, 'open alert')} on this layer.`
            : sentinelSummary.resolved > 0
                ? ` Sentinel has already resolved ${pluralize(sentinelSummary.resolved, 'issue')} here.`
                : '';

        if (node.type === 'source') {
            return `This source defines scheduling only: frequency, lookback window, and expected lag. Virtual windowing, caching, and versioning are owned downstream by the virtual layer.${sentinelSummaryText}`;
        }

        if (node.type === 'action') {
            return `This data normalization lane compiles intent into executable pandas or SQL steps before downstream feature engineering starts.${sentinelSummaryText}`;
        }

        if (node.type === 'category') {
            return `This unified virtual layer combines upstream normalization with downstream feature engineering and exposes a contract with ${node.data?.columns?.length || 0} fields, plus internal windowing, cache reuse, incremental refresh, and versioning.${sentinelSummaryText}`;
        }

        if (node.type === 'group') {
            return `This group anchors a cluster of downstream outputs around a shared business outcome.${sentinelSummaryText}`;
        }

        if (node.type === 'card') {
            return `This insight packages business logic, widget contract expectations, and the generated query path for review.${sentinelSummaryText}`;
        }

        return suggestions.length > 0
            ? `This node currently has ${pluralize(suggestions.length, 'recommendation')} attached.${sentinelSummaryText}`
            : `This node can be inspected, discussed with Parrot, and promoted through Sentinel validation.${sentinelSummaryText}`;
    }

    buildNodeInspectorPayload(node, nodeContext = this.buildNodeContext(node)) {
        const suggestions = this.buildNodeSuggestions(nodeContext);
        const validation = this.buildNodeValidation(nodeContext);
        const codeArtifacts = this.buildNodeCodeArtifacts(node, nodeContext);
        const processSteps = this.buildProcessSteps(node, nodeContext);
        const sentinelFindings = this.buildNodeSentinelFindings(node, nodeContext);
        const sentinelSummary = this.summarizeSentinelFindings(sentinelFindings);
        const lifecycleStages = this.mindmapManifest?.editing?.lifecycle || DEFAULT_LIFECYCLE;
        const isRecommended = this.isNodeRecommended(node);
        const isAccepted = this.workspaceUI.isRecommendationAccepted(node.id);
        const status = this.getStatusTone(sentinelSummary, {
            accepted: isAccepted,
            recommended: isRecommended,
            activeLabel: node.type === 'source'
                ? this.getSourceLoadState(node).readyLabel
                : 'Active'
        });

        return {
            subjectType: nodeContext.label,
            subjectName: node.label,
            description: this.buildNodeDescription(node, nodeContext),
            summary: this.buildNodeSummary(node, nodeContext, suggestions, sentinelSummary),
            statusTone: status.tone,
            statusLabel: status.label,
            audience: ['End user', 'Data engineer'],
            metrics: [
                { label: 'Suggestions', value: `${suggestions.length}` },
                { label: 'Open alerts', value: `${sentinelSummary.openErrors + sentinelSummary.openWarnings + sentinelSummary.openInfos}` },
                { label: 'Resolved', value: `${sentinelSummary.resolved}` },
                { label: 'Code paths', value: `${codeArtifacts.length}` },
                { label: 'Fields', value: `${node.data?.columns?.length || nodeContext?.details?.columns?.length || 0}` }
            ],
            lifecycle: lifecycleStages.map((stage, index) => ({
                title: this.formatStageTitle(stage),
                status: index < 2 ? 'passed' : 'pending',
                detail: `${node.label} moves through ${this.formatStageTitle(stage)} before it becomes active.`
            })),
            sentinelFindings,
            suggestions,
            validation,
            recommendationSummary: (
                isRecommended
                    ? [{
                        id: node.id,
                        title: node.label,
                        subtitle: isAccepted ? 'Accepted recommendation' : 'Pending recommendation'
                    }]
                    : []
            ).concat(suggestions.slice(0, 3).map((suggestion) => ({
                id: suggestion.id,
                title: suggestion.title,
                subtitle: suggestion.source
            }))),
            processSteps,
            codeArtifacts,
            chatSeed: [
                {
                    role: 'assistant',
                    content: `You are looking at ${node.label}. Ask Parrot what should change, what PNE planned here, or what Sentinel would reject.`
                }
            ]
        };
    }

    buildNodeViewModel(node, interactionState = {}) {
        const nodeContext = this.buildNodeContext(node);
        const sentinelSummary = this.summarizeSentinelFindings(this.buildNodeSentinelFindings(node, nodeContext));
        const isRecommended = this.isNodeRecommended(node);
        const accepted = this.workspaceUI.isRecommendationAccepted(node.id);
        const sourceLoadState = node.type === 'source' ? this.getSourceLoadState(node) : null;
        const status = this.getStatusTone(sentinelSummary, {
            accepted,
            recommended: isRecommended,
            activeLabel: node.type === 'source'
                ? sourceLoadState?.readyLabel || 'Active'
                : node.type === 'group'
                    ? 'Activation ready'
                    : 'Active'
        });

        return {
            node,
            nodeContext,
            sentinelSummary,
            isDimmed: interactionState.isDimmed || false,
            isTraceActive: interactionState.isTraceActive || false,
            isSelected: this.workspaceUI.selectedItems.has(node.id),
            isRecommended,
            accepted,
            isPendingCreation: node.type === 'card' && isRecommended && !accepted,
            status,
            sourceLoadState,
            hasIncoming: this.nodeConnectivityMap.get(node.id)?.hasIncoming || false,
            hasOutgoing: this.nodeConnectivityMap.get(node.id)?.hasOutgoing || false,
            isVisible: node.type === 'card' ? this.root.ui.isInsightVisible(node.id) : true,
            description: (node.data?.description || '').trim(),
            childIds: node.data?.childIds || [],
            isClickableCategory: false
        };
    }
}
