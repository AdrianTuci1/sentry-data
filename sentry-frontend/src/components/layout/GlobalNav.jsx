import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, FolderDot, Settings, LifeBuoy, Plus, ChevronLeft, ExternalLink } from 'lucide-react';
import ConnectorManager from '../connectors/ConnectorManager';
import './GlobalNav.css';

const GlobalNav = ({ isOpen, onClose, activeSection = 'nav' }) => {
    const [section, setSection] = useState(activeSection);
    const [managerView, setManagerView] = useState('list');

    // Sync section and internal view when prop changes or opened
    useEffect(() => {
        setSection(activeSection);
        if (activeSection === 'connectors') {
            setManagerView('list');
        }
    }, [activeSection, isOpen]);

    if (!isOpen) return null;

    const handleOpenAddMode = () => {
        setSection('connectors');
        setManagerView('add');
    };

    const handleBackAction = () => {
        if (managerView !== 'list') {
            setManagerView('list');
        } else {
            // If in list mode, maybe go to nav section? 
            // Based on user request, the header button toggles between Plus and Back for internal manager views.
        }
    };

    return (
        <div className="global-nav-overlay" onClick={onClose}>
            <div className="global-nav-fullwidth-container" onClick={e => e.stopPropagation()}>
                <div className="global-nav-inner-content">

                    {/* Unified Top Bar with Contextual Back/Plus */}
                    <div className="global-nav-top-bar">
                        <div className="hub-header-left">
                            <span className="hub-title-label">
                                {section === 'nav' ? 'Navigation' : (managerView === 'add' ? 'Discovery' : (managerView === 'detail' ? 'Settings' : 'Connectors'))}
                            </span>

                            {section === 'connectors' && (
                                managerView === 'list' ? (
                                    <button className="hub-plus-action" onClick={handleOpenAddMode} title="Add Connector">
                                        <Plus size={22} />
                                    </button>
                                ) : (
                                    <button className="hub-plus-action hub-back-action" onClick={handleBackAction} title="Back to Hub">
                                        <ChevronLeft size={22} />
                                    </button>
                                )
                            )}
                        </div>
                        <button className="nav-close-btn" onClick={onClose}>
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content Section */}
                    <div className="global-nav-scroll-area">
                        {section === 'nav' ? (
                            <div className="nav-grid">
                                <Link to="/" onClick={onClose} className="nav-large-item">
                                    <div className="nav-icon-bg home">
                                        <FolderDot size={20} />
                                    </div>
                                    <div className="nav-info">
                                        <h3>Projects</h3>
                                        <p>Manage your campaign workspaces</p>
                                    </div>
                                    <ExternalLink size={14} className="item-arrow" />
                                </Link>
                                <Link to="/settings" onClick={onClose} className="nav-large-item">
                                    <div className="nav-icon-bg settings">
                                        <Settings size={20} />
                                    </div>
                                    <div className="nav-info">
                                        <h3>Settings</h3>
                                        <p>Configuration and preferences</p>
                                    </div>
                                    <ExternalLink size={14} className="item-arrow" />
                                </Link>
                                <Link to="/support" onClick={onClose} className="nav-large-item">
                                    <div className="nav-icon-bg support">
                                        <LifeBuoy size={20} />
                                    </div>
                                    <div className="nav-info">
                                        <h3>Support</h3>
                                        <p>Help center and documentation</p>
                                    </div>
                                    <ExternalLink size={14} className="item-arrow" />
                                </Link>
                            </div>
                        ) : (
                            <ConnectorManager
                                viewMode={managerView}
                                onViewChange={(v) => setManagerView(v)}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalNav;
