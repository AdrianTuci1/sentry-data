import jwt from 'jsonwebtoken';
import { TenantRepository } from '../../infrastructure/repositories/TenantRepository';
import { AppError } from '../../api/middlewares/errorHandler';
import { AuthContext } from '../../types/controlPlane';

export interface DecodedToken extends AuthContext {
    iat: number;
    exp: number;
}

export class AuthService {
    private tenantRepo: TenantRepository;
    private jwtSecret: string;

    constructor(tenantRepo: TenantRepository) {
        this.tenantRepo = tenantRepo;
        this.jwtSecret = process.env.JWT_SECRET || 'super-secure-dev-secret';
    }

    /**
     * Verifies the JWT and checks if the Tenant actually exists in the DB.
     * @returns The auth context if valid
     */
    public async validateToken(token: string): Promise<AuthContext> {
        // MOCK BYPASS FOR TESTING PHASE
        if (token === 'mock-tenant-token-123') {
            console.log('[AuthService] Using MOCK bypass for testing.');
            return {
                tenantId: 'test_tenant_1',
                userId: 'user_adrian',
                email: 'adrian.tucicovenco@gmail.com',
                name: 'Adrian Tuci',
                role: 'owner',
                workspaceId: 'ws_test_tenant_1_main'
            };
        }

        try {
            const decoded = jwt.verify(token, this.jwtSecret) as DecodedToken;

            // Check if tenant exists/is active in DynamoDB
            const tenant = await this.tenantRepo.findById(decoded.tenantId);

            if (!tenant) {
                throw new AppError('Tenant associated with token does not exist.', 401);
            }
            if (tenant.status !== 'active') {
                throw new AppError('Tenant account is suspended.', 403);
            }

            return {
                tenantId: decoded.tenantId,
                userId: decoded.userId || decoded.email || `user_${decoded.tenantId}`,
                email: decoded.email,
                name: decoded.name,
                role: decoded.role || 'member',
                workspaceId: decoded.workspaceId
            };
        } catch (error: any) {
            if (error.name === 'TokenExpiredError') {
                throw new AppError('Authentication token expired', 401);
            }
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Invalid authentication token', 401);
        }
    }

    public async validateTokenAndGetTenant(token: string): Promise<string> {
        const authContext = await this.validateToken(token);
        return authContext.tenantId;
    }
}
