import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import { clsx } from 'clsx';
import {
    AlertTriangle,
    Info,
    LayoutDashboard,
    FolderKanban,
    Globe,
    Activity,
    Box,
    Database,
    Code2,
    Sparkles,
    Shield,
    Check,
    CheckCircle2,
    Clock3
} from 'lucide-react';
import { useMindMapLayout } from './useMindMapLayout';

const SentinelFindingBadges = ({ summary, compact = false, align = 'left' }) => {
    if (!summary || (!summary.openErrors && !summary.openWarnings && !summary.openInfos && !summary.resolved)) {
        return null;
    }

    const alertCount = summary.openWarnings + summary.openInfos;

    return (
        <div className={clsx('flex flex-wrap items-center gap-1.5', align === 'right' && 'justify-end')}>
            {summary.openErrors > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-1 text-[10px] font-medium text-rose-300">
                    <AlertTriangle size={11} />
                    {compact ? summary.openErrors : `${summary.openErrors} error${summary.openErrors === 1 ? '' : 's'}`}
                </span>
            )}
            {alertCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-300">
                    <Shield size={11} />
                    {compact ? alertCount : `${alertCount} alert${alertCount === 1 ? '' : 's'}`}
                </span>
            )}
            {summary.resolved > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-300">
                    <CheckCircle2 size={11} />
                    {compact ? summary.resolved : `${summary.resolved} resolved`}
                </span>
            )}
        </div>
    );
};

const FeatureMindMap = observer(({ onNodeClick, showCosts = false }) => {
    const { workspaceStore } = useStore();
    const { ui, data, editor } = workspaceStore;

    const { scale, pan, selectedItems: selectedColumns } = ui;
    const {
        connector,
        actionType,
        origin,
        adjustedData,
        group,
        insight,
        mindmapManifest,
        mindmapYaml,
        sourceMetadata
    } = data;

    const { layout } = useMindMapLayout({
        connector,
        actionType,
        origin,
        adjustedData,
        group,
        insight
    });

    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const [focusedSectionId, setFocusedSectionId] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (!event.target.closest('[data-mindmap-interactive="true"]')) {
                setActiveMenu(null);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setActiveMenu(null);
                setFocusedSectionId(null);
            }
        };

        window.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('keydown', handleEscape);

        return () => {
            window.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const nodeMap = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout.nodes]);

    const manifestSources = mindmapManifest?.layers?.sources || [];
    const manifestGroups = mindmapManifest?.layers?.groups || [];
    const manifestInsights = mindmapManifest?.layers?.insights || [];
    const manifestTransformations = mindmapManifest?.layers?.transformations || {};
    const manifestGold = mindmapManifest?.layers?.gold || {};

    const sourceLayerMap = useMemo(
        () => new Map(manifestSources.map((item) => [item.id, item])),
        [manifestSources]
    );

    const sourceProfileMap = useMemo(
        () => new Map((sourceMetadata || []).map((item) => [item.sourceId, item])),
        [sourceMetadata]
    );

    const groupMap = useMemo(
        () => new Map(manifestGroups.map((item) => [item.id, item])),
        [manifestGroups]
    );

    const insightMap = useMemo(
        () => new Map(manifestInsights.map((item) => [item.id, item])),
        [manifestInsights]
    );

    const goldMap = useMemo(() => {
        const flatViews = Object.values(manifestGold).flat();
        return new Map(flatViews.map((item) => [item.id, item]));
    }, [manifestGold]);

    const sectionModels = useMemo(() => ({
        sources: {
            id: 'sources',
            label: 'Sources',
            description: 'Discovery, schema profiling, and source-level metadata.',
            items: (sourceMetadata || []).map((profile) => ({
                source: sourceLayerMap.get(profile.sourceId) || null,
                profile,
                transformations: manifestTransformations[profile.sourceId] || [],
                gold: manifestGold[profile.sourceId] || []
            })),
            layerPolicy: mindmapManifest?.editing?.layerPolicies?.sources || null
        },
        transformations: {
            id: 'transformations',
            label: 'Transforms',
            description: 'Intent-first transformation rules compiled from Bronze.',
            items: Object.entries(manifestTransformations).flatMap(([sourceId, items]) => items.map((item) => ({
                sourceId,
                ...item
            }))),
            layerPolicy: mindmapManifest?.editing?.layerPolicies?.transformations || null
        },
        gold: {
            id: 'gold',
            label: 'Gold Views',
            description: 'Virtual gold views and contracts used for groups and widgets.',
            items: Object.entries(manifestGold).flatMap(([sourceId, items]) => items.map((item) => ({
                sourceId,
                ...item
            }))),
            layerPolicy: mindmapManifest?.editing?.layerPolicies?.gold || null
        },
        groups: {
            id: 'groups',
            label: 'Groups',
            description: 'Activation groups that bundle downstream business outputs.',
            items: manifestGroups,
            layerPolicy: mindmapManifest?.editing?.layerPolicies?.groups || null
        },
        insights: {
            id: 'insights',
            label: 'Insights',
            description: 'Insight nodes, widget contracts, and executable logic.',
            items: manifestInsights,
            layerPolicy: mindmapManifest?.editing?.layerPolicies?.insights || null
        }
    }), [sourceMetadata, sourceLayerMap, manifestTransformations, manifestGold, manifestGroups, manifestInsights, mindmapManifest]);

    const onToggleSelection = (id) => ui.toggleSelection(id);
    const onToggleGroup = (ids) => ui.toggleGroup(ids);

    const getSectionIdForNode = (node) => {
        if (!node) return null;
        if (node.type === 'source') return 'sources';
        if (node.type === 'action') return 'transformations';
        if (node.type === 'category' || node.type === 'idea') return 'gold';
        if (node.type === 'group') return 'groups';
        if (node.type === 'card') return 'insights';
        return null;
    };

    const getViewportStyle = (x, y, transform = 'translate(-50%, -100%)') => ({
        left: `calc(50% + ${pan.x + (x * scale)}px)`,
        top: `calc(50% + ${pan.y + (y * scale)}px)`,
        transform
    });

    const openCodeDocument = (title, code, type = 'python', recurrence = 'manual', payload = null) => {
        editor.openCode({
            isOpen: true,
            nodeId: title,
            title,
            code,
            type,
            recurrence,
            payload
        });
        setActiveMenu(null);
    };

    const openInspectorDocument = (title, payload, initialTab = 'overview') => {
        editor.openInspector({
            isOpen: true,
            nodeId: title,
            title,
            payload,
            initialTab,
            type: 'python'
        });
        setActiveMenu(null);
    };

    const formatStageTitle = (value) => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

    const normalizeSentinelFinding = (finding, prefix, index, fallbackTitle = 'Sentinel finding') => ({
        id: finding?.id || `${prefix}-${index}`,
        severity: finding?.severity || (finding?.status === 'resolved' ? 'info' : 'warning'),
        status: finding?.status === 'resolved' ? 'resolved' : 'open',
        title: finding?.title || fallbackTitle,
        detail: finding?.detail || finding?.message || '',
        resolution: finding?.resolution || '',
        source: finding?.source || 'sentinel'
    });

    const deriveFindingsFromChecks = (checks = [], prefix, label) => (
        checks.flatMap((check, index) => {
            if (check.status === 'failed') {
                return [normalizeSentinelFinding({
                    severity: 'error',
                    status: 'open',
                    title: `${formatStageTitle(check.name || 'validation')} failed`,
                    detail: check.message || `${label} failed a Sentinel validation check.`
                }, prefix, index, label)];
            }

            if (check.status === 'pending') {
                return [normalizeSentinelFinding({
                    severity: 'warning',
                    status: 'open',
                    title: `${formatStageTitle(check.name || 'validation')} needs review`,
                    detail: check.message || `${label} is waiting for Sentinel review.`
                }, prefix, index, label)];
            }

            return [];
        })
    );

    const dedupeSentinelFindings = (findings) => {
        const deduped = new Map();
        findings.forEach((finding) => {
            if (finding?.id && !deduped.has(finding.id)) {
                deduped.set(finding.id, finding);
            }
        });
        return Array.from(deduped.values());
    };

    const collectEntrySentinelFindings = (entry, prefix, label) => {
        if (!entry) return [];

        const explicitFindings = Array.isArray(entry.sentinelFindings)
            ? entry.sentinelFindings.map((finding, index) => normalizeSentinelFinding(
                finding,
                `${prefix}-explicit`,
                index,
                label || entry.title || entry.sourceName || 'Sentinel finding'
            ))
            : [];

        if (explicitFindings.length > 0) {
            return explicitFindings;
        }

        return deriveFindingsFromChecks(
            entry.validation?.checks || [],
            `${prefix}-derived`,
            label || entry.title || entry.sourceName || 'Sentinel finding'
        );
    };

    const summarizeSentinelFindings = (findings = []) => findings.reduce((summary, finding) => {
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

    const getStatusTone = (summary, fallback = {}) => {
        if (summary.openErrors > 0) {
            return {
                tone: 'error',
                label: `${summary.openErrors} error${summary.openErrors === 1 ? '' : 's'}`
            };
        }

        const openAlerts = summary.openWarnings + summary.openInfos;
        if (openAlerts > 0) {
            return {
                tone: 'warning',
                label: `${openAlerts} alert${openAlerts === 1 ? '' : 's'}`
            };
        }

        if (summary.resolved > 0) {
            return {
                tone: 'resolved',
                label: `${summary.resolved} resolved`
            };
        }

        if (fallback.accepted) {
            return {
                tone: 'accepted',
                label: 'Accepted'
            };
        }

        if (fallback.recommended) {
            return {
                tone: 'recommended',
                label: 'Pending review'
            };
        }

        return {
            tone: 'active',
            label: fallback.activeLabel || 'Active'
        };
    };

    const collectSectionSuggestions = (sectionId) => {
        const section = sectionModels[sectionId];
        const items = section?.items || [];

        return sectionId === 'sources'
            ? items.flatMap((item) => {
                const transformSuggestions = (item?.transformations || []).flatMap((entry) => (entry?.suggestions || []).map((suggestion) => ({
                    item_id: entry?.id || item?.profile?.sourceId || 'unknown',
                    item_title: entry?.title || item?.profile?.sourceName || 'Untitled',
                    ...suggestion
                })));

                const goldSuggestions = (item?.gold || []).flatMap((entry) => (entry?.suggestions || []).map((suggestion) => ({
                    item_id: entry?.id || item?.profile?.sourceId || 'unknown',
                    item_title: entry?.title || item?.profile?.sourceName || 'Untitled',
                    ...suggestion
                })));

                return transformSuggestions.concat(goldSuggestions);
            })
            : items.flatMap((item) => (item?.suggestions || []).map((suggestion) => ({
                item_id: item?.id || item?.profile?.sourceId || item?.sourceId || 'unknown',
                item_title: item?.title || item?.profile?.sourceName || item?.label || item?.sourceId || 'Untitled',
                ...suggestion
            })));
    };

    const buildSectionCodeArtifacts = (sectionId) => {
        const section = sectionModels[sectionId];
        const items = section?.items || [];

        if (sectionId === 'groups') {
            return items.map((item) => ({
                id: item.id,
                title: item.title || item.name,
                language: 'python',
                caption: 'Group activation logic and next-step summary.',
                code: [
                    `# Group control plan for ${item.title || item.name}`,
                    `group_id = "${item.id}"`,
                    `activation_mode = "${item.activationMode || item.activation_mode || 'manual'}"`,
                    `status = "${item.status}"`,
                    `intent = "${item.logic?.intent || 'No intent attached yet.'}"`,
                    '',
                    '# Next step',
                    'if sentinel_validate(group_id):',
                    '    activate_group(group_id)',
                    'else:',
                    '    keep_pending(group_id)'
                ].join('\n')
            }));
        }

        if (sectionId === 'insights') {
            return items.map((item) => ({
                id: item.id,
                title: item.title,
                language: (item.logic?.effective_query || item.logic?.code || '').toLowerCase().includes('select') ? 'sql' : 'python',
                caption: 'PNE-compiled logic for the active or proposed insight.',
                code: item.logic?.effective_query || item.logic?.compiled_code || item.logic?.code || '# No compiled logic yet'
            }));
        }

        if (sectionId === 'gold') {
            return items.map((item) => ({
                id: item.id,
                title: item.title,
                language: 'sql',
                caption: `Virtual gold path with ${item.columns?.length || 0} fields.`,
                code: item.logic?.compiled_code || item.logic?.code || 'SELECT * FROM bronze.source'
            }));
        }

        if (sectionId === 'transformations') {
            return items.map((item) => ({
                id: item.id,
                title: item.title,
                language: 'python',
                caption: 'Compiled transformation step generated or aligned by PNE.',
                code: item.compiledCode || item.code || 'apply_transform(bronze_frame)'
            }));
        }

        return items.flatMap((item) => {
            const sourceName = item?.profile?.sourceName || item?.source?.name || item?.profile?.sourceId || 'source';
            return (item?.transformations || []).map((transform) => ({
                id: transform.id,
                title: `${sourceName} · ${transform.title}`,
                language: 'python',
                caption: 'Source-level transformation draft derived from discovery metadata.',
                code: transform.compiledCode || transform.code || 'apply_transform(bronze_frame)'
            }));
        });
    };

    const buildSectionInspectorPayload = (sectionId) => {
        const section = sectionModels[sectionId];
        const suggestions = collectSectionSuggestions(sectionId);
        const lifecycleStages = mindmapManifest?.editing?.lifecycle || ['draft', 'compile', 'dry_run', 'sentinel_validate', 'activate'];
        const codeArtifacts = buildSectionCodeArtifacts(sectionId);
        const sentinelFindings = collectSectionSentinelFindings(sectionId);
        const sentinelSummary = summarizeSentinelFindings(sentinelFindings);
        const status = getStatusTone(sentinelSummary, {
            recommended: sectionId !== 'groups' && sectionId !== 'insights',
            activeLabel: `${section?.items?.length || 0} items`
        });

        return {
            subjectType: 'Lane',
            subjectName: section?.label,
            summary: section?.description,
            statusTone: status.tone,
            statusLabel: status.label,
            audience: ['End user', 'Data engineer'],
            metrics: [
                { label: 'Items', value: `${section?.items?.length || 0}` },
                { label: 'Suggestions', value: `${suggestions.length}` },
                { label: 'Open alerts', value: `${sentinelSummary.openErrors + sentinelSummary.openWarnings + sentinelSummary.openInfos}` },
                { label: 'Resolved', value: `${sentinelSummary.resolved}` }
            ],
            lifecycle: lifecycleStages.map((stage, index) => ({
                title: formatStageTitle(stage),
                status: index < 2 ? 'passed' : 'pending',
                detail: `${section?.label} changes should pass through ${formatStageTitle(stage)} before activation.`
            })),
            sentinelFindings,
            suggestions,
            validation: {
                checks: [
                    {
                        name: 'widget_contract',
                        status: sectionId === 'insights' ? 'passed' : 'pending',
                        message: sectionId === 'insights'
                            ? 'Insight lane should match widget contracts before activation.'
                            : 'This lane is checked when it feeds widget-facing logic.'
                    },
                    {
                        name: 'safety',
                        status: 'passed',
                        message: 'All edits remain draft-first until Sentinel approves activation.'
                    }
                ]
            },
            recommendationSummary: suggestions.slice(0, 4).map((suggestion) => ({
                id: suggestion.id,
                title: suggestion.title,
                subtitle: suggestion.item_title || suggestion.item_id
            })),
            codeArtifacts,
            chatSeed: [
                {
                    role: 'assistant',
                    content: `This is the ${section?.label} lane. You can review suggestions, inspect generated code, or ask Parrot how to reshape this part of the flow.`
                }
            ]
        };
    };

    const openSectionMenu = (sectionId) => {
        const control = sectionControls.find((item) => item.id === sectionId);
        const section = sectionModels[sectionId];
        if (!control || !section) return;

        const actions = [
            {
                id: `${sectionId}-workspace`,
                icon: Info,
                label: 'Open lane',
                onSelect: () => openInspectorDocument(`${section.label} Control Room`, buildSectionInspectorPayload(sectionId), 'overview')
            },
            {
                id: `${sectionId}-draft`,
                icon: Plus,
                label: 'Create draft',
                onSelect: () => openCodeDocument(`${section.label} Draft`, buildSectionDraft(sectionId), 'yaml')
            },
            {
                id: `${sectionId}-code`,
                icon: Code2,
                label: 'Open code',
                onSelect: () => {
                    const firstArtifact = buildSectionCodeArtifacts(sectionId)[0];
                    if (firstArtifact) {
                        openCodeDocument(firstArtifact.title, firstArtifact.code, firstArtifact.language, 'manual', buildSectionInspectorPayload(sectionId));
                    } else {
                        openCodeDocument('Mindmap YAML', mindmapYaml || '# mindmap yaml unavailable', 'yaml');
                    }
                }
            }
        ];

        setActiveMenu({
            kind: 'section',
            title: `${section.label}`,
            subtitle: `${section.count || control.count} items`,
            x: control.x,
            y: control.y + 20,
            transform: 'translate(-50%, 0)',
            actions
        });
    };

    const toggleSectionFocus = (sectionId) => {
        setFocusedSectionId((current) => current === sectionId ? null : sectionId);
    };

    const buildNodeContext = (node) => {
        if (node.type === 'source') {
            const sourceId = node.data?.id || node.id.replace(/^conn-/, '');
            return {
                label: 'Source',
                details: {
                    source: sourceLayerMap.get(sourceId) || null,
                    profile: sourceProfileMap.get(sourceId) || null,
                    transformations: manifestTransformations[sourceId] || [],
                    gold: manifestGold[sourceId] || []
                }
            };
        }

        if (node.type === 'action') {
            const sourceId = node.data?.connector_id;
            return {
                label: 'Transformations',
                details: {
                    sourceId,
                    transformations: manifestTransformations[sourceId] || []
                }
            };
        }

        if (node.type === 'category') {
            const goldId = node.data?.id;
            return {
                label: 'Gold View',
                details: goldMap.get(goldId) || node.data
            };
        }

        if (node.type === 'group') {
            const groupId = node.data?.id;
            return {
                label: 'Group',
                details: groupMap.get(groupId) || node.data
            };
        }

        if (node.type === 'card') {
            return {
                label: 'Insight',
                details: insightMap.get(node.id) || node.data
            };
        }

        if (node.type === 'idea') {
            const goldId = (node.parentId || '').replace(/^adj-/, '');
            return {
                label: 'Field',
                details: {
                    column: node.data,
                    gold: goldMap.get(goldId) || null
                }
            };
        }

        return {
            label: 'Node',
            details: node.data || node
        };
    };

    const buildNodeSuggestions = (nodeContext) => {
        const details = nodeContext?.details;

        if (Array.isArray(details?.transformations) && details.transformations.length > 0) {
            return details.transformations.flatMap((item) => item?.suggestions || []);
        }

        if (details?.suggestions && details.suggestions.length > 0) {
            return details.suggestions;
        }

        return [];
    };

    const buildNodeValidation = (nodeContext) => {
        const details = nodeContext?.details;

        if (Array.isArray(details?.transformations)) {
            return {
                checks: details.transformations.flatMap((item) => (item?.validation?.checks || []).map((check) => ({
                    ...check,
                    name: check.name,
                    message: `${item.title}: ${check.message}`
                })))
            };
        }

        if (details?.validation) {
            return details.validation;
        }

        return { checks: [] };
    };

    const buildNodeSentinelFindings = (node, nodeContext) => {
        const details = nodeContext?.details;

        if (node.type === 'source') {
            return dedupeSentinelFindings([
                ...collectEntrySentinelFindings(details?.profile, `${node.id}-profile`, node.label),
                ...(details?.transformations || []).flatMap((item) => collectEntrySentinelFindings(item, `${node.id}-${item.id}`, item.title || node.label)),
                ...(details?.gold || []).flatMap((item) => collectEntrySentinelFindings(item, `${node.id}-${item.id}`, item.title || node.label))
            ]);
        }

        if (Array.isArray(details?.transformations)) {
            return dedupeSentinelFindings(
                details.transformations.flatMap((item) => collectEntrySentinelFindings(item, `${node.id}-${item.id}`, item.title || node.label))
            );
        }

        if (details?.gold || details?.column) {
            return dedupeSentinelFindings([
                ...collectEntrySentinelFindings(details?.column, `${node.id}-column`, details?.column?.name || node.label),
                ...collectEntrySentinelFindings(details?.gold, `${node.id}-gold`, details?.gold?.title || node.label)
            ]);
        }

        return dedupeSentinelFindings(collectEntrySentinelFindings(details, node.id, node.label));
    };

    const collectSectionSentinelFindings = (sectionId) => {
        const section = sectionModels[sectionId];
        const items = section?.items || [];

        if (sectionId === 'sources') {
            return dedupeSentinelFindings(items.flatMap((item) => ([
                ...collectEntrySentinelFindings(item?.profile, `${sectionId}-${item?.profile?.sourceId || 'source'}`, item?.profile?.sourceName || 'Source'),
                ...(item?.transformations || []).flatMap((entry) => collectEntrySentinelFindings(entry, `${sectionId}-${entry.id}`, entry.title || 'Transformation')),
                ...(item?.gold || []).flatMap((entry) => collectEntrySentinelFindings(entry, `${sectionId}-${entry.id}`, entry.title || 'Gold view'))
            ])));
        }

        return dedupeSentinelFindings(items.flatMap((item) => collectEntrySentinelFindings(
            item,
            `${sectionId}-${item?.id || item?.sourceId || 'item'}`,
            item?.title || item?.name || item?.sourceName || section?.label || 'Mindmap item'
        )));
    };

    const sectionFindingSummaries = useMemo(() => Object.fromEntries(
        Object.keys(sectionModels).map((sectionId) => {
            const findings = collectSectionSentinelFindings(sectionId);
            return [sectionId, summarizeSentinelFindings(findings)];
        })
    ), [sectionModels]);

    const buildNodeCodeArtifacts = (node, nodeContext) => {
        const details = nodeContext?.details;

        if (Array.isArray(details?.transformations)) {
            return details.transformations.map((item) => ({
                id: item.id,
                title: item.title,
                language: 'python',
                caption: 'Compiled transformation path generated from intent.',
                code: item.compiledCode || item.code || 'apply_transform(bronze_frame)'
            }));
        }

        if (details?.logic) {
            const artifacts = [];
            if (details.logic.code) {
                artifacts.push({
                    id: `${node.id}-editable`,
                    title: 'Editable Logic',
                    language: (details.logic.code || '').toLowerCase().includes('select') ? 'sql' : 'python',
                    caption: 'The logic the user can review or override.',
                    code: details.logic.code
                });
            }

            if (details.logic.compiled_code) {
                artifacts.push({
                    id: `${node.id}-compiled`,
                    title: 'PNE Compiled Logic',
                    language: (details.logic.compiled_code || '').toLowerCase().includes('select') ? 'sql' : 'python',
                    caption: 'The current compiled path prepared by PNE.',
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

        return [];
    };

    const buildNodeSummary = (node, nodeContext, suggestions, sentinelSummary) => {
        const openAlerts = sentinelSummary.openErrors + sentinelSummary.openWarnings + sentinelSummary.openInfos;
        const sentinelSummaryText = openAlerts > 0
            ? ` Sentinel currently has ${openAlerts} open alert${openAlerts === 1 ? '' : 's'} on this layer.`
            : sentinelSummary.resolved > 0
                ? ` Sentinel has already resolved ${sentinelSummary.resolved} issue${sentinelSummary.resolved === 1 ? '' : 's'} here.`
                : '';

        if (node.type === 'source') {
            return `This source is profiled from metadata only. PNE uses its schema, semantic candidates, and sampling hints to decide the next transformation path.${sentinelSummaryText}`;
        }
        if (node.type === 'action') {
            return `This transformation lane compiles intent into executable Python-like steps before Daft or SQL execution is generated.${sentinelSummaryText}`;
        }
        if (node.type === 'category') {
            return `This gold view exposes a virtual contract with ${node.data?.columns?.length || 0} fields. It is the place where widgets, insights, and ML recommendations attach to stable semantics.${sentinelSummaryText}`;
        }
        if (node.type === 'group') {
            return `This group anchors a cluster of downstream outputs and keeps the flow organized around a shared business outcome.${sentinelSummaryText}`;
        }
        if (node.type === 'card') {
            return `This insight packages business logic, widget contract expectations, and the generated query path for review.${sentinelSummaryText}`;
        }
        return suggestions.length > 0
            ? `This node currently has ${suggestions.length} recommendations attached.${sentinelSummaryText}`
            : `This node can be inspected, discussed with Parrot, and promoted through Sentinel validation.${sentinelSummaryText}`;
    };

    const buildNodeInspectorPayload = (node, nodeContext) => {
        const suggestions = buildNodeSuggestions(nodeContext);
        const validation = buildNodeValidation(nodeContext);
        const codeArtifacts = buildNodeCodeArtifacts(node, nodeContext);
        const sentinelFindings = buildNodeSentinelFindings(node, nodeContext);
        const sentinelSummary = summarizeSentinelFindings(sentinelFindings);
        const lifecycleStages = mindmapManifest?.editing?.lifecycle || ['draft', 'compile', 'dry_run', 'sentinel_validate', 'activate'];
        const isRecommended = node.type === 'card' && (node.data?.status === 'warning' || node.data?.activationMode === 'manual' || node.data?.activation_mode === 'manual');
        const isAccepted = ui.isRecommendationAccepted(node.id);
        const status = getStatusTone(sentinelSummary, {
            accepted: isAccepted,
            recommended: isRecommended
        });

        return {
            subjectType: nodeContext.label,
            subjectName: node.label,
            summary: buildNodeSummary(node, nodeContext, suggestions, sentinelSummary),
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
                title: formatStageTitle(stage),
                status: index < 2 ? 'passed' : 'pending',
                detail: `${node.label} moves through ${formatStageTitle(stage)} before it can become the next active version.`
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
            codeArtifacts,
            chatSeed: [
                {
                    role: 'assistant',
                    content: `You are looking at ${node.label}. Ask Parrot what should change, what PNE planned here, or what Sentinel would reject.`
                }
            ]
        };
    };

    const openNodeMenu = (event, node) => {
        event.preventDefault();
        event.stopPropagation();

        const nodeContext = buildNodeContext(node);
        const inspectorPayload = buildNodeInspectorPayload(node, nodeContext);
        const firstCodeArtifact = inspectorPayload.codeArtifacts?.[0] || null;

        const actions = [
            {
                id: `${node.id}-workspace`,
                icon: Info,
                label: 'Open details',
                onSelect: () => openInspectorDocument(`${node.label} Workspace`, inspectorPayload, 'overview')
            }
        ];

        if (firstCodeArtifact) {
            actions.push({
                id: `${node.id}-logic`,
                icon: Code2,
                label: 'Open code',
                onSelect: () => openCodeDocument(firstCodeArtifact.title, firstCodeArtifact.code, firstCodeArtifact.language, 'manual', inspectorPayload)
            });
        }

        if (!firstCodeArtifact && inspectorPayload.suggestions?.length > 0) {
            actions.push({
                id: `${node.id}-suggestions`,
                icon: Sparkles,
                label: 'Open suggestions',
                onSelect: () => openInspectorDocument(`${node.label} Suggestions`, inspectorPayload, 'suggestions')
            });
        }

        if (node.type === 'card' && (node.data?.status === 'warning' || node.data?.activationMode === 'manual' || node.data?.activation_mode === 'manual')) {
            actions.push({
                id: `${node.id}-toggle-recommendation`,
                icon: ui.isRecommendationAccepted(node.id) ? CheckCircle2 : Clock3,
                label: ui.isRecommendationAccepted(node.id) ? 'Mark pending' : 'Approve',
                onSelect: () => {
                    ui.toggleRecommendation(node.id);
                    setActiveMenu(null);
                }
            });
        }

        setActiveMenu({
            kind: 'node',
            title: node.label,
            subtitle: nodeContext.label,
            x: node.x + (node.type === 'source' ? 120 : 26),
            y: node.y - 12,
            transform: 'translate(0, -10%)',
            actions
        });
    };

    const activeTrace = useMemo(() => {
        if (!hoveredNodeId) return null;

        const visitedNodes = new Set([hoveredNodeId]);
        const visitedEdges = new Set();
        const queue = [hoveredNodeId];

        while (queue.length > 0) {
            const currentId = queue.shift();
            const currentNode = nodeMap.get(currentId);

            if (!currentNode) continue;

            layout.edges.forEach((edge) => {
                if (edge.targetId === currentId) {
                    visitedEdges.add(edge.id);
                    const sourceId = edge.sourceId;
                    if (sourceId && !visitedNodes.has(sourceId)) {
                        const sourceNode = nodeMap.get(sourceId);

                        visitedNodes.add(sourceId);

                        const isStopType = sourceNode?.type === 'idea' || sourceNode?.type === 'category';

                        if (!isStopType) {
                            queue.push(sourceId);
                        }
                    }
                }
            });
        }

        return { nodes: visitedNodes, edges: visitedEdges };
    }, [hoveredNodeId, layout.edges, nodeMap]);

    const isEdgeDimmed = (edge) => {
        const traceMismatch = activeTrace && !activeTrace.edges.has(edge.id);
        if (traceMismatch) return true;

        if (!focusedSectionId) return false;

        const sourceSection = getSectionIdForNode(nodeMap.get(edge.sourceId));
        const targetSection = getSectionIdForNode(nodeMap.get(edge.targetId));
        return sourceSection !== focusedSectionId && targetSection !== focusedSectionId;
    };

    const isNodeDimmed = (node) => {
        const traceMismatch = activeTrace && !activeTrace.nodes.has(node.id);
        if (traceMismatch) return true;

        if (!focusedSectionId) return false;
        return getSectionIdForNode(node) !== focusedSectionId;
    };

    const renderMenu = () => {
        if (!activeMenu) return null;

        return (
            <div
                data-mindmap-interactive="true"
                className="absolute z-[140] pointer-events-auto min-w-[140px] rounded-lg border border-[#34363A] bg-[#18191B]/98 px-1.5 py-1 shadow-2xl backdrop-blur-md"
                style={getViewportStyle(activeMenu.x, activeMenu.y, activeMenu.transform)}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
            >
                {activeMenu.actions.map((action) => (
                    <button
                        key={action.id}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] text-[#E3E3E3] hover:bg-[#232426]"
                        onClick={action.onSelect}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
                className="w-full h-full relative flex items-center justify-center transition-transform duration-75 ease-out will-change-transform"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
            >
                <div className="relative w-0 h-0">
                    <svg className="absolute top-0 left-0 overflow-visible" style={{ zIndex: -1 }}>
                        {layout.edges.map((edge) => {
                            const isTrace = activeTrace ? activeTrace.edges.has(edge.id) : false;
                            const isDimmed = isEdgeDimmed(edge);

                            return (
                                <path
                                    key={edge.id}
                                    d={
                                        `M ${edge.source.x} ${edge.source.y}
                                         C ${edge.source.x + 100} ${edge.source.y},
                                           ${edge.target.x - 100} ${edge.target.y},
                                           ${edge.target.x} ${edge.target.y}`
                                    }
                                    fill="none"
                                    stroke={isTrace ? '#A8C7FA' : '#505357'}
                                    strokeWidth={isTrace ? 2 : 1.5}
                                    className={clsx('transition-all duration-300', isDimmed ? 'opacity-5' : (isTrace ? 'opacity-100' : 'opacity-30'))}
                                />
                            );
                        })}
                    </svg>

                    {layout.nodes.map((node) => {
                        const isDimmedNode = isNodeDimmed(node);
                        const baseOpacity = isDimmedNode ? 'opacity-5 blur-[2px]' : 'opacity-100';
                        const baseTransition = 'transition-all duration-300';
                        const nodeContext = buildNodeContext(node);
                        const sentinelFindings = buildNodeSentinelFindings(node, nodeContext);
                        const sentinelSummary = summarizeSentinelFindings(sentinelFindings);

                        if (node.type === 'source') {
                            const Icon = node.iconType === 'db' ? Database :
                                node.iconType === 'api' ? Globe :
                                    node.iconType === 'stream' ? Activity : Box;

                            return (
                                <div
                                    key={node.id}
                                    data-mindmap-interactive="true"
                                    className={clsx('absolute transform -translate-x-full -translate-y-1/2 pointer-events-auto flex items-center justify-end pr-2 gap-3 cursor-pointer hover:scale-105 transition-transform', baseOpacity, baseTransition)}
                                    style={{ left: node.x, top: node.y, maxWidth: 220 }}
                                    onClick={() => onNodeClick && onNodeClick(node)}
                                    onContextMenu={(event) => openNodeMenu(event, node)}
                                >
                                    <div className="flex flex-col items-end">
                                        <span className="text-[#E3E3E3] font-bold text-sm text-right leading-tight">{node.label}</span>
                                        <span className="text-[#777] text-[10px] uppercase tracking-wider">{node.iconType}</span>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-[#212123] border border-[#444746] flex items-center justify-center shadow-lg z-10 shrink-0">
                                        <Icon size={20} className="text-[#A8C7FA]" />
                                    </div>
                                </div>
                            );
                        }

                        if (node.type === 'action') {
                            return (
                                <div
                                    key={node.id}
                                    data-mindmap-interactive="true"
                                    className={clsx('absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center p-2 rounded-lg bg-[#1E1F20] border border-[#444746]/50 shadow-sm z-10 cursor-pointer hover:border-[#A8C7FA] hover:bg-[#333537] transition-all', baseOpacity, baseTransition)}
                                    style={{ left: node.x, top: node.y }}
                                    onClick={() => onNodeClick && onNodeClick(node)}
                                    onContextMenu={(event) => openNodeMenu(event, node)}
                                >
                                    <span className="text-[#C4C7C5] text-[10px] font-mono uppercase tracking-wide px-1">{node.label}</span>
                                </div>
                            );
                        }

                        if (node.type === 'category') {
                            const childIds = node.data?.childIds || [];
                            const isClickable = childIds.length > 0;
                            const descriptionChip = (node.data?.description || '').trim();

                            return (
                                <div
                                    key={node.id}
                                    data-mindmap-interactive="true"
                                    className={clsx(
                                        'absolute transform -translate-y-1/2 pointer-events-auto flex items-center group/cat',
                                        isClickable && 'cursor-pointer',
                                        baseOpacity,
                                        baseTransition
                                    )}
                                    style={{ left: node.x, top: node.y }}
                                    onClick={() => isClickable && onToggleGroup(childIds)}
                                    onContextMenu={(event) => openNodeMenu(event, node)}
                                >
                                    <div className={clsx(
                                        'w-3 h-3 rounded-full border z-10 shrink-0 mr-3 transition-colors',
                                        isClickable ? 'bg-[#A8C7FA]/50 border-[#A8C7FA]/80 group-hover/cat:bg-[#A8C7FA] group-hover/cat:border-white' : 'bg-[#444746] border-[#555]'
                                    )} />
                                    <span className={clsx(
                                        'text-[#E3E3E3] font-semibold text-sm transition-colors',
                                        isClickable && 'group-hover/cat:text-white'
                                    )}>{node.label}</span>
                                    {descriptionChip && (
                                        <span className="ml-3 max-w-[220px] truncate rounded-full border border-[#3C4043] bg-[#1E1F20]/92 px-2 py-1 text-[10px] text-[#A9AFB5]">
                                            {descriptionChip}
                                        </span>
                                    )}
                                </div>
                            );
                        }

                        if (node.type === 'group') {
                            return (
                                <div
                                    key={node.id}
                                    data-mindmap-interactive="true"
                                    className={clsx('absolute transform -translate-y-1/2 pointer-events-auto flex items-center gap-3 p-2 px-4 rounded-full shadow-lg z-10 cursor-pointer border border-emerald-400/30 bg-emerald-500/12', baseOpacity, baseTransition)}
                                    style={{ left: node.x, top: node.y }}
                                    onContextMenu={(event) => openNodeMenu(event, node)}
                                >
                                    <FolderKanban size={16} className="text-emerald-300" />
                                    <span className="text-emerald-100 text-sm font-medium whitespace-nowrap">{node.label}</span>
                                </div>
                            );
                        }

                        if (node.type === 'card') {
                            const isRecommended = node.data?.status === 'warning' || node.data?.activationMode === 'manual';
                            const accepted = ui.isRecommendationAccepted(node.id);
                            const cardOpacity = isDimmedNode ? 0.05 : (isRecommended && !accepted ? 0.68 : 1);
                            const hasOpenError = sentinelSummary.openErrors > 0;
                            const hasOpenAlert = sentinelSummary.openWarnings + sentinelSummary.openInfos > 0;
                            const hasResolved = sentinelSummary.resolved > 0;
                            const InsightStatusIcon = accepted ? CheckCircle2 : (isRecommended ? Clock3 : (hasOpenError || hasOpenAlert ? AlertTriangle : null));
                            const insightIconClasses = hasOpenError
                                ? 'bg-rose-500/12 text-rose-300 ring-1 ring-rose-400/25'
                                : (hasOpenAlert || (isRecommended && !accepted))
                                    ? 'bg-amber-500/12 text-amber-200 ring-1 ring-amber-400/20'
                                    : (accepted || hasResolved)
                                        ? 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-400/25'
                                        : 'bg-[#333537] text-[#A8C7FA]';
                            const statusIconClasses = accepted
                                ? 'text-emerald-300'
                                : (isRecommended || hasOpenAlert)
                                    ? 'text-amber-300'
                                    : hasOpenError
                                        ? 'text-rose-300'
                                        : 'text-[#7D838B]';

                            return (
                                <div
                                    key={node.id}
                                    data-mindmap-interactive="true"
                                    className={clsx('absolute transform -translate-y-1/2 pointer-events-auto flex items-center gap-3 cursor-pointer', baseOpacity, baseTransition)}
                                    style={{ left: node.x, top: node.y, width: 220, opacity: cardOpacity }}
                                    onMouseEnter={() => setHoveredNodeId(node.id)}
                                    onMouseLeave={() => setHoveredNodeId(null)}
                                    onClick={() => onNodeClick && onNodeClick(node)}
                                    onContextMenu={(event) => openNodeMenu(event, node)}
                                >
                                    <div className={clsx('p-2 rounded-lg', insightIconClasses)}>
                                        <LayoutDashboard size={18} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[#E3E3E3] text-sm font-medium leading-tight">{node.label}</span>
                                        <div className="mt-1 h-1.5 w-10 rounded-full bg-white/6 overflow-hidden">
                                            <div className={clsx(
                                                'h-full rounded-full',
                                                hasOpenError
                                                    ? 'bg-rose-300'
                                                    : (hasOpenAlert || (isRecommended && !accepted))
                                                        ? 'bg-amber-300'
                                                        : (accepted || hasResolved)
                                                            ? 'bg-emerald-300'
                                                            : 'bg-[#A8C7FA]'
                                            )} />
                                        </div>
                                    </div>
                                    {InsightStatusIcon && (
                                        <button
                                            className={clsx(
                                                'ml-auto w-7 h-7 rounded-full flex items-center justify-center bg-[#2B2C2F]/85',
                                                statusIconClasses
                                            )}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                if (isRecommended) {
                                                    ui.toggleRecommendation(node.id);
                                                }
                                            }}
                                        >
                                            <InsightStatusIcon size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div
                                key={node.id}
                                data-mindmap-interactive="true"
                                className={clsx('absolute transform -translate-y-1/2 pointer-events-auto group flex items-center', baseOpacity, baseTransition)}
                                style={{ left: node.x, top: node.y }}
                                onContextMenu={node.type === 'idea' ? undefined : (event) => openNodeMenu(event, node)}
                            >
                                <div
                                    className={clsx(
                                        'w-3 h-3 rounded-full z-10 shrink-0 mr-3 transition-all duration-200 cursor-pointer',
                                        selectedColumns.has(node.id) ? 'bg-blue-500 scale-110' : 'bg-[#444746]'
                                    )}
                                    onClick={() => onToggleSelection(node.id)}
                                />

                                <span className={clsx(
                                    'text-sm transition-colors whitespace-nowrap text-[#80868B]',
                                    'group-hover:text-[#C4C7C5]',
                                    selectedColumns.has(node.id) && 'text-[#E3E3E3] font-medium'
                                )}>
                                    {node.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {renderMenu()}

            {layout.nodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0D0E]/50 backdrop-blur-[2px] z-50 pointer-events-auto">
                    <div className="flex flex-col items-center bg-[#1E1F20] border border-[#444746] p-10 rounded-3xl shadow-2xl max-w-md text-center">
                        <div className="w-16 h-16 bg-[#2D2E30] rounded-2xl flex items-center justify-center mb-6 border border-[#444746]">
                            <Database size={32} className="text-[#A8C7FA] opacity-50" />
                        </div>
                        <h3 className="text-[#E3E3E3] text-xl font-semibold mb-2">No Data Discovered Yet</h3>
                        <p className="text-[#8E918F] text-sm leading-relaxed">
                            Please connect a source and you will see data as we find it.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
});

export default FeatureMindMap;
