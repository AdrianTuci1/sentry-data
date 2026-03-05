import React from 'react';
import { Database } from 'lucide-react';
import './Connectors.css';

const AddConnector = ({ onAdd }) => {
    const platforms = [
        { name: 'Google Ads', color: '#4285F4', type: 'API', description: 'Search and Display Advertising' },
        { name: 'Meta Ads', color: '#1877F2', type: 'API', description: 'Facebook and Instagram' },
        { name: 'Shopify Store', color: '#96bf48', type: 'Webhook', description: 'Ecommerce Sales & Catalog' },
        { name: 'TikTok Ads', color: '#ff0050', type: 'API', description: 'Video Campaign Performance' },
        { name: 'LinkedIn Ads', color: '#0077b5', type: 'API', description: 'Professional B2B Network' },
        { name: 'GA4 Analytics', color: '#F9AB00', type: 'Analytics', description: 'Universal Event Tracking' },
    ];

    return (
        <div className="add-connector-view">
            <table className="hub-minimal-table">
                <tbody>
                    {platforms.map(p => (
                        <tr key={p.name} onClick={() => onAdd(p)}>
                            <td className="brand-cell">
                                <div className="brand-box">
                                    <div className="brand-icon" style={{ background: p.color }}>
                                        <Database size={14} color="#FFF" />
                                    </div>
                                    <div className="brand-text">
                                        <span className="brand-name">{p.name}</span>
                                        <span className="brand-description">{p.description}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="type-cell">
                                <span className="type-badge">{p.type}</span>
                            </td>
                            <td className="action-cell">
                                <span className="connect-link">Connect</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AddConnector;
