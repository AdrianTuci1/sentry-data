import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BaseRepository, Entity } from './BaseRepository';

export interface AuditEventEntity extends Entity {
    tenantId: string;
    workspaceId: string;
    eventId: string;
    actorUserId: string;
    actorEmail?: string;
    action: string;
    targetType: 'workspace' | 'project' | 'invitation' | 'membership' | 'system';
    targetId: string;
    summary: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

export class AuditEventRepository extends BaseRepository<AuditEventEntity> {
    constructor(docClient: DynamoDBDocumentClient, tableName: string) {
        super(docClient, tableName);
    }

    protected getPartitionKey(tenantId: string): string {
        return `TENANT#${tenantId}`;
    }

    protected getSortKey(compositeId?: string): string {
        if (!compositeId) {
            throw new Error('workspaceId#timestamp#eventId must be provided for Audit Event SK.');
        }
        return `AUDIT#${compositeId}`;
    }

    public async findAllForWorkspace(tenantId: string, workspaceId: string): Promise<AuditEventEntity[]> {
        return this.queryByPrefix(tenantId, `AUDIT#${workspaceId}#`);
    }

    public async createEvent(event: Omit<AuditEventEntity, 'PK' | 'SK'>): Promise<void> {
        await this.save({
            tenantId: event.tenantId,
            workspaceId: event.workspaceId,
            eventId: event.eventId,
            actorUserId: event.actorUserId,
            actorEmail: event.actorEmail,
            action: event.action,
            targetType: event.targetType,
            targetId: event.targetId,
            summary: event.summary,
            metadata: event.metadata,
            createdAt: event.createdAt,
            PK: this.getPartitionKey(event.tenantId),
            SK: this.getSortKey(`${event.workspaceId}#${event.createdAt}#${event.eventId}`),
        });
    }
}
