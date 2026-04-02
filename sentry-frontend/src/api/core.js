const API_BASE_URL = 'http://localhost:3000/api';

// Use token from localStorage (set by seed/login) or fallback to mock for dev
const getHeaders = () => {
    const token = localStorage.getItem('sentry_token') || 'mock-tenant-token-123';
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.replace('Bearer ', '')}`
    };
};

export const ProjectService = {
    /**
     * Retrieves all projects for the current tenant.
     */
    async getProjects() {
        const res = await fetch(`${API_BASE_URL}/projects`, {
            method: 'GET',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },

    /**
     * Retrieves details for a specific project.
     */
    async getProject(projectId) {
        const res = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
            method: 'GET',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },

    /**
     * Creates a new project workspace.
     */
    async createProject(name) {
        const res = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },

    /**
     * Connects a new raw data source to the project.
     */
    async addSource(projectId, sourceName, sourceUri) {
        const res = await fetch(`${API_BASE_URL}/projects/${projectId}/sources`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ sourceName, sourceUri })
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },

    /**
     * Triggers the Parrot runtime for a project.
     */
    async runRuntime(projectId, rawSourceUris) {
        const res = await fetch(`${API_BASE_URL}/projects/${projectId}/runtime/run`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ rawSourceUris })
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },

    /**
     * Fetches the generated Gold Table schema mapped to MindMap Nodes.
     */
    async getLineage(projectId) {
        const res = await fetch(`${API_BASE_URL}/projects/${projectId}/lineage`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },

    /**
     * Fetches dashboard metadata plus optional widget data payloads.
     */
    async getAnalytics(projectId) {
        const res = await fetch(`${API_BASE_URL}/dashboard/${projectId}`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },

    /**
     * Fetches the structural manifest of a dashboard.
     */
    async getDashboardManifest(projectId) {
        const res = await fetch(`${API_BASE_URL}/dashboard/${projectId}/manifest`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },

    /**
     * Subscribes to Server-Sent Events (SSE) to receive real-time updates of runtime progress.
     */
    connectToRuntimeStream(onMessage, onError) {
        let eventSource = null;
        let reconnectTimeout = null;
        let retryCount = 0;
        const maxRetries = 10;
        const baseDelay = 1000;

        const connect = () => {
            const headers = getHeaders();
            const token = headers['Authorization'].replace('Bearer ', '');
            
            if (eventSource) {
                eventSource.close();
            }

            console.log(`[SSE] Connecting to stream (Attempt ${retryCount + 1})...`);
            eventSource = new EventSource(`${API_BASE_URL}/events?token=${token}`);

            eventSource.onopen = () => {
                console.log("[SSE] Connection established.");
                retryCount = 0; // Reset on success
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessage(data);
                } catch (err) {
                    console.warn("Failed to parse SSE event:", err);
                }
            };

            eventSource.onerror = (error) => {
                console.error("SSE Streaming Error observed:", error);
                if (onError) onError(error);
                
                eventSource.close();
                
                if (retryCount < maxRetries) {
                    const delay = Math.min(baseDelay * Math.pow(2, retryCount), 30000);
                    console.log(`[SSE] Reconnecting in ${delay}ms...`);
                    reconnectTimeout = setTimeout(() => {
                        retryCount++;
                        connect();
                    }, delay);
                } else {
                    console.error("[SSE] Max retries reached. Stopping reconnection.");
                }
            };
        };

        connect();

        return () => {
            console.log("[SSE] Closing connection manually.");
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (eventSource) eventSource.close();
        };
    }
};
