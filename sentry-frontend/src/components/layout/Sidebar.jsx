import React, { useState } from 'react';
import { MessageSquare, Calendar, ChevronLeft, ChevronRight, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { useLocation, useNavigate } from 'react-router-dom';

const Sidebar = ({ className }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const isModels = location.pathname.startsWith('/models');

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

            {/* Contextual Header / New Chat */}
            <div className={clsx("mb-6 flex flex-col gap-2", isCollapsed && "items-center")}>
                {!isCollapsed && (
                    <h2 className="text-xs font-medium text-[#E3E3E3] uppercase tracking-wider pl-2 opacity-50">
                        {isModels ? 'Library' : 'Sessions'}
                    </h2>
                )}

                <button
                    onClick={() => isModels ? navigate('/models/new') : navigate('/')}
                    className={clsx(
                        "flex items-center gap-2 bg-[#1E1F20] hover:bg-[#333537] text-[#E3E3E3] rounded-xl transition-all border border-[#444746]/50 shadow-sm",
                        isCollapsed ? "p-3 justify-center" : "px-4 py-2.5 w-full"
                    )}
                    title={isModels ? "Deploy New Model" : "New Chat"}
                >
                    <Plus size={18} className={!isCollapsed && "mr-1"} />
                    {!isCollapsed && <span className="text-sm font-medium">{isModels ? 'New Model' : 'New Chat'}</span>}
                </button>
            </div>

            {/* Content - Models View */}
            {isModels && (
                <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
                    {/* Example Model List */}
                    <div onClick={() => window.location.href = '/models/sales-predictor'} className={clsx("rounded-xl border border-transparent transition-all cursor-pointer group", isCollapsed ? "p-2 hover:bg-[#1E1F20] flex justify-center" : "p-3 bg-[#1E1F20] border-[#444746]/50 hover:border-[#A8C7FA]/50")}>
                        {isCollapsed ? (
                            <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" title="Sales Predictor (Running)"></div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-[#E3E3E3] font-medium truncate">Sales Predictor</span>
                                    <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                                </div>
                                <div className="text-[11px] text-[#C4C7C5] group-hover:text-[#E3E3E3] transition-colors">
                                    Running • 98% Acc
                                </div>
                            </>
                        )}
                    </div>

                    <div className={clsx("rounded-xl border border-transparent transition-all cursor-pointer group opacity-70", isCollapsed ? "p-2 hover:bg-[#1E1F20] flex justify-center" : "p-3 bg-[#1E1F20] border-[#444746]/50 hover:border-[#A8C7FA]/50")}>
                        {isCollapsed ? (
                            <div className="w-2 h-2 rounded-full bg-yellow-400" title="Churn Classifier (Training)"></div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-[#E3E3E3] font-medium truncate">Churn Classifier</span>
                                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                                </div>
                                <div className="text-[11px] text-[#C4C7C5] group-hover:text-[#E3E3E3] transition-colors">
                                    Training...
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Content - Home/Chat View */}
            {!isModels && (
                <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
                    {!isCollapsed ? (
                        <>
                            <button className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-[#1E1F20] text-[#E3E3E3] text-sm group transition-colors text-left">
                                <MessageSquare size={16} className="text-[#C4C7C5] group-hover:text-[#A8C7FA]" />
                                <span className="truncate">S3 Data Analysis</span>
                            </button>
                            <button className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-[#1E1F20] text-[#E3E3E3] text-sm group transition-colors text-left">
                                <MessageSquare size={16} className="text-[#C4C7C5] group-hover:text-[#A8C7FA]" />
                                <span className="truncate">Customer Segmentation</span>
                            </button>

                            <div className="mt-6 mb-2">
                                <h3 className="text-xs font-medium text-[#C4C7C5] px-2 opacity-50">Previous 7 Days</h3>
                            </div>

                            <button className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-[#1E1F20] text-[#E3E3E3] text-sm group transition-colors text-left opacity-70">
                                <MessageSquare size={16} className="text-[#C4C7C5]" />
                                <span className="truncate">Test Run #4</span>
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4 mt-4">
                            {/* Hidden when collapsed as requested: "Cand sidebar e retras nu aratam icon-uri de chat" */}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default Sidebar;
