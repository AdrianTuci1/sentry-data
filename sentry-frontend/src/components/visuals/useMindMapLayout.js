
import { useMemo } from 'react';

export const useMindMapLayout = ({ tables = [], metricGroups = [], predictionModels = [], advancedAnalytics = [], dashboards = [], dashboardGroups = [], title = "Prediction Model" }) => {
    // Stats Calculation
    const stats = useMemo(() => {
        let errors = 0;
        let warnings = 0;
        // Check tables
        tables.forEach(t => t.columns.forEach(c => {
            if (c.status === 'error') errors++;
            if (c.status === 'warning') warnings++;
        }));
        // Check metric groups
        metricGroups.forEach(g => g.metrics.forEach(m => {
            if (m.status === 'error') errors++;
            if (m.status === 'warning') warnings++;
        }));
        // Check prediction models
        predictionModels.forEach(m => m.predictions.forEach(p => {
            if (p.status === 'error') errors++;
            if (p.status === 'warning') warnings++;
        }));
        // Check advanced analytics
        advancedAnalytics.forEach(g => g.items.forEach(i => {
            if (i.status === 'error') errors++;
            if (i.status === 'warning') warnings++;
        }));
        // Check dashboards
        dashboards.forEach(g => g.items.forEach(i => {
            if (i.status === 'error') errors++;
            if (i.status === 'warning') warnings++;
        }));
        return { errors, warnings };
    }, [tables, metricGroups, predictionModels, advancedAnalytics, dashboards]);

    // Layout Calculation
    const layout = useMemo(() => {
        const nodes = [];
        const edges = [];

        // Config
        const ROOT_X = -400; // Central Hub
        const CATEGORY_X = -200; // Features Column
        const FEATURE_X = 180; // Leaf Nodes (Layer 2)
        const GROUP_X = 500; // New Dashboard Groups (Layer 3)
        const DASHBOARD_X = 800; // Dashboards (Layer 4)

        const ITEM_HEIGHT = 45;
        const GROUP_GAP = 60;

        // Helper: Calculate total height of a set of tables/groups
        const getSetHeight = (items) => items.reduce((acc, t) => acc + (t.columns?.length || t.metrics?.length || 0), 0) * ITEM_HEIGHT;

        // Calculate vertical offsets
        const tablesTotalHeight = getSetHeight(tables);
        const metricsTotalHeight = getSetHeight(metricGroups);
        const predictionsTotalHeight = getSetHeight(predictionModels);
        const analyticsTotalHeight = getSetHeight(advancedAnalytics);

        // Calculate height for 3rd layer (Groups)
        // Calculate height for 3rd layer (Groups)
        const groupItemHeight = 60;
        const totalGroupHeight = dashboardGroups.reduce((acc, group) => {
            const groupDashboards = dashboards.flatMap(d => d.items).filter(db => db.groupId === group.id);
            const dbHeight = groupDashboards.length * 60;
            return acc + Math.max(groupItemHeight, dbHeight + 20);
        }, 0);

        // Calculate height for 4th layer (Dashboards) - approximate for centering
        // Or we can center groups based on their own content?
        // Let's base the main startY on the Layer 2 content (Features) as that's the anchor
        const totalContentHeight = tablesTotalHeight + metricsTotalHeight + predictionsTotalHeight + analyticsTotalHeight + (GROUP_GAP * 3);
        let startY = -(totalContentHeight / 2);

        // --- 1. Layer 2 Generation (Features / metrics / etc) ---
        const featureNodes = [];

        // Helper to find Y of a node we just pushed
        function featNodeY(allNodes, id) {
            const n = allNodes.find(n => n.id === id);
            return n ? n.y : 0;
        }

        // Tables
        tables.forEach((table) => {
            const tableFeatures = table.columns || [];
            const validChildIds = tableFeatures.filter(c => c.status !== 'error').map(c => c.id);
            const tableStartY = startY;

            tableFeatures.forEach((col) => {
                const featNode = {
                    id: col.id,
                    type: 'idea',
                    label: col.name,
                    data: col,
                    x: FEATURE_X,
                    y: startY,
                    parentId: `table-${table.id}`
                };
                nodes.push(featNode);
                startY += ITEM_HEIGHT;
            });

            const tableEndY = startY - ITEM_HEIGHT;
            const tableY = (tableStartY + tableEndY) / 2;

            const catNode = {
                id: `table-${table.id}`,
                type: 'category',
                label: table.title,
                x: CATEGORY_X,
                y: tableY,
                parentId: 'root',
                data: { childIds: validChildIds }
            };
            nodes.push(catNode);
            featureNodes.push(catNode);

            tableFeatures.forEach(col => {
                edges.push({
                    id: `edge-${table.id}-${col.id}`,
                    sourceId: `table-${table.id}`,
                    targetId: col.id,
                    source: { x: CATEGORY_X, y: tableY },
                    target: { x: FEATURE_X, y: featNodeY(nodes, col.id) }
                });
            });
        });

        if (tables.length > 0) startY += GROUP_GAP;

        // Metric Groups
        const metricGroupNodes = [];
        metricGroups.forEach((group) => {
            const groupMetrics = group.metrics || [];
            const validChildIds = groupMetrics.filter(m => m.status !== 'error').map(m => m.id);
            const groupStartY = startY;

            groupMetrics.forEach((metric) => {
                const metricNode = {
                    id: metric.id,
                    type: 'idea',
                    label: metric.name,
                    data: { ...metric, isMetric: true },
                    x: FEATURE_X,
                    y: startY,
                    parentId: `group-${group.id}`
                };
                nodes.push(metricNode);
                startY += ITEM_HEIGHT;
            });

            const groupEndY = startY - ITEM_HEIGHT;
            const groupY = (groupStartY + groupEndY) / 2;

            const groupNode = {
                id: `group-${group.id}`,
                type: 'category',
                label: group.title,
                x: CATEGORY_X,
                y: groupY,
                parentId: 'root',
                data: { childIds: validChildIds }
            };
            nodes.push(groupNode);
            metricGroupNodes.push(groupNode);

            groupMetrics.forEach(metric => {
                edges.push({
                    id: `edge-${group.id}-${metric.id}`,
                    sourceId: `group-${group.id}`,
                    targetId: metric.id,
                    source: { x: CATEGORY_X, y: groupY },
                    target: { x: FEATURE_X, y: featNodeY(nodes, metric.id) }
                });
            });
        });

        if (metricGroups.length > 0) startY += GROUP_GAP;

        // Prediction Models
        const predictionNodes = [];
        predictionModels.forEach((model) => {
            const predictions = model.predictions || [];
            const validChildIds = predictions.filter(p => p.status !== 'error').map(p => p.id);
            const modelStartY = startY;

            predictions.forEach((pred) => {
                const predNode = {
                    id: pred.id,
                    type: 'idea',
                    label: pred.name,
                    data: { ...pred, isPrediction: true },
                    x: FEATURE_X,
                    y: startY,
                    parentId: `model-${model.id}`
                };
                nodes.push(predNode);
                startY += ITEM_HEIGHT;
            });

            const modelEndY = startY - ITEM_HEIGHT;
            const modelY = (modelStartY + modelEndY) / 2;

            const modelNode = {
                id: `model-${model.id}`,
                type: 'category',
                label: model.title,
                x: CATEGORY_X,
                y: modelY,
                parentId: 'root',
                data: { childIds: validChildIds }
            };
            nodes.push(modelNode);
            predictionNodes.push(modelNode);

            predictions.forEach(pred => {
                edges.push({
                    id: `edge-${model.id}-${pred.id}`,
                    sourceId: `model-${model.id}`,
                    targetId: pred.id,
                    source: { x: CATEGORY_X, y: modelY },
                    target: { x: FEATURE_X, y: featNodeY(nodes, pred.id) }
                });
            });
        });

        if (predictionModels.length > 0) startY += GROUP_GAP;

        // Advanced Analytics
        const analyticsNodes = [];
        advancedAnalytics.forEach((group) => {
            const items = group.items || [];
            const validChildIds = items.filter(i => i.status !== 'error').map(i => i.id);
            const groupStartY = startY;

            items.forEach((item) => {
                const itemNode = {
                    id: item.id,
                    type: 'idea',
                    label: item.name,
                    data: { ...item, isAnalytics: true },
                    x: FEATURE_X,
                    y: startY,
                    parentId: `analytics-${group.id}`
                };
                nodes.push(itemNode);
                startY += ITEM_HEIGHT;
            });

            const groupEndY = startY - ITEM_HEIGHT;
            const groupY = (groupStartY + groupEndY) / 2;

            const groupNode = {
                id: `analytics-${group.id}`,
                type: 'category',
                label: group.title,
                x: CATEGORY_X,
                y: groupY,
                parentId: 'root',
                data: { childIds: validChildIds }
            };
            nodes.push(groupNode);
            analyticsNodes.push(groupNode);

            items.forEach(item => {
                edges.push({
                    id: `edge-${group.id}-${item.id}`,
                    sourceId: `analytics-${group.id}`,
                    targetId: item.id,
                    source: { x: CATEGORY_X, y: groupY },
                    target: { x: FEATURE_X, y: featNodeY(nodes, item.id) }
                });
            });
        });

        // --- 2. Layer 3: Dashboard Groups ---
        // We need to position these groups. Let's center them vertically around the same center, but maybe spaced out?
        // Or list them out like we did for categories?
        // Let's list them out
        let groupY = -(totalGroupHeight / 2);

        dashboardGroups.forEach(group => {
            const groupNode = {
                id: group.id,
                type: 'group', // New type
                label: group.title,
                x: GROUP_X,
                y: groupY,
                parentId: 'root', // Effectively root relative
            };
            nodes.push(groupNode);

            // Edges: Feature -> Group
            if (group.sources) {
                group.sources.forEach(sourceId => {
                    const sourceNode = nodes.find(n => n.id === sourceId);
                    if (sourceNode) {
                        edges.push({
                            id: `edge-${sourceId}-${group.id}`,
                            sourceId: sourceId,
                            targetId: group.id,
                            source: { x: sourceNode.x, y: sourceNode.y },
                            target: { x: GROUP_X, y: groupY },
                            isGroupConnection: true
                        });
                    }
                });
            }

            // --- 3. Layer 4: Dashboards ---
            // Find dashboards that belong to this group
            // We need to iterate through all dashboard collections to find items belonging to this group
            // Or simple flat list? The structure passed is dashboards[0].items...
            const groupDashboards = [];
            dashboards.forEach(dCollection => {
                dCollection.items.forEach(db => {
                    if (db.groupId === group.id) {
                        groupDashboards.push(db);
                    }
                });
            });

            // Position dashboards to the right of this group
            // Spread them vertically centered around the groupY?
            const dbItemHeight = 60;
            const totalDbHeight = groupDashboards.length * dbItemHeight;
            let dbY = groupY - (totalDbHeight / 2) + (dbItemHeight / 2);

            // Adjust groupY step to encompass its children? 
            // Better: Simple tree layout. If we have multiple children, spread them.
            // For now, let's keep it simple.

            groupDashboards.forEach(db => {
                const dbNode = {
                    id: db.id,
                    type: 'card',
                    label: db.name,
                    data: { ...db, isDashboard: true },
                    x: DASHBOARD_X,
                    y: dbY,
                    parentId: group.id
                };
                nodes.push(dbNode);

                // Edge: Group -> Dashboard
                edges.push({
                    id: `edge-${group.id}-${db.id}`,
                    sourceId: group.id,
                    targetId: db.id,
                    source: { x: GROUP_X, y: groupY },
                    target: { x: DASHBOARD_X, y: dbY },
                    isDashboardConnection: true
                });

                dbY += dbItemHeight;
            });

            // Move groupY down
            // If the dashboards take up more space than the group itself (usually yes), we should increment by that height?
            const verticalSpace = Math.max(groupItemHeight, totalDbHeight + 20);
            groupY += verticalSpace;
        });


        // --- 4. Root Node ---
        const allSecondLayerNodes = [...featureNodes, ...metricGroupNodes, ...predictionNodes, ...analyticsNodes];
        const rootY = allSecondLayerNodes.length > 0
            ? allSecondLayerNodes.reduce((sum, node) => sum + node.y, 0) / allSecondLayerNodes.length
            : 0;

        const rootNode = {
            id: 'root',
            type: 'theme',
            label: "BI Insights",
            x: ROOT_X,
            y: rootY,
        };
        nodes.push(rootNode);

        allSecondLayerNodes.forEach(node => {
            edges.push({
                id: `edge-root-${node.id}`,
                source: { x: ROOT_X, y: rootY },
                target: { x: node.x, y: node.y }
            });
        });

        return { nodes, edges };
    }, [tables, metricGroups, predictionModels, advancedAnalytics, dashboards, dashboardGroups, title]);

    return { stats, layout };
};
