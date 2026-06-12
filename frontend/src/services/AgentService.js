import { apiClient } from "./ApiClient.js";

export class AgentService {
  async createSession(orgId, projectId, dto) {
    const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/agents`, dto);
    return response.data;
  }

  async listSessions(orgId, projectId) {
    const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/agents`);
    return response.data;
  }

  async getSession(orgId, projectId, sessionId) {
    const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/agents/${sessionId}`);
    return response.data;
  }

  async launch(orgId, projectId, sessionId, context) {
    const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/agents/${sessionId}/launch`, { context });
    return response.data;
  }

  async getCredentials(orgId, projectId) {
    const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/agents/credentials/gcs`);
    return response.data;
  }
}

export const agentService = new AgentService();
