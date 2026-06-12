import { config } from "@/config";

class ApiClient {
  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.token = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      this.token = localStorage.getItem("token") || null;
    }
  }

  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        localStorage.setItem("token", token);
      } else {
        localStorage.removeItem("token");
      }
    }
  }

  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(method, endpoint, body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders(),
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error?.message || `HTTP ${response.status}`);
    }

    return data;
  }

  get(endpoint) {
    return this.request("GET", endpoint);
  }

  post(endpoint, body) {
    return this.request("POST", endpoint, body);
  }

  patch(endpoint, body) {
    return this.request("PATCH", endpoint, body);
  }

  delete(endpoint) {
    return this.request("DELETE", endpoint);
  }
}

export const apiClient = new ApiClient();
