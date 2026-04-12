import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../application/services/AuthService';
import { AppError } from './errorHandler';
import { AuthContext } from '../../types/controlPlane';

// Extend Express Request interface to include tenantId
declare global {
    namespace Express {
        interface Request {
            tenantId?: string;
            userId?: string;
            userEmail?: string;
            workspaceId?: string;
            authContext?: AuthContext;
        }
    }
}

/**
 * Factory for creating the AuthMiddleware so it can have dependencies injected.
 */
export const requireAuth = (authService: AuthService) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            let token = '';
            const authHeader = req.headers.authorization;
            
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            } else if (req.query.token && typeof req.query.token === 'string') {
                token = req.query.token;
            }

            if (!token) {
                throw new AppError('Not authorized. No Bearer token provided.', 401);
            }

            const authContext = await authService.validateToken(token);

            // Attach tenantId to request context
            req.authContext = authContext;
            req.tenantId = authContext.tenantId;
            req.userId = authContext.userId;
            req.userEmail = authContext.email;
            req.workspaceId = authContext.workspaceId;
            next();
        } catch (error) {
            next(error);
        }
    };
};
