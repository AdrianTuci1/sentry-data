"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initContainer = initContainer;
const DynamoDBClient_1 = require("../infrastructure/database/DynamoDBClient");
const ProjectRepository_1 = require("../infrastructure/repositories/ProjectRepository");
const TenantRepository_1 = require("../infrastructure/repositories/TenantRepository");
const AnalyticsService_1 = require("../application/services/AnalyticsService");
const AuthService_1 = require("../application/services/AuthService");
const DashboardController_1 = require("../api/controllers/DashboardController");
const HealthController_1 = require("../api/controllers/HealthController");
const SSEManager_1 = require("../services/sse/SSEManager");
const SSEController_1 = require("../api/controllers/SSEController");
const config_1 = require("../config");
const E2BSandboxProvider_1 = require("../infrastructure/providers/E2BSandboxProvider");
const ModalSandboxProvider_1 = require("../infrastructure/providers/ModalSandboxProvider");
const ModalInferenceProvider_1 = require("../infrastructure/providers/ModalInferenceProvider");
const R2StorageService_1 = require("../infrastructure/storage/R2StorageService");
const AgentService_1 = require("../application/services/AgentService");
const PipelineOrchestratorService_1 = require("../application/services/PipelineOrchestratorService");
const WebhookController_1 = require("../api/controllers/WebhookController");
function initContainer() {
    console.log('[DI Container] Bootstrapping Application dependencies...');
    const dynamoTable = config_1.config.aws.dynamoTable;
    // 1. Initialize Singletons & Database
    const projectRepo = new ProjectRepository_1.ProjectRepository(DynamoDBClient_1.dynamoDbDocumentClient, dynamoTable);
    const tenantRepo = new TenantRepository_1.TenantRepository(DynamoDBClient_1.dynamoDbDocumentClient, dynamoTable);
    const sseManager = new SSEManager_1.SSEManager();
    // 2. Initialize Infrastructure Providers
    const r2StorageService = new R2StorageService_1.R2StorageService();
    const modalInferenceProvider = new ModalInferenceProvider_1.ModalInferenceProvider();
    // Choose the active sandbox provider via strategy pattern
    let sandboxProvider;
    if (config_1.config.providers.sandbox === 'modal') {
        sandboxProvider = new ModalSandboxProvider_1.ModalSandboxProvider();
    }
    else {
        sandboxProvider = new E2BSandboxProvider_1.E2BSandboxProvider();
    }
    // 3. Initialize Domain Services 
    const authService = new AuthService_1.AuthService(tenantRepo);
    const analyticsService = new AnalyticsService_1.AnalyticsService(projectRepo);
    const agentService = new AgentService_1.AgentService(sandboxProvider, projectRepo);
    const pipelineOrchestratorService = new PipelineOrchestratorService_1.PipelineOrchestratorService(sandboxProvider, r2StorageService, agentService);
    // 4. Initialize Controllers
    // Controllers are standalone objects that will be passed into the App class
    const healthController = new HealthController_1.HealthController();
    const dashboardController = new DashboardController_1.DashboardController(analyticsService, authService);
    const sseController = new SSEController_1.SSEController(sseManager, authService);
    const webhookController = new WebhookController_1.WebhookController(pipelineOrchestratorService);
    const controllers = [
        healthController,
        dashboardController,
        sseController,
        webhookController
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
            analyticsService,
            authService,
            pipelineOrchestratorService,
            projectRepo,
            tenantRepo,
            sseManager,
            r2StorageService,
            modalInferenceProvider,
            sandboxProvider
        }
    };
}
