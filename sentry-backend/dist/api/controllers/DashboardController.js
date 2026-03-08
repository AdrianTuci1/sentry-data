"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
class DashboardController {
    // Dependency Injection via Constructor
    constructor(analyticsService, authService) {
        this.path = '/dashboard';
        this.router = (0, express_1.Router)();
        this.getDashboard = async (req, res, next) => {
            try {
                const { projectId } = req.params;
                // Extracted securely from the JWT validation middleware
                const tenantId = req.tenantId;
                if (!tenantId) {
                    throw new errorHandler_1.AppError('Server error: Tenant ID not present after auth.', 500);
                }
                const data = await this.analyticsService.getDashboardData(tenantId, projectId);
                res.status(200).json({
                    status: 'success',
                    data
                });
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
        // Protect the Dashboard fetching route
        const authMiddleware = (0, auth_1.requireAuth)(this.authService);
        this.router.get('/:projectId', authMiddleware, this.getDashboard);
    }
}
exports.DashboardController = DashboardController;
