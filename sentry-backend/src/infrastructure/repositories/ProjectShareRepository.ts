import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BaseRepository, Entity } from './BaseRepository';

export interface ProjectShareEntity extends Entity {
    tenantId: string;
    workspaceId: string;
    projectId: string;
    shareId: string;
    shareToken: string;
    label?: string;
    access: 'viewer';
    status: 'active' | 'revoked' | 'expired';
    createdByUserId: string;
    createdByEmail?: string;
    expiresAt?: string;
    createdAt: string;
}

export class ProjectShareRepository extends BaseRepository<ProjectShareEntity> {
    constructor(docClient: DynamoDBDocumentClient, tableName: string) {
        super(docClient, tableName);
    }

    protected getPartitionKey(tenantId: string): string {
        return `TENANT#${tenantId}`;
    }

    protected getSortKey(compositeId?: string): string {
        if (!compositeId) {
            throw new Error('projectId#shareId must be provided for Share SK.');
        }

        return `PROJECT_SHARE#${compositeId}`;
    }

    public async findAllForProject(tenantId: string, projectId: string): Promise<ProjectShareEntity[]> {
        return this.queryByPrefix(tenantId, `PROJECT_SHARE#${projectId}#`);
    }

    public async findByToken(tenantId: string, projectId: string, shareToken: string): Promise<ProjectShareEntity | null> {
        const shares = await this.findAllForProject(tenantId, projectId);
        return shares.find((share) => share.shareToken === shareToken) || null;
    }

    public async createOrUpdate(share: Omit<ProjectShareEntity, 'PK' | 'SK'>): Promise<void> {
        await this.save({
            tenantId: share.tenantId,
            workspaceId: share.workspaceId,
            projectId: share.projectId,
            shareId: share.shareId,
            shareToken: share.shareToken,
            label: share.label,
            access: share.access,
            status: share.status,
            createdByUserId: share.createdByUserId,
            createdByEmail: share.createdByEmail,
            expiresAt: share.expiresAt,
            createdAt: share.createdAt,
            PK: this.getPartitionKey(share.tenantId),
            SK: this.getSortKey(`${share.projectId}#${share.shareId}`)
        });
    }
}
