import React, { useState, useEffect } from 'react';
import { Database, Layers, Folder, ChevronRight, Home as HomeIcon } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import MarketingWorkspace from '../components/visuals/MarketingWorkspace';

const ProjectDashboard = () => {
    const { projectId } = useParams();
    const [activeProjectName, setActiveProjectName] = useState('');

    // Mock Workspace Data
    const [workspaceData, setWorkspaceData] = useState(null);

    useEffect(() => {
        if (!projectId) return;

        // Mock Logic: Get name from ID
        const mockNames = {
            'marketing_campaign_2024': 'Marketing Campaign 2024',
            'customer_churn_v1': 'Customer Churn Model v1',
            'sales_forecast_q3': 'Sales Forecast Q3'
        };
        setActiveProjectName(mockNames[projectId] || projectId);

        // Mock Data Load (Simulate backend response)
        setWorkspaceData({
            tables: [
                {
                    id: 't1', title: 'Ecommerce Store', x: 0, y: 0,
                    columns: [
                        { id: 'c1', name: 'Age', type: 'Integer', status: 'ok' },
                        { id: 'c2', name: 'Income', type: 'Float', status: 'warning', issue: 'Missing values in 5% of rows' },
                        { id: 'c3', name: 'Location', type: 'String', status: 'ok' },
                        { id: 'c101', name: 'Gender', type: 'String', status: 'ok' },
                        { id: 'c102', name: 'Occupation', type: 'String', status: 'ok' }
                    ]
                },
                {
                    id: 't2', title: 'Amazon Shopping API', x: 0, y: 0,
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
                    id: 't3', title: 'Clickstream Events', x: 0, y: 0,
                    columns: [
                        { id: 'c7', name: 'Time on Site', type: 'Float', status: 'ok' },
                        { id: 'c8', name: 'Bounce Rate', type: 'Float', status: 'ok' },
                        { id: 'c301', name: 'Pages per Session', type: 'Integer', status: 'ok' },
                        { id: 'c302', name: 'Session Duration', type: 'Float', status: 'ok' }
                    ]
                },
                {
                    id: 't4', title: 'Customer 360', x: 0, y: 0,
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
            dashboardGroups: [
                { id: 'dg1', title: 'Executive Views', sources: ['m1', 'm2', 'p1'] },
                { id: 'dg2', title: 'Operational Views', sources: ['m2', 'p4', 'c8'] },
                { id: 'dg3', title: 'Product & UX', sources: ['c7', 'a1', 'c402'] },
                { id: 'dg4', title: 'Marketing Performance', sources: ['c5', 'c201', 'c202'] },
                { id: 'dg5', title: 'AI & Predictions', sources: ['p1', 'p2', 'p5', 'a1'] },
                { id: 'dg6', title: 'Security & Risk', sources: ['p5', 'c403'] },
                { id: 'dg7', title: 'Sales & Revenue', sources: ['m2', 'c402', 'c401'] }
            ],
            dashboards: [
                {
                    id: 'd1', title: 'Dashboards',
                    items: [
                        { id: 'db1', name: 'Executive Overview', status: 'ok', groupId: 'dg1' },
                        { id: 'db2', name: 'Sales Performance', status: 'ok', groupId: 'dg2' },
                        { id: 'db3', name: 'Churn Analysis', status: 'warning', issue: 'Data staleness detected', groupId: 'dg2' },

                        // New Additions
                        { id: 'db4', name: 'Product Strategy', status: 'ok', groupId: 'dg3' },
                        { id: 'db5', name: 'User Experience (UX)', status: 'ok', groupId: 'dg3' },
                        { id: 'db6', name: 'Ad Campaign Tracker', status: 'error', issue: 'Connection lost', groupId: 'dg4' },
                        { id: 'db7', name: 'Conversion Optimization', status: 'ok', groupId: 'dg4' },

                        { id: 'db8', name: 'Financial Overview', status: 'ok', groupId: 'dg1' },
                        { id: 'db9', name: 'Regional Sales', status: 'ok', groupId: 'dg2' },
                        { id: 'db10', name: 'Inventory Health', status: 'warning', groupId: 'dg2' },
                        { id: 'db11', name: 'Real-time Traffic', status: 'ok', groupId: 'dg3' },

                        // More Charts
                        { id: 'db12', name: 'Retention Curve', status: 'ok', groupId: 'dg3' },
                        { id: 'db13', name: 'Customer Satisfaction', status: 'ok', groupId: 'dg3' },
                        { id: 'db14', name: 'Ad Spend (Daily)', status: 'ok', groupId: 'dg4' },
                        { id: 'db15', name: 'Server Latency', status: 'error', issue: 'Spike detected', groupId: 'dg2' },

                        // New AI & Prediction Charts
                        { id: 'db16', name: 'Churn Risk Factors', status: 'warning', groupId: 'dg5' },
                        { id: 'db17', name: 'Lookalike Audiences', status: 'ok', groupId: 'dg5' },
                        { id: 'db18', name: 'Campaign Anomalies', status: 'ok', groupId: 'dg5' },

                        { id: 'db19', name: 'Social Sentiment', status: 'ok', groupId: 'dg3' },

                        // Complete BI Expansion
                        { id: 'db20', name: 'Fraud Detection Log', status: 'ok', groupId: 'dg6' },
                        { id: 'db21', name: 'Transaction Risk', status: 'ok', groupId: 'dg6' },
                        { id: 'db22', name: 'Refunds & Disputes', status: 'warning', groupId: 'dg6' },

                        { id: 'db23', name: 'MRR Growth Tracker', status: 'ok', groupId: 'dg7' },
                        { id: 'db24', name: 'Avg. Order Value (AOV)', status: 'ok', groupId: 'dg7' },
                        { id: 'db25', name: 'Top Selling Products', status: 'ok', groupId: 'dg7' },

                        { id: 'db26', name: 'Quarterly Goals', status: 'ok', groupId: 'dg1' },
                        { id: 'db27', name: 'Channel Attribution', status: 'ok', groupId: 'dg4' }
                    ]
                }
            ],
            metrics: { roi: '150%', spend: '$50k' }
        });

    }, [projectId]);

    return (
        <div className="flex flex-col h-full w-full bg-[#0B0D0E]">
            {/* Main Workspace Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131314] relative">

                {/* Breadcrumbs Top Bar */}
                <div className="h-14 bg-[#1E1F20] border-b border-[#444746]/30 flex items-center px-6 gap-4 text-sm justify-between">
                    <div className="flex items-center gap-2 text-[#C4C7C5]">
                        <Link to="/" className="p-1.5 hover:bg-[#333537] rounded-lg transition-colors text-[#C4C7C5] hover:text-[#E3E3E3]">
                            <HomeIcon size={16} />
                        </Link>
                        <ChevronRight size={14} className="opacity-50" />
                        <span className="font-medium text-[#E3E3E3]">{activeProjectName}</span>
                    </div>

                    {/* Quick Stats */}
                    {projectId && (
                        <div className="flex items-center gap-6 text-xs">
                            <div className="flex items-center gap-1.5">
                                <Database size={14} className="text-[#A8C7FA]" />
                                <span className="text-[#C4C7C5]">Lakehouse: <span className="text-[#E3E3E3]">Connected</span></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Layers size={14} className="text-green-400" />
                                <span className="text-[#C4C7C5]">Cost: <span className="text-[#E3E3E3]">$132.50</span></span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Workspace Content */}
                <div className="flex-1 overflow-hidden relative">
                    {projectId ? (
                        <MarketingWorkspace
                            data={workspaceData}
                            viewState="engineering"
                            onAction={() => { }}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-[#444746]">
                            <Folder size={64} className="mb-4 opacity-20" />
                            <p>Project not found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectDashboard;
