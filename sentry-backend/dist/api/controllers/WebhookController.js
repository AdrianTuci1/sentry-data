"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const express_1 = require("express");
class WebhookController {
    // Dependency Injection via Constructor
    constructor(orchestrator) {
        this.path = '/webhooks';
        this.router = (0, express_1.Router)();
        this.handleMeltanoEvent = async (req, res, next) => {
            try {
                // Note: In reality webhooks should have an external payload HMAC signature check
                const { tenantId, projectId, s3Path } = req.body;
                if (!tenantId || !projectId || !s3Path) {
                    res.status(400).json({ error: 'Missing tenantId, projectId or s3Path' });
                    return;
                }
                const result = await this.orchestrator.handleIngestionComplete(tenantId, projectId, s3Path);
                res.status(200).json({
                    status: 'success',
                    message: result.status,
                    nextAction: result.nextAction
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.handleAgentCallback = async (req, res, next) => {
            try {
                // Endpoints where long-running agents callback into the system with results
                res.status(200).json({ status: 'received' });
            }
            catch (error) {
                next(error);
            }
        };
        this.orchestrator = orchestrator;
        this.initRoutes();
    }
    initRoutes() {
        this.router.post('/meltano', this.handleMeltanoEvent);
        this.router.post('/agent', this.handleAgentCallback);
    }
}
exports.WebhookController = WebhookController;
