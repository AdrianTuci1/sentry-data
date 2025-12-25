
import React from 'react';
import { Clock, Cpu, Database, Pause, Play, Settings, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

const LLMTrainingWorkspace = ({ data, viewState, onAction }) => {
    // Data from props
    const config = data?.config || {};
    const runStatus = data || {}; // for training view, data is the status object

    const handleStart = () => {
        onAction('start_run', {});
    };

    const handleStop = () => {
        onAction('stop_run', {});
    };

    const formatTime = (seconds) => {
        if (!seconds) return '0h 0m';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hrs}h ${mins}m`;
    };

    // SETUP STATE
    if (viewState === 'setup') {
        const lr = config.lr || 0.001;
        const batch = config.batch || 32;

        return (
            <div className="h-full w-full flex flex-col p-8 overflow-y-auto">
                <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-[#E3E3E3] mb-1">Fine-tune Configuration</h2>
                    <p className="text-[#C4C7C5] text-sm">Review dataset health and hyperparameters before starting run.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Dataset Card */}
                    <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50">
                        <h3 className="text-[#E3E3E3] font-medium mb-4 flex items-center gap-2">
                            <Database size={18} className="text-[#A8C7FA]" /> Dataset
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-[#131314] p-3 rounded-xl border border-[#444746]">
                                <span className="text-sm text-[#E3E3E3]">{data?.dataset || "sentry_docs.jsonl"}</span>
                                <span className="text-xs font-mono text-green-400 flex items-center gap-1"><CheckCircle2 size={12} /> Ready</span>
                            </div>
                            <div className="flex justify-between text-sm text-[#C4C7C5]">
                                <span>Token Count</span>
                                <span className="text-[#E3E3E3]">1.2M</span>
                            </div>
                            <div className="flex justify-between text-sm text-[#C4C7C5]">
                                <span>Est. VRAM</span>
                                <span className="text-[#E3E3E3]">18 GB</span>
                            </div>
                        </div>
                    </div>

                    {/* Hyperparams Card */}
                    <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50">
                        <h3 className="text-[#E3E3E3] font-medium mb-4 flex items-center gap-2">
                            <Settings size={18} className="text-[#A8C7FA]" /> Hyperparameters
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[#C4C7C5] text-sm">Learning Rate</label>
                                    <span className="text-[#E3E3E3] font-mono text-xs">{lr}</span>
                                </div>
                                <input
                                    type="range" min="0.0001" max="0.01" step="0.0001" value={lr} readOnly
                                    className="w-full h-1.5 bg-[#444746] rounded-lg appearance-none cursor-not-allowed accent-[#A8C7FA] opacity-50"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[#C4C7C5] text-sm">Batch Size</label>
                                </div>
                                <div className="flex gap-2">
                                    {[16, 32, 64].map(size => (
                                        <button key={size}
                                            className={clsx("flex-1 py-1.5 text-xs rounded-lg transition-all border border-transparent",
                                                batch === size ? "bg-[#A8C7FA] text-[#0B1D3F]" : "bg-[#333537] text-[#C4C7C5]"
                                            )}>
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <button
                        onClick={handleStart}
                        className="w-full py-4 bg-[#A8C7FA] text-[#0B1D3F] font-semibold rounded-xl hover:bg-[#8AB4F8] transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-[#A8C7FA]/20"
                    >
                        <Play size={20} fill="currentColor" /> Start Training Run
                    </button>
                </div>
            </div>
        );
    }

    // TRAINING STATE
    return (
        <div className="h-full w-full flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-semibold text-[#E3E3E3] mb-1">Training Run #402</h2>
                    <p className="text-[#C4C7C5] text-sm flex items-center gap-2">
                        <span className={clsx("w-2 h-2 rounded-full", runStatus.status === 'running' ? "bg-green-500 animate-pulse" : "bg-red-500")}></span>
                        Fine-tuning 'Llama-3-8b'
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-[#131314] px-4 py-2 rounded-xl border border-[#444746]">
                    <Clock size={18} className="text-[#A8C7FA]" />
                    <span className="text-[#E3E3E3] font-mono text-lg">{formatTime(runStatus.time_left)}</span>
                </div>
            </div>

            {/* Main Metrics Area */}
            <div className="bg-[#1E1F20] rounded-2xl p-6 border border-[#444746]/50 shadow-lg mb-8 relative overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="text-[#C4C7C5] text-sm mb-1">Current Loss</div>
                        <div className="text-4xl font-mono text-white">{runStatus.loss?.toFixed(4) || "0.0000"}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[#C4C7C5] text-sm mb-1">Epoch</div>
                        <div className="text-2xl font-mono text-[#A8C7FA]">{runStatus.epoch} <span className="text-sm text-[#C4C7C5]">/ 10</span></div>
                    </div>
                </div>

                {/* Mock Loss Curve - Visual only */}
                <div className="h-40 w-full flex items-end gap-1 relative">
                    {Array.from({ length: 40 }).map((_, i) => {
                        const h = Math.max(10, 80 - i * 1.5 + Math.random() * 10);
                        return (
                            <div key={i} className="flex-1 bg-gradient-to-t from-[#A8C7FA]/50 to-[#A8C7FA] opacity-80 rounded-t-sm" style={{ height: `${h}%` }}></div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-[#1E1F20] p-4 rounded-2xl border border-[#444746]/30 flex items-center gap-4">
                    <div className="p-3 bg-[#A8C7FA]/10 rounded-xl text-[#A8C7FA]"><Cpu size={20} /></div>
                    <div><div className="text-xs text-[#C4C7C5]">GPU Utilization</div><div className="text-lg font-medium text-[#E3E3E3]">{runStatus.gpu || 0}%</div></div>
                </div>
                <div className="bg-[#1E1F20] p-4 rounded-2xl border border-[#444746]/30 flex items-center gap-4">
                    <div className="p-3 bg-[#A8C7FA]/10 rounded-xl text-[#A8C7FA]"><Database size={20} /></div>
                    <div><div className="text-xs text-[#C4C7C5]">VRAM Usage</div><div className="text-lg font-medium text-[#E3E3E3]">22GB</div></div>
                </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-[#444746]/50 mt-auto">
                <button
                    onClick={runStatus.status === 'running' ? handleStop : handleStart}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-all text-sm",
                        runStatus.status === 'running' ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-[#A8C7FA] text-[#0B1D3F]"
                    )}
                >
                    {runStatus.status === 'running' ? <><Pause size={16} /> Stop Training</> : <><Play size={16} /> Resume</>}
                </button>
            </div>
        </div>
    );
};

export default LLMTrainingWorkspace;

