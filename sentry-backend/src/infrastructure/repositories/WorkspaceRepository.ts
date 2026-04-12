import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BaseRepository, Entity } from './BaseRepository';
import { WorkspaceLimits } from '../../types/controlPlane';

export interface WorkspaceEntity extends Entity {
    tenantId: string;
    workspaceId: string;
    name: string;
    slug: string;
    status: 'active' | 'archived';
    plan: 'free' | 'pro' | 'enterprise';
    limits: WorkspaceLimits;
    createdByUserId: string;
    createdByEmail?: string;
    createdAt: string;
}

export class WorkspaceRepository extends BaseRepository<WorkspaceEntity> {
    constructor(docClient: DynamoDBDocumentClient, tableName: string) {
        super(docClient, tableName);
    }

    protected getPartitionKey(tenantId: string): string {
        return `TENANT#${tenantId}`;
    }

    protected getSortKey(workspaceId?: string): string {
        if (!workspaceId) {
            throw new Error('workspaceId must be provided for Workspace SK.');
        }
        return `WORKSPACE#${workspaceId}`;
    }

    public async findById(tenantId: string, workspaceId: string): Promise<WorkspaceEntity | null> {
        return this.get(tenantId, workspaceId);
    }

    public async findAllForTenant(tenantId: string): Promise<WorkspaceEntity[]> {
        return this.queryByPrefix(tenantId, 'WORKSPACE#');
    }

    public async createOrUpdate(workspace: Omit<WorkspaceEntity, 'PK' | 'SK'>): Promise<void> {
        await this.save({
            tenantId: workspace.tenantId,
            workspaceId: workspace.workspaceId,
            name: workspace.name,
            slug: workspace.slug,
            status: workspace.status,
            plan: workspace.plan,
            limits: workspace.limits,
            createdByUserId: workspace.createdByUserId,
            createdByEmail: workspace.createdByEmail,
            createdAt: workspace.createdAt,
            PK: this.getPartitionKey(workspace.tenantId),
            SK: this.getSortKey(workspace.workspaceId),
        });
    }
}
