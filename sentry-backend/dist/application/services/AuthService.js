"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("../../api/middlewares/errorHandler");
class AuthService {
    constructor(tenantRepo) {
        this.tenantRepo = tenantRepo;
        this.jwtSecret = process.env.JWT_SECRET || 'super-secure-dev-secret';
    }
    /**
     * Verifies the JWT and checks if the Tenant actually exists in the DB.
     * @returns The tenantId if valid
     */
    async validateTokenAndGetTenant(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            // Check if tenant exists/is active in DynamoDB
            const tenant = await this.tenantRepo.findById(decoded.tenantId);
            if (!tenant) {
                throw new errorHandler_1.AppError('Tenant associated with token does not exist.', 401);
            }
            if (tenant.status !== 'active') {
                throw new errorHandler_1.AppError('Tenant account is suspended.', 403);
            }
            return decoded.tenantId;
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new errorHandler_1.AppError('Authentication token expired', 401);
            }
            if (error instanceof errorHandler_1.AppError) {
                throw error;
            }
            throw new errorHandler_1.AppError('Invalid authentication token', 401);
        }
    }
}
exports.AuthService = AuthService;
