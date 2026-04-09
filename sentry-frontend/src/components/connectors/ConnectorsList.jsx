import React from 'react';
import { ExternalLink } from 'lucide-react';
import ConnectorBrandMark from './ConnectorBrandMark';
import './Connectors.css';

const ConnectorsList = ({ connectors, isLoading, projectId, onSelectConnector }) => {
    if (isLoading) {
        return (
            <div className="connectors-empty-state">
                <h3>Loading connectors</h3>
                <p>Pregatim starea reala a surselor conectate si catalogul de capabilitati.</p>
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="connectors-empty-state">
                <h3>No project selected</h3>
                <p>Conectorii devin configurabili dupa ce intri intr-un proiect activ.</p>
            </div>
        );
    }

    if (connectors.length === 0) {
        return (
            <div className="connectors-empty-state">
                <h3>No sources connected yet</h3>
                <p>Apasa `+` pentru a conecta un bucket S3/R2 compatibil sau pentru a vedea ce integrari managed putem opera astazi.</p>
            </div>
        );
    }

    return (
        <div className="connectors-list-view">
            <div className="connectors-section-header">
                <div>
                    <div className="connectors-section-eyebrow">Project Sources</div>
                    <h3>Connected datasets</h3>
                </div>
                <span className="connectors-count-pill">{connectors.length}</span>
            </div>
            <table className="hub-minimal-table">
                <tbody>
                    {connectors.map((connector) => (
                        <tr key={connector.id} onClick={() => onSelectConnector(connector)}>
                            <td className="brand-cell">
                                <div className="brand-box">
                                    <ConnectorBrandMark
                                        iconPath={connector.iconPath}
                                        label={connector.name}
                                        imageClassName="brand-icon-image"
                                        fallbackClassName="brand-icon"
                                        fallbackIconSize={14}
                                    />
                                    <div className="brand-text">
                                        <span className="brand-name">{connector.name}</span>
                                        <span className="brand-description">
                                            {connector.connectorProfile?.name ? `${connector.connectorProfile.name} · ` : ''}{connector.subtitle}
                                        </span>
                                    </div>
                                </div>
                            </td>
                            <td className="status-cell">
                                <div className="status-flex">
                                    <div className={`status-dot ${connector.status}`}></div>
                                    <span className="status-label">{connector.status}</span>
                                </div>
                            </td>
                            <td className="volume-cell">
                                <div className="connector-meta-column">
                                    <span className="volume-text">{connector.volume}</span>
                                    <span className="connector-last-seen">{connector.lastSeen}</span>
                                </div>
                            </td>
                            <td className="connector-arrow-cell">
                                <ExternalLink size={14} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ConnectorsList;
