import React, { useState, useEffect } from 'react';
import { Folder, ChevronLeft, ChevronRight, Plus, Box } from 'lucide-react';
import { clsx } from 'clsx';
import { useLocation, useNavigate } from 'react-router-dom';

const Sidebar = ({ className }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Mock Projects (In real app, fetch from Context or API)
    const [projects, setProjects] = useState([]);
    useEffect(() => {
        // Mock API
        setTimeout(() => {
            setProjects([
                { id: 'marketing_campaign_2024', name: 'Marketing Campaign 2024' },
                { id: 'customer_churn_v1', name: 'Customer Churn Model v1' },
                { id: 'sales_forecast_q3', name: 'Sales Forecast Q3' }
            ]);
        }, 100);
    }, []);

    const handleProjectClick = (projectId) => {
        navigate(`/dashboard?project=${projectId}`);
    };

    return (
        <div className={clsx(
            "h-full bg-[#131314] flex flex-col pt-20 transition-all duration-300 relative border-r border-[#444746]/30",
            isCollapsed ? "w-16 items-center" : "w-64 px-4",
            className
        )}>

            {/* Collapse Toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute top-6 right-[-12px] bg-[#1E1F20] border border-[#444746] rounded-full p-1 text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#333537] transition-colors z-20 shadow-md"
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* New Project Button */}
            <div className={clsx("mb-6 flex flex-col gap-2", isCollapsed && "items-center")}>
                {!isCollapsed && (
                    <h2 className="text-xs font-medium text-[#E3E3E3] uppercase tracking-wider pl-2 opacity-50">
                        Workspace
                    </h2>
                )}

                <button
                    onClick={() => navigate('/dashboard')}
                    className={clsx(
                        "flex items-center gap-2 bg-[#1E1F20] hover:bg-[#333537] text-[#E3E3E3] rounded-xl transition-all border border-[#444746]/50 shadow-sm",
                        isCollapsed ? "p-3 justify-center" : "px-4 py-2.5 w-full"
                    )}
                    title="New Project"
                >
                    <Plus size={18} className={!isCollapsed && "mr-1"} />
                    {!isCollapsed && <span className="text-sm font-medium">New Project</span>}
                </button>
            </div>

            {/* Project List */}
            <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
                {projects.map(p => (
                    <button
                        key={p.id}
                        onClick={() => handleProjectClick(p.id)}
                        className={clsx(
                            "flex items-center gap-3 w-full p-2.5 rounded-lg transition-colors text-left",
                            location.search.includes(p.id) ? "bg-[#A8C7FA]/10 text-[#A8C7FA]" : "hover:bg-[#1E1F20] text-[#E3E3E3]"
                        )}
                        title={isCollapsed ? p.name : undefined}
                    >
                        <Folder size={18} className={clsx("shrink-0", location.search.includes(p.id) ? "fill-current opacity-50" : "text-[#C4C7C5]")} />
                        {!isCollapsed && <span className="truncate text-sm">{p.name}</span>}
                    </button>
                ))}
            </div>

            {/* Simple User Footer if expanded */}
            {!isCollapsed && (
                <div className="mt-auto mb-4 p-3 bg-[#1E1F20]/50 rounded-xl border border-[#444746]/30 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-xs text-white">
                        AT
                    </div>
                    <div>
                        <div className="text-xs font-medium text-[#E3E3E3]">Adrian Tucicovenco</div>
                        <div className="text-[10px] text-[#C4C7C5]">Pro Plan</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
