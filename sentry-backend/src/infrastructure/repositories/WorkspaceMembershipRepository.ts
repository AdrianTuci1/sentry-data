import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BaseRepository, Entity } from './BaseRepository';
import { WorkspaceMembershipStatus, WorkspaceRole } from '../../types/controlPlane';

export interface WorkspaceMembershipEntity extends Entity {
    tenantId: string;
    workspaceId: string;
    userId: string;
    email: string;
    role: WorkspaceRole;
    status: WorkspaceMembershipStatus;
    joinedAt: string;
    invitedByUserId?: string;
    createdAt: string;
}

export class WorkspaceMembershipRepository extends BaseRepository<WorkspaceMembershipEntity> {
    constructor(docClient: DynamoDBDocumentClient, tableName: string) {
        super(docClient, tableName);
    }

    protected getPartitionKey(tenantId: string): string {
        return `TENANT#${tenantId}`;
    }

    protected getSortKey(compositeId?: string): string {
        if (!compositeId) {
            throw new Error('workspaceId#userId must be provided for Workspace Membership SK.');
        }
        return `WORKSPACE_MEMBER#${compositeId}`;
    }

    public async findByWorkspaceAndUser(tenantId: string, workspaceId: string, userId: string): Promise<WorkspaceMembershipEntity | null> {
        return this.get(tenantId, `${workspaceId}#${userId}`);
    }

    public async findAllForWorkspace(tenantId: string, workspaceId: string): Promise<WorkspaceMembershipEntity[]> {
        return this.queryByPrefix(tenantId, `WORKSPACE_MEMBER#${workspaceId}#`);
    }

    public async findAllForUser(tenantId: string, userId: string): Promise<WorkspaceMembershipEntity[]> {
        const memberships = await this.queryByPrefix(tenantId, 'WORKSPACE_MEMBER#');
        return memberships.filter((membership) => membership.userId === userId);
    }

    public async createOrUpdate(membership: Omit<WorkspaceMembershipEntity, 'PK' | 'SK'>): Promise<void> {
        await this.save({
            tenantId: membership.tenantId,
            workspaceId: membership.workspaceId,
            userId: membership.userId,
            email: membership.email,
            role: membership.role,
            status: membership.status,
            joinedAt: membership.joinedAt,
            invitedByUserId: membership.invitedByUserId,
            createdAt: membership.createdAt,
            PK: this.getPartitionKey(membership.tenantId),
            SK: this.getSortKey(`${membership.workspaceId}#${membership.userId}`),
        });
    }
}
