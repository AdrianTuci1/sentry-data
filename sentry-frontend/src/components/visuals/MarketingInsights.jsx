import React, { useState } from 'react';
import { TrendingUp, Users, DollarSign, Activity, PieChart, BarChart2, Calendar, Target, UserPlus, UserMinus, MonitorPlay, Image, MousePointer, Sliders } from 'lucide-react';

// --- Sub-View Components ---

const OverviewView = () => {
    const metrics = [
        { label: 'Total Revenue', value: '$2.4M', change: '+12.5%', icon: DollarSign, color: 'text-green-400' },
        { label: 'Active Users', value: '45.2k', change: '+8.1%', icon: Users, color: 'text-blue-400' },
        { label: 'Campaign ROI', value: '325%', change: '-2.4%', icon: Activity, color: 'text-purple-400' },
        { label: 'Conversion Rate', value: '4.8%', change: '+1.2%', icon: TrendingUp, color: 'text-yellow-400' },
    ];

    const pipelineData = [
        { stage: 'Awareness', count: 12500, percentage: 100 },
        { stage: 'Interest', count: 8400, percentage: 67 },
        { stage: 'Consideration', count: 4200, percentage: 33 },
        { stage: 'Intent', count: 2100, percentage: 16 },
        { stage: 'Purchase', count: 850, percentage: 6.8 },
    ];

    const channelPerformance = [
        { channel: 'Organic Search', traffic: 45, conversion: 3.2 },
        { channel: 'Paid Social', traffic: 25, conversion: 4.5 },
        { channel: 'Email', traffic: 20, conversion: 5.8 },
        { channel: 'Direct', traffic: 10, conversion: 2.1 },
    ];

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((metric, index) => (
                    <div key={index} className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50 hover:border-[#444746] transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-2 rounded-lg bg-[#333537] ${metric.color}`}>
                                <metric.icon size={20} />
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${metric.change.startsWith('+') ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
                                }`}>
                                {metric.change}
                            </span>
                        </div>
                        <div className="text-[#C4C7C5] text-sm mb-1">{metric.label}</div>
                        <div className="text-2xl font-bold text-[#E3E3E3]">{metric.value}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pipeline Funnel Chart */}
                <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50">
                    <h3 className="text-lg font-medium text-[#E3E3E3] mb-6 flex items-center gap-2">
                        <BarChart2 size={20} className="text-[#A8C7FA]" />
                        Conversion Funnel
                    </h3>
                    <div className="space-y-4">
                        {pipelineData.map((stage, i) => (
                            <div key={i} className="relative">
                                <div className="flex justify-between text-sm text-[#E3E3E3] mb-1 z-10 relative">
                                    <span>{stage.stage}</span>
                                    <span className="text-[#C4C7C5]">{stage.count.toLocaleString()}</span>
                                </div>
                                <div className="h-8 bg-[#333537] rounded-md overflow-hidden relative flex items-center px-2">
                                    <div
                                        className="absolute top-0 left-0 h-full bg-[#A8C7FA]/20 border-r-2 border-[#A8C7FA]"
                                        style={{ width: `${stage.percentage}%` }}
                                    ></div>
                                    <span className="text-xs text-[#A8C7FA] relative z-10 font-mono">{stage.percentage}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Channel Performance */}
                <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50">
                    <h3 className="text-lg font-medium text-[#E3E3E3] mb-6 flex items-center gap-2">
                        <PieChart size={20} className="text-purple-400" />
                        Channel Performance
                    </h3>
                    <div className="space-y-6">
                        {channelPerformance.map((channel, i) => (
                            <div key={i}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[#E3E3E3] font-medium">{channel.channel}</span>
                                    <div className="flex gap-4 text-xs">
                                        <span className="text-[#C4C7C5]">Traffic: {channel.traffic}%</span>
                                        <span className="text-green-400">Conv: {channel.conversion}%</span>
                                    </div>
                                </div>
                                <div className="flex h-2 rounded-full overflow-hidden bg-[#333537]">
                                    <div
                                        className="bg-purple-400"
                                        style={{ width: `${channel.traffic}%` }}
                                    />
                                    <div
                                        className="bg-green-400"
                                        style={{ width: `${channel.conversion * 5}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const AudienceView = () => {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* High Value Segments */}
                <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-yellow-400/10 rounded-lg text-yellow-400">
                            <Target size={20} />
                        </div>
                        <h3 className="text-lg font-medium text-[#E3E3E3]">High Value (Whales)</h3>
                    </div>
                    <div className="text-3xl font-bold text-[#E3E3E3] mb-2">1,240</div>
                    <div className="text-sm text-[#C4C7C5] mb-4">Users with LTV &gt; $500</div>
                    <div className="h-2 bg-[#333537] rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-yellow-400 w-1/4"></div>
                    </div>
                    <div className="text-xs text-[#777]">Top 5% of customer base</div>
                </div>

                {/* New Growth */}
                <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-400/10 rounded-lg text-green-400">
                            <UserPlus size={20} />
                        </div>
                        <h3 className="text-lg font-medium text-[#E3E3E3]">New Growth</h3>
                    </div>
                    <div className="text-3xl font-bold text-[#E3E3E3] mb-2">+850</div>
                    <div className="text-sm text-[#C4C7C5] mb-4">New signups this week</div>
                    <div className="h-2 bg-[#333537] rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-green-400 w-3/4"></div>
                    </div>
                    <div className="text-xs text-[#777]">15% above target</div>
                </div>

                {/* Churn Risk */}
                <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-400/10 rounded-lg text-red-400">
                            <UserMinus size={20} />
                        </div>
                        <h3 className="text-lg font-medium text-[#E3E3E3]">At Risk</h3>
                    </div>
                    <div className="text-3xl font-bold text-[#E3E3E3] mb-2">320</div>
                    <div className="text-sm text-[#C4C7C5] mb-4">High probability of churn</div>
                    <div className="h-2 bg-[#333537] rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-red-400 w-1/3"></div>
                    </div>
                    <div className="text-xs text-[#777]">Action required for retention</div>
                </div>
            </div>

            {/* Demographics Heatmap (CSS Grid) */}
            <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50">
                <h3 className="text-lg font-medium text-[#E3E3E3] mb-6">Audience Demographics & Interests</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['Tech Enthusiasts', 'Online Shoppers', 'Business Professionals', 'Students', 'Gamers', 'Designers', 'Developers', 'Executives'].map((segment, i) => (
                        <div key={i} className="bg-[#333537]/30 p-4 rounded-xl flex flex-col items-center justify-center text-center hover:bg-[#333537]/60 transition-colors cursor-pointer group">
                            <div className="text-2xl font-bold text-[#A8C7FA] mb-1 group-hover:scale-110 transition-transform">{(Math.random() * 20 + 5).toFixed(1)}%</div>
                            <div className="text-sm text-[#C4C7C5]">{segment}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const CreativeView = () => {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Winner Card */}
                <div className="bg-[#1E1F20] p-6 rounded-2xl border border-green-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-bl-xl z-10">WINNER</div>
                    <h3 className="text-lg font-medium text-[#E3E3E3] mb-4 flex items-center gap-2">
                        <MonitorPlay size={20} className="text-green-400" />
                        Top Performing Video
                    </h3>
                    <div className="aspect-video bg-[#000] rounded-xl mb-4 flex items-center justify-center border border-[#444746] relative group">
                        <div className="absolute inset-0 bg-cover bg-center opacity-50 transition-opacity group-hover:opacity-70" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600")' }}></div>
                        <div className="z-10 bg-white/10 backdrop-blur-sm p-3 rounded-full"><MonitorPlay size={32} className="text-white" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-xs text-[#C4C7C5]">CTR</div>
                            <div className="text-xl font-bold text-green-400">3.8%</div>
                        </div>
                        <div>
                            <div className="text-xs text-[#C4C7C5]">CPC</div>
                            <div className="text-xl font-bold text-[#E3E3E3]">$0.45</div>
                        </div>
                        <div>
                            <div className="text-xs text-[#C4C7C5]">Conv.</div>
                            <div className="text-xl font-bold text-[#E3E3E3]">128</div>
                        </div>
                    </div>
                </div>

                {/* Underperformer Card */}
                <div className="bg-[#1E1F20] p-6 rounded-2xl border border-red-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10">NEEDS ATTENTION</div>
                    <h3 className="text-lg font-medium text-[#E3E3E3] mb-4 flex items-center gap-2">
                        <Image size={20} className="text-red-400" />
                        Low Engagement Static
                    </h3>
                    <div className="aspect-video bg-[#000] rounded-xl mb-4 flex items-center justify-center border border-[#444746] relative group">
                        <div className="absolute inset-0 bg-cover bg-center opacity-30 transition-opacity group-hover:opacity-50" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=600")' }}></div>
                        <div className="z-10"><Image size={32} className="text-[#777]" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-xs text-[#C4C7C5]">CTR</div>
                            <div className="text-xl font-bold text-red-400">0.5%</div>
                        </div>
                        <div>
                            <div className="text-xs text-[#C4C7C5]">CPC</div>
                            <div className="text-xl font-bold text-[#E3E3E3]">$1.20</div>
                        </div>
                        <div>
                            <div className="text-xs text-[#C4C7C5]">Conv.</div>
                            <div className="text-xl font-bold text-[#E3E3E3]">12</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* A/B Test Table */}
            <div className="bg-[#1E1F20] rounded-2xl border border-[#444746]/50 overflow-hidden">
                <div className="p-4 border-b border-[#444746]/50">
                    <h3 className="text-md font-medium text-[#E3E3E3]">Active A/B Tests</h3>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-[#333537]/50 text-[#C4C7C5]">
                        <tr>
                            <th className="px-6 py-3 font-medium">Test Name</th>
                            <th className="px-6 py-3 font-medium">Variant A</th>
                            <th className="px-6 py-3 font-medium">Variant B</th>
                            <th className="px-6 py-3 font-medium">Confidence</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#444746]/30 text-[#E3E3E3]">
                        <tr className="hover:bg-[#333537]/30">
                            <td className="px-6 py-4">Homepage Hero</td>
                            <td className="px-6 py-4 text-green-400">4.2%</td>
                            <td className="px-6 py-4">3.8%</td>
                            <td className="px-6 py-4">88%</td>
                            <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">Running</span></td>
                        </tr>
                        <tr className="hover:bg-[#333537]/30">
                            <td className="px-6 py-4">Checkout Button</td>
                            <td className="px-6 py-4">12.1%</td>
                            <td className="px-6 py-4 text-green-400">14.5%</td>
                            <td className="px-6 py-4">96%</td>
                            <td className="px-6 py-4"><span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">Conclusive</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const PredictiveView = () => {
    const [spendAdjustment, setSpendAdjustment] = useState(20);

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-[#1E1F20] p-8 rounded-2xl border border-[#444746]/50">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-xl font-semibold text-[#E3E3E3] mb-2 flex items-center gap-2"><Sliders className="text-[#A8C7FA]" /> Budget Simulator</h2>
                        <p className="text-[#C4C7C5]">Adjust the budget allocation to see predicted impact on revenue.</p>
                    </div>
                </div>

                <div className="mb-10">
                    <div className="flex justify-between text-sm text-[#E3E3E3] mb-4">
                        <span>Current Budget</span>
                        <span>{(100 + spendAdjustment)}%</span>
                    </div>
                    <input
                        type="range"
                        min="-50"
                        max="100"
                        value={spendAdjustment}
                        onChange={(e) => setSpendAdjustment(Number(e.target.value))}
                        className="w-full h-2 bg-[#333537] rounded-lg appearance-none cursor-pointer accent-[#A8C7FA]"
                    />
                    <div className="flex justify-between text-xs text-[#777] mt-2">
                        <span>-50% spend</span>
                        <span>0% (Baseline)</span>
                        <span>+100% spend</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-8">
                    <div className="text-center p-4 rounded-xl bg-[#333537]/30 border border-[#444746]/30">
                        <div className="text-sm text-[#C4C7C5] mb-2">Projected Revenue</div>
                        <div className="text-3xl font-bold text-green-400">
                            ${(2.4 * (1 + (spendAdjustment * 0.8) / 100)).toFixed(2)}M
                        </div>
                        <div className="text-xs text-[#777] mt-1">
                            {spendAdjustment >= 0 ? '+' : ''}{(spendAdjustment * 0.8).toFixed(1)}% vs Baseline
                        </div>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-[#333537]/30 border border-[#444746]/30">
                        <div className="text-sm text-[#C4C7C5] mb-2">Estimated CBA</div>
                        <div className="text-3xl font-bold text-[#E3E3E3]">
                            ${(45 * (1 + (spendAdjustment * 0.2) / 100)).toFixed(2)}
                        </div>
                        <div className="text-xs text-[#777] mt-1">Cost Per Acquisition increases marginally</div>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-[#333537]/30 border border-[#444746]/30">
                        <div className="text-sm text-[#C4C7C5] mb-2">Predicted Conversions</div>
                        <div className="text-3xl font-bold text-[#A8C7FA]">
                            {Math.round(5200 * (1 + (spendAdjustment * 0.7) / 100)).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-[#1E1F20] p-6 rounded-2xl border border-[#444746]/50">
                <h3 className="text-lg font-medium text-[#E3E3E3] mb-4">Forecast Confidence</h3>
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-3 bg-[#333537] rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 w-[85%]"></div>
                    </div>
                    <span className="text-sm font-bold text-green-400">85% Confidence</span>
                </div>
                <p className="text-xs text-[#777] mt-2">Based on historical seasonality and current market trends.</p>
            </div>
        </div>
    );
};

const MarketingInsights = () => {
    const [subTab, setSubTab] = useState('overview'); // 'overview', 'audience', 'creative', 'predictive'

    const renderSubView = () => {
        switch (subTab) {
            case 'overview': return <OverviewView />;
            case 'audience': return <AudienceView />;
            case 'creative': return <CreativeView />;
            case 'predictive': return <PredictiveView />;
            default: return <OverviewView />;
        }
    };

    return (
        <div className="h-full w-full bg-[#131314] overflow-y-auto p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-[#E3E3E3] mb-1">Marketing Insights</h1>
                    <p className="text-[#C4C7C5] text-sm">Deep dive into project performance</p>
                </div>

                {/* Sub-Navigation Pills */}
                <div className="flex bg-[#1E1F20] p-1 rounded-xl border border-[#444746]">
                    {[
                        { id: 'overview', label: 'Overview' },
                        { id: 'audience', label: 'Audience' },
                        { id: 'creative', label: 'Creative' },
                        { id: 'predictive', label: 'Predictive' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === tab.id
                                    ? 'bg-[#333537] text-white shadow-sm'
                                    : 'text-[#777] hover:text-[#C4C7C5]'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-3 hidden md:flex">
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-[#1E1F20] border border-[#444746] rounded-lg text-[#C4C7C5] hover:text-[#E3E3E3] text-sm">
                        <Calendar size={16} />
                        Last 30 Days
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-[#A8C7FA] text-[#000] rounded-lg font-medium text-sm hover:bg-[#8AB4F8]">
                        Export
                    </button>
                </div>
            </div>

            {/* Dynamic Content */}
            {renderSubView()}
        </div>
    );
};

export default MarketingInsights;
