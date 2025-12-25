import React, { useState } from 'react';
import { Send, Mic, Image, Paperclip, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
    const [input, setInput] = useState('');
    const navigate = useNavigate();

    const handleStart = () => {
        if (input.trim()) {
            navigate('/chat');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full mx-auto px-4 pt-20">

            {/* Hero / Greeting */}
            <div className="flex flex-col items-center mb-12 text-center animate-fade-in">
                <div className="mb-6 relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-40"></div>
                    <div className="relative bg-[#1E1F20] p-4 rounded-full">
                        <Sparkles size={32} className="text-[#A8C7FA]" />
                    </div>
                </div>
                <h1 className="text-4xl md:text-5xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-purple-300 to-blue-300 mb-4">
                    How can I help you today?
                </h1>
                <p className="text-[#C4C7C5] text-lg">
                    I can help you discover data, train models, and deploy ML workflows.
                </p>
            </div>

            {/* Input Area */}
            <div className="w-full max-w-2xl relative group z-10 transition-all focus-within:scale-105">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <div className="relative bg-[#1E1F20] rounded-2xl p-2 shadow-2xl border border-[#444746]/50 flex flex-col">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleStart(); } }}
                        placeholder="Ask Sentry to analyze a dataset or train a model..."
                        className="w-full bg-transparent border-none focus:ring-0 resize-none text-[#E3E3E3] placeholder-[#C4C7C5] p-3 min-h-[60px] max-h-[200px]"
                        rows={1}
                    />

                    <div className="flex items-center justify-between px-2 pb-1">
                        <div className="flex items-center gap-2">
                            <button className="p-2 text-[#C4C7C5] hover:text-[#A8C7FA] hover:bg-[#131314] rounded-full transition-colors">
                                <Image size={20} />
                            </button>
                            <button className="p-2 text-[#C4C7C5] hover:text-[#A8C7FA] hover:bg-[#131314] rounded-full transition-colors">
                                <Paperclip size={20} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {input.length > 0 && (
                                <button onClick={handleStart} className="p-2 bg-[#E3E3E3] text-[#131314] rounded-full hover:bg-white transition-colors">
                                    <Send size={18} />
                                </button>
                            )}
                            {input.length === 0 && (
                                <button className="p-2 bg-[#333537] text-[#C4C7C5] rounded-full hover:bg-[#131314] transition-colors">
                                    <Mic size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Suggestion Chips */}
            <div className="flex flex-wrap gap-3 mt-8 justify-center opacity-80">
                {['Analyze S3 Bucket', 'Train Classifier', 'Deploy to Modal', 'Check Data Drift'].map((chip) => (
                    <button key={chip}
                        onClick={() => { setInput(chip); }}
                        className="px-4 py-2 bg-[#1E1F20] border border-[#444746] rounded-full text-sm text-[#C4C7C5] hover:bg-[#333537] hover:border-[#A8C7FA] transition-all cursor-pointer">
                        {chip}
                    </button>
                ))}
            </div>

        </div>
    );
};

export default Home;
