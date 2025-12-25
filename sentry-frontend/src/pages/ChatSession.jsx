import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, Box, Mic, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import MarketingWorkspace from '../components/visuals/MarketingWorkspace';
import LLMTrainingWorkspace from '../components/visuals/LLMTrainingWorkspace';
import ImageClassificationWorkspace from '../components/visuals/ImageClassificationWorkspace';
import { AgentService } from '../api/agent';
import DevTools from '../components/dev/DevTools';

const ChatSession = () => {
    const [messages, setMessages] = useState([
        { id: 1, role: 'assistant', content: 'Hello! I am your Sentry Data Agent. I can help you with Marketing Prediction, LLM Training, or Image Classification. What would you like to do?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [workspaceData, setWorkspaceData] = useState(null); // Data from Agent
    const [activeWorkspace, setActiveWorkspace] = useState(null); // 'marketing_engineering', 'llm_setup', etc.
    const messagesEndRef = useRef(null);

    // Initial session ID
    const sessionId = useRef(`sess_${Math.random().toString(36).substr(2, 9)}`);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Unified Agent Interaction
    const interactWithAgent = async (userInput, action = null, payload = {}) => {
        setLoading(true);
        if (userInput) {
            setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: userInput }]);
        }

        // MOCK INTERCEPTION FOR DEMO
        if (action === 'next_step') {
            setTimeout(() => {
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "Great choices! I've trained a model based on your selection. Here are the results." }]);
                setActiveWorkspace('marketing_results');
                // Mock Results Data
                setWorkspaceData({
                    metrics: { precision: 0.87, recall: 0.92, roi: '3.5' },
                    features: [
                        { name: 'User Age', val: 0.85 },
                        { name: 'Last Purchase', val: 0.65 },
                        { name: 'Email Open Rate', val: 0.45 },
                        { name: 'Churn Prob.', val: 0.95 }
                    ]
                });
                setLoading(false);
            }, 1000);
            return;
        }

        try {
            const data = await AgentService.interact(
                sessionId.current,
                userInput,
                action,
                payload
            );

            // update conversation
            if (data.message) {
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: data.message }]);
            }

            // update workspace
            if (data.current_workspace !== 'none') {
                setActiveWorkspace(data.current_workspace);
                setWorkspaceData(data.workspace_data);
            }

        } catch (error) {
            console.error("Agent Error:", error);
            // Fallback for demo if agent is offline but we want to show UI
            if (action === 'train_model' || action === 'next_step') {
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "Demo Mode: Processed selection." }]);
                setActiveWorkspace('marketing_results');
                setWorkspaceData({
                    metrics: { precision: 0.87, recall: 0.92, roi: '3.5' },
                    features: [
                        { name: 'User Age', val: 0.85 },
                        { name: 'Last Purchase', val: 0.65 },
                        { name: 'Email Open Rate', val: 0.45 }
                    ]
                });
            } else {
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "Error connecting to Agent server. (Demo Mode available for main flows)" }]);
            }
        } finally {
            if (action !== 'next_step') setLoading(false); // handled inside timeout for mock
        }
    };

    const handleSend = () => {
        if (!input.trim()) return;
        interactWithAgent(input);
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Workspace Action Handlers (Passed down to components)
    const handleWorkspaceAction = (action, payload) => {
        interactWithAgent(null, action, payload);
    };

    return (
        <div className="flex h-full w-full pt-16 p-4 gap-4 bg-[#0B0D0E]">

            {/* Floating Chat Container (Left) */}
            <div className="w-[400px] flex flex-col h-full bg-[#1E1F20]/80 backdrop-blur-xl rounded-3xl border border-[#444746]/50 shadow-2xl overflow-hidden relative z-10 transition-all duration-300">

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-[#333537]">
                    {messages.map((msg) => (
                        <div key={msg.id} className={clsx("flex flex-col gap-1", msg.role === 'user' ? "items-end" : "items-start")}>
                            <div className={clsx(
                                "max-w-[85%] p-3 text-sm rounded-2xl",
                                msg.role === 'user'
                                    ? "text-white"
                                    : "text-[#E3E3E3]"
                            )}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-2 items-center text-[#A8C7FA] text-xs p-2">
                            <Sparkles size={14} className="animate-pulse" /> Agent thinking...
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[#1E1F20]/50 border-t border-[#444746]/30">
                    {/* Data Connect Action - Visual only */}
                    <div className="mb-2 flex justify-center">
                        <button className="text-[10px] flex items-center gap-1.5 text-[#A8C7FA] hover:text-white hover:underline transition-colors px-3 py-1 bg-[#A8C7FA]/10 rounded-full border border-[#A8C7FA]/20">
                            <Box size={12} />
                            Connect Data Lake
                        </button>
                    </div>

                    <div className="relative bg-[#131314] rounded-2xl p-2 border border-[#444746] flex flex-col focus-within:ring-1 focus-within:ring-[#A8C7FA] transition-all">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask agent..."
                            className="w-full bg-transparent border-none focus:ring-0 resize-none text-[#E3E3E3] placeholder-[#555] p-2 text-sm max-h-[100px] scrollbar-hide focus:outline-none"
                            rows={1}
                        />
                        <div className="flex justify-between items-center mt-1">
                            <button className="p-1.5 text-[#C4C7C5] hover:text-white rounded-full transition-colors">
                                <Mic size={16} />
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="p-1.5 bg-[#E3E3E3] text-[#131314] rounded-full hover:bg-white transition-colors disabled:opacity-50"
                            >
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Workspace (Right - Main Stage) */}
            <div className="flex-1 h-full bg-[#1E1F20] rounded-3xl border border-[#444746]/30 overflow-hidden relative flex flex-col shadow-2xl">
                {!activeWorkspace ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#444746] select-none bg-gradient-to-br from-[#1E1F20] to-[#131314]">
                        <div className="w-24 h-24 bg-[#1E1F20] rounded-3xl flex items-center justify-center mb-6 border border-[#333537] shadow-xl">
                            <Sparkles size={48} className="text-[#333537]" />
                        </div>
                        <h2 className="text-xl font-medium text-[#E3E3E3] mb-2">Workspace Ready</h2>
                        <p className="max-w-md text-center text-sm">
                            Agent is waiting for instructions.
                        </p>
                    </div>
                ) : (
                    <div className="h-full w-full animate-in fade-in zoom-in-95 duration-500">
                        {(activeWorkspace === 'marketing_engineering' || activeWorkspace === 'marketing_results') && (
                            <MarketingWorkspace
                                data={workspaceData}
                                viewState={activeWorkspace === 'marketing_results' ? 'results' : 'engineering'}
                                onAction={handleWorkspaceAction}
                            />
                        )}
                        {(activeWorkspace === 'llm_setup' || activeWorkspace === 'llm_training') && (
                            <LLMTrainingWorkspace
                                data={workspaceData}
                                viewState={activeWorkspace === 'llm_training' ? 'training' : 'setup'}
                                onAction={handleWorkspaceAction}
                            />
                        )}
                        {(activeWorkspace === 'image_review' || activeWorkspace === 'image_processing') && (
                            <ImageClassificationWorkspace
                                data={workspaceData}
                                viewState={activeWorkspace === 'image_processing' ? 'processing' : 'review'}
                                onAction={handleWorkspaceAction}
                            />
                        )}
                    </div>
                )}
            </div>
            {/* Dev Tools Overlay */}
            <DevTools
                onSetWorkspace={setActiveWorkspace}
                onSetData={setWorkspaceData}
            />
        </div>
    );
};

export default ChatSession;
