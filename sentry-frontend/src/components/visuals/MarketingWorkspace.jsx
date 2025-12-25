import React, { useState, useEffect } from 'react';
import { Play, ZoomIn, ZoomOut } from 'lucide-react';
import FeatureMindMap from './FeatureMindMap';
import { clsx } from 'clsx';

const MarketingWorkspace = ({ data, viewState, onAction }) => {
    // UI Local State (Zoom/Pan) can remain local
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // Data from props
    const tables = data?.tables || [];
    const metricGroups = data?.metricGroups || [];
    const predictionModels = data?.predictionModels || [];
    const advancedAnalytics = data?.advancedAnalytics || [];
    const connections = data?.connections || [];
    // Local Selection State
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Auto-select items without errors on initial load/data change
    useEffect(() => {
        const initialSelection = new Set();

        // Helper to process items
        const processItems = (items) => {
            items.forEach(item => {
                if (item.status !== 'error') initialSelection.add(item.id);
            });
        };

        // Process all groups
        tables.forEach(t => processItems(t.columns));
        metricGroups.forEach(g => processItems(g.metrics));
        predictionModels.forEach(m => processItems(m.predictions));
        advancedAnalytics.forEach(g => getAnalyticsItems(g).forEach(item => {
            if (item.status !== 'error') initialSelection.add(item.id);
        }));

        setSelectedItems(initialSelection);
    }, [tables, metricGroups, predictionModels, advancedAnalytics]);

    // Helper for analytics structure consistency
    const getAnalyticsItems = (g) => g.items || [];

    const toggleSelection = (id) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedItems(newSet);
        onAction('select_item', { id }); // Notify parent just in case
    };

    const toggleGroup = (ids) => {
        const newSet = new Set(selectedItems);
        // Filter out errors just to be safe (though filtered by caller too)
        // Check if all provided items are currently selected
        const allSelected = ids.every(id => newSet.has(id));

        if (allSelected) {
            // Deselect all
            ids.forEach(id => newSet.delete(id));
        } else {
            // Select all
            ids.forEach(id => newSet.add(id));
        }
        setSelectedItems(newSet);
    };

    const handleNextStep = () => {
        // Logic for next step
        console.log("Proceeding with items:", Array.from(selectedItems));
        onAction('next_step', { selectedIds: Array.from(selectedItems) });
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

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey || true) { // Always allow wheel zoom in this view for better UX
            // e.preventDefault(); // React synthetic events might complain, usually good to avoid if passive. 
            // Better to just handle the logic. 
            const delta = -e.deltaY * 0.001;
            setScale(s => Math.min(4, Math.max(0.2, s + delta)));
        }
    };

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
            {/* Controls (Top Right) - Restored */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 pointer-events-none">
                <div className="pointer-events-auto flex gap-2 bg-[#1E1F20]/90 border border-[#444746] p-1.5 rounded-lg shadow-lg">
                    <button onClick={() => setScale(s => Math.min(4, s + 0.1))} className="p-2 hover:bg-[#333537] rounded-md text-[#C4C7C5]"><ZoomIn size={18} /></button>
                    <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-2 hover:bg-[#333537] rounded-md text-[#C4C7C5]"><ZoomOut size={18} /></button>
                </div>

                {selectedItems.size > 0 && (
                    <button
                        onClick={handleNextStep}
                        className="pointer-events-auto bg-green-500 text-white px-5 py-3 rounded-xl font-bold shadow-lg hover:bg-green-400 transition-all flex items-center gap-2 animate-in slide-in-from-right-10"
                    >
                        <Play size={18} fill="currentColor" />
                        Next Step ({selectedItems.size})
                    </button>
                )}
            </div>

            {/* Feature Mind Map Visualization */}
            <div
                className="flex-1 w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                onWheel={handleWheel}
            >
                <FeatureMindMap
                    tables={tables}
                    metricGroups={metricGroups}
                    predictionModels={predictionModels}
                    advancedAnalytics={advancedAnalytics}
                    selectedColumns={selectedItems}
                    onToggleSelection={toggleSelection}
                    onToggleGroup={toggleGroup}
                    title="Campaign ROI Prediction"
                    scale={scale}
                    pan={pan}
                />
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
