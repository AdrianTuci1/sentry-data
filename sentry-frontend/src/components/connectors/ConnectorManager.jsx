import React, { useState, useEffect } from 'react';
import ConnectorsList from './ConnectorsList';
import ConnectorDetail from './ConnectorDetail';
import AddConnector from './AddConnector';
import './Connectors.css';

const ConnectorManager = ({ viewMode = 'list', onViewChange }) => {
    const [view, setView] = useState(viewMode);
    const [selectedConnector, setSelectedConnector] = useState(null);
    const [connectors, setConnectors] = useState([
        { id: 1, name: 'Google Ads', status: 'connected', volume: '1.2 GB/mo', color: '#4285F4' },
        { id: 2, name: 'Meta Pixel', status: 'active', volume: '450 MB/mo', color: '#1877F2' },
        { id: 3, name: 'Shopify Store', status: 'connected', volume: '3.4 GB/mo', color: '#96bf48' },
        { id: 4, name: 'TikTok Ads', status: 'error', volume: '0 B', color: '#ff0050' }
    ]);

    // Externally forced view changes (e.g. from GlobalNav Plus icon)
    useEffect(() => {
        setView(viewMode);
    }, [viewMode]);

    // Inform parent of internal state changes
    const changeView = (newView) => {
        setView(newView);
        if (onViewChange) onViewChange(newView);
    };

    const handleSelectConnector = (conn) => {
        setSelectedConnector(conn);
        changeView('detail');
    };

    const handleAddPlatform = (platform) => {
        const newConn = {
            id: Date.now(),
            name: platform.name,
            status: 'connected',
            volume: '0 B',
            color: platform.color
        };
        setConnectors([...connectors, newConn]);
        changeView('list');
    };

    const handleDelete = (id) => {
        setConnectors(connectors.filter(c => c.id !== id));
        changeView('list');
    };

    return (
        <div className="connector-manager-view">
            {view === 'list' && (
                <ConnectorsList
                    connectors={connectors}
                    onSelectConnector={handleSelectConnector}
                />
            )}

            {view === 'detail' && (
                <ConnectorDetail
                    connector={selectedConnector}
                    onBack={() => changeView('list')}
                    onDelete={handleDelete}
                />
            )}

            {view === 'add' && (
                <AddConnector
                    onBack={() => changeView('list')}
                    onAdd={handleAddPlatform}
                />
            )}
        </div>
    );
};

export default ConnectorManager;
