import React, { useState } from 'react';
import { Folder, MoreVertical, Search, Grid, List as ListIcon, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';

const ModelsLibrary = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('grid');
    const [models] = useState([
        { id: 'sales-predictor', name: 'Sales Predictor v1', status: 'running', type: 'Gradient Boosting', updated: '2h ago' },
        { id: 'churn-classifier', name: 'Churn Classifier', status: 'training', type: 'Random Forest', updated: '5m ago' },
        { id: 'customer-seg', name: 'Customer Segmentation', status: 'stopped', type: 'K-Means', updated: '1d ago' },
        { id: 'inventory-forecast', name: 'Inventory Forecast', status: 'draft', type: 'Prophet', updated: '3d ago' },
    ]);

    return (
        <div className="flex flex-col h-full w-full bg-[#131314] p-8 animate-fade-in pt-20">

            {/* Header / Toolbar */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-medium text-[#E3E3E3]">Model Library</h1>
                    <div className="h-6 w-[1px] bg-[#444746]"></div>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4C7C5] group-focus-within:text-[#E3E3E3]" size={16} />
                        <input
                            type="text"
                            placeholder="Search models..."
                            className="bg-[#1E1F20] border border-[#444746] rounded-full pl-9 pr-4 py-1.5 text-sm text-[#E3E3E3] focus:ring-1 focus:ring-[#A8C7FA] focus:border-[#A8C7FA] outline-none transition-all w-64"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-[#1E1F20] border border-[#444746] rounded-lg p-1 flex">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={clsx("p-1.5 rounded transition-colors", viewMode === 'grid' ? "bg-[#333537] text-white" : "text-[#C4C7C5] hover:text-[#E3E3E3]")}
                        >
                            <Grid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={clsx("p-1.5 rounded transition-colors", viewMode === 'list' ? "bg-[#333537] text-white" : "text-[#C4C7C5] hover:text-[#E3E3E3]")}
                        >
                            <ListIcon size={18} />
                        </button>
                    </div>
                    <button className="flex items-center gap-2 bg-[#E3E3E3] hover:bg-white text-[#131314] px-4 py-2 rounded-full text-sm font-medium transition-colors">
                        <Plus size={18} />
                        New Model
                    </button>
                </div>
            </div>

            {/* Grid View (Finder Style) */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {models.map((model) => (
                        <div
                            key={model.id}
                            onClick={() => navigate(`/models/${model.id}`)}
                            onDoubleClick={() => navigate(`/models/${model.id}`)}
                            className="group flex flex-col items-center p-4 rounded-xl hover:bg-[#1E1F20] border border-transparent hover:border-[#444746] transition-all cursor-pointer"
                        >
                            <div className="w-20 h-20 mb-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-[#A8C7FA]/20 group-hover:scale-105 transition-transform">
                                <Folder size={32} className="text-[#A8C7FA]" fill="#A8C7FA" fillOpacity={0.2} />
                            </div>
                            <span className="text-sm font-medium text-[#E3E3E3] text-center mb-1 group-hover:text-white">{model.name}</span>
                            <div className="flex items-center gap-2">
                                <span className={clsx("w-2 h-2 rounded-full",
                                    model.status === 'running' ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.4)]" :
                                        model.status === 'training' ? "bg-yellow-400" :
                                            "bg-[#444746]"
                                )}></span>
                                <span className="text-xs text-[#C4C7C5] capitalize">{model.status}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="w-full">
                    <div className="grid grid-cols-12 text-xs font-medium text-[#C4C7C5] px-4 py-2 border-b border-[#444746]">
                        <div className="col-span-4">Name</div>
                        <div className="col-span-3">Status</div>
                        <div className="col-span-3">Type</div>
                        <div className="col-span-2">Last Updated</div>
                    </div>
                    {models.map((model) => (
                        <div
                            key={model.id}
                            onClick={() => navigate(`/models/${model.id}`)}
                            className="grid grid-cols-12 items-center px-4 py-3 text-sm text-[#E3E3E3] hover:bg-[#1E1F20] border-b border-[#444746]/30 cursor-pointer group transition-colors"
                        >
                            <div className="col-span-4 flex items-center gap-3">
                                <Folder size={18} className="text-[#A8C7FA]" fill="#A8C7FA" fillOpacity={0.2} />
                                <span className="font-medium">{model.name}</span>
                            </div>
                            <div className="col-span-3 flex items-center gap-2">
                                <span className={clsx("w-1.5 h-1.5 rounded-full",
                                    model.status === 'running' ? "bg-green-400" :
                                        model.status === 'training' ? "bg-yellow-400" :
                                            "bg-[#444746]"
                                )}></span>
                                <span className="capitalize text-[#C4C7C5]">{model.status}</span>
                            </div>
                            <div className="col-span-3 text-[#C4C7C5]">{model.type}</div>
                            <div className="col-span-2 text-[#C4C7C5]">{model.updated}</div>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
};

export default ModelsLibrary;
