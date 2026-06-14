import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Plus,
  Trash2,
  ArrowRightFromLine,
} from 'lucide-react';
import { IntegrationConnectionPage } from '@/components/shell/IntegrationConnectionPage';
import { ViewFrame } from '@/components/shell/ViewFrame';
import { useAppStore } from '@/stores/useAppStore';
import connectorsData from '@/data/connectors.json';
import '@/styles/integrations.css';

const EMPTY_CATALOG = {
  connectedDestinations: [],
  destinationCategories: [],
  featuredDestinations: [],
};

const authOptions = ['OAuth', 'API Key', 'Service Account', 'Webhook Token', 'Database Credentials'];

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function mapApiIntegrationToUI(apiItem) {
  return {
    id: apiItem.id || apiItem._id,
    name: apiItem.name || apiItem.connectorName || 'Unknown',
    type: apiItem.type || apiItem.categoryTitle || 'Destination',
    status: apiItem.status || 'connected',
    lastSync: apiItem.lastSync || apiItem.updatedAt || 'just now',
    note: apiItem.note || apiItem.description || '',
    authMethod: apiItem.authMethod || '',
    scope: apiItem.scope || '',
    connectorName: apiItem.connectorName || apiItem.name || '',
  };
}

function buildConnectorOptions(categories, flow) {
  return categories.flatMap((category) =>
    category.connectors.map((name) => ({
      id: `${flow}:${slugify(name)}`,
      flow,
      name,
      categoryId: category.id,
      categoryTitle: category.title,
      description: category.description,
      icon: category.icon,
    }))
  );
}

export function DestinationsView() {
  const {
    currentOrganization,
    currentWorkspace,
    integrationsData,
    fetchIntegrationCatalog,
    catalog,
    deployConnector,
    deleteConnector,
    isLoading,
    devMode,
    demoMode,
  } = useAppStore();

  const isMockMode = devMode || demoMode;

  const [connectedDestinations, setConnectedDestinations] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedConnectorId, setSelectedConnectorId] = useState('');
  const [formState, setFormState] = useState({
    displayName: '',
    scope: '',
    authMethod: authOptions[0],
    credentials: '',
    notes: '',
  });

  // Fetch catalog on mount
  useEffect(() => {
    if (!isMockMode && currentOrganization?.id && currentWorkspace?.id) {
      fetchIntegrationCatalog(currentOrganization.id, currentWorkspace.id);
    }
  }, [currentOrganization?.id, currentWorkspace?.id, isMockMode, fetchIntegrationCatalog]);

  // Sync local state from store
  useEffect(() => {
    if (isMockMode) return;
    if (integrationsData && integrationsData.length > 0) {
      const destinations = integrationsData
        .filter((i) => i.flow === 'destination')
        .map(mapApiIntegrationToUI);
      if (destinations.length > 0) setConnectedDestinations(destinations);
    }
  }, [integrationsData, isMockMode]);

  const effectiveCatalog = isMockMode ? connectorsData : catalog;
  const effectiveConnectedDestinations = isMockMode
    ? connectorsData.connectedDestinations || []
    : connectedDestinations;

  const destinationCategoriesData = effectiveCatalog?.destinationCategories || EMPTY_CATALOG.destinationCategories;
  const featuredDestinations = effectiveCatalog?.featuredDestinations || [];
  const hasFeaturedDestinations = featuredDestinations.length > 0;

  const destinationOptions = useMemo(
    () => buildConnectorOptions(destinationCategoriesData, 'destination'),
    [destinationCategoriesData]
  );

  const selectedConnector =
    destinationOptions.find((connector) => connector.id === selectedConnectorId) ??
    destinationOptions[0] ??
    null;

  const connectorSelectOptions = destinationOptions.map((connector) => ({
    value: connector.id,
    label: connector.name,
    hint: connector.categoryTitle,
  }));

  const authSelectOptions = authOptions.map((option) => ({
    value: option,
    label: option,
  }));

  const openDetail = (item) => {
    setDetailItem(item);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailItem(null);
  };

  const openModal = (connectorName = '') => {
    const matchedConnector =
      destinationOptions.find((item) => item.name === connectorName) ?? destinationOptions[0] ?? null;
    setSelectedConnectorId(matchedConnector?.id ?? '');
    setFormState({
      displayName: matchedConnector?.name ?? '',
      scope: '',
      authMethod: authOptions[0],
      credentials: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleDeploy = async () => {
    if (!selectedConnector || !currentOrganization || !currentWorkspace) return;
    try {
      await deployConnector(currentOrganization.id, currentWorkspace.id, {
        connectorName: selectedConnector.name,
        flow: 'destination',
        displayName: formState.displayName || selectedConnector.name,
        authMethod: formState.authMethod,
        credentials: formState.credentials,
        notes: formState.notes,
        scope: formState.scope,
      });
      closeModal();
    } catch (err) {
      alert('Failed to deploy destination: ' + err.message);
    }
  };

  const handleDelete = async (item) => {
    if (!currentOrganization || !currentWorkspace) return;
    if (confirm(`Are you sure you want to disconnect ${item.name}?`)) {
      try {
        await deleteConnector(currentOrganization.id, currentWorkspace.id, item.id);
        setConnectedDestinations((prev) => prev.filter((d) => d.id !== item.id));
      } catch (err) {
        alert('Failed to disconnect destination: ' + err.message);
      }
    }
  };

  if (detailOpen && detailItem) {
    return (
      <IntegrationConnectionPage
        connectorName={detailItem.connectorName || detailItem.name}
        flow="destination"
        onBack={closeDetail}
      />
    );
  }

  return (
    <ViewFrame
      title={detailOpen ? null : 'Destinations'}
      description="Manage data destinations — where your processed data is sent."
      maxWidthClassName="max-w-6xl"
    >
      <div className="integrations-wrapper">
        {/* Connected Destinations */}
        <div className="integrations-section-head">
          <h3 className="available-integrations-title">Connected Destinations</h3>
          <button className="integrations-add-btn" onClick={() => openModal()}>
            <Plus size={14} />
            Add Destination
          </button>
        </div>

        {effectiveConnectedDestinations.length === 0 ? (
          <div className="integrations-empty">
            <div className="integrations-empty-icon">
              <ArrowRightFromLine size={24} />
            </div>
            <p className="integrations-empty-title">No destinations connected</p>
            <p className="integrations-empty-desc">
              Destinations are where your processed data is sent. Add a destination to start exporting data.
            </p>
            <button className="integrations-add-btn" onClick={() => openModal()}>
              <Plus size={14} />
              Add Destination
            </button>
          </div>
        ) : (
          <div className="integrations-list">
            {effectiveConnectedDestinations.map((item) => (
              <div key={item.id} className="integration-card">
                <div className="integration-card-main">
                  <div className="integration-card-icon">
                    <ArrowRightFromLine size={18} />
                  </div>
                  <div className="integration-card-copy">
                    <span className="integration-card-name">{item.name}</span>
                    <span className="integration-card-type">{item.type}</span>
                  </div>
                </div>
                <div className="integration-card-meta">
                  <span className={`integration-card-status ${item.status}`}>
                    {item.status === 'connected' && <Check size={12} />}
                    {item.status}
                  </span>
                  <span className="integration-card-sync">{item.lastSync}</span>
                </div>
                <div className="integration-card-actions">
                  <button className="integration-card-action-btn" onClick={() => openDetail(item)}>
                    Configure
                  </button>
                  <button
                    className="integration-card-action-btn danger"
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Available Destinations */}
        <div className="integrations-section-head" style={{ marginTop: '32px' }}>
          <h3 className="available-integrations-title">Available Destinations</h3>
        </div>

        {destinationOptions.length === 0 ? (
          <div className="integrations-empty">
            <p className="integrations-empty-desc">No destination connectors available.</p>
          </div>
        ) : (
          <div className="integrations-grid">
            {destinationOptions.map((connector) => (
              <div key={connector.id} className="integration-tile" onClick={() => openModal(connector.name)}>
                <div className="integration-tile-header">
                  <span className="integration-tile-name">{connector.name}</span>
                  <span className="integration-tile-category">{connector.categoryTitle}</span>
                </div>
                <p className="integration-tile-desc">{connector.description}</p>
                <div className="integration-tile-footer">
                  <span className="integration-tile-flow">Destination</span>
                  <Plus size={14} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="integration-modal-overlay" onClick={closeModal}>
          <div className="integration-modal" onClick={(e) => e.stopPropagation()}>
            <div className="integration-modal-header">
              <h3 className="integration-modal-title">Add Destination</h3>
              <button className="integration-modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="integration-modal-body">
              <div className="integration-form-group">
                <label className="integration-form-label">Connector</label>
                <select
                  className="integration-form-select"
                  value={selectedConnectorId}
                  onChange={(e) => setSelectedConnectorId(e.target.value)}
                >
                  {connectorSelectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.hint}
                    </option>
                  ))}
                </select>
              </div>
              <div className="integration-form-group">
                <label className="integration-form-label">Display Name</label>
                <input
                  className="integration-form-input"
                  value={formState.displayName}
                  onChange={(e) => setFormState((s) => ({ ...s, displayName: e.target.value }))}
                  placeholder={selectedConnector?.name || 'Destination name'}
                />
              </div>
              <div className="integration-form-group">
                <label className="integration-form-label">Auth Method</label>
                <select
                  className="integration-form-select"
                  value={formState.authMethod}
                  onChange={(e) => setFormState((s) => ({ ...s, authMethod: e.target.value }))}
                >
                  {authSelectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="integration-form-group">
                <label className="integration-form-label">Credentials / Token</label>
                <textarea
                  className="integration-form-textarea"
                  value={formState.credentials}
                  onChange={(e) => setFormState((s) => ({ ...s, credentials: e.target.value }))}
                  placeholder="Paste API key, token, or connection string"
                  rows={3}
                />
              </div>
              <div className="integration-form-group">
                <label className="integration-form-label">Notes</label>
                <textarea
                  className="integration-form-textarea"
                  value={formState.notes}
                  onChange={(e) => setFormState((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Optional context"
                  rows={2}
                />
              </div>
            </div>
            <div className="integration-modal-footer">
              <button className="integration-modal-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="integration-modal-primary"
                onClick={handleDeploy}
                disabled={isLoading || !selectedConnector}
              >
                {isLoading ? 'Connecting...' : 'Connect Destination'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ViewFrame>
  );
}
