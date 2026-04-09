import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import ConnectorBrandMark from './ConnectorBrandMark';
import './Connectors.css';

const formatValue = (value, fallback = 'n/a') => value || fallback;

const ConnectorDetail = ({ connector, onDelete, onCheckUpdates }) => {
    if (!connector) {
        return null;
    }

    const source = connector.source || {};
    const metrics = source.observedMetrics || {};
    const dataCursor = source.dataCursor || {};
    const objectCount = metrics.objectCount ?? dataCursor.objectCount ?? 0;
    const latestModifiedAt = metrics.latestModifiedAt || dataCursor.latestModifiedAt;
    const storagePath = source.storageConfig?.prefix
        ? `${source.storageConfig.bucket}/${source.storageConfig.prefix}`
        : source.uri;

    return (
        <div className="connector-detail-view">
            <div className="detail-header">
                <ConnectorBrandMark
                    iconPath={connector.iconPath}
                    label={connector.name}
                    imageClassName="detail-brand-icon-image"
                    fallbackClassName="detail-brand-icon"
                    fallbackIconSize={24}
                />
                <div className="detail-title">
                    <h2>{connector.name}</h2>
                    <p>{connector.connectorProfile?.name ? `${connector.connectorProfile.name} · ` : ''}{storagePath}</p>
                </div>
            </div>

            <div className="detail-grid">
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Connection Status</span>
                    <div className="status-flex">
                        <div className={`status-dot ${connector.status}`}></div>
                        <span className="detail-stat-value status-capitalized">{connector.status}</span>
                    </div>
                </div>
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Data Footprint</span>
                    <span className="detail-stat-value">{connector.volume}</span>
                </div>
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Observed Objects</span>
                    <span className="detail-stat-value">{objectCount}</span>
                </div>
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Latest Source Change</span>
                    <span className="detail-stat-value detail-stat-value-small">{formatValue(latestModifiedAt, connector.lastSeen)}</span>
                </div>
            </div>

            <div className="detail-code-block">
                <span className="detail-code-label">Runtime URI</span>
                <code>{source.uri}</code>
            </div>

            <div className="detail-grid detail-grid-secondary">
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Connector Profile</span>
                    <span className="detail-stat-value detail-stat-value-small">{formatValue(connector.connectorProfile?.name, source.connectorId)}</span>
                </div>
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Source Type</span>
                    <span className="detail-stat-value detail-stat-value-small">{formatValue(source.type)}</span>
                </div>
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Discovery Prefix</span>
                    <span className="detail-stat-value detail-stat-value-small">{formatValue(metrics.sourcePrefix || source.storageConfig?.prefix)}</span>
                </div>
                <div className="detail-stat-card">
                    <span className="detail-stat-label">Last Observed</span>
                    <span className="detail-stat-value detail-stat-value-small">{formatValue(source.lastObservedAt, connector.lastSeen)}</span>
                </div>
            </div>

            <div className="detail-actions">
                <button className="btn-secondary" onClick={onCheckUpdates} type="button">
                    <RefreshCw size={15} />
                    <span>Check for new data</span>
                </button>
                <button className="btn-danger" onClick={() => onDelete(connector.id)} type="button">
                    <Trash2 size={15} />
                    <span>Delete connection</span>
                </button>
            </div>
        </div>
    );
};

export default ConnectorDetail;
