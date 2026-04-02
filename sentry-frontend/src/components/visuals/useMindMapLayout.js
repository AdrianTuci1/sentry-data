
import { useMemo } from 'react';

export const useMindMapLayout = ({ 
    connector = [], 
    actionType = [], 
    origin = [],
    adjustedData = [], 
    group = [], 
    insight = [],
    title = "Data Pipeline" 
}) => {
    // Stats Calculation
    const stats = useMemo(() => {
        let errors = 0;
        let warnings = 0;
        
        const checkStatus = (list) => list.forEach(item => {
            if (item.status === 'error') errors++;
            if (item.status === 'warning') warnings++;
        });

        checkStatus(connector);
        checkStatus(actionType);
        adjustedData.forEach(adj => (adj.columns || []).forEach(c => {
            if (c.status === 'error') errors++;
            if (c.status === 'warning') warnings++;
        }));
        checkStatus(insight);

        return { errors, warnings };
    }, [connector, actionType, origin, adjustedData, group, insight]);

    // Layout Calculation
    const layout = useMemo(() => {
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

        // X-Coordinates for Layers
        const X_CONNECTOR  = -800;
        const X_ACTION     = -550;
        const X_ORIGIN     = -325;
        const X_ADJUSTED   = -100;
        const X_COLUMNS    = 250;
        const X_GROUP      = 650;
        const X_INSIGHT    = 1000;

        const ITEM_HEIGHT = 55;
        const GROUP_GAP = 90;

        // 1. DATA (CENTER BRANCH) - Centered around Y=0
        let startY = 0;
        
        // We'll calculate total height of adjustedData to center it
        const totalAdjHeight = adjustedData.reduce((acc, adj) => acc + (adj.columns?.length || 1) * ITEM_HEIGHT, 0) + (adjustedData.length - 1) * GROUP_GAP;
        startY = -(totalAdjHeight / 2);

        adjustedData.forEach((adj) => {
            const columns = adj.columns || [];
            const adjStartY = startY;
            
            columns.forEach((col) => {
                const uniqueColId = `${adj.id}-${col.id}`;
                const colNode = {
                    id: uniqueColId,
                    type: 'idea',
                    label: col.title || col.name,
                    data: col,
                    x: X_COLUMNS,
                    y: startY,
                    parentId: `adj-${adj.id}`
                };
                pushNode(colNode);
                startY += ITEM_HEIGHT;
            });

            const adjEndY = startY - ITEM_HEIGHT;
            const adjY = (adjStartY + adjEndY) / 2;

            const adjNode = {
                id: `adj-${adj.id}`,
                type: 'category',
                label: adj.title || adj.name,
                x: X_ADJUSTED,
                y: adjY,
                parentId: `org-${adj.origin_id || 'root'}`,
                data: { childIds: columns.map(c => c.id), ...adj }
            };
            pushNode(adjNode);

            columns.forEach(col => {
                const uniqueColId = `${adj.id}-${col.id}`;
                pushEdge({
                    id: `edge-adj-${adj.id}-${col.id}`,
                    sourceId: `adj-${adj.id}`,
                    targetId: uniqueColId,
                    source: { x: X_ADJUSTED, y: adjY },
                    target: { x: X_COLUMNS, y: nodes.find(n => n.id === uniqueColId).y }
                });
            });

            startY += GROUP_GAP;
        });

        // 2. LINEAGE (LEFT SIDE: Origin > ActionType > Connector)
        // Position based on the adjustedData Y positions
        adjustedData.forEach(adj => {
            const adjNode = nodes.find(n => n.id === `adj-${adj.id}`);
            if (!adjNode) return;

            // 1. ActionType
            const act = actionType.find(a => a.id === adj.action_type_id) || actionType.find(a => origin.find(o => o.id === adj.origin_id)?.action_type_id === a.id);
            if (act) {
                let actNode = nodes.find(n => n.id === `act-${act.id}`);
                if (!actNode) {
                    actNode = {
                        id: `act-${act.id}`,
                        type: 'action',
                        label: act.name,
                        x: X_ACTION,
                        y: adjNode.y,
                        data: act
                    };
                    pushNode(actNode);
                }

                pushEdge({
                    id: `edge-act-${act.id}-adj-${adj.id}`,
                    sourceId: `act-${act.id}`,
                    targetId: `adj-${adj.id}`,
                    source: { x: X_ACTION, y: actNode.y },
                    target: { x: X_ADJUSTED, y: adjNode.y }
                });

                // 2. Connector
                const conn = connector.find(c => c.id === act.connector_id) || connector[0];
                if (conn) {
                    let connNode = nodes.find(n => n.id === `conn-${conn.id}`);
                    if (!connNode) {
                        connNode = {
                            id: `conn-${conn.id}`,
                            type: 'source',
                            label: conn.name,
                            iconType: conn.type,
                            x: X_CONNECTOR,
                        y: actNode.y,
                        data: conn
                    };
                        pushNode(connNode);
                    }

                    pushEdge({
                        id: `edge-conn-${conn.id}-act-${act.id}`,
                        sourceId: `conn-${conn.id}`,
                        targetId: `act-${act.id}`,
                        source: { x: X_CONNECTOR, y: connNode.y },
                        target: { x: X_ACTION, y: actNode.y }
                    });
                }
            }
        });

        // 3. INSIGHTS (RIGHT BRANCH: Group > Insight)
        // Groups connect to adjustedData via adjusted_data_ids
        const totalInsightHeight = insight.length * ITEM_HEIGHT + (group.length * GROUP_GAP);
        let groupStartY = -(totalInsightHeight / 2);

        group.forEach(grp => {
            const grpInsights = insight.filter(ins => ins.group_id === grp.id);
            const grpY = groupStartY + (grpInsights.length * ITEM_HEIGHT) / 2;

            const grpNode = {
                id: `grp-${grp.id}`,
                type: 'group',
                label: grp.title || grp.name,
                x: X_GROUP,
                y: grpY,
                data: grp
            };
            pushNode(grpNode);

            /* 
            // Connect group to its source adjustedData nodes
            (grp.adjusted_data_ids || []).forEach(adjId => {
                const adjNode = nodes.find(n => n.id === `adj-${adjId}`);
                if (adjNode) {
                    edges.push({
                        id: `edge-adj-${adjId}-grp-${grp.id}`,
                        sourceId: `adj-${adjId}`,
                        targetId: `grp-${grp.id}`,
                        source: { x: X_ADJUSTED, y: adjNode.y },
                        target: { x: X_GROUP, y: grpY },
                        isDashboardConnection: true
                    });
                }
            });
            */

            grpInsights.forEach(ins => {
                const insNode = {
                    id: ins.id,
                    type: 'card',
                    label: ins.title || ins.name,
                    data: ins,
                    x: X_INSIGHT,
                    y: groupStartY + (ITEM_HEIGHT / 2),
                    parentId: `grp-${grp.id}`
                };
                pushNode(insNode);

                pushEdge({
                    id: `edge-grp-${grp.id}-ins-${ins.id}`,
                    sourceId: `grp-${grp.id}`,
                    targetId: ins.id,
                    source: { x: X_GROUP, y: grpY },
                    target: { x: X_INSIGHT, y: insNode.y }
                });

                // Lineage: columns -> Group (tracing lines)
                (ins.adjusted_data_columns || []).forEach(adjColName => {
                    const colNode = nodes.find(n => n.data?.name === adjColName && n.type === 'idea' && (ins.lineage?.source_keys || []).some(srcId => n.parentId === `adj-${srcId}`));
                    if (colNode) {
                        pushEdge({
                            id: `edge-lin-${colNode.id}-grp-${grp.id}`,
                            sourceId: colNode.id,
                            targetId: `grp-${grp.id}`,
                            source: { x: colNode.x, y: colNode.y },
                            target: { x: X_GROUP, y: grpY },
                            isDashboardConnection: true,
                            isTracingOnly: true
                        });
                    }
                });

                groupStartY += ITEM_HEIGHT;
            });

            groupStartY += GROUP_GAP;
        });

        return { nodes, edges };
    }, [connector, actionType, adjustedData, group, insight, title]);

    return { stats, layout };
};
