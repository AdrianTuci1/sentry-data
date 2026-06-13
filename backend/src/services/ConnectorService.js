import { gcpService } from './GcpService.js';
import { config } from '../config/index.js';
import { CloudRunJobClient } from '@google-cloud/run';
import { CloudSchedulerClient } from '@google-cloud/scheduler';
import { PubSub } from '@google-cloud/pubsub';

/**
 * ConnectorService — manages data connectors using a SINGLE Cloud Run Job.
 *
 * Architecture:
 *   1 Cloud Run Job "sentry-sync-worker" (multi-tenant)
 *   1 Cloud Scheduler job triggers it every 5 minutes
 *   Job reads sync queue from Firestore and processes all pending syncs
 *
 * Cost: ~$30-60/month for 100 users with 7 sources each
 * vs $1,400+/month with individual Cloud Functions
 */

export class ConnectorService {
  constructor() {
    this.gcp = gcpService;
    this.runClient = new CloudRunJobClient();
    this.schedulerClient = new CloudSchedulerClient();
    this.pubsub = new PubSub({ projectId: config.gcpProjectId });
  }

  /**
   * Deploy a connector. Stores credentials and adds sync to queue.
   */
  async deployConnector(orgId, projectId, connectorName, credentials) {
    const authConfig = CONNECTOR_DEPLOY[connectorName];
    if (!authConfig) {
      throw new Error(`Unknown connector: ${connectorName}`);
    }

    // 1. Store credentials in Secret Manager
    const secretId = `connector-${orgId}-${projectId}-${connectorName.toLowerCase()}`;
    await this.storeCredentials(secretId, credentials);

    // 2. Route based on connector type
    if (authConfig.type === 'bigquery_transfer') {
      return this.setupBigQueryTransfer(orgId, projectId, connectorName, credentials);
    }

    if (authConfig.type === 'cloud_run_job') {
      return this.deployCloudRunJobConnector(orgId, projectId, connectorName, secretId, authConfig);
    }

    // Direct sources (Prometheus, BigQuery) — just store credentials
    return {
      status: 'connected',
      method: 'direct',
      message: `Connector ${connectorName} configured. Credentials stored.`,
    };
  }

  /**
   * Store credentials in GCP Secret Manager.
   */
  async storeCredentials(secretId, credentials) {
    const secretManager = this.gcp.secretManager;
    if (!secretManager) {
      console.warn('[ConnectorService] Secret Manager not available — credentials stored in Firestore only');
      return;
    }

    const parent = `projects/${config.gcpProjectId}`;

    try {
      await secretManager.createSecret({
        parent,
        secretId,
        secret: { replication: { automatic: {} } },
      });
    } catch (err) {
      if (!err.message?.includes('AlreadyExists')) throw err;
    }

    await secretManager.addSecretVersion({
      parent: `projects/${config.gcpProjectId}/secrets/${secretId}`,
      payload: { data: Buffer.from(JSON.stringify(credentials)).toString('base64') },
    });
  }

  /**
   * Read credentials from Secret Manager.
   */
  async getCredentials(secretId) {
    const secretManager = this.gcp.secretManager;
    if (!secretManager) return null;

    try {
      const [version] = await secretManager.accessSecretVersion({
        name: `projects/${config.gcpProjectId}/secrets/${secretId}/versions/latest`,
      });
      return JSON.parse(version.payload.data.toString());
    } catch {
      return null;
    }
  }

  /**
   * Google-native connectors (GA4, Ads, Search Console).
   * BigQuery Data Transfer — configured in GCP Console.
   */
  async setupBigQueryTransfer(orgId, projectId, connectorName, credentials) {
    const dataset = this.gcp.getDatasetName(orgId, projectId);

    return {
      status: 'pending_console',
      method: 'bigquery_transfer',
      message: `${connectorName} uses BigQuery Data Transfer. Configure in GCP Console.`,
      setupUrl: `https://console.cloud.google.com/bigquery/transfers?project=${config.gcpProjectId}`,
      dataset: `${dataset}_landing`,
      note: 'After configuring the transfer, data will appear in BigQuery within 24 hours.',
    };
  }

  /**
   * Deploy connector using SINGLE Cloud Run Job (multi-tenant).
   * Creates the job if it doesn't exist, adds connector to sync queue.
   */
  async deployCloudRunJobConnector(orgId, projectId, connectorName, secretId, authConfig) {
    const jobName = 'sentry-sync-worker';
    const location = config.gcpRegion || 'europe-west1';
    const parent = `projects/${config.gcpProjectId}/locations/${location}`;
    const jobPath = `${parent}/jobs/${jobName}`;

    // 1. Ensure Cloud Run Job exists (idempotent)
    await this.ensureCloudRunJob(jobName, parent, jobPath);

    // 2. Ensure Cloud Scheduler exists (idempotent)
    await this.ensureCloudScheduler(jobName, parent);

    // 3. Add connector to sync queue in Firestore
    await this.addToSyncQueue(orgId, projectId, connectorName, secretId, authConfig);

    // 4. Trigger immediate first sync
    await this.triggerImmediateSync(orgId, projectId, connectorName);

    return {
      status: 'deployed',
      method: 'cloud_run_job',
      jobName,
      message: `Connector ${connectorName} added to sync queue. First sync triggered. Data will appear in BigQuery within minutes.`,
    };
  }

  /**
   * Ensure the Cloud Run Job exists. Creates it if not.
   */
  async ensureCloudRunJob(jobName, parent, jobPath) {
    try {
      await this.runClient.getJob({ name: jobPath });
      return; // Job exists
    } catch (err) {
      if (err.code !== 5) throw err; // 5 = NOT_FOUND
    }

    // Build and upload source code
    const sourceCode = this.buildSyncWorkerSource();
    const sourceBucket = config.gcsBucketName || 'sentry-platform-data';
    const sourceObject = `cloud-run-jobs/${jobName}/source.zip`;
    await this.uploadSourceZip(sourceBucket, sourceObject, sourceCode);

    // Create Cloud Run Job
    const [operation] = await this.runClient.createJob({
      parent,
      jobId: jobName,
      job: {
        name: jobPath,
        description: 'Sentry Data Platform — multi-tenant sync worker',
        template: {
          template: {
            containers: [{
              image: 'gcr.io/cloud-builders/gcloud', // Placeholder, will be built from source
              resources: { limits: { cpu: '1', memory: '512Mi' } },
              env: [
                { name: 'GCP_PROJECT_ID', value: config.gcpProjectId },
                { name: 'BQ_LOCATION', value: config.bigQueryLocation || 'EU' },
                { name: 'DATASET_PREFIX', value: config.bigQueryDatasetPrefix || 'sentry_dataset' },
              ],
            }],
            maxRetries: 3,
            timeout: '300s',
            serviceAccount: `sentry-jobs@${config.gcpProjectId}.iam.gserviceaccount.com`,
          },
        },
      },
    });

    await operation.promise();
  }

  /**
   * Ensure Cloud Scheduler exists. Creates it if not.
   */
  async ensureCloudScheduler(jobName, parent) {
    const schedulerJobName = `${parent}/jobs/${jobName}-scheduler`;

    try {
      await this.schedulerClient.getJob({ name: schedulerJobName });
      return; // Exists
    } catch (err) {
      if (err.code !== 5) throw err;
    }

    await this.schedulerClient.createJob({
      parent,
      job: {
        name: schedulerJobName,
        description: 'Trigger sentry-sync-worker every 5 minutes',
        schedule: '*/5 * * * *', // Every 5 minutes
        timeZone: 'UTC',
        httpTarget: {
          uri: `https://${config.gcpRegion}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${config.gcpProjectId}/jobs/${jobName}:run`,
          httpMethod: 'POST',
          headers: { 'Authorization': `Bearer ${await this.getServiceAccountToken()}` },
        },
      },
    });
  }

  /**
   * Add connector to sync queue in Firestore.
   */
  async addToSyncQueue(orgId, projectId, connectorName, secretId, authConfig) {
    const db = this.gcp.firestore;
    if (!db) return;

    const queueRef = db.collection('sync_queue').doc(`${orgId}_${projectId}_${connectorName}`);
    await queueRef.set({
      orgId,
      projectId,
      connectorName,
      secretId,
      schedule: authConfig.schedule || 'every 1 hour',
      status: 'pending',
      lastSyncAt: null,
      nextSyncAt: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Trigger immediate sync by publishing to Pub/Sub.
   */
  async triggerImmediateSync(orgId, projectId, connectorName) {
    const topicName = 'sentry-sync-trigger';

    try {
      await this.pubsub.topic(topicName).publishMessage({
        data: Buffer.from(JSON.stringify({
          orgId,
          projectId,
          connectorName,
          immediate: true,
        })),
      });
    } catch (err) {
      if (err.code === 5) {
        await this.pubsub.createTopic(topicName);
        await this.pubsub.topic(topicName).publishMessage({
          data: Buffer.from(JSON.stringify({
            orgId,
            projectId,
            connectorName,
            immediate: true,
          })),
        });
      } else {
        throw err;
      }
    }
  }

  /**
   * Trigger manual sync for an existing connector.
   */
  async triggerManualSync(orgId, projectId, connectorName) {
    await this.triggerImmediateSync(orgId, projectId, connectorName);
    return {
      status: 'triggered',
      message: 'Sync job triggered. Check BigQuery in a few minutes.',
    };
  }

  /**
   * Build the Cloud Run Job source code.
   */
  buildSyncWorkerSource() {
    return `
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { BigQuery } = require('@google-cloud/bigquery');
const { Firestore } = require('@google-cloud/firestore');
const { PubSub } = require('@google-cloud/pubsub');

const secretClient = new SecretManagerServiceClient();
const bq = new BigQuery();
const db = new Firestore();
const pubsub = new PubSub();

async function processSyncQueue() {
  const queueRef = db.collection('sync_queue');
  const now = new Date().toISOString();
  
  // Get all pending syncs
  const snapshot = await queueRef
    .where('status', 'in', ['pending', 'failed'])
    .where('nextSyncAt', '<=', now)
    .limit(10)
    .get();

  if (snapshot.empty) {
    console.log('No pending syncs');
    return;
  }

  for (const doc of snapshot.docs) {
    const task = doc.data();
    try {
      await syncConnector(task);
      await doc.ref.update({
        status: 'completed',
        lastSyncAt: new Date().toISOString(),
        nextSyncAt: calculateNextSync(task.schedule),
        error: null,
      });
    } catch (err) {
      console.error('Sync failed:', err);
      await doc.ref.update({
        status: 'failed',
        error: err.message,
        retries: (task.retries || 0) + 1,
      });
    }
  }
}

async function syncConnector(task) {
  const { orgId, projectId, connectorName, secretId } = task;
  const datasetId = \`\${process.env.DATASET_PREFIX}_\${orgId}_\${projectId}\`;

  // 1. Get credentials
  const [version] = await secretClient.accessSecretVersion({
    name: \`projects/\${process.env.GCP_PROJECT_ID}/secrets/\${secretId}/versions/latest\`,
  });
  const credentials = JSON.parse(version.payload.data.toString());

  // 2. Ensure dataset exists
  const [datasets] = await bq.getDatasets();
  if (!datasets.find(d => d.id === datasetId)) {
    await bq.createDataset(datasetId, { location: process.env.BQ_LOCATION });
  }

  // 3. Sync based on connector type
  const results = await runConnectorSync(connectorName, credentials, datasetId);

  // 4. Publish completion event
  await pubsub.topic('connector-sync-complete').publishMessage({
    data: Buffer.from(JSON.stringify({
      orgId,
      projectId,
      connector: connectorName,
      dataset: datasetId,
      results,
      syncedAt: new Date().toISOString(),
    })),
  });

  return results;
}

async function runConnectorSync(connectorName, credentials, datasetId) {
  const handlers = {
    Stripe: syncStripe,
    Shopify: syncShopify,
    HubSpot: syncHubSpot,
    Sentry: syncSentry,
    Salesforce: syncSalesforce,
    PostHog: syncPostHog,
    Klaviyo: syncKlaviyo,
    WooCommerce: syncWooCommerce,
    GoogleAds: syncGoogleAds,
    GA4: syncGA4,
    TikTokAds: syncTikTokAds,
    Facebook: syncFacebook,
    PostgreSQL: syncPostgreSQL,
    MongoDB: syncMongoDB,
    Firestore: syncFirestore,
  };

  const handler = handlers[connectorName];
  if (!handler) throw new Error(\`Unknown connector: \${connectorName}\`);

  return await handler(credentials, datasetId);
}

// Connector-specific sync implementations
async function syncStripe(credentials, datasetId) {
  const { apiKey } = credentials;
  const endpoints = [
    { path: '/customers', table: 'stripe_customers' },
    { path: '/charges', table: 'stripe_charges' },
    { path: '/subscriptions', table: 'stripe_subscriptions' },
  ];
  return await syncApiEndpoints('https://api.stripe.com/v1', endpoints, apiKey, datasetId, 'Bearer');
}

async function syncShopify(credentials, datasetId) {
  const { apiKey, shopDomain } = credentials;
  const endpoints = [
    { path: '/orders.json', table: 'shopify_orders' },
    { path: '/products.json', table: 'shopify_products' },
    { path: '/customers.json', table: 'shopify_customers' },
  ];
  return await syncApiEndpoints(\`https://\${shopDomain}/admin/api/2024-01\`, endpoints, apiKey, datasetId, 'X-Shopify-Access-Token');
}

async function syncHubSpot(credentials, datasetId) {
  const { apiKey } = credentials;
  const endpoints = [
    { path: '/crm/v3/objects/contacts', table: 'hubspot_contacts' },
    { path: '/crm/v3/objects/deals', table: 'hubspot_deals' },
    { path: '/crm/v3/objects/companies', table: 'hubspot_companies' },
  ];
  return await syncApiEndpoints('https://api.hubapi.com', endpoints, apiKey, datasetId, 'Authorization', 'Bearer');
}

async function syncSentry(credentials, datasetId) {
  const { apiKey, orgSlug } = credentials;
  const endpoints = [
    { path: \`/organizations/\${orgSlug}/issues/\`, table: 'sentry_issues' },
    { path: \`/organizations/\${orgSlug}/events/\`, table: 'sentry_events' },
  ];
  return await syncApiEndpoints('https://sentry.io/api/0', endpoints, apiKey, datasetId, 'Authorization', 'Bearer');
}

async function syncSalesforce(credentials, datasetId) {
  // OAuth2 flow required
  const { accessToken, instanceUrl } = credentials;
  const endpoints = [
    { path: '/services/data/v58.0/sobjects/Account', table: 'sf_accounts' },
    { path: '/services/data/v58.0/sobjects/Opportunity', table: 'sf_opportunities' },
  ];
  return await syncApiEndpoints(instanceUrl, endpoints, accessToken, datasetId, 'Authorization', 'Bearer');
}

async function syncPostHog(credentials, datasetId) {
  const { apiKey, projectId } = credentials;
  const endpoints = [
    { path: \`/api/projects/\${projectId}/events\`, table: 'posthog_events' },
    { path: \`/api/projects/\${projectId}/insights/trend\`, table: 'posthog_insights' },
  ];
  return await syncApiEndpoints('https://app.posthog.com', endpoints, apiKey, datasetId, 'Authorization', 'Bearer');
}

async function syncKlaviyo(credentials, datasetId) {
  const { apiKey } = credentials;
  const endpoints = [
    { path: '/api/v2/lists', table: 'klaviyo_lists' },
    { path: '/api/v2/metrics', table: 'klaviyo_metrics' },
  ];
  return await syncApiEndpoints('https://a.klaviyo.com', endpoints, apiKey, datasetId, 'Authorization', 'Klaviyo-API-Key');
}

async function syncWooCommerce(credentials, datasetId) {
  const { apiKey, apiSecret, storeUrl } = credentials;
  const endpoints = [
    { path: '/wp-json/wc/v3/orders', table: 'wc_orders' },
    { path: '/wp-json/wc/v3/products', table: 'wc_products' },
    { path: '/wp-json/wc/v3/customers', table: 'wc_customers' },
  ];
  const basicAuth = Buffer.from(apiKey + ':' + apiSecret).toString('base64');
  return await syncApiEndpoints(storeUrl, endpoints, basicAuth, datasetId, 'Authorization', 'Basic');
}

async function syncGoogleAds(credentials, datasetId) {
  const { developerToken, customerId, loginCustomerId } = credentials;
  const endpoints = [
    { path: '/v14/customers/' + customerId + '/googleAds:searchStream', table: 'googleads_campaigns' },
  ];
  return await syncApiEndpoints('https://googleads.googleapis.com', endpoints, developerToken, datasetId, 'Authorization', 'Bearer');
}

async function syncGA4(credentials, datasetId) {
  const { propertyId, apiKey } = credentials;
  const endpoints = [
    { path: '/v1beta/properties/' + propertyId + ':runReport', table: 'ga4_events' },
    { path: '/v1beta/properties/' + propertyId + ':runReport', table: 'ga4_sessions' },
  ];
  return await syncApiEndpoints('https://analyticsdata.googleapis.com', endpoints, apiKey, datasetId, 'Authorization', 'Bearer');
}

async function syncTikTokAds(credentials, datasetId) {
  const { accessToken, advertiserId } = credentials;
  const endpoints = [
    { path: '/open_api/v1.3/advertiser/info', table: 'tiktok_advertiser' },
    { path: '/open_api/v1.3/campaign/get', table: 'tiktok_campaigns' },
  ];
  return await syncApiEndpoints('https://business-api.tiktok.com', endpoints, accessToken, datasetId, 'Access-Token');
}

async function syncFacebook(credentials, datasetId) {
  const { accessToken, adAccountId } = credentials;
  const endpoints = [
    { path: '/' + adAccountId + '/insights', table: 'fb_insights' },
    { path: '/' + adAccountId + '/campaigns', table: 'fb_campaigns' },
  ];
  return await syncApiEndpoints('https://graph.facebook.com/v18.0', endpoints, accessToken, datasetId, 'Authorization', 'Bearer');
}

async function syncPostgreSQL(credentials, datasetId) {
  const { host, port, database, user, password, ssl } = credentials;
  const { Client } = require('pg');
  const client = new Client({ host, port: port || 5432, database, user, password, ssl: ssl || false });
  await client.connect();

  const tables = ['users', 'orders', 'products', 'customers'];
  const results = [];

  for (const table of tables) {
    try {
      const res = await client.query('SELECT * FROM ' + table + ' LIMIT 10000');
      if (res.rows.length > 0) {
        await saveToBigQuery('pg_' + table, res.rows, datasetId);
      }
      results.push({ table: 'pg_' + table, rows: res.rows.length });
    } catch (err) {
      results.push({ table: 'pg_' + table, error: err.message });
    }
  }

  await client.end();
  return results;
}

async function syncMongoDB(credentials, datasetId) {
  const { uri, database } = credentials;
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(database);
  const collections = ['users', 'orders', 'products', 'events'];
  const results = [];

  for (const coll of collections) {
    try {
      const docs = await db.collection(coll).find().limit(10000).toArray();
      if (docs.length > 0) {
        await saveToBigQuery('mongo_' + coll, docs, datasetId);
      }
      results.push({ table: 'mongo_' + coll, rows: docs.length });
    } catch (err) {
      results.push({ table: 'mongo_' + coll, error: err.message });
    }
  }

  await client.close();
  return results;
}

async function syncFirestore(credentials, datasetId) {
  const { projectId } = credentials;
  const { Firestore } = require('@google-cloud/firestore');
  const db = new Firestore({ projectId });

  const collections = ['users', 'orders', 'events', 'products'];
  const results = [];

  for (const coll of collections) {
    try {
      const snapshot = await db.collection(coll).limit(10000).get();
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (docs.length > 0) {
        await saveToBigQuery('fs_' + coll, docs, datasetId);
      }
      results.push({ table: 'fs_' + coll, rows: docs.length });
    } catch (err) {
      results.push({ table: 'fs_' + coll, error: err.message });
    }
  }

  return results;
}

// Generic API endpoint sync
async function syncApiEndpoints(baseUrl, endpoints, apiKey, datasetId, authHeader, authPrefix = '') {
  const results = [];
  const headers = { 'Content-Type': 'application/json' };
  headers[authHeader] = authPrefix ? \`\${authPrefix} \${apiKey}\` : apiKey;

  for (const ep of endpoints) {
    try {
      const response = await fetch(\`\${baseUrl}\${ep.path}\`, { headers });
      const data = await response.json();
      const rows = Array.isArray(data) ? data : (data.data || data.results || []);
      
      if (rows.length > 0) {
        await saveToBigQuery(ep.table, rows, datasetId);
      }
      results.push({ table: ep.table, rows: rows.length });
    } catch (err) {
      results.push({ table: ep.table, error: err.message });
    }
  }
  return results;
}

async function saveToBigQuery(tableId, data, datasetId) {
  if (!data || data.length === 0) return;
  const table = bq.dataset(datasetId).table(tableId);
  const [exists] = await table.exists();
  if (!exists) {
    await table.create({ schema: 'AUTO' });
  }
  await table.insert(data);
}

function calculateNextSync(schedule) {
  const now = Date.now();
  if (schedule.includes('5 minutes')) return new Date(now + 5 * 60000).toISOString();
  if (schedule.includes('15 minutes')) return new Date(now + 15 * 60000).toISOString();
  if (schedule.includes('1 hour')) return new Date(now + 60 * 60000).toISOString();
  if (schedule.includes('6 hours')) return new Date(now + 6 * 60 * 60000).toISOString();
  if (schedule.includes('1 day')) return new Date(now + 24 * 60 * 60000).toISOString();
  return new Date(now + 60 * 60000).toISOString(); // default 1 hour
}

// Main entry point
processSyncQueue().then(() => process.exit(0)).catch(err => {
  console.error('Worker failed:', err);
  process.exit(1);
});
`;
  }

  /**
   * Upload source code as ZIP to GCS.
   */
  async uploadSourceZip(bucketName, objectName, sourceCode) {
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('index.js', sourceCode);
    zip.file('package.json', JSON.stringify({
      name: 'sentry-sync-worker',
      version: '1.0.0',
      main: 'index.js',
      dependencies: {
        '@google-cloud/secret-manager': '^5.0.0',
        '@google-cloud/bigquery': '^7.0.0',
        '@google-cloud/firestore': '^7.0.0',
        '@google-cloud/pubsub': '^4.0.0',
      },
    }, null, 2));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    await file.save(zipBuffer, { contentType: 'application/zip' });
  }

  /**
   * Get service account token for Cloud Scheduler HTTP target.
   */
  async getServiceAccountToken() {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
  }

  /**
   * Remove a connector — delete credentials and sync queue entry.
   */
  async removeConnector(orgId, projectId, connectorName) {
    const secretId = `connector-${orgId}-${projectId}-${connectorName.toLowerCase()}`;

    // Delete secret
    try {
      await this.gcp.secretManager?.deleteSecret({
        name: `projects/${config.gcpProjectId}/secrets/${secretId}`,
      });
    } catch {}

    // Delete from sync queue
    try {
      const db = this.gcp.firestore;
      if (db) {
        await db.collection('sync_queue').doc(`${orgId}_${projectId}_${connectorName}`).delete();
      }
    } catch {}

    return {
      status: 'removed',
      message: `Connector ${connectorName} removed.`,
    };
  }
}

// Connector deploy configuration
const CONNECTOR_DEPLOY = {
  // Real-time (5-15 min) — critical business data
  'Stripe':       { type: 'cloud_run_job', schedule: 'every 5 minutes' },
  'Sentry':       { type: 'cloud_run_job', schedule: 'every 5 minutes' },
  'Prometheus':   { type: 'direct', schedule: 'real-time' },
  'BigQuery':     { type: 'direct', schedule: 'real-time' },

  // Frequent (15-30 min) — e-commerce, ads, analytics
  'Shopify':      { type: 'cloud_run_job', schedule: 'every 15 minutes' },
  'WooCommerce':  { type: 'cloud_run_job', schedule: 'every 15 minutes' },
  'Meta Ads':     { type: 'cloud_run_job', schedule: 'every 15 minutes' },
  'TikTok Ads':   { type: 'cloud_run_job', schedule: 'every 15 minutes' },
  'Google Ads':   { type: 'cloud_run_job', schedule: 'every 15 minutes' },
  'GA4':          { type: 'cloud_run_job', schedule: 'every 15 minutes' },
  'PostHog':      { type: 'cloud_run_job', schedule: 'every 15 minutes' },
  'Klaviyo':      { type: 'cloud_run_job', schedule: 'every 15 minutes' },

  // Standard (30-60 min) — CRM, databases
  'HubSpot':      { type: 'cloud_run_job', schedule: 'every 30 minutes' },
  'Salesforce':   { type: 'cloud_run_job', schedule: 'every 30 minutes' },
  'PostgreSQL':   { type: 'cloud_run_job', schedule: 'every 30 minutes' },
  'MySQL':        { type: 'cloud_run_job', schedule: 'every 30 minutes' },
  'MongoDB':      { type: 'cloud_run_job', schedule: 'every 30 minutes' },
  'Firestore':    { type: 'cloud_run_job', schedule: 'every 30 minutes' },
  'Facebook':     { type: 'cloud_run_job', schedule: 'every 30 minutes' },

  // Daily (Google Transfer) — Search, YouTube
  'Search Console': { type: 'bigquery_transfer', schedule: 'daily' },
  'YouTube':      { type: 'bigquery_transfer', schedule: 'daily' },
};
