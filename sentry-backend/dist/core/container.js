"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initContainer = initContainer;
const DynamoDBClient_1 = require("../infrastructure/database/DynamoDBClient");
const ProjectRepository_1 = require("../infrastructure/repositories/ProjectRepository");
const TenantRepository_1 = require("../infrastructure/repositories/TenantRepository");
const SourceRepository_1 = require("../infrastructure/repositories/SourceRepository");
const AnalyticsService_1 = require("../application/services/AnalyticsService");
const WidgetService_1 = require("../application/services/WidgetService");
const WidgetRenderer_1 = require("../application/utils/WidgetRenderer");
const AuthService_1 = require("../application/services/AuthService");
const DashboardController_1 = require("../api/controllers/DashboardController");
const HealthController_1 = require("../api/controllers/HealthController");
const ProjectController_1 = require("../api/controllers/ProjectController");
const SSEManager_1 = require("../services/sse/SSEManager");
const SSEController_1 = require("../api/controllers/SSEController");
const config_1 = require("../config");
// External Providers & Services
const R2StorageService_1 = require("../infrastructure/storage/R2StorageService");
const OrchestrationService_1 = require("../application/services/OrchestrationService");
const WebhookController_1 = require("../api/controllers/WebhookController");
const ParrotNeuralEngineService_1 = require("../application/services/ParrotNeuralEngineService");
const ParrotProgressService_1 = require("../application/services/ParrotProgressService");
const ReverseEtlHeadService_1 = require("../application/services/ReverseEtlHeadService");
const ParrotRuntimeService_1 = require("../application/services/ParrotRuntimeService");
const SentinelClient_1 = require("../application/services/SentinelClient");
const BronzeDiscoveryService_1 = require("../application/services/BronzeDiscoveryService");
const MindMapManifestService_1 = require("../application/services/MindMapManifestService");
const WorkloadPlannerService_1 = require("../application/services/WorkloadPlannerService");
const ExecutionPlaneService_1 = require("../application/services/ExecutionPlaneService");
const ModalExecutionProvider_1 = require("../application/execution/ModalExecutionProvider");
const RayDaftExecutionProvider_1 = require("../application/execution/RayDaftExecutionProvider");
const RuntimeOrchestratorService_1 = require("../application/services/RuntimeOrchestratorService");
const ObjectStorageService_1 = require("../application/services/ObjectStorageService");
const ProjectionRegistryService_1 = require("../application/services/ProjectionRegistryService");
const SourceUpdateMonitorService_1 = require("../application/services/SourceUpdateMonitorService");
const ConnectorCatalogService_1 = require("../application/services/ConnectorCatalogService");
function initContainer() {
    console.log('[DI Container] Bootstrapping Application dependencies...');
    const dynamoTable = config_1.config.aws.dynamoTable;
    // 1. Initialize Singletons & Database
    const projectRepo = new ProjectRepository_1.ProjectRepository(DynamoDBClient_1.dynamoDbDocumentClient, dynamoTable);
    const tenantRepo = new TenantRepository_1.TenantRepository(DynamoDBClient_1.dynamoDbDocumentClient, dynamoTable);
    const sourceRepo = new SourceRepository_1.SourceRepository(DynamoDBClient_1.dynamoDbDocumentClient, dynamoTable);
    const sseManager = new SSEManager_1.SSEManager();
    // 2. Initialize Infrastructure Providers
    const r2StorageService = new R2StorageService_1.R2StorageService();
    const objectStorageService = new ObjectStorageService_1.ObjectStorageService();
    const connectorCatalogService = new ConnectorCatalogService_1.ConnectorCatalogService();
    // 3. Initialize Domain Services 
    const authService = new AuthService_1.AuthService(tenantRepo);
    const widgetService = new WidgetService_1.WidgetService(r2StorageService);
    const widgetRenderer = new WidgetRenderer_1.WidgetRenderer(r2StorageService);
    const analyticsService = new AnalyticsService_1.AnalyticsService(projectRepo, sourceRepo, widgetService, widgetRenderer, objectStorageService);
    const sentinelClient = new SentinelClient_1.SentinelClient();
    const parrotNeuralEngineService = new ParrotNeuralEngineService_1.ParrotNeuralEngineService();
    const parrotProgressService = new ParrotProgressService_1.ParrotProgressService(r2StorageService);
    const reverseEtlHeadService = new ReverseEtlHeadService_1.ReverseEtlHeadService();
    const bronzeDiscoveryService = new BronzeDiscoveryService_1.BronzeDiscoveryService(r2StorageService, objectStorageService, connectorCatalogService);
    const mindMapManifestService = new MindMapManifestService_1.MindMapManifestService();
    const workloadPlannerService = new WorkloadPlannerService_1.WorkloadPlannerService();
    const projectionRegistryService = new ProjectionRegistryService_1.ProjectionRegistryService(r2StorageService);
    const modalExecutionProvider = new ModalExecutionProvider_1.ModalExecutionProvider();
    const rayDaftExecutionProvider = new RayDaftExecutionProvider_1.RayDaftExecutionProvider();
    const executionPlaneService = new ExecutionPlaneService_1.ExecutionPlaneService([
        modalExecutionProvider,
        rayDaftExecutionProvider
    ]);
    const parrotRuntimeService = new ParrotRuntimeService_1.ParrotRuntimeService(parrotNeuralEngineService, parrotProgressService, reverseEtlHeadService, sentinelClient, projectRepo, sseManager);
    const orchestrationService = new OrchestrationService_1.OrchestrationService(projectRepo, sseManager, parrotRuntimeService, bronzeDiscoveryService, mindMapManifestService, parrotProgressService, workloadPlannerService, executionPlaneService, projectionRegistryService);
    const runtimeOrchestratorService = new RuntimeOrchestratorService_1.RuntimeOrchestratorService(orchestrationService, sourceRepo);
    const sourceUpdateMonitorService = new SourceUpdateMonitorService_1.SourceUpdateMonitorService(sourceRepo, objectStorageService, orchestrationService);
    // 4. Initialize Controllers
    // Controllers are standalone objects that will be passed into the App class
    const healthController = new HealthController_1.HealthController();
    const dashboardController = new DashboardController_1.DashboardController(analyticsService, authService);
    const sseController = new SSEController_1.SSEController(sseManager, authService);
    const webhookController = new WebhookController_1.WebhookController(runtimeOrchestratorService);
    const projectController = new ProjectController_1.ProjectController(orchestrationService, analyticsService, authService, projectRepo, sourceRepo, objectStorageService, sourceUpdateMonitorService, connectorCatalogService);
    const controllers = [
        healthController,
        dashboardController,
        sseController,
        webhookController,
        projectController
    ];
    console.log('[DI Container] Dependencies wired successfully.');
    return {
        controllers,
        // Exporting instances could be useful for manual testing/scripts
        instances: {
            healthController,
            dashboardController,
            sseController,
            webhookController,
            projectController,
            analyticsService,
            authService,
            runtimeOrchestratorService,
            orchestrationService,
            projectRepo,
            tenantRepo,
            sourceRepo,
            sseManager,
            r2StorageService,
            objectStorageService,
            connectorCatalogService,
            parrotRuntimeService,
            bronzeDiscoveryService,
            mindMapManifestService,
            workloadPlannerService,
            executionPlaneService,
            projectionRegistryService,
            sourceUpdateMonitorService
        }
    };
}
