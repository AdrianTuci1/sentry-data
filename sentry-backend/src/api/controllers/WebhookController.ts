import { Request, Response, NextFunction } from 'express';
import { IController } from './IController';
import { Router } from 'express';
import { RuntimeOrchestratorService } from '../../application/services/RuntimeOrchestratorService';
import crypto from 'crypto';
import { config } from '../../config';

export class WebhookController implements IController {
    public path = '/webhooks';
    public router = Router();
    private orchestrator: RuntimeOrchestratorService;

    // Dependency Injection via Constructor
    constructor(orchestrator: RuntimeOrchestratorService) {
        this.orchestrator = orchestrator;
        this.initRoutes();
    }

    public initRoutes() {
        this.router.post('/meltano', this.validateSignature, this.handleMeltanoEvent);
        this.router.post('/agent', this.handleAgentCallback);
    }

    /**
     * Optional HMAC signature validation for webhook security.
     * Expects header: x-webhook-signature = HMAC-SHA256(body, INTERNAL_API_SECRET)
     * Skipped if no signature header is present (dev mode).
     */
    private validateSignature = (req: Request, res: Response, next: NextFunction) => {
        const signature = req.headers['x-webhook-signature'] as string | undefined;

        // In development, skip validation if no signature is provided
        if (!signature) {
            console.warn('[Webhook] No x-webhook-signature header — skipping HMAC validation (dev mode).');
            return next();
        }

        const secret = config.worker.secret;
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        try {
            const sigBuffer = Buffer.from(signature, 'hex');
            const expectedBuffer = Buffer.from(expectedSignature, 'hex');

            if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
                res.status(401).json({ error: 'Invalid webhook signature' });
                return;
            }
        } catch (e) {
            res.status(401).json({ error: 'Invalid webhook signature format' });
            return;
        }

        next();
    };

    private handleMeltanoEvent = async (req: Request, res: Response, next: NextFunction) => {
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
        } catch (error) {
            next(error);
        }
    };

    private handleAgentCallback = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Endpoints where long-running agents callback into the system with results
            res.status(200).json({ status: 'received' });
        } catch (error) {
            next(error);
        }
    };
}
