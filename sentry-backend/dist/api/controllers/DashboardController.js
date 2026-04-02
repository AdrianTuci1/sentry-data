"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
class DashboardController {
    constructor(analyticsService, authService) {
        this.path = '/dashboard';
        this.router = (0, express_1.Router)();
        this.getDashboard = async (req, res, next) => {
            try {
                const { projectId } = req.params;
                const tenantId = req.tenantId;
                if (!tenantId)
                    throw new errorHandler_1.AppError('Tenant ID not present', 500);
                const data = await this.analyticsService.getDashboardData(tenantId, projectId);
                res.status(200).json({ status: 'success', data });
            }
            catch (error) {
                next(error);
            }
        };
        this.getManifest = async (req, res, next) => {
            try {
                const { projectId } = req.params;
                const tenantId = req.tenantId;
                if (!tenantId)
                    throw new errorHandler_1.AppError('Tenant ID not present', 500);
                const data = await this.analyticsService.getDashboardManifest(tenantId, projectId);
                res.status(200).json({ status: 'success', data });
            }
            catch (error) {
                next(error);
            }
        };
        this.getWidgetData = async (req, res, next) => {
            try {
                const { projectId, widgetId } = req.params;
                const tenantId = req.tenantId;
                if (!tenantId)
                    throw new errorHandler_1.AppError('Tenant ID not present', 500);
                const data = await this.analyticsService.getWidgetDataInstance(tenantId, projectId, widgetId);
                res.status(200).json({ status: 'success', data });
            }
            catch (error) {
                next(error);
            }
        };
        this.reloadWidgets = async (req, res, next) => {
            try {
                this.analyticsService.reloadWidgets();
                res.status(200).json({ status: 'success', message: 'Widget cache reloaded' });
            }
            catch (error) {
                next(error);
            }
        };
        this.analyticsService = analyticsService;
        this.authService = authService;
        this.initRoutes();
    }
    initRoutes() {
        const authMiddleware = (0, auth_1.requireAuth)(this.authService);
        this.router.get('/:projectId', authMiddleware, this.getDashboard);
        this.router.get('/:projectId/manifest', authMiddleware, this.getManifest);
        this.router.get('/:projectId/widget/:widgetId', authMiddleware, this.getWidgetData);
        this.router.get('/system/reload', authMiddleware, this.reloadWidgets);
    }
}
exports.DashboardController = DashboardController;
