import { dynamoDbDocumentClient } from '../infrastructure/database/DynamoDBClient';
import { ProjectRepository } from '../infrastructure/repositories/ProjectRepository';
import { TenantRepository } from '../infrastructure/repositories/TenantRepository';
import { SourceRepository } from '../infrastructure/repositories/SourceRepository';
import { AnalyticsService } from '../application/services/AnalyticsService';
import { WidgetService } from '../application/services/WidgetService';
import { WidgetRenderer } from '../application/utils/WidgetRenderer';
import { AuthService } from '../application/services/AuthService';
import { DashboardController } from '../api/controllers/DashboardController';
import { HealthController } from '../api/controllers/HealthController';
import { ProjectController } from '../api/controllers/ProjectController';
import { SSEManager } from '../services/sse/SSEManager';
import { SSEController } from '../api/controllers/SSEController';
import { config } from '../config';

// External Providers & Services
import { R2StorageService } from '../infrastructure/storage/R2StorageService';
import { OrchestrationService } from '../application/services/OrchestrationService';
import { WebhookController } from '../api/controllers/WebhookController';
import { ParrotNeuralEngineService } from '../application/services/ParrotNeuralEngineService';
import { ParrotProgressService } from '../application/services/ParrotProgressService';
import { ReverseEtlHeadService } from '../application/services/ReverseEtlHeadService';
import { ParrotRuntimeService } from '../application/services/ParrotRuntimeService';
import { SentinelClient } from '../application/services/SentinelClient';
import { BronzeDiscoveryService } from '../application/services/BronzeDiscoveryService';
import { MindMapManifestService } from '../application/services/MindMapManifestService';
import { WorkloadPlannerService } from '../application/services/WorkloadPlannerService';
import { ExecutionPlaneService } from '../application/services/ExecutionPlaneService';
import { ModalExecutionProvider } from '../application/execution/ModalExecutionProvider';
import { RayDaftExecutionProvider } from '../application/execution/RayDaftExecutionProvider';
import { RuntimeOrchestratorService } from '../application/services/RuntimeOrchestratorService';

export function initContainer() {
    console.log('[DI Container] Bootstrapping Application dependencies...');

    const dynamoTable = config.aws.dynamoTable;

    // 1. Initialize Singletons & Database
    const projectRepo = new ProjectRepository(dynamoDbDocumentClient, dynamoTable);
    const tenantRepo = new TenantRepository(dynamoDbDocumentClient, dynamoTable);
    const sourceRepo = new SourceRepository(dynamoDbDocumentClient, dynamoTable);
    const sseManager = new SSEManager();

    // 2. Initialize Infrastructure Providers
    const r2StorageService = new R2StorageService();

    // 3. Initialize Domain Services 
    const authService = new AuthService(tenantRepo);
    const widgetService = new WidgetService(r2StorageService);
    const widgetRenderer = new WidgetRenderer(r2StorageService);
    const analyticsService = new AnalyticsService(projectRepo, widgetService, widgetRenderer);
    const sentinelClient = new SentinelClient();
    const parrotNeuralEngineService = new ParrotNeuralEngineService();
    const parrotProgressService = new ParrotProgressService(r2StorageService);
    const reverseEtlHeadService = new ReverseEtlHeadService();
    const bronzeDiscoveryService = new BronzeDiscoveryService(r2StorageService);
    const mindMapManifestService = new MindMapManifestService();
    const workloadPlannerService = new WorkloadPlannerService();
    const modalExecutionProvider = new ModalExecutionProvider();
    const rayDaftExecutionProvider = new RayDaftExecutionProvider();
    const executionPlaneService = new ExecutionPlaneService([
        modalExecutionProvider,
        rayDaftExecutionProvider
    ]);
    const parrotRuntimeService = new ParrotRuntimeService(
        parrotNeuralEngineService,
        parrotProgressService,
        reverseEtlHeadService,
        sentinelClient,
        projectRepo,
        sseManager
    );
    
    const orchestrationService = new OrchestrationService(
        projectRepo,
        sseManager,
        parrotRuntimeService,
        bronzeDiscoveryService,
        mindMapManifestService,
        parrotProgressService,
        workloadPlannerService,
        executionPlaneService
    );
    
    const runtimeOrchestratorService = new RuntimeOrchestratorService(orchestrationService, sourceRepo);

    // 4. Initialize Controllers
    // Controllers are standalone objects that will be passed into the App class
    const healthController = new HealthController();
    const dashboardController = new DashboardController(analyticsService, authService);
    const sseController = new SSEController(sseManager, authService);
    const webhookController = new WebhookController(runtimeOrchestratorService);
    const projectController = new ProjectController(orchestrationService, analyticsService, authService, projectRepo, sourceRepo);

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
            parrotRuntimeService,
            bronzeDiscoveryService,
            mindMapManifestService,
            workloadPlannerService,
            executionPlaneService
        }
    };
}
