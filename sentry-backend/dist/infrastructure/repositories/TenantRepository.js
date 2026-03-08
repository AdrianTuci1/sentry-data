"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantRepository = void 0;
const BaseRepository_1 = require("./BaseRepository");
class TenantRepository extends BaseRepository_1.BaseRepository {
    constructor(docClient, tableName) {
        super(docClient, tableName);
    }
    // PK Mapping rule: TENANT#<tenantId>
    getPartitionKey(id) {
        return `TENANT#${id}`;
    }
    // SK Mapping rule: PROFILE#<tenantId> (Using Profile to leave room for billing/users etc under the same tenant)
    getSortKey() {
        return 'PROFILE';
    }
    async findById(tenantId) {
        return this.get(tenantId);
    }
    async createTenant(tenant) {
        const newEntity = {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
            subscriptionPlan: tenant.subscriptionPlan,
            status: tenant.status,
            PK: this.getPartitionKey(tenant.id),
            SK: this.getSortKey(),
            createdAt: new Date().toISOString()
        };
        await this.save(newEntity);
    }
}
exports.TenantRepository = TenantRepository;
