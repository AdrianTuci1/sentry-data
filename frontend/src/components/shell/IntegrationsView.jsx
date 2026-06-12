import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  Database,
  Plus,
  Trash2,
} from 'lucide-react';
import { IntegrationConnectionModal } from '@/components/shell/IntegrationConnectionModal';
import { ViewFrame } from '@/components/shell/ViewFrame';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/useAppStore';
import { cn } from '@/lib/utils';
import connectorsData from '@/data/connectors.json';
import '@/styles/integrations.css';

const {
  connectedSources: defaultConnectedSources,
  connectedDestinations: defaultConnectedDestinations,
  sourceCategories,
  destinationCategories,
} = connectorsData;

const authOptions = ['OAuth', 'API Key', 'Service Account', 'Database Credentials', 'Webhook Token'];

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function mapApiIntegrationToUI(apiItem) {
  return {
    id: apiItem.id || apiItem._id,
    name: apiItem.name || apiItem.connectorName || 'Unknown',
    type: apiItem.type || apiItem.categoryTitle || 'Source',
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

function buildConnectionRecord(formState, selectedConnector) {
  const displayName = formState.displayName.trim() || selectedConnector.name;
  const scope = formState.scope.trim();
  const note = formState.notes.trim();

  return {
    id: `${selectedConnector.flow}-${slugify(displayName)}-${Date.now()}`,
    name: displayName,
    type: selectedConnector.categoryTitle,
    status: 'connected',
    lastSync: 'just now',
    note:
      note ||
      `${selectedConnector.name} connected via ${formState.authMethod}${scope ? ` for ${scope}` : ''}.`,
    authMethod: formState.authMethod,
    scope,
    connectorName: selectedConnector.name,
  };
}

const FEATURED_INTEGRATIONS = [
  {
    name: 'Stripe',
    connectorName: 'Stripe',
    description: 'Subscriptions, invoices, MRR, failed payments, and paid account states.',
    flow: 'source',
  },
  {
    name: 'PostHog',
    connectorName: 'PostHog',
    description: 'Events, active users, cohorts, and free-to-paid activation signals.',
    flow: 'source',
  },
  {
    name: 'Shopify',
    connectorName: 'Shopify',
    description: 'Orders, AOV, repeat purchase rate, refunds, and product-level revenue.',
    flow: 'source',
  },
  {
    name: 'Prometheus',
    connectorName: 'Prometheus',
    description: 'Low-latency service metrics used directly for operational dashboards.',
    flow: 'source',
  },
  {
    name: 'HubSpot',
    connectorName: 'HubSpot',
    description: 'Accounts, lifecycle stages, deal context, and customer enrichment.',
    flow: 'source',
  },
  {
    name: 'Google Ads',
    connectorName: 'Google Ads',
    description: 'Campaign spend, budget, and marketing performance.',
    flow: 'source',
  },
  {
    name: 'Slack',
    connectorName: 'Slack',
    description: 'Push insights, anomaly alerts, and scheduled summaries into team channels.',
    flow: 'destination',
  },
  {
    name: 'Salesforce',
    connectorName: 'Salesforce',
    description: 'Send segments, health signals, and revenue context back into customer systems.',
    flow: 'destination',
  },
  {
    name: 'Discord',
    connectorName: 'Discord',
    description: 'Push real-time alerts and channel updates.',
    flow: 'destination',
  },
  {
    name: 'PostgreSQL',
    connectorName: 'PostgreSQL',
    description: 'Relational database storage and query ingestion.',
    flow: 'source',
  },
  {
    name: 'Snowflake',
    connectorName: 'Snowflake',
    description: 'Cloud data warehousing for analytics and reporting.',
    flow: 'source',
  },
  {
    name: 'BigQuery',
    connectorName: 'BigQuery',
    description: 'Serverless, highly scalable cloud data warehouse.',
    flow: 'source',
  },
];

export function IntegrationsView() {
  const {
    currentOrganization,
    currentWorkspace,
    integrationsData,
    fetchIntegrations,
    createIntegration,
    deleteIntegration,
  } = useAppStore();

  const [connectedSources, setConnectedSources] = useState(defaultConnectedSources);
  const [connectedDestinations, setConnectedDestinations] = useState(defaultConnectedDestinations);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flowType, setFlowType] = useState('source');

  // Fetch integrations from API on mount, fall back to defaults
  useEffect(() => {
    if (currentOrganization?.id && currentWorkspace?.id) {
      fetchIntegrations(currentOrganization.id, currentWorkspace.id);
    }
  }, [currentOrganization?.id, currentWorkspace?.id]);

  // Sync local state from store
  useEffect(() => {
    if (integrationsData && integrationsData.length > 0) {
      const sources = integrationsData
        .filter((i) => i.flow === 'source' || !i.flow)
        .map(mapApiIntegrationToUI);
      const destinations = integrationsData
        .filter((i) => i.flow === 'destination')
        .map(mapApiIntegrationToUI);
      if (sources.length > 0) setConnectedSources(sources);
      if (destinations.length > 0) setConnectedDestinations(destinations);
    }
  }, [integrationsData]);

  const sourceOptions = useMemo(() => buildConnectorOptions(sourceCategories, 'source'), []);
  const destinationOptions = useMemo(
    () => buildConnectorOptions(destinationCategories, 'destination'),
    []
  );

  const [selectedConnectorId, setSelectedConnectorId] = useState(sourceOptions[0]?.id ?? '');
  const [formState, setFormState] = useState({
    displayName: '',
    scope: '',
    authMethod: authOptions[0],
    credentials: '',
    notes: '',
  });

  const connectorOptions = flowType === 'source' ? sourceOptions : destinationOptions;
  const selectedConnector =
    connectorOptions.find((connector) => connector.id === selectedConnectorId) ??
    connectorOptions[0] ??
    null;
  const connectorSelectOptions = connectorOptions.map((connector) => ({
    value: connector.id,
    label: connector.name,
    hint: connector.categoryTitle,
  }));
  const authSelectOptions = authOptions.map((option) => ({
    value: option,
    label: option,
  }));

  const setModalFlowType = (flow, connectorName = '') => {
    const options = flow === 'source' ? sourceOptions : destinationOptions;
    const matchedConnector =
      options.find((item) => item.name === connectorName) ?? options[0] ?? null;

    setFlowType(flow);
    setSelectedConnectorId(matchedConnector?.id ?? '');
    setFormState({
      displayName: matchedConnector?.name ?? '',
      scope: '',
      authMethod: authOptions[0],
      credentials: '',
      notes: '',
    });
  };

  const openSheet = (flow, connectorName = '') => {
    setModalFlowType(flow, connectorName);
    setSheetOpen(true);
  };

  const handleFormChange = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleConnectorChange = (value) => {
    const connector = connectorOptions.find((item) => item.id === value);
    setSelectedConnectorId(value);
    if (connector) {
      setFormState((current) => ({
        ...current,
        displayName: current.displayName === '' ? connector.name : current.displayName,
      }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedConnector) {
      return;
    }

    const record = buildConnectionRecord(formState, selectedConnector);

    // Add to local state immediately for responsive UI
    if (flowType === 'source') {
      setConnectedSources((current) => [record, ...current]);
    } else {
      setConnectedDestinations((current) => [record, ...current]);
    }

    // Persist to backend
    if (currentOrganization?.id && currentWorkspace?.id) {
      try {
        await createIntegration(currentOrganization.id, currentWorkspace.id, {
          name: record.name,
          flow: flowType,
          type: record.type,
          connectorName: record.connectorName,
          authMethod: record.authMethod,
          scope: record.scope,
          note: record.note,
        });
      } catch (err) {
        alert('Failed to save integration: ' + err.message);
      }
    }

    setSheetOpen(false);
  };

  const handleRemoveConnection = async (flow, id) => {
    if (flow === 'source') {
      setConnectedSources((current) => current.filter((item) => item.id !== id));
    } else {
      setConnectedDestinations((current) => current.filter((item) => item.id !== id));
    }

    if (currentOrganization?.id && currentWorkspace?.id) {
      try {
        await deleteIntegration(currentOrganization.id, currentWorkspace.id, id);
      } catch (err) {
        alert('Failed to remove integration: ' + err.message);
      }
    }
  };

  const getConnection = (connectorName) => {
    const source = connectedSources.find(
      (c) => c.connectorName?.toLowerCase() === connectorName.toLowerCase()
    );
    if (source) return { isConnected: true, flow: 'source', id: source.id };

    const dest = connectedDestinations.find(
      (c) => c.connectorName?.toLowerCase() === connectorName.toLowerCase()
    );
    if (dest) return { isConnected: true, flow: 'destination', id: dest.id };

    return { isConnected: false };
  };

  return (
    <>
      <ViewFrame
        title="Integrations"
        description="Connect business data sources, then route modeled insights into the destinations your teams already use."
        maxWidthClassName="max-w-3xl"
      >
        <div className="integrations-wrapper">
          <div className="integrations-section-head">
            <h3 className="available-integrations-title">Featured</h3>
          </div>

          <div className="integrations-grid">
            {FEATURED_INTEGRATIONS.map((integration) => {
              const { isConnected, flow, id } = getConnection(integration.connectorName);

              return (
                <div key={integration.name} className="integration-item">
                  <div className="integration-icon-container is-empty" />

                  <div className="integration-info">
                    <span className="integration-name">{integration.name}</span>
                    <span className="integration-description">{integration.description}</span>
                  </div>

                  <div className="integration-action-cell">
                    {isConnected ? (
                      <button
                        className="integration-connected-btn"
                        type="button"
                        onClick={() => handleRemoveConnection(flow, id)}
                        title="Disconnect"
                      >
                        <Check size={16} className="check-icon" />
                        <Trash2 size={14} className="trash-icon" />
                      </button>
                    ) : (
                      <button
                        className="integration-plus-btn"
                        type="button"
                        onClick={() => openSheet(integration.flow, integration.name)}
                        title="Connect"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ViewFrame>
      <IntegrationConnectionModal
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        flowType={flowType}
        onFlowTypeChange={setModalFlowType}
        connectorSelectOptions={connectorSelectOptions}
        selectedConnectorId={selectedConnectorId}
        onConnectorChange={handleConnectorChange}
        authSelectOptions={authSelectOptions}
        formState={formState}
        onFormChange={handleFormChange}
        onSubmit={handleSubmit}
        selectedConnector={selectedConnector}
      />
    </>
  );
}

