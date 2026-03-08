import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BaseRepository, Entity } from './BaseRepository';

// Representation of a Tenant in DB
export interface TenantEntity extends Entity {
    id: string; // The tenant's external reference ID
    name: string;
    email: string;
    subscriptionPlan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'suspended';
    createdAt: string;
}

export class TenantRepository extends BaseRepository<TenantEntity> {
    constructor(docClient: DynamoDBDocumentClient, tableName: string) {
        super(docClient, tableName);
    }

    // PK Mapping rule: TENANT#<tenantId>
    protected getPartitionKey(id: string): string {
        return `TENANT#${id}`;
    }

    // SK Mapping rule: PROFILE#<tenantId> (Using Profile to leave room for billing/users etc under the same tenant)
    protected getSortKey(): string {
        return 'PROFILE';
    }

    public async findById(tenantId: string): Promise<TenantEntity | null> {
        return this.get(tenantId);
    }

    public async createTenant(tenant: Omit<TenantEntity, 'PK' | 'SK' | 'createdAt'>): Promise<void> {
        const newEntity: TenantEntity = {
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
