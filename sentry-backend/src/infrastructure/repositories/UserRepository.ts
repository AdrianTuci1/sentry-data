import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BaseRepository, Entity } from './BaseRepository';

export interface UserEntity extends Entity {
    tenantId: string;
    userId: string;
    email: string;
    name: string;
    status: 'active' | 'invited';
    createdAt: string;
    lastSeenAt?: string;
}

export class UserRepository extends BaseRepository<UserEntity> {
    constructor(docClient: DynamoDBDocumentClient, tableName: string) {
        super(docClient, tableName);
    }

    protected getPartitionKey(tenantId: string): string {
        return `TENANT#${tenantId}`;
    }

    protected getSortKey(userId?: string): string {
        if (!userId) {
            throw new Error('userId must be provided for User SK.');
        }
        return `USER#${userId}`;
    }

    public async findById(tenantId: string, userId: string): Promise<UserEntity | null> {
        return this.get(tenantId, userId);
    }

    public async findAllForTenant(tenantId: string): Promise<UserEntity[]> {
        return this.queryByPrefix(tenantId, 'USER#');
    }

    public async createOrUpdate(user: Omit<UserEntity, 'PK' | 'SK'>): Promise<void> {
        await this.save({
            tenantId: user.tenantId,
            userId: user.userId,
            email: user.email,
            name: user.name,
            status: user.status,
            createdAt: user.createdAt,
            lastSeenAt: user.lastSeenAt,
            PK: this.getPartitionKey(user.tenantId),
            SK: this.getSortKey(user.userId),
        });
    }
}
