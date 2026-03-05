import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, BrainCircuit, BarChart2, Plus, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import GlobalNav from './GlobalNav';
import RecommendationsMenu from './RecommendationsMenu';
import './FloatingNav.css';

const Layout = observer(() => {
    const navigate = useNavigate();
    const location = useLocation();
    const { dockStore } = useStore();
    const [isHubOpen, setIsHubOpen] = useState(false);
    const [hubSection, setHubSection] = useState('nav');

    // Determine if we are inside a project (Workspace)
    const isProjectView = location.pathname.startsWith('/project/');
    const projectId = isProjectView ? location.pathname.split('/')[2] : null;

    // Check query params to establish active tab context
    const queryParams = new URLSearchParams(location.search);
    const specificTab = queryParams.get('tab');

    // Engineering is the default when opening a project, Insights is the charts
    const isEngineering = isProjectView && (!specificTab || specificTab === 'engineering');
    const isInsights = isProjectView && specificTab === 'insights';

    const handleTopRightClick = () => {
        if (isProjectView) {
            navigate('/');
        } else {
            setHubSection('nav');
            setIsHubOpen(true);
        }
    };

    const handleDockIconClick = () => {
        if (isProjectView && projectId) {
            if (isEngineering) {
                navigate(`/project/${projectId}?tab=insights`);
            } else {
                navigate(`/project/${projectId}?tab=engineering`);
            }
        }
    };

    const openConnectors = () => {
        setHubSection('connectors');
        setIsHubOpen(true);
    };

    const toggleRecommendations = () => {
        dockStore.toggleRecommendations();
    };

    return (
        <div className="layout-wrapper">
            {/* Top Right Action Button */}
            <div className="floating-top-right">
                <button
                    className={`nav-circle-btn ${isHubOpen && !isProjectView ? 'menu-active' : ''}`}
                    onClick={handleTopRightClick}
                    aria-label={isProjectView ? "Go Back" : "Open Hub"}
                >
                    <ChevronDown size={20} strokeWidth={2.5} className={isHubOpen && !isProjectView ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
                </button>
            </div>

            {/* Professional Global Hub */}
            <GlobalNav
                isOpen={isHubOpen}
                onClose={() => setIsHubOpen(false)}
                activeSection={hubSection}
            />

            {/* Recommendations Menu */}
            <RecommendationsMenu
                isOpen={dockStore.isRecommendationsOpen}
                onClose={() => dockStore.setRecommendationsOpen(false)}
            />

            {/* Dynamic Content Area */}
            <main className="layout-content">
                <Outlet />
            </main>

            {/* Bottom Dock */}
            <div className="floating-bottom-dock">
                <div className="dock-container">
                    {/* Recommendations Toggle - Only in Insights view */}
                    {isInsights && (
                        <button
                            className={`dock-recommend-btn ${dockStore.isRecommendationsOpen ? 'active' : ''}`}
                            onClick={toggleRecommendations}
                            aria-label="Toggle Recommendations"
                        >
                            <Sparkles size={18} />
                        </button>
                    )}

                    {/* Plus Button - Only in Intelligence/Engineering view */}
                    {isEngineering && (
                        <button className="dock-plus-btn" onClick={openConnectors} aria-label="Add Connector">
                            <Plus size={20} />
                        </button>
                    )}

                    <button className="dock-pill-btn" aria-label="AI Voice/Text Input">
                        <div className="pill-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </button>

                    <button className="dock-icon-btn" onClick={handleDockIconClick} aria-label="Toggle Context">
                        {isEngineering ? <BarChart2 size={20} /> : <BrainCircuit size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default Layout;
