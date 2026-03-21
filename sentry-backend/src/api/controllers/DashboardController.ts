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

    constructor(analyticsService: AnalyticsService, authService: AuthService) {
        this.analyticsService = analyticsService;
        this.authService = authService;
        this.initRoutes();
    }

    public initRoutes() {
        const authMiddleware = requireAuth(this.authService);
        this.router.get('/:projectId', authMiddleware, this.getDashboard);
        this.router.get('/:projectId/manifest', authMiddleware, this.getManifest);
        this.router.get('/:projectId/widget/:widgetId', authMiddleware, this.getWidgetData);
        this.router.get('/system/reload', authMiddleware, this.reloadWidgets);
    }

    private getDashboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { projectId } = req.params;
            const tenantId = req.tenantId;
            if (!tenantId) throw new AppError('Tenant ID not present', 500);

            const data = await this.analyticsService.getDashboardData(tenantId, projectId);
            res.status(200).json({ status: 'success', data });
        } catch (error) {
            next(error);
        }
    };

    private getManifest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { projectId } = req.params;
            const tenantId = req.tenantId;
            if (!tenantId) throw new AppError('Tenant ID not present', 500);

            const data = await this.analyticsService.getDashboardManifest(tenantId, projectId);
            res.status(200).json({ status: 'success', data });
        } catch (error) {
            next(error);
        }
    };

    private getWidgetData = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { projectId, widgetId } = req.params;
            const tenantId = req.tenantId;
            if (!tenantId) throw new AppError('Tenant ID not present', 500);

            const data = await this.analyticsService.getWidgetDataInstance(tenantId, projectId, widgetId);
            res.status(200).json({ status: 'success', data });
        } catch (error) {
            next(error);
        }
    };

    private reloadWidgets = async (req: Request, res: Response, next: NextFunction) => {
        try {
            this.analyticsService.reloadWidgets();
            res.status(200).json({ status: 'success', message: 'Widget cache reloaded' });
        } catch (error) {
            next(error);
        }
    };
}
