import { dynamoDbDocumentClient } from '../infrastructure/database/DynamoDBClient';
import { ProjectRepository } from '../infrastructure/repositories/ProjectRepository';
import { TenantRepository } from '../infrastructure/repositories/TenantRepository';
import { AnalyticsService } from '../application/services/AnalyticsService';
import { AuthService } from '../application/services/AuthService';
import { DashboardController } from '../api/controllers/DashboardController';
import { HealthController } from '../api/controllers/HealthController';
import { ProjectController } from '../api/controllers/ProjectController';
import { SSEManager } from '../services/sse/SSEManager';
import { SSEController } from '../api/controllers/SSEController';
import { config } from '../config';

// External Providers & Services
import { ISandboxProvider } from '../infrastructure/providers/ISandboxProvider';
import { E2BSandboxProvider } from '../infrastructure/providers/E2BSandboxProvider';
import { ModalSandboxProvider } from '../infrastructure/providers/ModalSandboxProvider';
import { ModalInferenceProvider } from '../infrastructure/providers/ModalInferenceProvider';
import { R2StorageService } from '../infrastructure/storage/R2StorageService';
import { PipelineOrchestratorService } from '../application/services/PipelineOrchestratorService';
import { OrchestrationService } from '../application/services/OrchestrationService';
import { WebhookController } from '../api/controllers/WebhookController';

export function initContainer() {
    console.log('[DI Container] Bootstrapping Application dependencies...');

    const dynamoTable = config.aws.dynamoTable;

    // 1. Initialize Singletons & Database
    const projectRepo = new ProjectRepository(dynamoDbDocumentClient, dynamoTable);
    const tenantRepo = new TenantRepository(dynamoDbDocumentClient, dynamoTable);
    const sseManager = new SSEManager();

    // 2. Initialize Infrastructure Providers
    const r2StorageService = new R2StorageService();
    const modalInferenceProvider = new ModalInferenceProvider();

    // Choose the active sandbox provider via strategy pattern
    let sandboxProvider: ISandboxProvider;
    if (config.providers.sandbox === 'modal') {
        sandboxProvider = new ModalSandboxProvider();
    } else {
        sandboxProvider = new E2BSandboxProvider();
    }

    // 3. Initialize Domain Services 
    const authService = new AuthService(tenantRepo);
    const analyticsService = new AnalyticsService(projectRepo);
    const orchestrationService = new OrchestrationService(sandboxProvider, projectRepo, r2StorageService, sseManager);
    const pipelineOrchestratorService = new PipelineOrchestratorService(orchestrationService);

    // 4. Initialize Controllers
    // Controllers are standalone objects that will be passed into the App class
    const healthController = new HealthController();
    const dashboardController = new DashboardController(analyticsService, authService);
    const sseController = new SSEController(sseManager, authService);
    const webhookController = new WebhookController(pipelineOrchestratorService);
    const projectController = new ProjectController(orchestrationService, authService, projectRepo);

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
            pipelineOrchestratorService,
            orchestrationService,
            projectRepo,
            tenantRepo,
            sseManager,
            r2StorageService,
            modalInferenceProvider,
            sandboxProvider
        }
    };
}
