import { apiClient } from "./ApiClient.js";

export class OrganizationService {
  async create(dto) {
    const response = await apiClient.post("/organizations", dto);
    return response.data;
  }

  async list() {
    const response = await apiClient.get("/organizations");
    return response.data;
  }

  async get(orgId) {
    const response = await apiClient.get(`/organizations/${orgId}`);
    return response.data;
  }

  async update(orgId, dto) {
    const response = await apiClient.patch(`/organizations/${orgId}`, dto);
    return response.data;
  }

  async delete(orgId) {
    await apiClient.delete(`/organizations/${orgId}`);
  }
}

export const organizationService = new OrganizationService();
