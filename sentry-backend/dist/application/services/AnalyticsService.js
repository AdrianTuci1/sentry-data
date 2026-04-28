"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const crypto_1 = require("crypto");
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
    constructor(projectRepository, sourceRepository, widgetService, _widgetRenderer, objectStorageService, r2StorageService) {
        this.projectRepository = projectRepository;
        this.sourceRepository = sourceRepository;
        this.widgetService = widgetService;
        this.objectStorageService = objectStorageService;
        this.r2StorageService = r2StorageService;
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
    normalizeWidgetPayload(mappedData, rawRows = []) {
        if (mappedData && typeof mappedData === 'object' && !Array.isArray(mappedData)) {
            return {
                data: mappedData.data !== undefined ? mappedData.data : mappedData,
                results: Array.isArray(mappedData.results) ? mappedData.results : rawRows
            };
        }
        return {
            data: mappedData,
            results: rawRows
        };
    }
    normalizeDashboardInstances(widgets = []) {
        const seenIds = new Map();
        return widgets.map((widget, index) => {
            const baseId = String(widget?.id
                || widget?.widgetInstanceId
                || widget?.runtimeWidgetId
                || widget?.type
                || widget?.widget_type
                || `widget-${index + 1}`).trim();
            const duplicateCount = (seenIds.get(baseId) || 0) + 1;
            seenIds.set(baseId, duplicateCount);
            const instanceId = duplicateCount === 1 ? baseId : `${baseId}--${duplicateCount}`;
            return {
                ...widget,
                id: instanceId,
                runtimeWidgetId: widget?.runtimeWidgetId || baseId,
                widgetInstanceId: widget?.widgetInstanceId || instanceId
            };
        });
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
            const workerResult = await this.executeQueriesWithCache(tenantId, project, project.queryConfigs);
            const rawMetadata = project.discoveryMetadata?.insight || project.discoveryMetadata?.dashboards || [];
            const metadataDashboards = this.normalizeDashboardInstances(WidgetDataMapper_1.WidgetDataMapper.unmarshall(rawMetadata) || []);
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
                const runtimeWidgetId = widget.runtimeWidgetId || widget.id;
                const result = workerResult?.results?.find((r) => r?.widgetId === runtimeWidgetId);
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
                const mappedData = WidgetDataMapper_1.WidgetDataMapper.map(widgetType, result.data, definition);
                const normalizedPayload = this.normalizeWidgetPayload(mappedData, result.data);
                return {
                    ...baseWidget,
                    data: normalizedPayload.data,
                    results: normalizedPayload.results,
                    isMock: false,
                    latency: result.latency_ms,
                    cache: {
                        hit: result.cache_hit === true,
                        uri: result.cache_uri,
                        cachedAt: result.cached_at,
                        queryHash: result.query_hash
                    }
                };
            }));
            return {
                tenantId,
                projectId,
                dashboards: enrichedDashboards,
                queryExecution: workerResult.observability
            };
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
        const workerRes = await this.executeQueriesWithCache(tenantId, project, [queryConfig]);
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
            const mappedData = WidgetDataMapper_1.WidgetDataMapper.map(widgetType, result?.data || [], undefined);
            const normalizedPayload = this.normalizeWidgetPayload(mappedData, result?.data || []);
            const meta = (widgetMetadata || {});
            return {
                ...this.buildWidgetShell(meta),
                data: normalizedPayload.data,
                results: normalizedPayload.results,
                isMock: Array.isArray(result?.data) && result.data.length === 0
            };
        }
        const mappedData = WidgetDataMapper_1.WidgetDataMapper.map(widgetType, result.data, definition);
        const normalizedPayload = this.normalizeWidgetPayload(mappedData, result.data);
        return {
            id: widgetMetadata.id,
            type: definition.id,
            title: widgetMetadata.title || definition.title || widgetType,
            gridSpan: widgetMetadata.grid_span || widgetMetadata.gridSpan || definition.grid_span || 'col-span-1',
            colorTheme: widgetMetadata.color_theme || widgetMetadata.colorTheme || definition.color_theme || 'theme-productivity',
            data: normalizedPayload.data,
            results: normalizedPayload.results,
            isMock: (Array.isArray(result.data) && result.data.length === 0),
            cache: {
                hit: result.cache_hit === true,
                uri: result.cache_uri,
                cachedAt: result.cached_at,
                queryHash: result.query_hash
            }
        };
    }
    async executeQueriesWithCache(tenantId, project, queryConfigs) {
        const querySpecs = this.extractQuerySpecs(project.discoveryMetadata);
        const cachedResults = [];
        const workerQueries = [];
        const observability = [];
        const projectId = project.projectId;
        for (const queryConfig of queryConfigs) {
            const querySpec = this.findQuerySpec(querySpecs, queryConfig.widgetId);
            const baseObservation = {
                widgetId: queryConfig.widgetId,
                queryId: querySpec?.queryId,
                executionMode: querySpec?.executionPolicy.mode || 'direct',
                refreshStrategy: querySpec?.executionPolicy.refreshStrategy || 'always',
                inputFingerprint: querySpec?.inputFingerprint,
                queryHash: querySpec?.queryHash,
                cacheEligible: this.isCacheEligible(querySpec)
            };
            if (this.isCacheEligible(querySpec)) {
                const cached = await this.loadCachedQueryResult(tenantId, projectId, querySpec);
                if (cached) {
                    cachedResults.push(cached.result);
                    observability.push({
                        ...baseObservation,
                        cacheHit: true,
                        cacheUri: cached.uri,
                        executedBy: 'r2_query_result_cache'
                    });
                    continue;
                }
            }
            workerQueries.push(queryConfig);
            observability.push({
                ...baseObservation,
                cacheHit: false,
                executedBy: 'analytics_worker'
            });
        }
        let workerResults = [];
        if (workerQueries.length > 0) {
            const storageConfig = await this.resolveWorkerStorageConfig(tenantId, projectId);
            const duckdbLease = await this.createDuckDbLease(storageConfig).catch((error) => {
                console.warn(`[AnalyticsService] DuckDB lease unavailable, falling back to direct execute: ${error.message}`);
                return undefined;
            });
            const response = await fetch(this.analyticsWorkerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': this.workerSecret
                },
                body: JSON.stringify({
                    tenantId,
                    projectId,
                    queries: workerQueries,
                    storageConfig,
                    duckdbLeaseId: duckdbLease?.leaseId,
                    leaseTtlSeconds: 900
                })
            });
            if (!response.ok)
                throw new Error(`Worker Failed: ${response.status}`);
            const workerResult = await response.json() || { results: [] };
            workerResults = Array.isArray(workerResult.results) ? workerResult.results : [];
            const activeLeaseId = workerResult.lease?.leaseId || duckdbLease?.leaseId;
            if (activeLeaseId) {
                for (const observation of observability) {
                    if (observation.executedBy === 'analytics_worker' && !observation.cacheHit) {
                        observation.duckdbLeaseId = activeLeaseId;
                    }
                }
            }
            for (const result of workerResults) {
                const querySpec = this.findQuerySpec(querySpecs, result?.widgetId);
                if (!this.isCacheEligible(querySpec) || result?.error) {
                    continue;
                }
                const cached = await this.saveCachedQueryResult(tenantId, projectId, querySpec, result);
                result.cache_hit = false;
                result.cache_uri = cached.uri;
                result.cached_at = cached.cachedAt;
                result.query_hash = querySpec.queryHash;
                const observation = observability.find((item) => item.widgetId === result.widgetId);
                if (observation) {
                    observation.cacheUri = cached.uri;
                    observation.cachedAt = cached.cachedAt;
                    observation.duckdbLeaseId = activeLeaseId;
                }
            }
        }
        return {
            results: [...cachedResults, ...workerResults],
            observability
        };
    }
    extractQuerySpecs(discoveryMetadata) {
        if (!discoveryMetadata)
            return [];
        if (Array.isArray(discoveryMetadata.querySpecs)) {
            return discoveryMetadata.querySpecs;
        }
        if (Array.isArray(discoveryMetadata.projectionPlan?.querySpecs)) {
            return discoveryMetadata.projectionPlan.querySpecs;
        }
        return [];
    }
    async createDuckDbLease(storageConfig) {
        const leaseUrl = this.resolveWorkerPath('/runtime/lease');
        const response = await fetch(leaseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': this.workerSecret
            },
            body: JSON.stringify({
                storageConfig,
                ttlSeconds: 900
            })
        });
        if (!response.ok) {
            throw new Error(`duckdb_lease_${response.status}`);
        }
        return response.json();
    }
    resolveWorkerPath(path) {
        const baseUrl = this.analyticsWorkerUrl.replace(/\/execute\/?$/, '').replace(/\/+$/, '');
        return `${baseUrl}${path}`;
    }
    findQuerySpec(querySpecs, widgetId) {
        return querySpecs.find((querySpec) => querySpec.widgetId === widgetId || querySpec.queryId === widgetId);
    }
    isCacheEligible(querySpec) {
        return Boolean(querySpec && querySpec.status === 'active' && querySpec.executionPolicy.mode !== 'direct');
    }
    async loadCachedQueryResult(tenantId, projectId, querySpec) {
        const cacheKey = this.buildQueryCacheKey(querySpec);
        const key = this.r2StorageService.getS3Key(tenantId, projectId, 'queries', 'cache', querySpec.queryId, `${cacheKey}.json`);
        const uri = this.r2StorageService.getS3Uri(tenantId, projectId, 'queries', 'cache', querySpec.queryId, `${cacheKey}.json`);
        try {
            const cached = await this.r2StorageService.getJsonIfExists(key);
            if (!cached) {
                return null;
            }
            if (cached.queryHash !== querySpec.queryHash || cached.inputFingerprint !== querySpec.inputFingerprint) {
                return null;
            }
            return {
                uri,
                result: {
                    widgetId: querySpec.widgetId,
                    data: cached.data || [],
                    latency_ms: cached.latency_ms,
                    cache_hit: true,
                    cache_uri: uri,
                    cached_at: cached.cachedAt,
                    query_hash: querySpec.queryHash
                }
            };
        }
        catch {
            return null;
        }
    }
    async saveCachedQueryResult(tenantId, projectId, querySpec, result) {
        const cachedAt = new Date().toISOString();
        const cacheKey = this.buildQueryCacheKey(querySpec);
        const document = {
            version: 1,
            tenantId,
            projectId,
            queryId: querySpec.queryId,
            widgetId: querySpec.widgetId,
            queryHash: querySpec.queryHash,
            inputFingerprint: querySpec.inputFingerprint,
            executionPolicy: querySpec.executionPolicy,
            latency_ms: result.latency_ms,
            rowCount: Array.isArray(result.data) ? result.data.length : 0,
            data: result.data || [],
            cachedAt
        };
        const saved = await this.r2StorageService.saveJson(tenantId, projectId, 'queries', document, 'cache', querySpec.queryId, `${cacheKey}.json`);
        return {
            uri: saved.uri,
            cachedAt
        };
    }
    buildQueryCacheKey(querySpec) {
        const hash = (0, crypto_1.createHash)('sha256');
        hash.update(JSON.stringify({
            queryHash: querySpec.queryHash,
            inputFingerprint: querySpec.inputFingerprint
        }));
        return hash.digest('hex');
    }
    async resolveWorkerStorageConfig(tenantId, projectId) {
        const sources = await this.sourceRepository.findAllForProject(tenantId, projectId);
        return this.objectStorageService.resolveSharedWorkerStorageConfig(sources);
    }
}
exports.AnalyticsService = AnalyticsService;
