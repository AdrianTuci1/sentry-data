import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BaseRepository, Entity } from './BaseRepository';
import { WorkspaceInvitationStatus, WorkspaceRole } from '../../types/controlPlane';

export interface WorkspaceInvitationEntity extends Entity {
    tenantId: string;
    workspaceId: string;
    invitationId: string;
    email: string;
    role: WorkspaceRole;
    status: WorkspaceInvitationStatus;
    inviteToken: string;
    invitedByUserId: string;
    invitedByEmail?: string;
    projectIds?: string[];
    expiresAt: string;
    createdAt: string;
}

export class WorkspaceInvitationRepository extends BaseRepository<WorkspaceInvitationEntity> {
    constructor(docClient: DynamoDBDocumentClient, tableName: string) {
        super(docClient, tableName);
    }

    protected getPartitionKey(tenantId: string): string {
        return `TENANT#${tenantId}`;
    }

    protected getSortKey(compositeId?: string): string {
        if (!compositeId) {
            throw new Error('workspaceId#invitationId must be provided for Invitation SK.');
        }
        return `INVITE#${compositeId}`;
    }

    public async findAllForWorkspace(tenantId: string, workspaceId: string): Promise<WorkspaceInvitationEntity[]> {
        return this.queryByPrefix(tenantId, `INVITE#${workspaceId}#`);
    }

    public async createOrUpdate(invitation: Omit<WorkspaceInvitationEntity, 'PK' | 'SK'>): Promise<void> {
        await this.save({
            tenantId: invitation.tenantId,
            workspaceId: invitation.workspaceId,
            invitationId: invitation.invitationId,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            inviteToken: invitation.inviteToken,
            invitedByUserId: invitation.invitedByUserId,
            invitedByEmail: invitation.invitedByEmail,
            projectIds: invitation.projectIds,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
            PK: this.getPartitionKey(invitation.tenantId),
            SK: this.getSortKey(`${invitation.workspaceId}#${invitation.invitationId}`),
        });
    }
}
