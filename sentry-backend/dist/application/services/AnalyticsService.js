"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const WidgetDataMapper_1 = require("../utils/WidgetDataMapper");
// Debugging Tasks:
// - [x] Debug "fetch failed" / "401 Unauthorized" in `AnalyticsService`
// - [x] Transition to Client-Side Component Rendering
// - [/] Debug "Waiting for components..." / Empty Cache (0 widgets)
//     - [x] Add debug logs to backend and frontend
//     - [/] Fix R2 `listPrefixGroups` logic
//     - [ ] Verify R2 object existence for components
// - [ ] Final Verification
class AnalyticsService {
    constructor(projectRepository, sourceRepository, widgetService, _widgetRenderer, objectStorageService) {
        this.projectRepository = projectRepository;
        this.sourceRepository = sourceRepository;
        this.widgetService = widgetService;
        this.objectStorageService = objectStorageService;
        // Internal worker connection details
        this.analyticsWorkerUrl = process.env.ANALYTICS_WORKER_URL || 'http://localhost:4000/execute';
        this.workerSecret = process.env.INTERNAL_API_SECRET || 'secret';
    }
    async buildCatalogDashboards() {
        const catalog = await this.widgetService.getCatalog();
        return catalog.map((widget) => ({
            id: widget.id,
            type: widget.id,
            title: widget.title || widget.id,
            description: widget.description,
            category: widget.category,
            gridSpan: widget.grid_span || widget.gridSpan || 'col-span-1',
            colorTheme: widget.color_theme || widget.colorTheme || 'theme-productivity',
            isMock: true,
            data: widget.data_structure_template || {}
        }));
    }
    buildWidgetShell(widget, definition) {
        const widgetType = widget?.type || widget?.widget_type || definition?.id || widget?.id;
        return {
            ...widget,
            type: widgetType,
            title: widget?.title || definition?.title || widgetType,
            gridSpan: widget?.grid_span || widget?.gridSpan || definition?.grid_span || 'col-span-1',
            colorTheme: widget?.color_theme || widget?.colorTheme || definition?.color_theme || 'theme-productivity'
        };
    }
    /**
     * The core orchestration method (Global snapshot).
     */
    async getDashboardData(tenantId, projectId) {
        const project = await this.projectRepository.findById(tenantId, projectId);
        if (!project)
            throw new Error(`Project ${projectId} not found.`);
        if (!project.queryConfigs || project.queryConfigs.length === 0) {
            // If project is fresh (just seeded), return the catalog as 'discovery' widgets
            const enrichedDashboards = await this.buildCatalogDashboards();
            return { tenantId, projectId, status: 'discovery', dashboards: enrichedDashboards };
        }
        try {
            const storageConfig = await this.resolveWorkerStorageConfig(tenantId, projectId);
            const response = await fetch(this.analyticsWorkerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': this.workerSecret
                },
                body: JSON.stringify({ tenantId, projectId, queries: project.queryConfigs, storageConfig })
            });
            if (!response.ok)
                throw new Error(`Worker Failed: ${response.status}`);
            const workerResult = await response.json() || { results: [] };
            const rawMetadata = project.discoveryMetadata?.insight || project.discoveryMetadata?.dashboards || [];
            const metadataDashboards = WidgetDataMapper_1.WidgetDataMapper.unmarshall(rawMetadata) || [];
            if (Array.isArray(metadataDashboards)) {
                console.log(`[AnalyticsService] Found ${metadataDashboards.length} insight widgets. Types: ${metadataDashboards.map((w) => w?.type || w?.widget_type || 'NO_TYPE').join(', ')}`);
            }
            if (!Array.isArray(metadataDashboards) || metadataDashboards.length === 0) {
                console.warn('[AnalyticsService] No dashboard metadata found. Falling back to widget catalog.');
                const dashboards = await this.buildCatalogDashboards();
                return { tenantId, projectId, status: 'discovery', dashboards };
            }
            const enrichedDashboards = await Promise.all(metadataDashboards.map(async (widget) => {
                if (!widget)
                    return { id: 'err', title: 'Error', isMock: true };
                const result = workerResult?.results?.find((r) => r?.widgetId === widget.id);
                // Resolve widget type: insights may use `type` or `widget_type`
                const widgetType = widget.type || widget.widget_type || widget.id;
                // Get definition to find category, gridSpan, and title
                const definition = await this.widgetService.findWidget(widgetType);
                if (!definition) {
                    console.warn(`[AnalyticsService] No widget definition found for type: "${widgetType}" (widget id: ${widget.id})`);
                }
                const baseWidget = this.buildWidgetShell(widget, definition);
                if (!result || result.error || !result.data || result.data.length === 0) {
                    // If no result, error, or empty data, return base widget with isMock: true 
                    // and serve the template data from manifest.
                    return {
                        ...baseWidget,
                        isMock: true,
                        data: definition?.data_structure_template || {}
                    };
                }
                const mappedData = WidgetDataMapper_1.WidgetDataMapper.map(widgetType, result.data);
                return {
                    ...baseWidget,
                    data: mappedData,
                    isMock: false,
                    latency: result.latency_ms
                };
            }));
            return { tenantId, projectId, dashboards: enrichedDashboards };
        }
        catch (error) {
            console.error(`[AnalyticsService] Error:`, error.message);
            throw new Error(`Failed to generate data: ${error.message}`);
        }
    }
    /**
     * Returns the structural manifest of a dashboard (groups and IDs) without data.
     */
    async getDashboardManifest(tenantId, projectId) {
        const project = await this.projectRepository.findById(tenantId, projectId);
        if (!project)
            throw new Error(`Project ${projectId} not found.`);
        const groups = WidgetDataMapper_1.WidgetDataMapper.unmarshall(project.discoveryMetadata?.group || project.discoveryMetadata?.dashboardGroups || []);
        const insights = WidgetDataMapper_1.WidgetDataMapper.unmarshall(project.discoveryMetadata?.insight || project.discoveryMetadata?.dashboards || []);
        return {
            dashboardGroups: Array.isArray(groups) ? groups : [],
            dashboards: (Array.isArray(insights) ? insights : []).map((d) => ({
                id: d?.id,
                type: d?.type || d?.widget_type,
                title: d?.title,
                gridSpan: d?.gridSpan || d?.grid_span,
                colorTheme: d?.colorTheme || d?.color_theme
            }))
        };
    }
    /**
     * Clears the widget catalog cache.
     */
    reloadWidgets() {
        this.widgetService.clearCache();
    }
    /**
     * Fetches and hydrates a single widget's data.
     */
    async getWidgetDataInstance(tenantId, projectId, widgetId) {
        const project = await this.projectRepository.findById(tenantId, projectId);
        if (!project)
            throw new Error(`Project ${projectId} not found.`);
        const rawMetadata = project.discoveryMetadata?.insight || project.discoveryMetadata?.dashboards || [];
        const metadataArray = WidgetDataMapper_1.WidgetDataMapper.unmarshall(rawMetadata) || [];
        const widgetMetadata = Array.isArray(metadataArray)
            ? metadataArray.find((d) => d?.id === widgetId)
            : null;
        const queryConfig = project.queryConfigs?.find((q) => q?.widgetId === widgetId);
        // If not configured, it might be a direct call for a discovery widget (type preview)
        if (!widgetMetadata || !queryConfig) {
            // First check if widgetId is actually a known TYPE
            const definition = await this.widgetService.findWidget(widgetId);
            if (!definition) {
                throw new Error(`Widget instance or type ${widgetId} not found.`);
            }
            console.log(`[AnalyticsService] Falling back to type preview for ${widgetId}`);
            return {
                id: widgetId,
                type: definition.id,
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
            body: JSON.stringify({
                tenantId,
                projectId,
                queries: [queryConfig],
                storageConfig: await this.resolveWorkerStorageConfig(tenantId, projectId)
            })
        });
        const workerRes = await response.json() || { results: [] };
        const result = workerRes?.results?.[0];
        if (!result)
            throw new Error(`No worker result for ${widgetId}`);
        if (result.error)
            throw new Error(`Query failed for ${widgetId}: ${result.error}`);
        // IMPORTANT: Use the template type for mapping and rendering, not the instance ID
        const widgetType = widgetMetadata.type || widgetMetadata.widget_type || widgetId;
        const definition = await this.widgetService.findWidget(widgetType);
        if (!definition) {
            console.warn(`[AnalyticsService] Definition NOT FOUND for type: ${widgetType}`);
            const mappedData = WidgetDataMapper_1.WidgetDataMapper.map(widgetType, result?.data || []);
            const meta = (widgetMetadata || {});
            return {
                ...this.buildWidgetShell(meta),
                data: mappedData,
                isMock: Array.isArray(result?.data) && result.data.length === 0
            };
        }
        const mappedData = WidgetDataMapper_1.WidgetDataMapper.map(widgetType, result.data);
        return {
            id: widgetMetadata.id,
            type: definition.id,
            title: widgetMetadata.title || definition.title || widgetType,
            gridSpan: widgetMetadata.grid_span || widgetMetadata.gridSpan || definition.grid_span || 'col-span-1',
            colorTheme: widgetMetadata.color_theme || widgetMetadata.colorTheme || definition.color_theme || 'theme-productivity',
            data: mappedData,
            isMock: (Array.isArray(result.data) && result.data.length === 0)
        };
    }
    async resolveWorkerStorageConfig(tenantId, projectId) {
        const sources = await this.sourceRepository.findAllForProject(tenantId, projectId);
        return this.objectStorageService.resolveSharedWorkerStorageConfig(sources);
    }
}
exports.AnalyticsService = AnalyticsService;
