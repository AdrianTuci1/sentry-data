import jwt from 'jsonwebtoken';
import { TenantRepository } from '../../infrastructure/repositories/TenantRepository';
import { AppError } from '../../api/middlewares/errorHandler';

export interface DecodedToken {
    tenantId: string;
    role: string;
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
     * @returns The tenantId if valid
     */
    public async validateTokenAndGetTenant(token: string): Promise<string> {
        // MOCK BYPASS FOR TESTING PHASE
        if (token === 'mock-tenant-token-123') {
            console.log('[AuthService] Using MOCK bypass for testing.');
            return 'test_tenant_1';
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

            return decoded.tenantId;
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
}
