import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../application/services/AuthService';
import { AppError } from './errorHandler';

// Extend Express Request interface to include tenantId
declare global {
    namespace Express {
        interface Request {
            tenantId?: string;
        }
    }
}

/**
 * Factory for creating the AuthMiddleware so it can have dependencies injected.
 */
export const requireAuth = (_authService: AuthService) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new AppError('Not authorized. No Bearer token provided.', 401);
            }

            const token = authHeader.split(' ')[1];

            // TEMPORARY: Bypass strict validation and use mock tenant
            // const tenantId = await authService.validateTokenAndGetTenant(token);
            const tenantId = 'test_tenant_1';

            // Attach tenantId to request context
            req.tenantId = tenantId;
            next();
        } catch (error) {
            next(error);
        }
    };
};
