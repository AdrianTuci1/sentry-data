import React from 'react';
import { Database } from 'lucide-react';
import './Connectors.css';

const ConnectorsList = ({ connectors, onSelectConnector }) => {
    return (
        <div className="connectors-list-view">
            <table className="hub-minimal-table">
                <tbody>
                    {connectors.map(conn => (
                        <tr key={conn.id} onClick={() => onSelectConnector(conn)}>
                            <td className="brand-cell">
                                <div className="brand-box">
                                    <div className="brand-icon" style={{ background: conn.color }}>
                                        <Database size={14} color="#FFF" />
                                    </div>
                                    <span className="brand-name">{conn.name}</span>
                                </div>
                            </td>
                            <td className="status-cell">
                                <div className="status-flex">
                                    <div className={`status-dot ${conn.status}`}></div>
                                    <span className={`status-label`}>{conn.status}</span>
                                </div>
                            </td>
                            <td className="volume-cell">
                                <span className="volume-text">{conn.volume}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ConnectorsList;
