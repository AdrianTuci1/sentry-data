const average = (items, selector = (item) => item) => {
    if (!items.length) {
        return 0;
    }

    return items.reduce((total, item) => total + selector(item), 0) / items.length;
};

const COLUMN_WIDTHS = {
    source: 272,
    category: 260,
    group: 250,
    card: 268
};

const COLUMN_GAPS = {
    sourceToCategory: 128,
    categoryToGroup: 156,
    groupToCard: 110
};

export const calculateMindMapStats = ({
    connector = [],
    actionType = [],
    adjustedData = [],
    insight = []
}) => {
    let errors = 0;
    let warnings = 0;

    const checkStatus = (list) => list.forEach((item) => {
        if (item.status === 'error') errors += 1;
        if (item.status === 'warning') warnings += 1;
    });

    checkStatus(connector);
    checkStatus(actionType);
    adjustedData.forEach((adjustedEntry) => (adjustedEntry.columns || []).forEach((column) => {
        if (column.status === 'error') errors += 1;
        if (column.status === 'warning') warnings += 1;
    }));
    checkStatus(insight);

    return { errors, warnings };
};

export const buildMindMapLayout = ({
    connector = [],
    actionType = [],
    adjustedData = [],
    group = [],
    insight = []
}) => {
    const nodes = [];
    const edges = [];
    const seenNodeIds = new Set();
    const seenEdgeIds = new Set();

    const pushNode = (node) => {
        if (!node?.id || seenNodeIds.has(node.id)) {
            return;
        }

        seenNodeIds.add(node.id);
        nodes.push(node);
    };

    const pushEdge = (edge) => {
        if (!edge?.id || seenEdgeIds.has(edge.id)) {
            return;
        }

        seenEdgeIds.add(edge.id);
        edges.push(edge);
    };

    const X_ORIGIN = -325;
    const totalLayoutWidth = COLUMN_WIDTHS.source
        + COLUMN_GAPS.sourceToCategory
        + COLUMN_WIDTHS.category
        + COLUMN_GAPS.categoryToGroup
        + COLUMN_WIDTHS.group
        + COLUMN_GAPS.groupToCard
        + COLUMN_WIDTHS.card;
    const layoutLeftEdge = -(totalLayoutWidth / 2);
    const X_SOURCE = layoutLeftEdge + COLUMN_WIDTHS.source;
    const X_ADJUSTED = X_SOURCE + COLUMN_GAPS.sourceToCategory;
    const X_GROUP = X_ADJUSTED + COLUMN_WIDTHS.category + COLUMN_GAPS.categoryToGroup;
    const X_INSIGHT = X_GROUP + COLUMN_WIDTHS.group + COLUMN_GAPS.groupToCard;

    const ITEM_HEIGHT = 55;
    const GROUP_GAP = 90;
    const ORPHAN_GAP = 78;
    const CATEGORY_BASE_HEIGHT = 82;
    const CATEGORY_FIELD_STEP = 12;
    const CATEGORY_GROUP_GAP = 42;

    const getCategoryBlockHeight = (columns = []) => {
        const extraFields = Math.max((columns.length || 0) - 1, 0);
        return CATEGORY_BASE_HEIGHT + (extraFields * CATEGORY_FIELD_STEP);
    };

    const adjustedNodesBySourceId = new Map();
    const categoryNodesById = new Map();
    let transformedLayerBottomY = null;

    const totalAdjustedHeight = adjustedData.length > 0
        ? adjustedData.reduce((acc, adjustedEntry) => acc + getCategoryBlockHeight(adjustedEntry.columns || []), 0) + ((adjustedData.length - 1) * CATEGORY_GROUP_GAP)
        : 0;

    let startY = -(totalAdjustedHeight / 2);

    adjustedData.forEach((adjustedEntry) => {
        const columns = adjustedEntry.columns || [];
        const adjustedStartY = startY;
        const categoryBlockHeight = getCategoryBlockHeight(columns);
        const adjustedY = adjustedStartY + (categoryBlockHeight / 2);

        const adjustedNode = {
            id: `adj-${adjustedEntry.id}`,
            type: 'category',
            label: adjustedEntry.title || adjustedEntry.name,
            x: X_ADJUSTED,
            y: adjustedY,
            parentId: `org-${adjustedEntry.origin_id || 'root'}`,
            data: { childIds: columns.map((column) => column.id), ...adjustedEntry }
        };

        pushNode(adjustedNode);
        categoryNodesById.set(adjustedEntry.id, adjustedNode);

        const sourceId = adjustedEntry.origin_id || adjustedEntry.action_type_id?.replace(/^action-/, '');
        if (sourceId) {
            if (!adjustedNodesBySourceId.has(sourceId)) {
                adjustedNodesBySourceId.set(sourceId, []);
            }

            adjustedNodesBySourceId.get(sourceId).push(adjustedNode);
        }

        const adjustedBottomY = adjustedStartY + categoryBlockHeight;
        transformedLayerBottomY = transformedLayerBottomY == null
            ? adjustedBottomY
            : Math.max(transformedLayerBottomY, adjustedBottomY);

        startY = adjustedStartY + categoryBlockHeight + CATEGORY_GROUP_GAP;
    });

    void actionType;

    const leftNodeCount = Math.max(connector.length, 1);
    const fallbackStartY = -(((leftNodeCount - 1) * ORPHAN_GAP) / 2);
    let orphanIndex = 0;
    const orphanYByKey = new Map();

    const getLineageBottomY = () => {
        if (transformedLayerBottomY != null) {
            return transformedLayerBottomY + GROUP_GAP;
        }

        return fallbackStartY;
    };

    const getOrphanY = (key) => {
        if (!orphanYByKey.has(key)) {
            orphanYByKey.set(key, getLineageBottomY() + (orphanIndex * ORPHAN_GAP));
            orphanIndex += 1;
        }

        return orphanYByKey.get(key);
    };

    connector.forEach((source) => {
        const relatedAdjustedNodes = adjustedNodesBySourceId.get(source.id) || [];
        const sourceY = relatedAdjustedNodes.length > 0
            ? average(relatedAdjustedNodes, (node) => node.y)
            : getOrphanY(`orphan-chain:${source.id}`);

        const sourceNode = {
            id: `conn-${source.id}`,
            type: 'source',
            label: source.name,
            iconType: source.type,
            x: X_SOURCE,
            y: sourceY,
            data: source
        };

        pushNode(sourceNode);

        relatedAdjustedNodes.forEach((adjustedNode) => {
            pushEdge({
                id: `edge-conn-${source.id}-${adjustedNode.id}`,
                sourceId: `conn-${source.id}`,
                targetId: adjustedNode.id,
                source: { x: X_SOURCE, y: sourceY },
                target: { x: X_ADJUSTED, y: adjustedNode.y }
            });
        });
    });

    const totalInsightHeight = (insight.length * ITEM_HEIGHT) + (group.length * GROUP_GAP);
    let groupStartY = -(totalInsightHeight / 2);

    group.forEach((groupEntry) => {
        const groupInsights = insight.filter((insightEntry) => insightEntry.group_id === groupEntry.id);
        const groupY = groupStartY + ((groupInsights.length * ITEM_HEIGHT) / 2);

        const groupNode = {
            id: `grp-${groupEntry.id}`,
            type: 'group',
            label: groupEntry.title || groupEntry.name,
            x: X_GROUP,
            y: groupY,
            data: groupEntry
        };

        pushNode(groupNode);

        groupInsights.forEach((insightEntry) => {
            const insightNode = {
                id: insightEntry.id,
                type: 'card',
                label: insightEntry.title || insightEntry.name,
                data: insightEntry,
                x: X_INSIGHT,
                y: groupStartY + (ITEM_HEIGHT / 2),
                parentId: `grp-${groupEntry.id}`
            };

            pushNode(insightNode);

            pushEdge({
                id: `edge-grp-${groupEntry.id}-ins-${insightEntry.id}`,
                sourceId: `grp-${groupEntry.id}`,
                targetId: insightEntry.id,
                source: { x: X_GROUP, y: groupY },
                target: { x: X_INSIGHT, y: insightNode.y }
            });

            (insightEntry.adjusted_data_columns || []).forEach((adjustedColumnName) => {
                const categoryNode = nodes.find((node) => (
                    node.type === 'category'
                    && (insightEntry.lineage?.source_keys || []).some((sourceId) => node.id === `adj-${sourceId}`)
                    && (node.data?.columns || []).some((column) => column.name === adjustedColumnName)
                ));

                if (!categoryNode) {
                    return;
                }

                pushEdge({
                    id: `edge-lin-${categoryNode.id}-grp-${groupEntry.id}`,
                    sourceId: categoryNode.id,
                    targetId: `grp-${groupEntry.id}`,
                    source: { x: X_ADJUSTED, y: categoryNode.y },
                    target: { x: X_GROUP, y: groupY },
                    isDashboardConnection: true,
                    isTracingOnly: true
                });
            });

            groupStartY += ITEM_HEIGHT;
        });

        groupStartY += GROUP_GAP;
    });

    return { nodes, edges, X_ORIGIN, X_ADJUSTED };
};
