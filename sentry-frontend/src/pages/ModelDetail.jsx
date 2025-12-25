import React from 'react';
import { Activity, BarChart2, GitBranch, Play, Settings, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ModelDetail = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col h-full w-full p-6 animate-fade-in pt-20">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/models')}
                        className="p-2 hover:bg-[#1E1F20] rounded-full text-[#C4C7C5] hover:text-[#E3E3E3] transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-medium text-[#E3E3E3]">Sales Predictor v1</h1>
                        <p className="text-[#C4C7C5] text-sm flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                            Running on Modal (A100) • ID: mdl-8392s
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#333537] hover:bg-[#444746] rounded-full text-sm transition-colors">
                        <Settings size={16} />
                        Configuration
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#E3E3E3] text-[#131314] hover:bg-white rounded-full text-sm font-medium transition-colors shadow-lg shadow-white/5">
                        <Play size={16} fill="currentColor" />
                        Test Inference
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-[#1E1F20] p-4 rounded-2xl border border-[#444746]/50">
                    <div className="flex items-center gap-2 text-[#C4C7C5] mb-2">
                        <Activity size={18} />
                        <span className="text-xs uppercase tracking-wider">Throughput</span>
                    </div>
                    <div className="text-2xl font-medium text-[#E3E3E3]">420 req/s</div>
                    <div className="text-xs text-green-400 mt-1">+12% vs last run</div>
                </div>
                <div className="bg-[#1E1F20] p-4 rounded-2xl border border-[#444746]/50">
                    <div className="flex items-center gap-2 text-[#C4C7C5] mb-2">
                        <BarChart2 size={18} />
                        <span className="text-xs uppercase tracking-wider">Accuracy</span>
                    </div>
                    <div className="text-2xl font-medium text-[#E3E3E3]">98.2%</div>
                    <div className="text-xs text-[#C4C7C5] mt-1">Validation Set B</div>
                </div>
                <div className="bg-[#1E1F20] p-4 rounded-2xl border border-[#444746]/50">
                    <div className="flex items-center gap-2 text-[#C4C7C5] mb-2">
                        <GitBranch size={18} />
                        <span className="text-xs uppercase tracking-wider">Data Drift</span>
                    </div>
                    <div className="text-2xl font-medium text-[#E3E3E3]">0.04</div>
                    <div className="text-xs text-green-400 mt-1">Stable</div>
                </div>
            </div>

            {/* Main Visualizer Area */}
            <div className="flex-1 bg-[#1E1F20] rounded-3xl border border-[#444746]/50 p-6 relative overflow-hidden flex flex-col">
                <h3 className="text-sm font-medium text-[#C4C7C5] mb-4">Real-time Loss Curve</h3>

                {/* Fake Chart Visualization */}
                <div className="flex-1 flex items-end justify-between gap-1 px-4 pb-4 opacity-70">
                    {[30, 45, 40, 60, 55, 70, 65, 80, 75, 90, 85, 95, 20, 40, 60, 50, 70, 80, 60, 90].map((h, i) => (
                        <div key={i} style={{ height: `${h}%` }} className="w-full bg-gradient-to-t from-blue-500 to-[#A8C7FA] rounded-t-sm opacity-60 hover:opacity-100 transition-opacity"></div>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default ModelDetail;
