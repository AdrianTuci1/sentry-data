"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
class AnalyticsService {
    constructor(projectRepository) {
        this.projectRepository = projectRepository;
        // The URL of the internal DuckDB Node.js Worker/Microservice
        this.analyticsWorkerUrl = process.env.ANALYTICS_WORKER_URL || 'http://localhost:4000/execute';
    }
    /**
     * The core orchestration method.
     * 1. Fetches the project config (including SQL queries) from DynamoDB.
     * 2. Sends the queries to the DuckDB Worker.
     * 3. Returns the aggregated JSON for the frontend.
     */
    async getDashboardData(tenantId, projectId) {
        // 1. Fetch Project Metadata
        const project = await this.projectRepository.findOne(tenantId, projectId);
        if (!project) {
            throw new Error(`Project ${projectId} not found or access denied.`);
        }
        if (!project.queryConfigs || project.queryConfigs.length === 0) {
            return {
                status: 'pending',
                message: 'No analytics configuration found. E2B Agent might still be processing.'
            };
        }
        // 2. Send request to Analytics Worker
        try {
            console.log(`[AnalyticsService] Dispatching ${project.queryConfigs.length} queries to Analytics Worker for ${projectId}`);
            const response = await fetch(this.analyticsWorkerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Optional internal auth header
                    'x-internal-secret': process.env.INTERNAL_API_SECRET || 'secret'
                },
                body: JSON.stringify({
                    tenantId,
                    projectId,
                    queries: project.queryConfigs
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Analytics Worker Failed: ${response.status} - ${errorText}`);
            }
            // 3. Return formatted data
            const dashboardData = await response.json();
            return dashboardData;
        }
        catch (error) {
            console.error(`[AnalyticsService] Error calling DuckDB Worker:`, error.message);
            // Re-throw to be caught by the global error handler
            throw new Error(`Failed to generate analytics data: ${error.message}`);
        }
    }
}
exports.AnalyticsService = AnalyticsService;
