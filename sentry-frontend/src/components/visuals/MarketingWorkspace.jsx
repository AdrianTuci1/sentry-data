import React, { useState, useEffect } from 'react';
import { Play, ZoomIn, ZoomOut, Database, Layers, BrainCircuit, DollarSign, Box, PieChart, Info, X } from 'lucide-react';
import FeatureMindMap from './FeatureMindMap';
import MeltanoConnectorConfig from './MeltanoConnectorConfig';
import DataLakeExplorer from './DataLakeExplorer';
import ModelsLibrary from '../../pages/ModelsLibrary';
import MarketingInsights from './MarketingInsights';
import { clsx } from 'clsx';

// Modal Content Components
const TransformationInfo = () => (
    <div className="space-y-4">
        <div className="bg-[#333537]/50 p-4 rounded-xl border border-[#444746]">
            <h4 className="font-semibold text-[#A8C7FA] mb-2">Normalization Phase</h4>
            <p className="text-sm text-[#C4C7C5]">Data is automatically normalized upon ingestion. Timestamps are unified to UTC, and currency values are converted to USD based on daily rates.</p>
        </div>
        <div className="bg-[#333537]/50 p-4 rounded-xl border border-[#444746]">
            <h4 className="font-semibold text-[#A8C7FA] mb-2">Feature Engineering</h4>
            <p className="text-sm text-[#C4C7C5]">Categorical variables are one-hot encoded during the pipeline execution. Missing values are imputed using KNN (k=5) for numerical fields.</p>
        </div>
    </div>
);

const RelationsInfo = () => (
    <div className="space-y-2">
        <p className="text-sm text-[#C4C7C5] mb-4">The graph analysis detected strong correlations between the following entities:</p>
        <ul className="space-y-2">
            <li className="flex items-center gap-3 p-3 bg-[#333537]/50 rounded-lg border border-[#444746]">
                <div className="h-2 w-2 rounded-full bg-green-400"></div>
                <span className="text-[#E3E3E3] text-sm">User Activity <span className="text-[#555]">↔</span> Purchase Value</span>
                <span className="ml-auto text-xs text-green-400 font-mono">r=0.85</span>
            </li>
            <li className="flex items-center gap-3 p-3 bg-[#333537]/50 rounded-lg border border-[#444746]">
                <div className="h-2 w-2 rounded-full bg-yellow-400"></div>
                <span className="text-[#E3E3E3] text-sm">Campaign Spend <span className="text-[#555]">↔</span> Site Traffic</span>
                <span className="ml-auto text-xs text-yellow-400 font-mono">r=0.72</span>
            </li>
            <li className="flex items-center gap-3 p-3 bg-[#333537]/50 rounded-lg border border-[#444746]">
                <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                <span className="text-[#E3E3E3] text-sm">Email Open Rate <span className="text-[#555]">↔</span> Churn Probability</span>
                <span className="ml-auto text-xs text-blue-400 font-mono">r=-0.64</span>
            </li>
        </ul>
    </div>
);

const ModelsInfo = () => (
    <div className="space-y-4">
        <p className="text-sm text-[#C4C7C5]">Prediction models are versioned and stored in the localized model registry.</p>
        <div className="grid gap-3">
            <div className="bg-[#1E1F20] p-3 rounded-lg border border-[#444746] flex flex-col">
                <span className="text-[#A8C7FA] font-medium text-sm">Auto-Deployment</span>
                <span className="text-xs text-[#777] mt-1">Models with accuracy &gt; 95% are automatically deployed to the serving endpoint.</span>
            </div>
            <div className="bg-[#1E1F20] p-3 rounded-lg border border-[#444746] flex flex-col">
                <span className="text-[#A8C7FA] font-medium text-sm">A/B Testing</span>
                <span className="text-xs text-[#777] mt-1">Traffic is split 80/20 between the current champion model and the new challenger.</span>
            </div>
        </div>
    </div>
);


const MarketingWorkspace = ({ data, viewState = 'engineering', onAction }) => {
    // UI Local State
    const [activeTab, setActiveTab] = useState('engineering'); // 'data_sources', 'lakehouse', 'engineering', 'models', 'insights', 'results'

    // Menu States
    const [activeMenu, setActiveMenu] = useState(null); // 'transformation', 'relations', 'models'

    // Sync viewState prop with internal tab
    useEffect(() => {
        if (viewState === 'results') setActiveTab('results');
    }, [viewState]);

    // MindMap Zoom/Pan State
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // Data from props
    const tables = data?.tables || [];
    const metricGroups = data?.metricGroups || [];
    const predictionModels = data?.predictionModels || [];
    const advancedAnalytics = data?.advancedAnalytics || [];
    const dashboards = data?.dashboards || [];
    const dashboardGroups = data?.dashboardGroups || [];

    // Local Selection State (for MindMap)
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Auto-select items helper
    useEffect(() => {
        const initialSelection = new Set();
        const processItems = (items) => items?.forEach(item => {
            if (item.status !== 'error') initialSelection.add(item.id);
        });
        tables.forEach(t => processItems(t.columns));
        metricGroups.forEach(g => processItems(g.metrics));
        predictionModels.forEach(m => processItems(m.predictions));
        advancedAnalytics.forEach(g => (g.items || []).forEach(item => {
            if (item.status !== 'error') initialSelection.add(item.id);
        }));
        dashboards.forEach(g => (g.items || []).forEach(item => {
            if (item.status !== 'error') initialSelection.add(item.id);
        }));

        setSelectedItems(initialSelection);
    }, [tables, metricGroups, predictionModels, advancedAnalytics, dashboards]);

    // Handlers
    const toggleSelection = (id) => {
        const newSet = new Set(selectedItems);
        newSet.has(id) ? newSet.delete(id) : newSet.add(id);
        setSelectedItems(newSet);
    };

    const toggleGroup = (ids) => {
        const newSet = new Set(selectedItems);
        const allSelected = ids.every(id => newSet.has(id));
        if (allSelected) {
            ids.forEach(id => newSet.delete(id));
        } else {
            ids.forEach(id => newSet.add(id));
        }
        setSelectedItems(newSet);
    };

    // --- Tab Navigation ---
    const tabs = [
        { id: 'data_sources', label: 'Data Connectors', icon: Database },
        { id: 'lakehouse', label: 'Data Lake', icon: Layers },
        { id: 'engineering', label: 'Campaign Intelligence', icon: BrainCircuit },
        { id: 'models', label: 'Models', icon: Box },
        { id: 'insights', label: 'Insights', icon: PieChart },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'data_sources': return <MeltanoConnectorConfig />;
            case 'lakehouse': return <DataLakeExplorer />;
            case 'engineering': return renderMindMap();
            case 'models': return <ModelsLibrary isEmbedded={true} />;
            case 'insights': return <MarketingInsights />;
            case 'results': return renderResults();
            default: return renderMindMap();
        }
    };

    const renderResults = () => {
        // [Existing renderResults implementation remains the same via closure, re-implemented here only if needed, but for replacement tool I must provide content]
        // Since I'm replacing the whole file component body logic or large chunk, I'll copy the existing renderResults logic.
        const metrics = data?.metrics || { precision: 0, recall: 0, roi: 0 };
        const features = data?.features || [];
        return (
            <div className="h-full w-full flex flex-col p-8 overflow-y-auto bg-[#131314]">
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
    };

    const renderMindMap = () => {
        const handleMouseDown = (e) => {
            if (e.button === 2 || e.altKey || e.button === 0) {
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
            const delta = -e.deltaY * 0.001;
            setScale(s => Math.min(4, Math.max(0.2, s + delta)));
        };

        return (
            <div className="h-full w-full flex flex-col relative overflow-hidden bg-[#131314]">
                {/* Floating Menu for Campaign Intelligence Questions */}
                <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                    <div className="bg-[#1E1F20]/90 border border-[#444746] rounded-xl p-2 shadow-xl backdrop-blur-md w-64">
                        <div className="text-[10px] text-[#777] uppercase tracking-wider font-semibold mb-2 px-2">Intelligence Assist</div>
                        <button
                            onClick={() => setActiveMenu(activeMenu === 'transformation' ? null : 'transformation')}
                            className={clsx("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1", activeMenu === 'transformation' ? "bg-[#333537] text-[#A8C7FA]" : "text-[#C4C7C5] hover:bg-[#333537]/50 hover:text-[#E3E3E3]")}
                        >
                            <span className="flex items-center gap-2"><Info size={14} /> When do we transform data?</span>
                        </button>
                        <button
                            onClick={() => setActiveMenu(activeMenu === 'relations' ? null : 'relations')}
                            className={clsx("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1", activeMenu === 'relations' ? "bg-[#333537] text-yellow-400" : "text-[#C4C7C5] hover:bg-[#333537]/50 hover:text-[#E3E3E3]")}
                        >
                            <span className="flex items-center gap-2"><BrainCircuit size={14} /> What relations did we find?</span>
                        </button>
                        <button
                            onClick={() => setActiveMenu(activeMenu === 'models' ? null : 'models')}
                            className={clsx("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors", activeMenu === 'models' ? "bg-[#333537] text-green-400" : "text-[#C4C7C5] hover:bg-[#333537]/50 hover:text-[#E3E3E3]")}
                        >
                            <span className="flex items-center gap-2"><Box size={14} /> What about prediction models?</span>
                        </button>
                    </div>

                    {/* Popover Content */}
                    {activeMenu && (
                        <div className="bg-[#1E1F20]/90 border border-[#444746] rounded-xl p-4 shadow-xl backdrop-blur-md w-80 animate-in slide-in-from-left-5">
                            <div className="flex justify-between items-center mb-3 border-b border-[#444746]/50 pb-2">
                                <h3 className="font-semibold text-[#E3E3E3]">
                                    {activeMenu === 'transformation' && 'Data Transformation Pipeline'}
                                    {activeMenu === 'relations' && 'Entity Relations Discovered'}
                                    {activeMenu === 'models' && 'Prediction Model Lifecycle'}
                                </h3>
                                <button onClick={() => setActiveMenu(null)} className="text-[#777] hover:text-[#E3E3E3]">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto pr-1">
                                {activeMenu === 'transformation' && <TransformationInfo />}
                                {activeMenu === 'relations' && <RelationsInfo />}
                                {activeMenu === 'models' && <ModelsInfo />}
                            </div>
                        </div>
                    )}
                </div>

                <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 pointer-events-none">
                    <div className="pointer-events-auto flex gap-2 bg-[#1E1F20]/90 border border-[#444746] p-1.5 rounded-lg shadow-lg">
                        <button onClick={() => setScale(s => Math.min(4, s + 0.1))} className="p-2 hover:bg-[#333537] rounded-md text-[#C4C7C5]"><ZoomIn size={18} /></button>
                        <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-2 hover:bg-[#333537] rounded-md text-[#C4C7C5]"><ZoomOut size={18} /></button>
                    </div>
                </div>

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
                        dashboards={dashboards}
                        dashboardGroups={dashboardGroups}
                        selectedColumns={selectedItems}
                        onToggleSelection={toggleSelection}
                        onToggleGroup={toggleGroup}
                        title="Campaign ROI Prediction"
                        scale={scale}
                        pan={pan}
                        showCosts={true}
                    />
                </div>
                {selectedItems.size > 0 && (
                    <div className="absolute bottom-6 left-6 z-20 bg-[#1E1F20]/90 backdrop-blur-md border border-[#444746] rounded-xl p-4 shadow-xl animate-in slide-in-from-bottom-5">
                        <div className="flex items-center gap-2 text-[#C4C7C5] mb-2 text-xs uppercase tracking-wider font-semibold">
                            <DollarSign size={14} className="text-green-400" /> Estimated Pipeline Cost
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-[#E3E3E3]">${(selectedItems.size * 0.05).toFixed(2)}</span>
                            <span className="text-xs text-[#C4C7C5]">/ run</span>
                        </div>
                        <div className="text-[10px] text-[#555] mt-1">
                            Based on {selectedItems.size} selected active features
                        </div>
                    </div>
                )}
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

    return (
        <div className="flex flex-col h-full w-full bg-[#131314]">
            {/* Top Navigation Payload */}
            <div className="h-14 border-b border-[#444746]/50 flex items-center px-4 gap-6 bg-[#1E1F20]/50 backdrop-blur-sm z-30">
                <div className="font-semibold text-[#E3E3E3] mr-4">Marketing Workspace</div>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                            activeTab === tab.id
                                ? "bg-[#333537] text-white shadow-sm"
                                : "text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#333537]/50"
                        )}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {renderContent()}
            </div>
        </div>
    );
};

export default MarketingWorkspace;
