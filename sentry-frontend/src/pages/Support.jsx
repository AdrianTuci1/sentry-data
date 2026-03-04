import React, { useState } from 'react';
import { Search, MessageSquare, Plus, Inbox, ChevronDown, MoveVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Support.css';

const Support = () => {
    const navigate = useNavigate();
    const [activeFilter, setActiveFilter] = useState('Open');

    return (
        <div className="h-full w-full overflow-y-auto" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="support-container" style={{ padding: '2rem 1rem' }}>
                <header className="support-header">
                    <h1>Support Center</h1>
                    <button className="contact-support-btn">
                        <MessageSquare size={16} />
                        Contact Support
                    </button>
                </header>

                <div className="support-controls">
                    <div className="search-tickets">
                        <Search className="search-icon" size={16} />
                        <input type="text" placeholder="Search Tickets" />
                    </div>

                    <div className="support-filters-sort">
                        <div className="filters-group">
                            <button
                                className={`filter-btn ${activeFilter === 'All' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('All')}
                            >
                                All
                            </button>
                            <button
                                className={`filter-btn ${activeFilter === 'Open' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('Open')}
                            >
                                Open
                            </button>
                            <button
                                className={`filter-btn ${activeFilter === 'Closed' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('Closed')}
                            >
                                Closed
                            </button>
                        </div>

                        <button className="sort-dropdown">
                            <MoveVertical size={16} />
                            Last Updated
                            <ChevronDown size={14} />
                        </button>
                    </div>
                </div>

                <div className="empty-state">
                    <div className="empty-icon">
                        <Inbox size={48} strokeWidth={1.5} />
                    </div>
                    <h2>No tickets yet</h2>
                    <p>You haven't created any support tickets yet.</p>
                    <button className="create-ticket-btn" onClick={() => navigate('/support/new')}>
                        <Plus size={16} />
                        Create Ticket
                    </button>
                </div>

                <div className="chat-bubble-fixed">
                    <MessageSquare size={20} />
                </div>
            </div>
        </div>
    );
};

export default Support;
