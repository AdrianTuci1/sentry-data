const API_BASE_URL = 'http://localhost:8000/api/v1';

// Temporary mock token for Auth Middleware bypass until fully integrated
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mock-tenant-token-123'
});

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
     * Triggers the full 6-agent Orchestration Pipeline.
     */
    async runPipeline(projectId, rawSourceUris) {
        const res = await fetch(`${API_BASE_URL}/projects/${projectId}/pipeline/run`, {
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
     * Fetches the generated insights/ML predictions mapped to Dashboard Widgets.
     */
    async getAnalytics(projectId) {
        const res = await fetch(`${API_BASE_URL}/projects/${projectId}/analytics`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    },

    /**
     * Subscribes to Server-Sent Events (SSE) to receive real-time updates of agent progress.
     */
    connectToPipelineStream(onMessage, onError) {
        // SSE natively uses GET. We pass token via query string or rely on cookies since browsers restrict custom headers in EventSource.
        const token = 'mock-tenant-token-123';
        const eventSource = new EventSource(`${API_BASE_URL}/events?token=${token}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'pipeline_progress') {
                    onMessage(data.data);
                }
            } catch (err) {
                console.warn("Failed to parse SSE event:", err);
            }
        };

        eventSource.onerror = (error) => {
            console.error("SSE Streaming Error:", error);
            if (onError) onError(error);
            eventSource.close();
        };

        return () => {
            // Return closer function
            eventSource.close();
        };
    }
};
