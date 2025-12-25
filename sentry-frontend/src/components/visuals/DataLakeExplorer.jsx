import React, { useState, useEffect } from 'react';
import { Folder, FileText, Database, RefreshCw, Upload, Search, ArrowRight } from 'lucide-react';

const DataLakeExplorer = () => {
    const [projects, setProjects] = useState([]);
    const [currentProject, setCurrentProject] = useState(null);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [discovery, setDiscovery] = useState([]);

    // Mock API calls - replace with real fetch to /api/v1/lakehouse/
    const fetchProjects = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/lakehouse/projects');
            const data = await res.json();
            setProjects(data);
        } catch (e) {
            console.error(e);
            // Mock Fallback
            setProjects(['marketing_campaign_2024', 'customer_churn_v1']);
        } finally {
            setLoading(false);
        }
    };

    const fetchFiles = async (projectId) => {
        setLoading(true);
        setCurrentProject(projectId);
        try {
            const res = await fetch(`/api/v1/lakehouse/projects/${projectId}/files`);
            const data = await res.json();
            setFiles(data);

            // Trigger Discovery
            const discRes = await fetch(`/api/v1/lakehouse/projects/${projectId}/discover`);
            const discData = await discRes.json();
            setDiscovery(discData);

        } catch (e) {
            console.error(e);
            // Mock Fallback
            setFiles([
                { name: 'campaign_data.csv', size: 10240, last_modified: '2024-03-20', type: 'file' },
                { name: 'user_logs.json', size: 40500, last_modified: '2024-03-21', type: 'file' }
            ]);
            setDiscovery([
                { type: 'suggestion', description: "Found CSV 'campaign_data.csv'. Normalize dates?", action: 'normalize_csv' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    return (
        <div className="flex h-full w-full bg-[#131314] text-[#E3E3E3]">
            {/* Sidebar: Projects */}
            <div className="w-64 border-r border-[#444746]/50 p-4 bg-[#1E1F20]/50">
                <h3 className="text-sm font-semibold text-[#C4C7C5] mb-4 uppercase tracking-wider">Projects</h3>
                <div className="space-y-2">
                    {projects.map(p => (
                        <button
                            key={p}
                            onClick={() => fetchFiles(p)}
                            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all ${currentProject === p ? 'bg-[#A8C7FA]/20 text-[#A8C7FA]' : 'hover:bg-[#333537]'}`}
                        >
                            <Folder size={18} />
                            <span className="truncate text-sm">{p}</span>
                        </button>
                    ))}
                </div>
                <button className="mt-4 w-full p-2 border border-[#444746] rounded-xl text-xs hover:bg-[#333537] flex items-center justify-center gap-2">
                    <RefreshCw size={14} /> Refresh Projects
                </button>
            </div>

            {/* Main Content: Files & Discovery */}
            <div className="flex-1 p-8 overflow-y-auto">
                {!currentProject ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#444746]">
                        <Database size={64} className="mb-4 opacity-50" />
                        <p>Select a project to inspect the Lakehouse</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Header */}
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold">{currentProject}</h1>
                                <p className="text-sm text-[#C4C7C5]">S3 Bucket: sentry-lakehouse/{currentProject}</p>
                            </div>
                            <button className="bg-[#A8C7FA] text-[#131314] px-4 py-2 rounded-xl font-medium flex items-center gap-2 hover:bg-[#A8C7FA]/90">
                                <Upload size={18} /> Upload Data
                            </button>
                        </div>

                        {/* Discovery Actions */}
                        {discovery.length > 0 && (
                            <div className="bg-[#A8C7FA]/10 border border-[#A8C7FA]/30 p-4 rounded-xl">
                                <h4 className="flex items-center gap-2 text-[#A8C7FA] font-medium mb-3">
                                    <Search size={18} /> Automated Discovery
                                </h4>
                                <div className="space-y-2">
                                    {discovery.map((d, i) => (
                                        <div key={i} className="flex items-center justify-between bg-[#131314] p-3 rounded-lg border border-[#A8C7FA]/20">
                                            <span className="text-sm">{d.description}</span>
                                            <button className="text-xs bg-[#A8C7FA]/20 hover:bg-[#A8C7FA]/40 text-[#A8C7FA] px-3 py-1.5 rounded-full flex items-center gap-1">
                                                Run Action <ArrowRight size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* File List */}
                        <div className="space-y-2">
                            <h3 className="section-title text-lg font-medium">Files</h3>
                            {files.length === 0 ? (
                                <p className="text-sm text-[#444746]">No files found.</p>
                            ) : (
                                files.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-[#1E1F20] rounded-xl border border-[#444746]/30 hover:border-[#444746] transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-[#333537] rounded-lg">
                                                <FileText className="text-[#A8C7FA]" size={20} />
                                            </div>
                                            <div>
                                                <div className="font-medium">{f.name}</div>
                                                <div className="text-xs text-[#C4C7C5]">{f.size} bytes • {f.last_modified}</div>
                                            </div>
                                        </div>
                                        <button className="text-xs text-[#C4C7C5] hover:text-white border border-[#444746] px-3 py-1 rounded-lg">
                                            Preview
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataLakeExplorer;
