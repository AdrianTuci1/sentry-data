import { gcpService } from './GcpService.js';
import { config } from '../config/index.js';

export class MeltanoService {
  constructor() {
    this.gcp = gcpService;
  }

  async getLandingZoneCredentials(orgId, projectId) {
    const gcsToken = await this.gcp.generateTemporaryToken(orgId, projectId);
    const prefix = this.gcp.getLandingZonePrefix(orgId, projectId);

    return {
      gcsToken,
      bucketName: config.gcsBucketName,
      landingZonePrefix: prefix,
      bigQueryDataset: this.gcp.getDatasetName(orgId, projectId),
      bigQueryProjectId: config.gcpProjectId,
    };
  }

  async reportTelemetry(orgId, projectId, integrationId, telemetry) {
    const integrationRef = this.gcp.firestore
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('integrations')
      .doc(integrationId);

    const now = new Date().toISOString();
    const update = {
      lastSyncAt: now,
      updatedAt: now,
      syncStats: {
        totalRuns: telemetry.totalRuns,
        successfulRuns: telemetry.successfulRuns,
        failedRuns: telemetry.failedRuns,
        lastVolume: telemetry.volume || 0,
        lastDuration: telemetry.duration || 0,
      },
      lastStatus: telemetry.status,
      lastError: telemetry.error || null,
    };

    await integrationRef.update(update);
    return update;
  }

  async validateExtractorConfig(type, config) {
    const validators = {
      'tap-postgres': (cfg) => cfg.host && cfg.port && cfg.database && cfg.user,
      'tap-mysql': (cfg) => cfg.host && cfg.port && cfg.database && cfg.user,
      'tap-snowflake': (cfg) => cfg.account && cfg.warehouse && cfg.database && cfg.user,
      'tap-bigquery': (cfg) => cfg.project_id && cfg.dataset_id,
      'tap-google-analytics': (cfg) => cfg.view_id || cfg.property_id,
      'tap-salesforce': (cfg) => cfg.client_id && cfg.client_secret && cfg.refresh_token,
      'tap-shopify': (cfg) => cfg.shop && cfg.api_key,
      'tap-stripe': (cfg) => cfg.client_secret,
    };

    const validator = validators[type];
    if (!validator) {
      return { valid: false, error: `Unknown extractor type: ${type}` };
    }

    const valid = validator(config);
    return {
      valid,
      error: valid ? null : `Missing required fields for ${type}`,
    };
  }

  async generateMeltanoConfig(orgId, projectId, integrationId, extractorConfig) {
    const credentials = await this.getLandingZoneCredentials(orgId, projectId);
    const landingZonePath = `gs://${credentials.bucketName}/${credentials.landingZonePrefix}`;

    return {
      version: 1,
      default_environment: 'prod',
      project_id: projectId,
      plugins: {
        extractors: [
          {
            name: extractorConfig.type,
            variant: extractorConfig.variant || 'singer-io',
            config: {
              ...extractorConfig.settings,
              // Add GCS landing zone as destination
              batch_config: {
                encoding: {
                  format: 'jsonl',
                },
                storage: {
                  root: landingZonePath,
                  prefix: `integration_${integrationId}/`,
                },
              },
            },
          },
        ],
        loaders: [
          {
            name: 'target-bigquery',
            variant: 'adswerve',
            config: {
              project_id: credentials.bigQueryProjectId,
              dataset_id: credentials.bigQueryDataset,
              location: config.bigQueryLocation,
              // GCS staging bucket for BigQuery load
              bucket_name: credentials.bucketName,
              bucket_path: `${credentials.landingZonePrefix}/staging/`,
            },
          },
        ],
      },
      schedules: [
        {
          name: `${extractorConfig.type}-to-bigquery`,
          extractor: extractorConfig.type,
          loader: 'target-bigquery',
          transform: 'skip',
          interval: extractorConfig.schedule || '@daily',
          start_date: new Date().toISOString().split('T')[0],
        },
      ],
      // Telemetry reporting endpoint
      telemetry: {
        endpoint: `${config.meltanoApiUrl || ''}/api/v1/organizations/${orgId}/projects/${projectId}/integrations/${integrationId}/sync`,
        secret: config.meltanoWebhookSecret,
      },
    };
  }

  async cleanupLandingZone(orgId, projectId, integrationId) {
    const prefix = `${this.gcp.getLandingZonePrefix(orgId, projectId)}/integration_${integrationId}/`;
    const bucket = this.gcp.getBucket();

    try {
      const [files] = await bucket.getFiles({ prefix });
      await Promise.all(files.map(file => file.delete()));
      return { deleted: files.length };
    } catch (err) {
      return { deleted: 0, error: err.message };
    }
  }
}
