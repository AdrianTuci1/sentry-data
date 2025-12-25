import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, Info } from 'lucide-react';

const FeatureMindMap = ({ tables = [], metricGroups = [], predictionModels = [], advancedAnalytics = [], selectedColumns = new Set(), onToggleSelection, onToggleGroup, title = "Prediction Model", scale = 1, pan = { x: 0, y: 0 }, showCosts = false }) => {
    // Stats
    // Stats
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
        return { errors, warnings };
    }, [tables, metricGroups, predictionModels, advancedAnalytics]);

    // Calculate node positions (Horizontal Dendrogram)
    const layout = useMemo(() => {
        const nodes = [];
        const edges = [];

        // Config
        const ROOT_X = -400; // Central Hub
        const CATEGORY_X = -200; // Features Column
        const METRIC_GROUP_X = -200; // Metric Groups Column (aligned with categories for now, or offset)
        const FEATURE_X = 180; // Leaf Nodes
        const ITEM_HEIGHT = 45; // Increased slightly for breathing room (was 40)
        const GROUP_GAP = 60; // Gap between Feature Tables and Metric Groups

        // --- 1. Process Feature Tables ---
        let currentY = 0;
        const featureNodes = [];
        const featureEdges = [];

        // Helper: Calculate total height of a set of tables/groups
        const getSetHeight = (items) => items.reduce((acc, t) => acc + (t.columns?.length || t.metrics?.length || 0), 0) * ITEM_HEIGHT;

        // Calculate vertical offsets to center everything
        const tablesTotalHeight = getSetHeight(tables);
        const metricsTotalHeight = getSetHeight(metricGroups);
        const predictionsTotalHeight = getSetHeight(predictionModels);
        const analyticsTotalHeight = getSetHeight(advancedAnalytics);
        const totalContentHeight = tablesTotalHeight + metricsTotalHeight + predictionsTotalHeight + analyticsTotalHeight + (GROUP_GAP * 3);

        let startY = -(totalContentHeight / 2);

        // -- Features Section --
        tables.forEach((table) => {
            const tableFeatures = table.columns || [];
            const validChildIds = tableFeatures.filter(c => c.status !== 'error').map(c => c.id);
            const tableStartY = startY;

            // Generate Feature Nodes (Leaves)
            // ... (unchanged iteration logic for nodes, but skipped here for brevity if possible, or copied exact) 
            // Better to target the category creation part specifically if context allows, or safer to replace the whole block if stable.
            // Let's replace the loop content around category creation.

            // Generate Feature Nodes (Leaves)
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

            // Table Node (Category Aggregator)
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

            // Connect Table -> Features
            tableFeatures.forEach(col => {
                edges.push({
                    id: `edge-${table.id}-${col.id}`,
                    source: { x: CATEGORY_X, y: tableY },
                    target: { x: FEATURE_X, y: featNodeY(nodes, col.id) }
                });
            });
        });

        // Add Gap between Features and Metrics
        startY += GROUP_GAP;

        // -- Metric Groups Section --
        const metricGroupNodes = [];

        metricGroups.forEach((group) => {
            const groupMetrics = group.metrics || []; // Array of { id, name, value, status... }
            const validChildIds = groupMetrics.filter(m => m.status !== 'error').map(m => m.id);
            const groupStartY = startY;

            // Generate Metric Nodes (Leaves)
            groupMetrics.forEach((metric) => {
                const metricNode = {
                    id: metric.id,
                    type: 'idea',
                    label: metric.name, // e.g. "ROI", "Conversion"
                    data: { ...metric, isMetric: true },
                    x: FEATURE_X,
                    y: startY,
                    parentId: `group-${group.id}`
                };
                nodes.push(metricNode);
                startY += ITEM_HEIGHT;
            });

            // Group Node
            const groupEndY = startY - ITEM_HEIGHT;
            const groupY = (groupStartY + groupEndY) / 2;

            const groupNode = {
                id: `group-${group.id}`,
                type: 'category',
                label: group.title,
                x: CATEGORY_X, // Same column as tables
                y: groupY,
                parentId: 'root',
                data: { childIds: validChildIds }
            };
            nodes.push(groupNode);
            metricGroupNodes.push(groupNode);

            // Connect Group -> Metrics
            groupMetrics.forEach(metric => {
                edges.push({
                    id: `edge-${group.id}-${metric.id}`,
                    source: { x: CATEGORY_X, y: groupY },
                    target: { x: FEATURE_X, y: featNodeY(nodes, metric.id) }
                });
            });
        });

        // Add Gap
        if (metricGroups.length > 0) startY += GROUP_GAP;

        // -- Prediction Models Section --
        const predictionNodes = [];

        predictionModels.forEach((model) => {
            const predictions = model.predictions || [];
            const validChildIds = predictions.filter(p => p.status !== 'error').map(p => p.id);
            const modelStartY = startY;

            // Generate Prediction Nodes (Leaves)
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

            // Model Node
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

            // Connect Model -> Predictions
            predictions.forEach(pred => {
                edges.push({
                    id: `edge-${model.id}-${pred.id}`,
                    source: { x: CATEGORY_X, y: modelY },
                    target: { x: FEATURE_X, y: featNodeY(nodes, pred.id) }
                });
            });
        });

        // Add Gap
        if (predictionModels.length > 0) startY += GROUP_GAP;

        // -- Advanced Analytics Section --
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

            // Analytics Group Node
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

            // Connect Group -> Items
            items.forEach(item => {
                edges.push({
                    id: `edge-${group.id}-${item.id}`,
                    source: { x: CATEGORY_X, y: groupY },
                    target: { x: FEATURE_X, y: featNodeY(nodes, item.id) }
                });
            });
        });

        // Helper to find Y of a node we just pushed
        function featNodeY(allNodes, id) {
            const n = allNodes.find(n => n.id === id);
            return n ? n.y : 0;
        }

        // --- 3. Root Node (Central BI Chart) ---
        // Center root based on all categories
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

        // Connect Root -> All Second Layer Nodes
        allSecondLayerNodes.forEach(node => {
            edges.push({
                id: `edge-root-${node.id}`,
                source: { x: ROOT_X, y: rootY },
                target: { x: node.x, y: node.y }
            });
        });

        return { nodes, edges };
    }, [tables, metricGroups, predictionModels, advancedAnalytics, title]);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* HUD / Toolbar */}
            <div className="absolute top-4 left-4 z-20 pointer-events-auto bg-[#1E1F20]/90 backdrop-blur border border-[#444746] p-3 rounded-xl shadow-xl flex gap-4 items-center animate-in slide-in-from-top-4">
                <div className="font-semibold text-[#E3E3E3] text-sm pr-2 border-r border-[#444746]">{title}</div>

                <div className="flex gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#C4C7C5]">
                        <AlertTriangle size={14} className="text-red-500" />
                        <span className="text-red-400 font-bold">{stats.errors}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#C4C7C5]">
                        <AlertTriangle size={14} className="text-yellow-500" />
                        <span className="text-yellow-400 font-bold">{stats.warnings}</span>
                    </div>
                </div>
            </div>

            {/* Transformed Content */}
            <div
                className="w-full h-full relative flex items-center justify-center transition-transform duration-75 ease-out will-change-transform"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
            >
                {/* We translate the entire container to center the (0,0) coordinate visually */}
                <div className="relative w-0 h-0">

                    {/* 1. Connections Layer (SVG) */}
                    <svg className="absolute top-0 left-0 overflow-visible" style={{ zIndex: -1 }}>
                        {layout.edges.map(edge => (
                            <path
                                key={edge.id}
                                d={
                                    // Horizontal Cubic Bezier
                                    `M ${edge.source.x} ${edge.source.y}
                                     C ${edge.source.x + 100} ${edge.source.y},
                                       ${edge.target.x - 100} ${edge.target.y},
                                       ${edge.target.x} ${edge.target.y}`
                                }
                                fill="none"
                                stroke="#505357"
                                strokeWidth="1.5"
                                className="opacity-60"
                            />
                        ))}
                    </svg>

                    {/* 2. Nodes Layer (HTML) */}
                    {layout.nodes.map(node => {
                        // THEME NODE (Left)
                        if (node.type === 'theme') {
                            return (
                                <div
                                    key={node.id}
                                    className="absolute transform -translate-x-full -translate-y-1/2 pointer-events-auto flex items-center justify-end pr-2"
                                    style={{ left: node.x, top: node.y, maxWidth: 220 }}
                                >
                                    <span className="text-[#E3E3E3] font-bold text-lg text-right leading-tight mr-3">{node.label}</span>
                                    <div className="w-4 h-4 rounded-full bg-[#A8C7FA] shadow-[0_0_10px_rgba(168,199,250,0.5)] z-10 shrink-0" />
                                </div>
                            );
                        }

                        // CATEGORY NODES (Middle)
                        if (node.type === 'category') {
                            const childIds = node.data?.childIds || [];
                            const isClickable = childIds.length > 0 && onToggleGroup;

                            return (
                                <div
                                    key={node.id}
                                    className={clsx(
                                        "absolute transform -translate-y-1/2 pointer-events-auto flex items-center group/cat",
                                        isClickable && "cursor-pointer"
                                    )}
                                    style={{ left: node.x, top: node.y }}
                                    onClick={() => isClickable && onToggleGroup(childIds)}
                                >
                                    <div className={clsx(
                                        "w-3 h-3 rounded-full border z-10 shrink-0 mr-3 transition-colors",
                                        isClickable ? "bg-[#444746] border-[#555] group-hover/cat:bg-[#555] group-hover/cat:border-[#777]" : "bg-[#444746] border-[#555]"
                                    )} />
                                    <span className={clsx(
                                        "text-[#C4C7C5] font-medium text-sm transition-colors",
                                        isClickable && "group-hover/cat:text-[#E3E3E3]"
                                    )}>{node.label}</span>
                                </div>
                            );
                        }

                        // FEATURE / METRIC / PREDICTION / ANALYTICS NODES (Right)
                        // Small Dot + Text
                        const status = node.data.status;
                        const isWarning = status === 'warning';
                        const isError = status === 'error';

                        return (
                            <div
                                key={node.id}
                                className="absolute transform -translate-y-1/2 pointer-events-auto group flex items-center"
                                style={{ left: node.x, top: node.y }}
                            >
                                {/* Dot Indicator */}
                                <div className={clsx(
                                    "w-3 h-3 rounded-full z-10 shrink-0 mr-3 transition-all duration-200",
                                    isError
                                        ? "bg-red-500"
                                        : isWarning
                                            ? "bg-yellow-500"
                                            : "bg-[#444746]"
                                )} />

                                {/* Text Label */}
                                <span className={clsx(
                                    "text-sm transition-colors whitespace-nowrap text-[#80868B]",
                                    (isError || isWarning) ? "text-[#C4C7C5]" : "group-hover:text-[#C4C7C5]"
                                )}>
                                    {node.label}
                                </span>

                                {/* Cost Preview Badge (If ShowCosts is ON) */}
                                {showCosts && (
                                    <div className="ml-3 px-1.5 py-0.5 rounded-md bg-[#131314]/80 border border-[#333537] text-[10px] text-[#A8C7FA] opacity-0 group-hover:opacity-100 transition-opacity">
                                        $0.05
                                    </div>
                                )}

                                {/* Mini Warning/Error Icon (Optional, inline) */}
                                {isError && <AlertTriangle size={12} className="text-red-500 ml-2" />}
                                {isWarning && <AlertTriangle size={12} className="text-yellow-500 ml-2" />}

                                {/* Tooltip */}
                                {(isError || isWarning) && (
                                    <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 w-48 bg-[#2A2B2D] text-white text-xs p-3 rounded-xl border border-[#444746] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        <div className="font-semibold mb-1 flex items-center gap-2">
                                            <Info size={12} className={isError ? "text-red-400" : "text-yellow-400"} />
                                            Issue Detected
                                        </div>
                                        <p className="text-[#C4C7C5]">
                                            {node.data.issue}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default FeatureMindMap;
