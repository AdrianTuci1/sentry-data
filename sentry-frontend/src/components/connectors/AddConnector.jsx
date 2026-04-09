import React, { useState } from 'react';
import { Boxes } from 'lucide-react';
import { ProjectService } from '../../api/core';
import ConnectorBrandMark from './ConnectorBrandMark';
import './Connectors.css';

const initialFormState = {
    sourceName: '',
    endpoint: '',
    bucket: '',
    prefix: '',
    region: 'auto',
    fileFormat: 'parquet',
    provider: 'generic_s3',
    urlStyle: 'path',
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    connectorId: ''
};

const bytesLabel = (value) => {
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

    return `${size >= 100 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
};

const humanize = (value) => String(value || 'source')
    .split('/')
    .filter(Boolean)
    .at(-1)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildSourceName = (formState, fallbackLabel, selectedProfile) => {
    if (formState.sourceName.trim()) {
        return formState.sourceName.trim();
    }

    if (fallbackLabel) {
        const normalized = humanize(fallbackLabel);
        if (selectedProfile && !normalized.toLowerCase().includes(selectedProfile.name.toLowerCase())) {
            return `${selectedProfile.name} ${normalized}`.trim();
        }

        return normalized;
    }

    if (selectedProfile) {
        return selectedProfile.name;
    }

    return humanize(formState.prefix || formState.bucket);
};

const buildStorageConfig = (formState, prefixOverride) => {
    const credentials = formState.accessKeyId && formState.secretAccessKey
        ? {
            accessKeyId: formState.accessKeyId,
            secretAccessKey: formState.secretAccessKey,
            sessionToken: formState.sessionToken || undefined
        }
        : undefined;

    return {
        provider: formState.provider,
        endpoint: formState.endpoint || undefined,
        bucket: formState.bucket,
        prefix: (prefixOverride ?? formState.prefix) || undefined,
        region: formState.region || 'auto',
        urlStyle: formState.urlStyle,
        fileFormat: formState.fileFormat,
        credentials
    };
};

const ActionBadge = ({ supportLevel }) => (
    <span className={`catalog-support-badge catalog-support-${supportLevel}`}>
        {supportLevel === 'ready' ? 'Ready now' : supportLevel === 'assisted' ? 'Operator-assisted' : 'Planned'}
    </span>
);

const EmptyCatalogState = () => (
    <div className="connectors-empty-state">
        <h3>No connector catalog</h3>
        <p>Catalogul de capabilitati nu a fost incarcat inca.</p>
    </div>
);

const CatalogCard = ({ item, onSelect }) => (
    <button type="button" className="connector-catalog-card" onClick={() => onSelect(item)}>
        <div className="connector-catalog-card-top">
            <ConnectorBrandMark
                iconPath={item.iconPath}
                label={item.name}
                imageClassName="connector-catalog-icon-image"
                fallbackClassName="connector-catalog-icon"
                fallbackIconSize={16}
            />
            <ActionBadge supportLevel={item.supportLevel} />
        </div>
        <div className="connector-catalog-copy">
            <h4>{item.name}</h4>
            <p>{item.description}</p>
        </div>
        <div className="connector-catalog-meta">
            <span>{item.category.replace(/_/g, ' ')}</span>
            <span>{item.discoveryMode.replace(/_/g, ' ')}</span>
        </div>
    </button>
);

const ProfileCard = ({ profile, isSelected, onSelect }) => (
    <button
        type="button"
        className={`connector-profile-card ${isSelected ? 'connector-profile-card-active' : ''}`}
        onClick={() => onSelect(profile.id)}
    >
        <ConnectorBrandMark
            iconPath={profile.iconPath}
            label={profile.name}
            imageClassName="connector-profile-icon-image"
            fallbackClassName="connector-profile-icon"
            fallbackIconSize={18}
        />
        <div className="connector-profile-copy">
            <h4>{profile.name}</h4>
            <p>{profile.description}</p>
        </div>
    </button>
);

const AddConnector = ({ catalog, projectId, onConnected, onError }) => {
    const [selectedCatalog, setSelectedCatalog] = useState(null);
    const [formState, setFormState] = useState(initialFormState);
    const [discoveredSources, setDiscoveredSources] = useState([]);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [localMessage, setLocalMessage] = useState('');

    const readyCatalog = catalog.filter((item) => item.supportLevel === 'ready');
    const assistedCatalog = catalog.filter((item) => item.supportLevel === 'assisted');
    const plannedCatalog = catalog.filter((item) => item.supportLevel === 'planned');
    const selectedProfile = selectedCatalog?.supportedProfiles?.find((profile) => profile.id === formState.connectorId) || null;

    const resetForm = () => {
        setSelectedCatalog(null);
        setFormState(initialFormState);
        setDiscoveredSources([]);
        setLocalMessage('');
    };

    const handleFormChange = (field, value) => {
        setFormState((current) => ({
            ...current,
            [field]: value
        }));
    };

    const handleProfileSelect = (profileId) => {
        setFormState((current) => ({
            ...current,
            connectorId: current.connectorId === profileId ? '' : profileId
        }));
    };

    const previewStorage = async () => {
        if (!projectId) {
            onError('Trebuie sa intri intr-un proiect activ ca sa configurezi un conector.');
            return;
        }

        if (!formState.bucket.trim()) {
            onError('Bucket-ul este obligatoriu pentru preview.');
            return;
        }

        setIsPreviewing(true);
        setLocalMessage('');

        try {
            const storageConfig = buildStorageConfig(formState);
            const response = await ProjectService.discoverSources(projectId, storageConfig);
            const nextDiscoveredSources = response?.data || [];
            setDiscoveredSources(nextDiscoveredSources);
            setLocalMessage(
                nextDiscoveredSources.length > 0
                    ? `Am detectat ${nextDiscoveredSources.length} dataset${nextDiscoveredSources.length > 1 ? '-uri' : ''} sub prefixul selectat.`
                    : 'Nu am gasit dataset-uri la acest nivel. Poti conecta prefixul curent manual.'
            );
        } catch (previewError) {
            console.warn('[AddConnector] Failed to preview storage.', previewError);
            onError('Nu am putut face discovery pe bucket-ul selectat.');
        } finally {
            setIsPreviewing(false);
        }
    };

    const connectStorage = async (prefixOverride, sourceNameOverride) => {
        if (!projectId) {
            onError('Trebuie sa intri intr-un proiect activ ca sa configurezi un conector.');
            return;
        }

        if (!formState.bucket.trim()) {
            onError('Bucket-ul este obligatoriu pentru conectare.');
            return;
        }

        setIsConnecting(true);

        try {
            const storageConfig = buildStorageConfig(formState, prefixOverride);
            const sourceName = buildSourceName(formState, prefixOverride || sourceNameOverride, selectedProfile);
            const response = await ProjectService.addSource(projectId, {
                sourceName: sourceNameOverride ? buildSourceName({ ...formState, sourceName: '' }, sourceNameOverride, selectedProfile) : sourceName,
                type: formState.fileFormat,
                connectorId: formState.connectorId || undefined,
                storageConfig
            });
            const wasDeduplicated = Boolean(response?.data?.deduplicated);
            onConnected(
                wasDeduplicated
                    ? 'Sursa era deja conectata si a fost pastrata configuratia existenta.'
                    : `Sursa ${sourceNameOverride || sourceName} a fost conectata la proiect.`
            );
        } catch (connectError) {
            console.warn('[AddConnector] Failed to connect source.', connectError);
            onError('Nu am putut conecta sursa la proiect.');
        } finally {
            setIsConnecting(false);
        }
    };

    const connectAllDiscovered = async () => {
        if (discoveredSources.length === 0) {
            return;
        }

        setIsConnecting(true);

        try {
            for (const source of discoveredSources) {
                const storageConfig = buildStorageConfig(formState, source.prefix);
                await ProjectService.addSource(projectId, {
                    sourceName: buildSourceName({ ...formState, sourceName: '' }, source.sourceName, selectedProfile),
                    type: source.fileFormat,
                    connectorId: formState.connectorId || undefined,
                    storageConfig
                });
            }

            onConnected(`Am conectat ${discoveredSources.length} dataset${discoveredSources.length > 1 ? '-uri' : ''} descoperite in bucket.`);
        } catch (connectError) {
            console.warn('[AddConnector] Failed to connect discovered sources.', connectError);
            onError('Nu am putut conecta toate dataset-urile descoperite.');
        } finally {
            setIsConnecting(false);
        }
    };

    if (!selectedCatalog) {
        if (!catalog.length) {
            return <EmptyCatalogState />;
        }

        return (
            <div className="add-connector-view">
                <div className="connectors-section-header">
                    <div>
                        <div className="connectors-section-eyebrow">Connector Catalog</div>
                        <h3>What we can connect today</h3>
                    </div>
                </div>

                <div className="connector-catalog-grid">
                    {readyCatalog.map((item) => (
                        <CatalogCard key={item.id} item={item} onSelect={setSelectedCatalog} />
                    ))}
                </div>

                {assistedCatalog.length > 0 && (
                    <>
                        <div className="connectors-subsection-label">Operator-assisted</div>
                        <div className="connector-catalog-grid">
                            {assistedCatalog.map((item) => (
                                <CatalogCard key={item.id} item={item} onSelect={setSelectedCatalog} />
                            ))}
                        </div>
                    </>
                )}

                {plannedCatalog.length > 0 && (
                    <>
                        <div className="connectors-subsection-label">Planned next</div>
                        <div className="connector-catalog-grid">
                            {plannedCatalog.map((item) => (
                                <CatalogCard key={item.id} item={item} onSelect={setSelectedCatalog} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    const isObjectStorageFlow = selectedCatalog.frontendAction === 'configure_object_storage';
    const supportedProfiles = selectedCatalog.supportedProfiles || [];

    return (
        <div className="add-connector-view">
            <button type="button" className="catalog-inline-back" onClick={resetForm}>
                <Boxes size={14} />
                <span>Back to catalog</span>
            </button>

            <div className="connector-config-panel">
                <div className="connector-config-header">
                    <div>
                        <ActionBadge supportLevel={selectedCatalog.supportLevel} />
                        <h3>{selectedCatalog.name}</h3>
                        <p>{selectedCatalog.description}</p>
                    </div>
                </div>

                <div className="connector-notes-list">
                    {selectedCatalog.notes.map((note) => (
                        <div key={note} className="connector-note-chip">{note}</div>
                    ))}
                </div>

                {supportedProfiles.length > 0 && (
                    <div className="connector-guidance-card">
                        <h4>Supported source profiles</h4>
                        <p>Alege un profil cand stii sursa de origine. El ajuta discovery-ul sa recunoasca mai bine campurile si sa le mapeze in mindmap.</p>
                        <div className="connector-profile-grid">
                            {supportedProfiles.map((profile) => (
                                <ProfileCard
                                    key={profile.id}
                                    profile={profile}
                                    isSelected={formState.connectorId === profile.id}
                                    onSelect={handleProfileSelect}
                                />
                            ))}
                        </div>
                        {selectedProfile && (
                            <div className="connector-profile-fields">
                                <div className="connector-profile-fields-title">{selectedProfile.name} canonical fields</div>
                                <div className="connector-field-chip-grid">
                                    {selectedProfile.fields.map((field) => (
                                        <div key={field.canonicalName} className="connector-field-chip">
                                            <strong>{field.label}</strong>
                                            <span>{field.semanticType}</span>
                                            <small>{field.aliases.slice(0, 3).join(', ')}</small>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!isObjectStorageFlow && (
                    <div className="connector-guidance-card">
                        <h4>{selectedCatalog.frontendAction === 'ops_assisted' ? 'Current flow' : 'Current status'}</h4>
                        <p>
                            {selectedCatalog.frontendAction === 'ops_assisted'
                                ? 'Managed ingestion functioneaza astazi daca datele sunt aduse intr-un bucket sau prefix convenit si runtime-ul este declansat prin webhook sau polling. Profilul selectat ne ajuta sa mapam schema dupa landing.'
                                : 'Acest tip de conector nu este inca executabil direct in runtime-ul curent. Recomandarea pe termen scurt este landing in object storage si apoi discovery zero-ETL din fisiere.'}
                        </p>
                    </div>
                )}

                {isObjectStorageFlow && (
                    <>
                        <div className="connector-form-grid">
                            <label className="connector-form-field">
                                <span>Source name</span>
                                <input value={formState.sourceName} onChange={(event) => handleFormChange('sourceName', event.target.value)} placeholder={selectedProfile ? `${selectedProfile.name} export` : 'orders-lake'} />
                            </label>
                            <label className="connector-form-field">
                                <span>Bucket</span>
                                <input value={formState.bucket} onChange={(event) => handleFormChange('bucket', event.target.value)} placeholder="customer-warehouse" />
                            </label>
                            <label className="connector-form-field connector-form-field-wide">
                                <span>Prefix</span>
                                <input value={formState.prefix} onChange={(event) => handleFormChange('prefix', event.target.value)} placeholder="exports/orders" />
                            </label>
                            <label className="connector-form-field connector-form-field-wide">
                                <span>Endpoint</span>
                                <input value={formState.endpoint} onChange={(event) => handleFormChange('endpoint', event.target.value)} placeholder="https://storage.example.com" />
                            </label>
                            <label className="connector-form-field">
                                <span>Region</span>
                                <input value={formState.region} onChange={(event) => handleFormChange('region', event.target.value)} placeholder="auto" />
                            </label>
                            <label className="connector-form-field">
                                <span>File format</span>
                                <select value={formState.fileFormat} onChange={(event) => handleFormChange('fileFormat', event.target.value)}>
                                    <option value="parquet">parquet</option>
                                    <option value="csv">csv</option>
                                    <option value="json">json</option>
                                </select>
                            </label>
                            <label className="connector-form-field">
                                <span>Access key</span>
                                <input value={formState.accessKeyId} onChange={(event) => handleFormChange('accessKeyId', event.target.value)} placeholder="AKIA..." />
                            </label>
                            <label className="connector-form-field">
                                <span>Secret key</span>
                                <input type="password" value={formState.secretAccessKey} onChange={(event) => handleFormChange('secretAccessKey', event.target.value)} placeholder="••••••••" />
                            </label>
                        </div>

                        <div className="connector-form-actions">
                            <button className="btn-secondary" type="button" onClick={previewStorage} disabled={isPreviewing || isConnecting}>
                                {isPreviewing ? 'Discovering...' : 'Preview datasets'}
                            </button>
                            <button className="btn-primary" type="button" onClick={() => connectStorage()} disabled={isConnecting}>
                                {isConnecting ? 'Connecting...' : 'Connect current prefix'}
                            </button>
                        </div>

                        {(localMessage || discoveredSources.length > 0) && (
                            <div className="connector-guidance-card">
                                <h4>Discovery preview</h4>
                                {localMessage && <p>{localMessage}</p>}

                                {discoveredSources.length > 0 && (
                                    <>
                                        <div className="discovered-sources-list">
                                            {discoveredSources.map((source) => (
                                                <div key={source.id} className="discovered-source-card">
                                                    <div>
                                                        <div className="discovered-source-title">{buildSourceName({ ...formState, sourceName: '' }, source.sourceName, selectedProfile)}</div>
                                                        <div className="discovered-source-meta">
                                                            <span>{source.prefix || '/'}</span>
                                                            <span>{source.objectCount} objects</span>
                                                            <span>{bytesLabel(source.totalBytes)}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="connect-link-button"
                                                        onClick={() => connectStorage(source.prefix, source.sourceName)}
                                                        disabled={isConnecting}
                                                    >
                                                        Connect
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button className="btn-secondary" type="button" onClick={connectAllDiscovered} disabled={isConnecting}>
                                            Connect all discovered datasets
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AddConnector;
