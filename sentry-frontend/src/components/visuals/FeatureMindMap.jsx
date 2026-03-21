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
        connector,
        actionType,
        origin,
        adjustedData,
        group,
        insight
    } = data;

    // Layout Logic moved to hook
    const { layout } = useMindMapLayout({
        connector,
        actionType,
        origin,
        adjustedData,
        group,
        insight
    });

    const onToggleSelection = (id) => ui.toggleSelection(id);
    const onToggleGroup = (ids) => ui.toggleGroup(ids);

    // --- Trace Logic ---
    const [hoveredNodeId, setHoveredNodeId] = useState(null);

    const activeTrace = useMemo(() => {
        if (!hoveredNodeId) return null;

        // Create a lookup map for faster node type checking
        const nodeMap = new Map(layout.nodes.map(n => [n.id, n]));

        const visitedNodes = new Set([hoveredNodeId]);
        const visitedEdges = new Set();
        const queue = [hoveredNodeId];

        // Trace Backwards (Target -> Source)
        while (queue.length > 0) {
            const currentId = queue.shift();
            const currentNode = nodeMap.get(currentId);

            if (!currentNode) continue;

            // Find all edges where target === currentId
            layout.edges.forEach(edge => {
                if (edge.targetId === currentId) {
                    visitedEdges.add(edge.id);
                    const sourceId = edge.sourceId;
                    if (sourceId && !visitedNodes.has(sourceId)) {
                        // Logic to stop propagation:
                        // 1. If we are entering an 'idea' (column) node, we stop searching ITS parents.
                        // 2. If we are entering a 'group' node from an insight, we stop searching ITS parents.
                        const sourceNode = nodeMap.get(sourceId);
                        
                        visitedNodes.add(sourceId);
                        
                        // Stop if we reach a column (leaf), or a category (data source) 
                        // This ensures the trace stays within the dashboard area when starting from insights.
                        const isStopType = sourceNode?.type === 'idea' || sourceNode?.type === 'category';
                        
                        if (!isStopType) {
                            queue.push(sourceId);
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
                                    className={clsx("transition-all duration-300", isDimmed ? "opacity-5" : (isTrace ? "opacity-100" : "opacity-30"))}
                                />
                            );
                        })}
                    </svg>

                    {/* 2. Nodes Layer (HTML) */}
                    {layout.nodes.map(node => {
                        const isTraceNode = activeTrace ? activeTrace.nodes.has(node.id) : false;
                        const isDimmedNode = activeTrace && !isTraceNode;
                        const baseOpacity = isDimmedNode ? "opacity-5 blur-[2px]" : "opacity-100";
                        const baseTransition = "transition-all duration-300";

                        // CONNECTION NODE (Far Left - Layer 0)
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



                        // CATEGORY NODES (Middle - Adjusted Data)
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
                                        isClickable ? "bg-[#A8C7FA]/50 border-[#A8C7FA]/80 group-hover/cat:bg-[#A8C7FA] group-hover/cat:border-white" : "bg-[#444746] border-[#555]"
                                    )} />
                                    <span className={clsx(
                                        "text-[#E3E3E3] font-semibold text-sm transition-colors",
                                        isClickable && "group-hover/cat:text-white"
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

            {/* Empty State Overlay */}
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
