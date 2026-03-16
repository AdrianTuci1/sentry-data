import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { WidgetDataMapper } from '../utils/WidgetDataMapper';

export class AnalyticsService {
    private projectRepository: ProjectRepository;
    private analyticsWorkerUrl: string;

    constructor(projectRepository: ProjectRepository) {
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
    public async getDashboardData(tenantId: string, projectId: string): Promise<any> {
        // 1. Fetch Project Metadata
        const project = await this.projectRepository.findById(tenantId, projectId);

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

            // 3. Process and Return formatted data
            const workerResponse = await response.json();
            const metadataDashboards = project.discoveryMetadata?.dashboards || [];
            
            console.log(`[AnalyticsService] Project has ${metadataDashboards.length} dashboards, Worker returned ${workerResponse.results?.length || 0} results`);
            
            // Merge live results into the metadata-defined dashboard structures
            const enrichedDashboards = metadataDashboards.map((widget: any) => {
                // Find matching result from worker
                const result = workerResponse.results?.find((r: any) => r.widgetId === widget.id);
                
                if (!result || result.error || !result.data || !Array.isArray(result.data)) {
                    console.warn(`[AnalyticsService] No live data for widget ${widget.id}${result?.error ? ': ' + result.error : ''}`);
                    return widget; // Return basic metadata if no live data is available
                }

                // Map raw data using the widget type
                const mappedData = WidgetDataMapper.map(widget.type, result.data);
                
                return {
                    ...widget,
                    ...mappedData, // Overwrite/add live data fields (value, historical, etc.)
                    latency: result.latency_ms
                };
            });

            return {
                tenantId,
                projectId,
                dashboards: enrichedDashboards
            };

        } catch (error: any) {
            console.error(`[AnalyticsService] Error calling DuckDB Worker:`, error.message);
            // Re-throw to be caught by the global error handler
            throw new Error(`Failed to generate analytics data: ${error.message}`);
        }
    }
}
