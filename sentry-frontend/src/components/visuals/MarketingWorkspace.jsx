import React, { useState, useEffect } from 'react';
import { Network, AlertTriangle, Play, ZoomIn, ZoomOut } from 'lucide-react';
import { clsx } from 'clsx';

const MarketingWorkspace = ({ data, viewState, onAction }) => {
    // UI Local State (Zoom/Pan) can remain local
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // Data from props
    const tables = data?.tables || [];
    const connections = data?.connections || [];
    const selectedColumns = new Set(data?.selected_columns || []);

    const toggleSelection = (colId) => {
        onAction('select_column', { col_id: colId });
    };

    const handleTrain = () => {
        onAction('train_model', {});
    };

    const handleMouseDown = (e) => {
        if (e.button === 2 || e.altKey || e.button === 0) { // Allow left click drag for ease
            setIsDragging(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            setPan(p => ({ x: p.x + dx, y: p.y + dy }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    // Results View
    if (viewState === 'results') {
        const metrics = data?.metrics || { precision: 0, recall: 0, roi: 0 };
        const features = data?.features || [];

        return (
            <div className="h-full w-full flex flex-col p-8 overflow-y-auto">
                <h2 className="text-2xl font-semibold text-[#E3E3E3] mb-8">Model Performance</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50 flex flex-col items-center">
                        <div className="text-[#C4C7C5] mb-2">Precision</div>
                        <div className="text-4xl font-bold text-green-400">{(metrics.precision * 100).toFixed(1)}%</div>
                    </div>
                    <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50 flex flex-col items-center">
                        <div className="text-[#C4C7C5] mb-2">Recall</div>
                        <div className="text-4xl font-bold text-[#A8C7FA]">{(metrics.recall * 100).toFixed(1)}%</div>
                    </div>
                    <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50 flex flex-col items-center">
                        <div className="text-[#C4C7C5] mb-2">Est. ROI</div>
                        <div className="text-4xl font-bold text-yellow-400">{metrics.roi}x</div>
                    </div>
                </div>

                <div className="bg-[#1E1F20] rounded-2xl p-6 border border-[#444746]/50 flex-1">
                    <h3 className="text-lg font-medium text-[#E3E3E3] mb-4">Feature Importance</h3>
                    <div className="space-y-4">
                        {features.map((f, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-sm text-[#E3E3E3] mb-1">
                                    <span>{f.name}</span>
                                    <span>{(f.val * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-[#131314] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#A8C7FA]" style={{ width: `${f.val * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Engineering View (Mesh)
    return (
        <div className="h-full w-full flex flex-col relative overflow-hidden bg-[#131314]">
            {/* Toolbar */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
                <div className="pointer-events-auto bg-[#1E1F20]/90 backdrop-blur border border-[#444746] p-4 rounded-xl shadow-xl max-w-sm">
                    <h2 className="text-lg font-semibold text-[#E3E3E3] flex items-center gap-2 mb-1">
                        <Network size={18} className="text-[#A8C7FA]" /> Feature Engineering
                    </h2>
                    <p className="text-xs text-[#C4C7C5] mb-3">
                        Select features to include. <span className="text-yellow-400">Yellow</span> items need attention.
                    </p>
                </div>

                <div className="pointer-events-auto flex flex-col gap-2">
                    <div className="flex gap-2 bg-[#1E1F20]/90 border border-[#444746] p-1.5 rounded-lg shadow-lg">
                        <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="p-2 hover:bg-[#333537] rounded-md text-[#C4C7C5]"><ZoomIn size={18} /></button>
                        <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-2 hover:bg-[#333537] rounded-md text-[#C4C7C5]"><ZoomOut size={18} /></button>
                    </div>

                    {selectedColumns.size > 0 && (
                        <button
                            onClick={handleTrain}
                            className="bg-[#A8C7FA] text-[#0B1D3F] px-4 py-3 rounded-xl font-medium shadow-lg hover:bg-[#8AB4F8] transition-all flex items-center gap-2 animate-in slide-in-from-right-10"
                        >
                            <Play size={18} fill="currentColor" />
                            Train Model ({selectedColumns.size})
                        </button>
                    )}
                </div>
            </div>

            {/* Interactive Mesh */}
            <div
                className="flex-1 w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
            >
                <svg className="w-full h-full">
                    <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
                        {/* Connections */}
                        {connections.map((conn, i) => {
                            const t1 = tables.find(t => t.id === conn.from_table); // Adjusted to backend model keys
                            const t2 = tables.find(t => t.id === conn.to_table);
                            if (!t1 || !t2) return null;

                            // Simple center-to-center lines for demo
                            const x1 = t1.x + 100;
                            const y1 = t1.y + 100;
                            const x2 = t2.x + 100;
                            const y2 = t2.y + 100;

                            return (
                                <path
                                    key={i}
                                    d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                                    stroke="#444746"
                                    strokeWidth="2"
                                    fill="none"
                                />
                            );
                        })}

                        {/* Tables */}
                        {tables.map(table => (
                            <foreignObject key={table.id} x={table.x} y={table.y} width="220" height="300">
                                <div className="bg-[#1E1F20] border border-[#444746] rounded-xl shadow-2xl overflow-hidden text-sm select-none">
                                    <div className="bg-[#333537] px-3 py-2 border-b border-[#444746] font-medium text-[#E3E3E3] flex justify-between items-center">
                                        {table.title}
                                        <div className="text-[10px] text-[#C4C7C5] bg-[#131314] px-1.5 py-0.5 rounded">TABLE</div>
                                    </div>
                                    <div className="p-1">
                                        {table.columns.map(col => {
                                            const isSelected = selectedColumns.has(col.id); // Backend just sends col IDs for simplicity
                                            return (
                                                <div
                                                    key={col.id}
                                                    onClick={() => toggleSelection(col.id)}
                                                    className={clsx(
                                                        "px-2 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors border",
                                                        isSelected ? "bg-[#A8C7FA]/10 border-[#A8C7FA]/50" : "border-transparent hover:bg-[#333537]"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className={clsx(
                                                            "w-1.5 h-1.5 rounded-full shrink-0",
                                                            col.status === 'ok' ? "bg-green-500" :
                                                                col.status === 'warning' ? "bg-yellow-400" : "bg-red-500"
                                                        )} />
                                                        <span className={clsx("truncate text-[#E3E3E3]", isSelected && "font-medium")}>
                                                            {col.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-[#80868B] font-mono">{col.type}</span>
                                                        {col.status !== 'ok' && (
                                                            <AlertTriangle size={12} className={col.status === 'warning' ? "text-yellow-400" : "text-red-500"} />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </foreignObject>
                        ))}
                    </g>
                </svg>
            </div>
            {/* Grid Background */}
            <div className="absolute inset-0 z-[-1] opacity-20 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#444746 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    transform: `translate(${pan.x % 20}px, ${pan.y % 20}px)`
                }}>
            </div>
        </div>
    );
};

export default MarketingWorkspace;
