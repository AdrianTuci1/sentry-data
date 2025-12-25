import React from 'react';
import { Home, Box } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate, useLocation } from 'react-router-dom';

const TopDock = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isHome = location.pathname === '/' || location.pathname.startsWith('/chat');
    const isModels = location.pathname.startsWith('/models');

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1E1F20]/80 backdrop-blur-md border border-[#444746] rounded-full p-1.5 flex items-center gap-1 shadow-lg animate-fade-in-down">
            <button
                onClick={() => navigate('/')}
                className={clsx(
                    "p-2.5 rounded-full transition-all duration-300",
                    isHome ? "bg-[#333537] text-white shadow-sm" : "text-[#C4C7C5] hover:bg-[#333537]/50 hover:text-white"
                )}
            >
                <Home size={20} />
            </button>
            <div className="w-[1px] h-4 bg-[#444746] mx-1"></div>
            <button
                onClick={() => navigate('/models')}
                className={clsx(
                    "p-2.5 rounded-full transition-all duration-300",
                    isModels ? "bg-[#333537] text-white shadow-sm" : "text-[#C4C7C5] hover:bg-[#333537]/50 hover:text-white"
                )}
            >
                <Box size={20} />
            </button>
        </div>
    );
};

export default TopDock;
