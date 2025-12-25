import React from 'react';
import { Wrench } from 'lucide-react';

const DevTools = ({ onSetWorkspace, onSetData }) => {
    // Only show if VITE_DEV_MODE is true
    const isDev = import.meta.env.VITE_DEV_MODE === 'true';

    if (!isDev) return null;

    const handleSwitch = (workspace, mockData = null) => {
        onSetWorkspace(workspace);
        onSetData(mockData);
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 p-3 bg-[#131314]/90 backdrop-blur-md rounded-xl border border-[#444746] shadow-2xl">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono text-[#A8C7FA] mb-1 px-1">
                <Wrench size={12} /> Dev Controls
            </div>

            <div className="grid grid-cols-1 gap-2">
                <button
                    onClick={() => handleSwitch('marketing_engineering', {
                        tables: [
                            {
                                id: 't1', title: 'User Demographics', x: 0, y: 0,
                                columns: [
                                    { id: 'c1', name: 'Age', type: 'Integer', status: 'ok' },
                                    { id: 'c2', name: 'Income', type: 'Float', status: 'warning', issue: 'Missing values in 5% of rows' },
                                    { id: 'c3', name: 'Location', type: 'String', status: 'ok' },
                                    { id: 'c101', name: 'Gender', type: 'String', status: 'ok' },
                                    { id: 'c102', name: 'Occupation', type: 'String', status: 'ok' }
                                ]
                            },
                            {
                                id: 't2', title: 'Campaign Metrics', x: 0, y: 0,
                                columns: [
                                    { id: 'c4', name: 'Ad Spend', type: 'Float', status: 'ok' },
                                    { id: 'c5', name: 'Impressions', type: 'Integer', status: 'error', issue: 'Negative values detected' },
                                    { id: 'c6', name: 'Clicks', type: 'Integer', status: 'ok' },
                                    { id: 'c201', name: 'CTR', type: 'Float', status: 'ok' },
                                    { id: 'c202', name: 'Conversion Rate', type: 'Float', status: 'ok' },
                                    { id: 'c203', name: 'CPC', type: 'Float', status: 'warning', issue: 'High variance detected' }
                                ]
                            },
                            {
                                id: 't3', title: 'Website Engagement', x: 0, y: 0,
                                columns: [
                                    { id: 'c7', name: 'Time on Site', type: 'Float', status: 'ok' },
                                    { id: 'c8', name: 'Bounce Rate', type: 'Float', status: 'ok' },
                                    { id: 'c301', name: 'Pages per Session', type: 'Integer', status: 'ok' },
                                    { id: 'c302', name: 'Session Duration', type: 'Float', status: 'ok' }
                                ]
                            },
                            {
                                id: 't4', title: 'Customer Lifetime Value', x: 0, y: 0,
                                columns: [
                                    { id: 'c401', name: 'Total Revenue', type: 'Float', status: 'ok' },
                                    { id: 'c402', name: 'Order Count', type: 'Integer', status: 'ok' },
                                    { id: 'c403', name: 'Returns', type: 'Integer', status: 'error', issue: 'Data mismatch' },
                                    { id: 'c404', name: 'Last Purchase Date', type: 'Date', status: 'ok' }
                                ]
                            }
                        ],
                        connections: [],
                        metricGroups: [
                            {
                                id: 'g1', title: 'Campaign ROI',
                                metrics: [
                                    { id: 'm1', name: 'Total Spend', value: '$50,000', status: 'ok' },
                                    { id: 'm2', name: 'Revenue', value: '$120,000', status: 'ok' },
                                    { id: 'm3', name: 'ROI', value: '140%', status: 'warning', issue: 'Slightly below target' }
                                ]
                            },
                            {
                                id: 'g2', title: 'Financial KPIs',
                                metrics: [
                                    { id: 'm4', name: 'CAC', value: '$25', status: 'ok' },
                                    { id: 'm5', name: 'LTV', value: '$450', status: 'ok' }
                                ]
                            }
                        ],
                        predictionModels: [
                            {
                                id: 'pm1', title: 'Customer Predictions',
                                predictions: [
                                    { id: 'p1', name: 'Churn Probability', status: 'warning', issue: 'Rising trend in cohort A' },
                                    { id: 'p2', name: 'Lifetime Value (CLV)', status: 'ok' },
                                    { id: 'p3', name: 'Next Best Action', status: 'ok' }
                                ]
                            },
                            {
                                id: 'pm2', title: 'Operational ML',
                                predictions: [
                                    { id: 'p4', name: 'Demand Forecast', status: 'error', issue: 'Insufficient historical data' },
                                    { id: 'p5', name: 'Fraud Probability', status: 'ok' },
                                    { id: 'p6', name: 'Lead Scoring', status: 'ok' }
                                ]
                            }
                        ],
                        advancedAnalytics: [
                            {
                                id: 'aa1', title: 'Advanced Analytics',
                                items: [
                                    { id: 'a1', name: 'Sentiment Analysis', status: 'ok' },
                                    { id: 'a2', name: 'Network Graph', status: 'error', issue: 'Data connection failed' }
                                ]
                            }
                        ],
                        metrics: { roi: '150%', spend: '$50k' }
                    })}
                    className="px-3 py-2 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/20 transition-all text-left truncate"
                >
                    Marketing Wrksp
                </button>

                <button
                    onClick={() => handleSwitch('llm_setup', {
                        models: ['Llama-2-7b', 'Mistral-7b'],
                        status: 'idle'
                    })}
                    className="px-3 py-2 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/20 transition-all text-left truncate"
                >
                    LLM Training
                </button>

                <button
                    onClick={() => handleSwitch('image_review', {
                        images: [],
                        stats: { accuracy: '94%' }
                    })}
                    className="px-3 py-2 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-300 rounded-lg border border-green-500/20 transition-all text-left truncate"
                >
                    Image Classification
                </button>

                <div className="h-px bg-[#444746]/50 my-1"></div>

                <button
                    onClick={() => handleSwitch(null, null)}
                    className="px-3 py-2 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-lg border border-red-500/20 transition-all text-left truncate"
                >
                    Reset View
                </button>
            </div>
        </div>
    );
};

export default DevTools;
