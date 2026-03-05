import React, { useState } from 'react';
import { Database } from 'lucide-react';
import './ConnectorsHub.css';

const ConnectorsHub = () => {
    const [connectors, setConnectors] = useState([
        {
            id: 1,
            name: 'Google Ads',
            status: 'connected',
            volume: '1.2 GB/mo',
            color: '#4285F4'
        },
        {
            id: 2,
            name: 'Meta Pixel',
            status: 'active',
            volume: '450 MB/mo',
            color: '#1877F2'
        },
        {
            id: 3,
            name: 'Shopify Store',
            status: 'connected',
            volume: '3.4 GB/mo',
            color: '#96bf48'
        },
        {
            id: 4,
            name: 'TikTok Ads',
            status: 'error',
            volume: '0 B',
            color: '#ff0050'
        }
    ]);

    return (
        <div className="connectors-hub-container">
            <table className="hub-minimal-table">
                <tbody>
                    {connectors.map(conn => (
                        <tr key={conn.id}>
                            <td className="brand-col">
                                <div className="brand-item">
                                    <div className="brand-icon-box" style={{ background: conn.color }}>
                                        <Database size={14} color="#FFF" />
                                    </div>
                                    <span className="brand-name">{conn.name}</span>
                                </div>
                            </td>
                            <td className="status-col">
                                <div className="status-item">
                                    <div className={`status-dot ${conn.status}`}></div>
                                    <span className={`status-text ${conn.status}`}>{conn.status}</span>
                                </div>
                            </td>
                            <td className="volume-col">
                                <span className="volume-text">{conn.volume}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ConnectorsHub;
