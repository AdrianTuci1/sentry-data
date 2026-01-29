import { Request, Response, NextFunction } from 'express';

// Extend Express Request interface to include tenantId and query params
declare global {
    namespace Express {
        interface Request {
            user?: {
                tenantId: string;
                roles?: string[];
            };
        }
    }
}

export const contextMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Extract Tenant ID from Headers or JWT (using a header for MVP/simplicity as per plan)
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
        // Ideally, we would return 401/403 here, but for now we can let it pass or generic 'public'
        // Depending on strict requirement: "Feature: Nu poți interoga datele fără un context de proiect valid."
        // We will block it for API routes, maybe lax for health check.

        // For this middleware, we just attach if present.
        // Auth validation middleware can check for its existence.
    }

    req.user = {
        tenantId: tenantId || 'default-tenant', // Fallback or strict
    };

    next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.tenantId || req.user.tenantId === 'default-tenant') {
        // Check if actually strictly required. For now, strict.
        if (!req.headers['x-tenant-id']) {
            return res.status(401).json({ error: 'Missing X-Tenant-ID header' });
        }
    }
    next();
};
