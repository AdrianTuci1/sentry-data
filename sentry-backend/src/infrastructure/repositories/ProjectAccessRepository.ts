import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BaseRepository, Entity } from './BaseRepository';
import { ProjectAccessRole, ProjectMemberInput } from '../../types/controlPlane';

export interface ProjectAccessEntity extends Entity {
    tenantId: string;
    workspaceId: string;
    projectId: string;
    accessId: string;
    account: string;
    access: ProjectAccessRole;
    userId?: string;
    grantedByUserId?: string;
    createdAt: string;
}

export class ProjectAccessRepository extends BaseRepository<ProjectAccessEntity> {
    constructor(docClient: DynamoDBDocumentClient, tableName: string) {
        super(docClient, tableName);
    }

    protected getPartitionKey(tenantId: string): string {
        return `TENANT#${tenantId}`;
    }

    protected getSortKey(compositeId?: string): string {
        if (!compositeId) {
            throw new Error('projectId#accessId must be provided for Project Access SK.');
        }
        return `PROJECT_ACCESS#${compositeId}`;
    }

    public async findAllForProject(tenantId: string, projectId: string): Promise<ProjectAccessEntity[]> {
        return this.queryByPrefix(tenantId, `PROJECT_ACCESS#${projectId}#`);
    }

    public async replaceForProject(
        tenantId: string,
        workspaceId: string,
        projectId: string,
        members: ProjectMemberInput[],
        grantedByUserId?: string
    ): Promise<ProjectAccessEntity[]> {
        const existing = await this.findAllForProject(tenantId, projectId);

        for (const member of existing) {
            await this.delete(tenantId, `${projectId}#${member.accessId}`);
        }

        const normalizedMembers = members
            .filter((member) => member.account?.trim())
            .map((member) => ({
                ...member,
                account: member.account.trim().toLowerCase()
            }));

        const createdAt = new Date().toISOString();
        const savedMembers: ProjectAccessEntity[] = [];

        for (const member of normalizedMembers) {
            const accessId = member.userId || member.account;
            const entity: ProjectAccessEntity = {
                tenantId,
                workspaceId,
                projectId,
                accessId,
                account: member.account,
                access: member.access,
                userId: member.userId,
                grantedByUserId,
                createdAt,
                PK: this.getPartitionKey(tenantId),
                SK: this.getSortKey(`${projectId}#${accessId}`),
            };

            await this.save(entity);
            savedMembers.push(entity);
        }

        return savedMembers;
    }
}
