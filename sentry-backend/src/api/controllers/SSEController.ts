import { Request, Response, NextFunction } from 'express';
import { IController } from './IController';
import { Router } from 'express';
import { SSEManager } from '../../services/sse/SSEManager';
import { requireAuth } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import { AuthService } from '../../application/services/AuthService';

export class SSEController implements IController {
    public path = '/events';
    public router = Router();
    private sseManager: SSEManager;
    private authService: AuthService;

    // Dependency Injection via Constructor
    constructor(sseManager: SSEManager, authService: AuthService) {
        this.sseManager = sseManager;
        this.authService = authService;
        this.initRoutes();
    }

    public initRoutes() {
        // Protect the SSE endpoint (ensure client is valid before holding the connection open)
        const authMiddleware = requireAuth(this.authService);
        this.router.get('/', authMiddleware, this.connectClient);
    }

    private connectClient = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.tenantId;

            if (!tenantId) {
                throw new AppError('Server error: Tenant ID not present after auth.', 500);
            }

            // Register the response socket strictly inside the SSE manager
            this.sseManager.addClient(tenantId, req, res);

            // Note: We do NOT call `res.end()` or `res.send()` here. 
            // The connection is intentionally left hanging.
        } catch (error) {
            next(error);
        }
    };
}
