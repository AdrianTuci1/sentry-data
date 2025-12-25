import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Plus, Users, Settings, Database, Server, CreditCard, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

const Home = () => {
    const navigate = useNavigate();

    // Mock Projects
    const projects = [
        { id: 'marketing_campaign_2024', name: 'Marketing Campaign 2024', status: 'active', lastActive: '2 min ago', connectors: 3, models: 1 },
        { id: 'customer_churn_v1', name: 'Customer Churn Model v1', status: 'active', lastActive: '2h ago', connectors: 1, models: 2 },
        { id: 'sales_forecast_q3', name: 'Sales Forecast Q3', status: 'archived', lastActive: '5d ago', connectors: 2, models: 0 }
    ];

    return (
        <div className="flex w-full h-full bg-[#0B0D0E] overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full p-8 md:p-12">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-green-400 to-blue-500 flex items-center justify-center text-[#131314] font-bold text-xl shadow-lg shadow-blue-500/20">
                                S
                            </div>
                            <h1 className="text-2xl font-bold text-[#E3E3E3]">Sentry Data</h1>
                        </div>
                        <p className="text-[#80868B] mt-2">Manage your data lakes, connectors, and machine learning models.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E1F20] border border-[#444746]/50 text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#333537] transition-all">
                            <Users size={16} />
                            <span>Workspace Members</span>
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E1F20] border border-[#444746]/50 text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#333537] transition-all">
                            <CreditCard size={16} />
                            <span>Billing</span>
                        </button>
                    </div>
                </header>

                {/* Projects Grid */}
                <section className="mb-12">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-[#E3E3E3] flex items-center gap-2">
                            <Folder size={18} className="text-[#A8C7FA]" />
                            Projects
                        </h2>

                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A8C7FA] text-[#0B0D0E] font-medium hover:bg-[#8AB4F8] transition-all shadow-[0_0_15px_rgba(168,199,250,0.3)]">
                            <Plus size={18} />
                            Create Project
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(project => (
                            <div
                                key={project.id}
                                onClick={() => navigate(`/project/${project.id}`)}
                                className="group relative bg-[#1E1F20]/50 hover:bg-[#1E1F20] border border-[#444746]/30 hover:border-[#A8C7FA]/50 rounded-2xl p-6 transition-all cursor-pointer shadow-sm hover:shadow-md"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 rounded-xl bg-[#333537]/50 group-hover:bg-[#A8C7FA]/10 transition-colors">
                                        <Folder size={24} className="text-[#C4C7C5] group-hover:text-[#A8C7FA]" />
                                    </div>
                                    <div className={clsx("px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider",
                                        project.status === 'active' ? "bg-green-400/10 text-green-400" : "bg-[#444746]/50 text-[#80868B]"
                                    )}>
                                        {project.status}
                                    </div>
                                </div>

                                <h3 className="text-lg font-semibold text-[#E3E3E3] mb-1 group-hover:text-[#A8C7FA] transition-colors">
                                    {project.name}
                                </h3>
                                <div className="text-xs text-[#80868B] mb-6">Last active {project.lastActive}</div>

                                <div className="flex items-center gap-6 border-t border-[#444746]/30 pt-4 text-xs text-[#C4C7C5]">
                                    <div className="flex items-center gap-1.5" title="Active Connectors">
                                        <Database size={14} />
                                        <span>{project.connectors} Connectors</span>
                                    </div>
                                    <div className="flex items-center gap-1.5" title="Deployed Models">
                                        <Server size={14} />
                                        <span>{project.models} Models</span>
                                    </div>
                                </div>

                                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                    <ChevronRight size={20} className="text-[#A8C7FA]" />
                                </div>
                            </div>
                        ))}

                        {/* Empty Add Card */}
                        <button className="flex flex-col items-center justify-center gap-4 bg-[#1E1F20]/30 hover:bg-[#1E1F20]/50 border border-dashed border-[#444746] hover:border-[#80868B] rounded-2xl p-6 transition-all group">
                            <div className="p-4 rounded-full bg-[#333537]/50 group-hover:bg-[#333537] text-[#80868B] group-hover:text-[#E3E3E3] transition-colors">
                                <Plus size={24} />
                            </div>
                            <span className="font-medium text-[#80868B] group-hover:text-[#C4C7C5]">Add New Project</span>
                        </button>
                    </div>
                </section>

                {/* Accounts / Settings Section */}
                <section>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#1E1F20]/30 border border-[#444746]/30 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Users size={18} className="text-[#F28B82]" />
                                <h3 className="font-semibold text-[#E3E3E3]">Account Management</h3>
                            </div>
                            <p className="text-sm text-[#80868B] mb-4">You have 3 active users in this workspace. Manage permissions or add new seats.</p>
                            <button className="text-sm text-[#A8C7FA] hover:text-[#8AB4F8] font-medium">Manage Team &rarr;</button>
                        </div>

                        <div className="bg-[#1E1F20]/30 border border-[#444746]/30 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Settings size={18} className="text-[#FDD663]" />
                                <h3 className="font-semibold text-[#E3E3E3]">Global Settings</h3>
                            </div>
                            <p className="text-sm text-[#80868B] mb-4">Configure default AWS regions, Meltano repositories, and billing details.</p>
                            <button className="text-sm text-[#A8C7FA] hover:text-[#8AB4F8] font-medium">Configure Workspace &rarr;</button>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
};

export default Home;
