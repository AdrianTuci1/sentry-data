"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSEController = void 0;
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
class SSEController {
    // Dependency Injection via Constructor
    constructor(sseManager, authService) {
        this.path = '/events';
        this.router = (0, express_1.Router)();
        this.connectClient = async (req, res, next) => {
            try {
                const tenantId = req.tenantId;
                if (!tenantId) {
                    throw new errorHandler_1.AppError('Server error: Tenant ID not present after auth.', 500);
                }
                // Register the response socket strictly inside the SSE manager
                this.sseManager.addClient(tenantId, req, res);
                // Note: We do NOT call `res.end()` or `res.send()` here. 
                // The connection is intentionally left hanging.
            }
            catch (error) {
                next(error);
            }
        };
        this.sseManager = sseManager;
        this.authService = authService;
        this.initRoutes();
    }
    initRoutes() {
        // Protect the SSE endpoint (ensure client is valid before holding the connection open)
        const authMiddleware = (0, auth_1.requireAuth)(this.authService);
        this.router.get('/', authMiddleware, this.connectClient);
    }
}
exports.SSEController = SSEController;
