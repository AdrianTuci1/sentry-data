import React, { useState, useEffect } from 'react';
import ConnectorsList from './ConnectorsList';
import ConnectorDetail from './ConnectorDetail';
import AddConnector from './AddConnector';
import { useStore } from '../../store/StoreProvider';
import { ProjectService } from '../../api/core';
import './Connectors.css';

const COLOR_BY_SOURCE_TYPE = {
    parquet: '#5B8DEF',
    csv: '#F59E0B',
    json: '#14B8A6',
    ga4: '#F9AB00',
    facebook_ads: '#1877F2',
    shopify: '#95BF47',
    tiktok_ads: '#111111',
    stripe: '#635BFF',
    hubspot: '#FF7A59',
    postgres: '#6366F1',
    kafka: '#F97316',
    default: '#64748B'
};

const formatBytes = (value) => {
    if (!value) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    const rounded = size >= 100 || unitIndex === 0 ? Math.round(size) : size.toFixed(1);
    return `${rounded} ${units[unitIndex]}`;
};

const formatRelativeTime = (timestamp) => {
    if (!timestamp) {
        return 'Not observed yet';
    }

    const deltaMs = Date.now() - new Date(timestamp).getTime();
    const deltaMinutes = Math.max(Math.round(deltaMs / 60000), 0);

    if (deltaMinutes < 1) {
        return 'just now';
    }

    if (deltaMinutes < 60) {
        return `${deltaMinutes} min ago`;
    }

    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) {
        return `${deltaHours}h ago`;
    }

    const deltaDays = Math.round(deltaHours / 24);
    return `${deltaDays}d ago`;
};

const getSourceStatus = (source) => {
    if (source.lastObservedAt || source.dataCursor?.latestModifiedAt) {
        return 'active';
    }

    if (source.storageConfig || source.uri) {
        return 'connected';
    }

    return 'pending';
};

const flattenProfiles = (catalog) => (
    catalog.flatMap((entry) => entry.supportedProfiles || [])
);

const mapSourceToConnector = (source, catalog) => {
    const connectorProfile = flattenProfiles(catalog).find((profile) => profile.id === source.connectorId);

    return {
        id: source.sourceId,
        name: source.name,
        subtitle: source.storageConfig?.prefix || source.uri,
        status: getSourceStatus(source),
        volume: formatBytes(source.observedMetrics?.totalBytes || source.dataCursor?.totalBytes || 0),
        lastSeen: formatRelativeTime(source.lastObservedAt || source.dataCursor?.scannedAt || source.createdAt),
        color: COLOR_BY_SOURCE_TYPE[source.type] || COLOR_BY_SOURCE_TYPE[connectorProfile?.sourceType] || COLOR_BY_SOURCE_TYPE.default,
        iconPath: connectorProfile?.iconPath,
        connectorProfile,
        source
    };
};

const ConnectorManager = ({ viewMode = 'list', onViewChange }) => {
    const { projectStore } = useStore();
    const projectId = projectStore.currentProjectId;
    const [view, setView] = useState(viewMode);
    const [selectedConnector, setSelectedConnector] = useState(null);
    const [connectors, setConnectors] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        setView(viewMode);
    }, [viewMode]);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError('');

            try {
                const catalogPromise = ProjectService.getConnectorCatalog();
                const sourcesPromise = projectId ? ProjectService.getSources(projectId) : Promise.resolve({ data: [] });
                const [catalogResponse, sourcesResponse] = await Promise.all([catalogPromise, sourcesPromise]);
                const catalogData = catalogResponse?.data || [];

                setCatalog(catalogData);
                setConnectors((sourcesResponse?.data || []).map((source) => mapSourceToConnector(source, catalogData)));
            } catch (loadError) {
                console.warn('[ConnectorManager] Failed to load connector state.', loadError);
                setError('Nu am putut incarca catalogul de conectoare sau sursele proiectului.');
                setCatalog([]);
                setConnectors([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [projectId]);

    const changeView = (newView) => {
        setView(newView);
        if (onViewChange) {
            onViewChange(newView);
        }
    };

    const reloadSources = async (message) => {
        if (message) {
            setStatusMessage(message);
        }

        if (!projectId) {
            return;
        }

        try {
            const response = await ProjectService.getSources(projectId);
            const nextConnectors = (response?.data || []).map((source) => mapSourceToConnector(source, catalog));
            setConnectors(nextConnectors);

            if (selectedConnector) {
                const refreshedSelection = nextConnectors.find((connector) => connector.id === selectedConnector.id) || null;
                setSelectedConnector(refreshedSelection);
            }
        } catch (reloadError) {
            console.warn('[ConnectorManager] Failed to reload sources.', reloadError);
            setError('Nu am putut reincarca sursele proiectului.');
        }
    };

    const handleSelectConnector = (connector) => {
        setSelectedConnector(connector);
        changeView('detail');
    };

    const handleDelete = async (sourceId) => {
        if (!projectId) {
            return;
        }

        try {
            await ProjectService.deleteSource(projectId, sourceId);
            setSelectedConnector(null);
            changeView('list');
            await reloadSources('Conectorul a fost eliminat din proiect.');
        } catch (deleteError) {
            console.warn('[ConnectorManager] Failed to delete source.', deleteError);
            setError('Nu am putut sterge conectorul.');
        }
    };

    const handleCheckUpdates = async () => {
        if (!projectId || !selectedConnector) {
            return;
        }

        try {
            const response = await ProjectService.checkSourceUpdates(projectId);
            const result = response?.data || {};
            const changedSourceIds = result.changedSourceIds || [];
            const triggeredRuntime = Boolean(result.triggeredRuntime);

            if (changedSourceIds.includes(selectedConnector.id)) {
                setStatusMessage(triggeredRuntime
                    ? 'Au fost detectate date noi si runtime-ul a fost retrigger-uit.'
                    : 'Au fost detectate date noi pentru sursa selectata.');
            } else {
                setStatusMessage(triggeredRuntime
                    ? 'Au fost detectate actualizari pe alte surse din proiect.'
                    : 'Nu au fost detectate date noi pentru proiect.');
            }

            await reloadSources();
        } catch (checkError) {
            console.warn('[ConnectorManager] Failed to check source updates.', checkError);
            setError('Nu am putut verifica daca au intrat date noi.');
        }
    };

    return (
        <div className="connector-manager-view">
            {(statusMessage || error) && (
                <div className={`connectors-banner ${error ? 'connectors-banner-error' : ''}`}>
                    {error || statusMessage}
                </div>
            )}

            {view === 'list' && (
                <ConnectorsList
                    connectors={connectors}
                    isLoading={isLoading}
                    projectId={projectId}
                    onSelectConnector={handleSelectConnector}
                />
            )}

            {view === 'detail' && (
                <ConnectorDetail
                    connector={selectedConnector}
                    onDelete={handleDelete}
                    onCheckUpdates={handleCheckUpdates}
                />
            )}

            {view === 'add' && (
                <AddConnector
                    catalog={catalog}
                    projectId={projectId}
                    onConnected={(message) => {
                        setStatusMessage(message);
                        reloadSources();
                        changeView('list');
                    }}
                    onError={(message) => setError(message)}
                />
            )}
        </div>
    );
};

export default ConnectorManager;
