import { Request, Response, NextFunction } from 'express';
import { IController } from './IController';
import { Router } from 'express';
import { PipelineOrchestratorService } from '../../application/services/PipelineOrchestratorService';

export class WebhookController implements IController {
    public path = '/webhooks';
    public router = Router();
    private orchestrator: PipelineOrchestratorService;

    // Dependency Injection via Constructor
    constructor(orchestrator: PipelineOrchestratorService) {
        this.orchestrator = orchestrator;
        this.initRoutes();
    }

    public initRoutes() {
        this.router.post('/meltano', this.handleMeltanoEvent);
        this.router.post('/agent', this.handleAgentCallback);
    }

    private handleMeltanoEvent = async (req: Request, res: Response, next: NextFunction) => {
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
