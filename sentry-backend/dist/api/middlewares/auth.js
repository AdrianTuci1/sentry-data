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
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new errorHandler_1.AppError('Not authorized. No Bearer token provided.', 401);
            }
            const token = authHeader.split(' ')[1];
            // Validate via the AuthService to ensure business rules (e.g., tenant is active)
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
