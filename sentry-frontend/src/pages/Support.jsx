import React, { useState } from 'react';
import { Search, MessageSquare, Plus, Inbox, ChevronDown, MoveVertical, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Support.css';

const SUPPORT_STATS = [
    { label: 'Open', value: '12' },
    { label: 'Waiting', value: '3' },
    { label: 'Resolved', value: '8' },
];

const SUPPORT_FILTERS = ['All', 'Open', 'Closed'];

const Support = () => {
    const navigate = useNavigate();
    const [activeFilter, setActiveFilter] = useState('Open');

    return (
        <div className="support-root">
            <div className="support-wrap">
                <div className="support-topbar">
                    <div className="support-heading">
                        <h1 className="support-heading-title">Support</h1>
                        <p className="support-heading-copy">
                            Search the queue, filter current requests, or open a new support ticket.
                        </p>
                    </div>

                    <div className="support-stats">
                        {SUPPORT_STATS.map((item) => (
                            <div key={item.label} className="support-stat">
                                <span className="support-stat-label">{item.label}</span>
                                <strong className="support-stat-value">{item.value}</strong>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="support-toolbar">
                    <div className="support-searchbox">
                        <Search size={16} className="support-searchbox-icon" />
                        <input
                            className="support-searchbox-input"
                            type="text"
                            placeholder="Search tickets, ids, or messages"
                        />
                    </div>

                    <div className="support-toolbar-actions">
                        <div className="support-filter-group">
                            {SUPPORT_FILTERS.map((filter) => (
                                <button
                                    key={filter}
                                    type="button"
                                    className={`support-filter-chip ${activeFilter === filter ? 'active' : ''}`}
                                    onClick={() => setActiveFilter(filter)}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>

                        <button type="button" className="support-secondary-action">
                            <MoveVertical size={16} />
                            Last updated
                            <ChevronDown size={14} />
                        </button>

                        <button type="button" className="support-primary-action">
                            <MessageSquare size={16} />
                            Contact support
                        </button>
                    </div>
                </div>

                <div className="support-panel">
                    <div className="support-empty">
                        <div className="support-empty-icon">
                            <Inbox size={42} strokeWidth={1.5} />
                        </div>

                        <h2 className="support-empty-title">No tickets yet</h2>
                        <p className="support-empty-copy">
                            The queue is empty right now. Start a new support thread when the team needs help.
                        </p>

                        <div className="support-empty-actions">
                            <button
                                type="button"
                                className="support-primary-action"
                                onClick={() => navigate('/support/new')}
                            >
                                <Plus size={16} />
                                Create ticket
                            </button>

                            <button type="button" className="support-secondary-action">
                                <ArrowUpRight size={16} />
                                View docs
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Support;
