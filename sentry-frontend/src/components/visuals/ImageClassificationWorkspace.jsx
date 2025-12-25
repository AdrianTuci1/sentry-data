
import React from 'react';
import { Clock, Image as ImageIcon, Scan, CheckCircle2, AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { clsx } from 'clsx';

const ImageClassificationWorkspace = ({ data, viewState, onAction }) => {
    // Data Props
    const reviewQueue = data?.queue || [];
    const processState = data || {}; // for processing view

    const handleAction = (id, type) => {
        onAction('label', { image_id: id, label: type });
    };

    const startProcess = () => {
        onAction('start_process', {});
    };

    const formatTime = (seconds) => {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Review / Active Learning State
    if (viewState === 'review') {
        return (
            <div className="h-full w-full flex flex-col p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-semibold text-[#E3E3E3] mb-1">Active Learning Queue</h2>
                        <p className="text-[#C4C7C5] text-sm">Please review low-confidence predictions.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[#C4C7C5] bg-[#1E1F20] px-2 py-1 rounded">Queue: {reviewQueue.length}</span>
                        <button
                            onClick={startProcess}
                            className="bg-[#A8C7FA] text-[#0B1D3F] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#8AB4F8]"
                        >
                            Start Batch Process
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {reviewQueue.length === 0 ? (
                        <div className="text-center p-12 text-[#C4C7C5]">Queue empty. All items reviewed!</div>
                    ) : (
                        reviewQueue.map(item => (
                            <div key={item.id} className="bg-[#1E1F20] p-4 rounded-xl border border-[#444746]/50 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-[#131314] rounded-lg border border-[#444746] flex items-center justify-center">
                                        <ImageIcon size={24} className="text-[#444746]" />
                                    </div>
                                    <div>
                                        <div className="font-mono text-sm text-[#E3E3E3]">{item.src}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-[#C4C7C5]">Prediction:</span>
                                            <span className="text-sm font-medium text-[#A8C7FA]">{item.pred}</span>
                                            <span className="text-xs px-1.5 py-0.5 bg-yellow-400/10 text-yellow-400 rounded">{(item.conf * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleAction(item.id, 'approve')} className="p-2 hover:bg-green-500/20 text-green-400 rounded-lg hover:border-green-500/50 border border-transparent transition-all">
                                        <ThumbsUp size={18} />
                                    </button>
                                    <button onClick={() => handleAction(item.id, 'reject')} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg hover:border-red-500/50 border border-transparent transition-all">
                                        <ThumbsDown size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // Processing State
    const progress = (processState.processed / processState.total) * 100 || 0;

    return (
        <div className="h-full w-full flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-semibold text-[#E3E3E3] mb-1">Batch Processing</h2>
                    <p className="text-[#C4C7C5] text-sm">Processing batch 'Quality_Control_Day_2'</p>
                </div>
                <div className="flex items-center gap-3 bg-[#131314] px-4 py-2 rounded-xl border border-[#444746]">
                    <Clock size={18} className="text-[#A8C7FA]" />
                    <span className="text-[#E3E3E3] font-mono text-lg">{formatTime(processState.time_left)}</span>
                </div>
            </div>

            <div className="bg-[#1E1F20] rounded-2xl border border-[#444746]/50 shadow-lg mb-8 overflow-hidden">
                <div className="h-1 w-full bg-[#131314]">
                    <div className="h-full bg-[#A8C7FA] transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="p-6 flex flex-col items-center">
                    <div className="w-64 h-64 bg-[#131314] rounded-xl border border-[#444746] flex items-center justify-center relative mb-4">
                        <ImageIcon size={48} className="text-[#444746]" />
                        <div className="absolute inset-0 border-2 border-[#A8C7FA]/50 rounded-xl animate-pulse"></div>
                        <div className="absolute top-0 w-full h-1 bg-[#A8C7FA] shadow-[0_0_15px_#A8C7FA] animate-[scan_2s_ease-in-out_infinite]"></div>
                    </div>
                </div>

                <div className="bg-[#131314] p-3 flex justify-between text-xs text-[#C4C7C5] border-t border-[#444746]">
                    <span>Processed: {processState.processed} / {processState.total}</span>
                    <span>Remaining: {processState.total - processState.processed}</span>
                </div>
            </div>

            <div className="text-center">
                {processState.status === 'completed' && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-xl border border-green-500/20">
                        <CheckCircle2 size={16} /> Batch Completed Successfully
                    </div>
                )}
            </div>

            <style jsx>{`
@keyframes scan {
    0% { top: 0%; opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { top: 100%; opacity: 0; }
}
`}</style>
        </div>
    );
};

export default ImageClassificationWorkspace;
