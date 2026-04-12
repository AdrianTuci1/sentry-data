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
            const authContext = await authService.validateToken(token);
            // Attach tenantId to request context
            req.authContext = authContext;
            req.tenantId = authContext.tenantId;
            req.userId = authContext.userId;
            req.userEmail = authContext.email;
            req.workspaceId = authContext.workspaceId;
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireAuth = requireAuth;
