import React, { useState, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import { clsx } from 'clsx';
import { AlertTriangle, Info, LayoutDashboard, FolderKanban, Globe, Activity, Box, Database } from 'lucide-react';
import { useMindMapLayout } from './useMindMapLayout';

const FeatureMindMap = observer(({ onNodeClick, showCosts = false }) => {
    const { workspaceStore } = useStore();
    const { ui, data } = workspaceStore;

    // Destructure from sub-stores
    const { scale, pan, selectedItems: selectedColumns } = ui;
    const {
        tables,
        metricGroups,
        predictionModels,
        advancedAnalytics,
        dashboards,
        dashboardGroups
    } = data;

    // Layout Logic moved to hook
    const { layout } = useMindMapLayout({
        tables,
        metricGroups,
        predictionModels,
        advancedAnalytics,
        dashboards,
        dashboardGroups
    });

    const onToggleSelection = (id) => ui.toggleSelection(id);
    const onToggleGroup = (ids) => ui.toggleGroup(ids);

    // --- Trace Logic ---
    const [hoveredNodeId, setHoveredNodeId] = useState(null);

    const activeTrace = useMemo(() => {
        if (!hoveredNodeId) return null;

        const visitedNodes = new Set([hoveredNodeId]);
        const visitedEdges = new Set();
        const queue = [hoveredNodeId];

        // Trace Backwards (Target -> Source)
        while (queue.length > 0) {
            const currentId = queue.shift();

            // Find all edges where target === currentId
            layout.edges.forEach(edge => {
                if (edge.targetId === currentId) {
                    visitedEdges.add(edge.id);
                    if (edge.sourceId && !visitedNodes.has(edge.sourceId)) {
                        visitedNodes.add(edge.sourceId);

                        // Check source node type to stop recursion at Metrics/Features (Layer 2)
                        const sourceNode = layout.nodes.find(n => n.id === edge.sourceId);
                        if (sourceNode && sourceNode.type !== 'idea') {
                            queue.push(edge.sourceId);
                        }
                    }
                }
            });
        }
        return { nodes: visitedNodes, edges: visitedEdges };
    }, [hoveredNodeId, layout.edges, layout.nodes]);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Transformed Content */}
            <div
                className="w-full h-full relative flex items-center justify-center transition-transform duration-75 ease-out will-change-transform"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
            >
                <div className="relative w-0 h-0">

                    {/* 1. Connections Layer (SVG) */}
                    <svg className="absolute top-0 left-0 overflow-visible" style={{ zIndex: -1 }}>
                        {layout.edges.map(edge => {
                            const isTrace = activeTrace ? activeTrace.edges.has(edge.id) : false;
                            const isDimmed = activeTrace && !isTrace;

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
                                    stroke={isTrace ? "#A8C7FA" : "#505357"}
                                    strokeWidth={isTrace ? 2 : 1.5}
                                    className={clsx("transition-all duration-300", isDimmed ? "opacity-10" : (isTrace ? "opacity-100" : "opacity-60"))}
                                />
                            );
                        })}
                    </svg>

                    {/* 2. Nodes Layer (HTML) */}
                    {layout.nodes.map(node => {
                        const isTraceNode = activeTrace ? activeTrace.nodes.has(node.id) : false;
                        const isDimmedNode = activeTrace && !isTraceNode;
                        const baseOpacity = isDimmedNode ? "opacity-20 blur-[1px]" : "opacity-100";
                        const baseTransition = "transition-all duration-300";

                        // SOURCE NODE (Leftmost - Layer 0)
                        if (node.type === 'source') {
                            const Icon = node.iconType === 'db' ? Database :
                                node.iconType === 'api' ? Globe :
                                    node.iconType === 'stream' ? Activity : Box;

                            return (
                                <div
                                    key={node.id}
                                    className={clsx("absolute transform -translate-x-full -translate-y-1/2 pointer-events-auto flex items-center justify-end pr-2 gap-3 cursor-pointer hover:scale-105 transition-transform", baseOpacity, baseTransition)}
                                    style={{ left: node.x, top: node.y, maxWidth: 220 }}
                                    onClick={() => onNodeClick && onNodeClick(node)}
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

                        // ACTION NODE (Layer 1 - Transformation)
                        if (node.type === 'action') {
                            return (
                                <div
                                    key={node.id}
                                    className={clsx("absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center p-2 rounded-lg bg-[#1E1F20] border border-[#444746]/50 shadow-sm z-10 cursor-pointer hover:border-[#A8C7FA] hover:bg-[#333537] transition-all", baseOpacity, baseTransition)}
                                    style={{ left: node.x, top: node.y }}
                                    onClick={() => onNodeClick && onNodeClick(node)}
                                >
                                    <span className="text-[#C4C7C5] text-[10px] font-mono uppercase tracking-wide px-1">{node.label}</span>
                                </div>
                            );
                        }

                        // CATEGORY NODES (Middle)
                        if (node.type === 'category') {
                            const childIds = node.data?.childIds || [];
                            const isClickable = childIds.length > 0;

                            return (
                                <div
                                    key={node.id}
                                    className={clsx(
                                        "absolute transform -translate-y-1/2 pointer-events-auto flex items-center group/cat",
                                        isClickable && "cursor-pointer",
                                        baseOpacity, baseTransition
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

                        // DASHBOARD GROUPS (Layer 3)
                        if (node.type === 'group') {
                            return (
                                <div
                                    key={node.id}
                                    className={clsx("absolute transform -translate-y-1/2 pointer-events-auto flex items-center gap-3 p-2 px-4 bg-[#212123] border border-[#555] rounded-full shadow-lg z-10", baseOpacity, baseTransition)}
                                    style={{ left: node.x, top: node.y }}
                                >
                                    <FolderKanban size={16} className="text-[#A8C7FA]" />
                                    <span className="text-[#E3E3E3] text-sm font-medium whitespace-nowrap">{node.label}</span>
                                </div>
                            );
                        }

                        // DASHBOARD NODES (Right - 4th Layer)
                        if (node.type === 'card') {
                            return (
                                <div
                                    key={node.id}
                                    className={clsx("absolute transform -translate-y-1/2 pointer-events-auto flex items-center gap-3 cursor-pointer", baseOpacity, baseTransition)}
                                    style={{ left: node.x, top: node.y, width: 220 }}
                                    onMouseEnter={() => setHoveredNodeId(node.id)}
                                    onMouseLeave={() => setHoveredNodeId(null)}
                                >
                                    <div className="p-2 bg-[#333537] rounded-lg text-[#A8C7FA]">
                                        <LayoutDashboard size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[#E3E3E3] text-sm font-medium leading-tight">{node.label}</span>
                                        {node.data.issue && (
                                            <span className="text-[10px] text-yellow-400 mt-0.5">{node.data.issue}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        // FEATURE / METRIC / PREDICTION / ANALYTICS NODES (Right)
                        const status = node.data.status;
                        const isWarning = status === 'warning';
                        const isError = status === 'error';

                        return (
                            <div
                                key={node.id}
                                className={clsx("absolute transform -translate-y-1/2 pointer-events-auto group flex items-center", baseOpacity, baseTransition)}
                                style={{ left: node.x, top: node.y }}
                            >
                                <div
                                    className={clsx(
                                        "w-3 h-3 rounded-full z-10 shrink-0 mr-3 transition-all duration-200 cursor-pointer",
                                        selectedColumns.has(node.id) ? (
                                            isError ? "bg-red-500 scale-110" : isWarning ? "bg-yellow-500 scale-110" : "bg-blue-500 scale-110"
                                        ) : "bg-[#444746]"
                                    )}
                                    onClick={() => onToggleSelection(node.id)}
                                />

                                <span className={clsx(
                                    "text-sm transition-colors whitespace-nowrap text-[#80868B]",
                                    (isError || isWarning) ? "text-[#C4C7C5]" : "group-hover:text-[#C4C7C5]",
                                    selectedColumns.has(node.id) && "text-[#E3E3E3] font-medium"
                                )}>
                                    {node.label}
                                </span>


                                {isError && <AlertTriangle size={12} className="text-red-500 ml-2" />}
                                {isWarning && <AlertTriangle size={12} className="text-yellow-500 ml-2" />}

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
});

export default FeatureMindMap;
