"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../../config");
class WebhookController {
    // Dependency Injection via Constructor
    constructor(orchestrator) {
        this.path = '/webhooks';
        this.router = (0, express_1.Router)();
        /**
         * Optional HMAC signature validation for webhook security.
         * Expects header: x-webhook-signature = HMAC-SHA256(body, INTERNAL_API_SECRET)
         * Skipped if no signature header is present (dev mode).
         */
        this.validateSignature = (req, res, next) => {
            const signature = req.headers['x-webhook-signature'];
            // In development, skip validation if no signature is provided
            if (!signature) {
                console.warn('[Webhook] No x-webhook-signature header — skipping HMAC validation (dev mode).');
                return next();
            }
            const secret = config_1.config.worker.secret;
            const expectedSignature = crypto_1.default
                .createHmac('sha256', secret)
                .update(JSON.stringify(req.body))
                .digest('hex');
            try {
                const sigBuffer = Buffer.from(signature, 'hex');
                const expectedBuffer = Buffer.from(expectedSignature, 'hex');
                if (sigBuffer.length !== expectedBuffer.length || !crypto_1.default.timingSafeEqual(sigBuffer, expectedBuffer)) {
                    res.status(401).json({ error: 'Invalid webhook signature' });
                    return;
                }
            }
            catch (e) {
                res.status(401).json({ error: 'Invalid webhook signature format' });
                return;
            }
            next();
        };
        this.handleMeltanoEvent = async (req, res, next) => {
            try {
                const { tenantId, projectId, s3Path } = req.body;
                if (!tenantId || !projectId || !s3Path) {
                    res.status(400).json({ error: 'Missing tenantId, projectId or s3Path' });
                    return;
                }
                const result = await this.orchestrator.handleIngestionComplete(tenantId, projectId, s3Path);
                res.status(200).json({
                    status: 'success',
                    message: result.status,
                    nextAction: result.nextAction,
                    sourcesLoaded: result.sourcesLoaded
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
        this.router.post('/meltano', this.validateSignature, this.handleMeltanoEvent);
        this.router.post('/agent', this.handleAgentCallback);
    }
}
exports.WebhookController = WebhookController;
