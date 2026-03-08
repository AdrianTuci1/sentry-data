import { Request, Response, NextFunction } from 'express';
import { IController } from './IController';
import { Router } from 'express';
import { AnalyticsService } from '../../application/services/AnalyticsService';
import { AuthService } from '../../application/services/AuthService';
import { requireAuth } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';

export class DashboardController implements IController {
    public path = '/dashboard';
    public router = Router();
    private analyticsService: AnalyticsService;
    private authService: AuthService;

    // Dependency Injection via Constructor
    constructor(analyticsService: AnalyticsService, authService: AuthService) {
        this.analyticsService = analyticsService;
        this.authService = authService;
        this.initRoutes();
    }

    public initRoutes() {
        // Protect the Dashboard fetching route
        const authMiddleware = requireAuth(this.authService);
        this.router.get('/:projectId', authMiddleware, this.getDashboard);
    }

    private getDashboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { projectId } = req.params;

            // Extracted securely from the JWT validation middleware
            const tenantId = req.tenantId;

            if (!tenantId) {
                throw new AppError('Server error: Tenant ID not present after auth.', 500);
            }

            const data = await this.analyticsService.getDashboardData(tenantId, projectId);

            res.status(200).json({
                status: 'success',
                data
            });
        } catch (error) {
            next(error);
        }
    };
}
