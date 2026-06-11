import { gcpService } from './GcpService.js';
import { config } from '../config/index.js';

export class SpecService {
  constructor() {
    this.gcp = gcpService;
    this.harnessUrl = config.harnessServiceUrl || 'http://localhost:8081';
  }

  getSpecsPrefix(orgId, projectId) {
    return `specs/${orgId}/${projectId}`;
  }

  async getSpec(orgId, projectId) {
    const prefix = this.getSpecsPrefix(orgId, projectId);
    const bucket = this.gcp.storage.bucket(config.gcsBucketName);
    const blob = bucket.file(`${prefix}/dashboard_spec.json`);
    try {
      const [exists] = await blob.exists();
      if (!exists) return null;
      const [content] = await blob.download();
      return JSON.parse(content.toString());
    } catch (err) {
      console.warn(`[SpecService] ${err.message}`);
      return null;
    }
  }

  async getDataCatalog(orgId, projectId) {
    const prefix = this.getSpecsPrefix(orgId, projectId);
    const bucket = this.gcp.storage.bucket(config.gcsBucketName);
    const blob = bucket.file(`${prefix}/data_catalog.json`);
    try {
      const [exists] = await blob.exists();
      if (!exists) return null;
      const [content] = await blob.download();
      return JSON.parse(content.toString());
    } catch { return null; }
  }

  /**
   * Trigger spec generation via Harness Service.
   * Calls the harness service directly (Cloud Run or Docker Compose).
   */
  async generateSpec(orgId, projectId) {
    const dataset = this.gcp.getDatasetName(orgId, projectId);

    const response = await fetch(`${this.harnessUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': config.internalToken || '',
      },
      body: JSON.stringify({ orgId, projectId, dataset }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Harness service error: ${response.status}`);
    }

    return response.json();
  }

  async invalidateSpec(orgId, projectId) {
    const prefix = this.getSpecsPrefix(orgId, projectId);
    const bucket = this.gcp.storage.bucket(config.gcsBucketName);
    try {
      await bucket.file(`${prefix}/dashboard_spec.json`).delete({ ignoreNotFound: true });
      return { invalidated: true };
    } catch (err) {
      return { invalidated: false, error: err.message };
    }
  }
}
