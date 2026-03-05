import React from 'react';
import { Database } from 'lucide-react';
import './Connectors.css';

const ConnectorDetail = ({ connector, onDelete }) => {
    if (!connector) return null;

    return (
        <div className="connector-detail-view">
            {/* Redundant back button removed - handled by GlobalNav header */}
            <div className="detail-header">
                <div className="detail-brand-icon" style={{ background: connector.color }}>
                    <Database size={24} color="#FFF" />
                </div>
                <div className="detail-title">
                    <h2>{connector.name}</h2>
                    <p>Active Connection since Feb 2026</p>
                </div>
            </div>

            <div className="detail-grid">
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Connection Status</span>
                    <div className="status-flex">
                        <div className={`status-dot ${connector.status}`}></div>
                        <span className="detail-stat-value" style={{ textTransform: 'capitalize' }}>{connector.status}</span>
                    </div>
                </div>
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Data Consumed</span>
                    <span className="detail-stat-value">{connector.volume}</span>
                </div>
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Last Synchronization</span>
                    <span className="detail-stat-value">2 minutes ago</span>
                </div>
            </div>

            <div className="detail-actions">
                <button className="btn-secondary">Re-authenticate Integration</button>
                <button className="btn-danger" onClick={() => onDelete(connector.id)}>Delete Integration</button>
            </div>
        </div>
    );
};

export default ConnectorDetail;
