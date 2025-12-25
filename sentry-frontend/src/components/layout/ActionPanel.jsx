import React, { useState } from 'react';
import { X, Maximize2, Minimize2, Activity, Table, GitBranch } from 'lucide-react';
import { clsx } from 'clsx';
import { useWebSocket } from '../../contexts/WebSocketContext';

const ActionPanel = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('visualizer');
    const { readyState } = useWebSocket();
    const isConnected = readyState === WebSocket.OPEN;

    if (!isOpen) return null;

    return (
        <div className="w-[400px] border-l border-border bg-background h-full flex flex-col transition-all duration-300">

            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-primary" />
                    <span className="font-medium text-sm">Data Visualizer</span>
                </div>
                <div className="flex items-center gap-1">
                    <button className="p-1.5 hover:bg-surface rounded text-subtext transition-colors">
                        <Maximize2 size={16} />
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-surface rounded text-subtext transition-colors">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center p-2 gap-1 border-b border-border">
                <button
                    onClick={() => setActiveTab('visualizer')}
                    className={clsx(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                        activeTab === 'visualizer' ? "bg-surface text-text" : "text-subtext hover:text-text"
                    )}
                >
                    Visualizer
                </button>
                <button
                    onClick={() => setActiveTab('data')}
                    className={clsx(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                        activeTab === 'data' ? "bg-surface text-text" : "text-subtext hover:text-text"
                    )}
                >
                    Raw Data
                </button>
                <button
                    onClick={() => setActiveTab('lineage')}
                    className={clsx(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                        activeTab === 'lineage' ? "bg-surface text-text" : "text-subtext hover:text-text"
                    )}
                >
                    Lineage
                </button>
            </div>

            {/* Content Placeholder */}
            <div className="flex-1 overflow-y-auto p-4">

                {activeTab === 'visualizer' && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-surface rounded-xl p-4 border border-border/50 h-48 flex items-center justify-center relative overflow-hidden group">
                            {/* Fake Chart */}
                            <div className="absolute inset-0 flex items-end justify-between px-4 pb-4 opacity-50">
                                <div className="w-4 h-12 bg-blue-500 rounded-t"></div>
                                <div className="w-4 h-20 bg-blue-500 rounded-t"></div>
                                <div className="w-4 h-16 bg-blue-500 rounded-t"></div>
                                <div className="w-4 h-32 bg-purple-500 rounded-t"></div>
                                <div className="w-4 h-24 bg-blue-500 rounded-t"></div>
                                <div className="w-4 h-10 bg-blue-500 rounded-t"></div>
                            </div>
                            <span className="z-10 text-subtext text-xs relative bg-background/80 px-2 py-1 rounded">Feature Distribution Placeholder</span>
                        </div>

                        <div className="bg-surface rounded-xl p-4 border border-border/50 h-48 flex items-center justify-center">
                            <span className="text-subtext text-xs">Correlation Matrix Placeholder</span>
                        </div>
                    </div>
                )}

                {/* ... other tab placeholders ... */}
                {activeTab === 'data' && (
                    <div className="text-sm text-subtext font-mono">
                        Scan a dataset to view rows...
                    </div>
                )}

            </div>

            {/* Footer Status */}
            <div className="p-2 border-t border-border text-[10px] text-subtext flex justify-between">
                <span>Connected to Lakehouse</span>
                <span className="flex items-center gap-1">
                    <span className={clsx("w-1.5 h-1.5 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")}></span>
                    {isConnected ? "Ready" : "Disconnected"}
                </span>
            </div>

        </div>
    );
};

export default ActionPanel;
