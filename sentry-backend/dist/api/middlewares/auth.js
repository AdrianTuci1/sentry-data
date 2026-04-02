"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const errorHandler_1 = require("./errorHandler");
/**
 * Factory for creating the AuthMiddleware so it can have dependencies injected.
 */
const requireAuth = (authService) => {
    return async (req, res, next) => {
        try {
            let token = '';
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
            else if (req.query.token && typeof req.query.token === 'string') {
                token = req.query.token;
            }
            if (!token) {
                throw new errorHandler_1.AppError('Not authorized. No Bearer token provided.', 401);
            }
            // Use AuthService (which has the mock bypass for 'mock-tenant-token-123')
            const tenantId = await authService.validateTokenAndGetTenant(token);
            // Attach tenantId to request context
            req.tenantId = tenantId;
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireAuth = requireAuth;
