import { apiClient } from "./ApiClient.js";

export class MeltanoService {
  async getCredentials(orgId, projectId) {
    const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/meltano/credentials`);
    return response.data;
  }

  async validateConfig(orgId, projectId, type, settings) {
    const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/meltano/validate`, { type, settings });
    return response.data;
  }

  async generateConfig(orgId, projectId, integrationId, config) {
    const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/meltano/config/${integrationId}`, config);
    return response.data;
  }

  async cleanupLandingZone(orgId, projectId, integrationId) {
    const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/meltano/cleanup/${integrationId}`);
    return response.data;
  }
}

export const meltanoService = new MeltanoService();
