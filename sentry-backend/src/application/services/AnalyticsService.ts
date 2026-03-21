import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { WidgetDataMapper } from '../utils/WidgetDataMapper';
import { WidgetService } from './WidgetService';
import { SDUIHydrator } from '../utils/SDUIHydrator';
import { WidgetRenderer } from '../utils/WidgetRenderer';

// Debugging Tasks:
// - [x] Debug "fetch failed" / "401 Unauthorized" in `AnalyticsService`
// - [x] Transition to Client-Side Component Rendering
// - [/] Debug "Waiting for components..." / Empty Cache (0 widgets)
//     - [x] Add debug logs to backend and frontend
//     - [/] Fix R2 `listPrefixGroups` logic
//     - [ ] Verify R2 object existence for components
// - [ ] Final Verification

export class AnalyticsService {
    private projectRepository: ProjectRepository;
    private widgetService: WidgetService;
    private widgetRenderer: WidgetRenderer;
    private analyticsWorkerUrl: string;
    private workerSecret: string;

    constructor(
        projectRepository: ProjectRepository,
        widgetService: WidgetService,
        widgetRenderer: WidgetRenderer
    ) {
        this.projectRepository = projectRepository;
        this.widgetService = widgetService;
        this.widgetRenderer = widgetRenderer;
        // Internal worker connection details
        this.analyticsWorkerUrl = process.env.ANALYTICS_WORKER_URL || 'http://localhost:4000/execute';
        this.workerSecret = process.env.INTERNAL_API_SECRET || 'secret';
    }

    /**
     * The core orchestration method (Global snapshot).
     */
    public async getDashboardData(tenantId: string, projectId: string): Promise<any> {
        const project = await this.projectRepository.findById(tenantId, projectId);
        if (!project) throw new Error(`Project ${projectId} not found.`);

        if (!project.queryConfigs || project.queryConfigs.length === 0) {
            // If project is fresh (just seeded), return the catalog as 'discovery' widgets
            const catalog = await this.widgetService.getCatalog();
            const enrichedDashboards = await Promise.all(catalog.map(async (widget: any) => {
                const componentCode = await this.widgetRenderer.getCompiledCode(widget.id, widget.category);
                return {
                    ...widget,
                    gridSpan: widget.grid_span || widget.gridSpan || 'col-span-1',
                    colorTheme: widget.color_theme || widget.colorTheme || 'theme-productivity',
                    isMock: true,
                    data: widget.data_structure_template || {},
                    componentCode
                };
            }));
            return { tenantId, projectId, status: 'discovery', dashboards: enrichedDashboards };
        }

        try {
            const response = await fetch(this.analyticsWorkerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': this.workerSecret
                },
                body: JSON.stringify({ tenantId, projectId, queries: project.queryConfigs })
            });

            if (!response.ok) throw new Error(`Worker Failed: ${response.status}`);

            const workerResult = await response.json() || { results: [] };
            const rawMetadata = project.discoveryMetadata?.insight || project.discoveryMetadata?.dashboards || [];
            const metadataDashboards = WidgetDataMapper.unmarshall(rawMetadata) || [];

            if (Array.isArray(metadataDashboards)) {
                console.log(`[AnalyticsService] Found ${metadataDashboards.length} insight widgets. Types: ${metadataDashboards.map((w: any) => w?.type || w?.widget_type || 'NO_TYPE').join(', ')}`);
            }

            const enrichedDashboards = await Promise.all(metadataDashboards.map(async (widget: any) => {
                if (!widget) return { id: 'err', title: 'Error', isMock: true };
                const result = workerResult?.results?.find((r: any) => r?.widgetId === widget.id);

                // Resolve widget type: insights may use `type` or `widget_type`
                const widgetType = widget.type || widget.widget_type || widget.id;

                // Get definition to find category, gridSpan, and title
                const definition = await this.widgetService.findWidget(widgetType);

                let componentCode = "";
                if (definition) {
                    componentCode = await this.widgetRenderer.getCompiledCode(widgetType, definition.category);
                    if (!componentCode) {
                        console.warn(`[AnalyticsService] Component code EMPTY for ${widgetType} (category: ${definition.category})`);
                    }
                } else {
                    console.warn(`[AnalyticsService] No widget definition found for type: "${widgetType}" (widget id: ${widget.id})`);
                }

                const baseWidget = {
                    ...widget,
                    type: widgetType,
                    gridSpan: widget.grid_span || widget.gridSpan || definition?.grid_span || 'col-span-1',
                    colorTheme: widget.color_theme || widget.colorTheme || definition?.color_theme || 'theme-productivity',
                    title: widget.title || definition?.title || widgetType,
                    componentCode
                };

                if (!result || result.error || !result.data || result.data.length === 0) {
                    // If no result, error, or empty data, return base widget with isMock: true 
                    // and serve the template data from manifest.
                    return { 
                        ...baseWidget, 
                        isMock: true,
                        data: definition?.data_structure_template || {}
                    };
                }

                const mappedData = WidgetDataMapper.map(widgetType, result.data);

                return {
                    ...baseWidget,
                    data: mappedData,
                    results: result.data,
                    isMock: false,
                    latency: result.latency_ms
                };
            }));

            return { tenantId, projectId, dashboards: enrichedDashboards };
        } catch (error: any) {
            console.error(`[AnalyticsService] Error:`, error.message);
            throw new Error(`Failed to generate data: ${error.message}`);
        }
    }

    /**
     * Returns the structural manifest of a dashboard (groups and IDs) without data.
     */
    public async getDashboardManifest(tenantId: string, projectId: string): Promise<any> {
        const project = await this.projectRepository.findById(tenantId, projectId);
        if (!project) throw new Error(`Project ${projectId} not found.`);

        const groups = WidgetDataMapper.unmarshall(project.discoveryMetadata?.group || project.discoveryMetadata?.dashboardGroups || []);
        const insights = WidgetDataMapper.unmarshall(project.discoveryMetadata?.insight || project.discoveryMetadata?.dashboards || []);

        return {
            dashboardGroups: Array.isArray(groups) ? groups : [],
            dashboards: (Array.isArray(insights) ? insights : []).map((d: any) => ({
                id: d?.id,
                type: d?.type,
                title: d?.title,
                gridSpan: d?.gridSpan || d?.grid_span,
                colorTheme: d?.colorTheme || d?.color_theme
            }))
        };
    }

    /**
     * Clears the widget catalog cache.
     */
    public reloadWidgets(): void {
        this.widgetService.clearCache();
    }

    /**
     * Fetches and hydrates a single widget's data.
     */
    public async getWidgetDataInstance(tenantId: string, projectId: string, widgetId: string): Promise<any> {
        const project = await this.projectRepository.findById(tenantId, projectId);
        if (!project) throw new Error(`Project ${projectId} not found.`);

        const rawMetadata = project.discoveryMetadata?.insight || project.discoveryMetadata?.dashboards || [];
        const metadataArray = WidgetDataMapper.unmarshall(rawMetadata) || [];

        const widgetMetadata = Array.isArray(metadataArray)
            ? metadataArray.find((d: any) => d?.id === widgetId)
            : null;

        const queryConfig = project.queryConfigs?.find((q: any) => q?.widgetId === widgetId);

        // If not configured, it might be a direct call for a discovery widget (type preview)
        if (!widgetMetadata || !queryConfig) {
            // First check if widgetId is actually a known TYPE
            const definition = await this.widgetService.findWidget(widgetId);
            if (!definition) {
                throw new Error(`Widget instance or type ${widgetId} not found.`);
            }

            console.log(`[AnalyticsService] Falling back to type preview for ${widgetId}`);
            const componentCode = await this.widgetRenderer.getCompiledCode(definition.id, definition.category);
            return {
                id: widgetId,
                type: definition.id,
                componentCode,
                title: definition.title,
                gridSpan: definition.grid_span || 'col-span-1',
                colorTheme: definition.color_theme || 'theme-productivity',
                data: definition.data_structure_template || {}
            };
        }

        const response = await fetch(this.analyticsWorkerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': this.workerSecret
            },
            body: JSON.stringify({ tenantId, projectId, queries: [queryConfig] })
        });

        const workerRes = await response.json() || { results: [] };
        const result = workerRes?.results?.[0];

        if (!result) throw new Error(`No worker result for ${widgetId}`);
        if (result.error) throw new Error(`Query failed for ${widgetId}: ${result.error}`);

        // IMPORTANT: Use the template type for mapping and rendering, not the instance ID
        const widgetType = widgetMetadata.type || widgetMetadata.widget_type || widgetId;
        const definition = await this.widgetService.findWidget(widgetType);

        if (!definition) {
            console.warn(`[AnalyticsService] Definition NOT FOUND for type: ${widgetType}`);
            const mappedData = WidgetDataMapper.map(widgetType, result?.data || []);
            const meta = (widgetMetadata || {}) as any;
            return {
                ...meta,
                gridSpan: meta.grid_span || meta.gridSpan || 'col-span-1',
                colorTheme: meta.color_theme || meta.colorTheme || 'theme-productivity',
                data: mappedData
            };
        }

        const mappedData = WidgetDataMapper.map(widgetType, result.data);
        const componentCode = await this.widgetRenderer.getCompiledCode(definition.id, definition.category);

        return {
            id: widgetMetadata.id,
            type: definition.id,
            title: widgetMetadata.title || definition.title || widgetType,
            gridSpan: widgetMetadata.grid_span || widgetMetadata.gridSpan || definition.grid_span || 'col-span-1',
            colorTheme: widgetMetadata.color_theme || widgetMetadata.colorTheme || definition.color_theme || 'theme-productivity',
            data: mappedData,
            results: result.data,
            isMock: (Array.isArray(result.data) && result.data.length === 0),
            componentCode
        };
    }
}
