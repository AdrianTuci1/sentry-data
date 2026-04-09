import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../api/middlewares/errorHandler';
import { AuthContext, ProjectMemberInput, WorkspaceLimits, WorkspaceRole } from '../../types/controlPlane';
import { UserEntity, UserRepository } from '../../infrastructure/repositories/UserRepository';
import { WorkspaceEntity, WorkspaceRepository } from '../../infrastructure/repositories/WorkspaceRepository';
import { WorkspaceMembershipEntity, WorkspaceMembershipRepository } from '../../infrastructure/repositories/WorkspaceMembershipRepository';
import { WorkspaceInvitationEntity, WorkspaceInvitationRepository } from '../../infrastructure/repositories/WorkspaceInvitationRepository';
import { AuditEventRepository } from '../../infrastructure/repositories/AuditEventRepository';
import { ProjectEntity, ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { TenantRepository } from '../../infrastructure/repositories/TenantRepository';
import { ProjectAccessEntity, ProjectAccessRepository } from '../../infrastructure/repositories/ProjectAccessRepository';
import { ProjectShareEntity, ProjectShareRepository } from '../../infrastructure/repositories/ProjectShareRepository';

export interface ControlPlaneSnapshot {
    user: UserEntity;
    workspaces: WorkspaceEntity[];
    memberships: WorkspaceMembershipEntity[];
    currentWorkspace: WorkspaceEntity;
    currentMembership: WorkspaceMembershipEntity;
}

export class ControlPlaneService {
    constructor(
        private readonly tenantRepo: TenantRepository,
        private readonly userRepo: UserRepository,
        private readonly workspaceRepo: WorkspaceRepository,
        private readonly workspaceMembershipRepo: WorkspaceMembershipRepository,
        private readonly workspaceInvitationRepo: WorkspaceInvitationRepository,
        private readonly auditEventRepo: AuditEventRepository,
        private readonly projectRepo: ProjectRepository,
        private readonly projectAccessRepo: ProjectAccessRepository,
        private readonly projectShareRepo: ProjectShareRepository
    ) {}

    public async ensureBootstrap(authContext: AuthContext): Promise<ControlPlaneSnapshot> {
        const tenant = await this.tenantRepo.findById(authContext.tenantId);
        if (!tenant) {
            throw new AppError('Tenant not found for control plane bootstrap.', 404);
        }

        const user = await this.upsertUser(authContext);
        let workspaces = await this.workspaceRepo.findAllForTenant(authContext.tenantId);
        let memberships = (await this.workspaceMembershipRepo.findAllForUser(authContext.tenantId, authContext.userId))
            .filter((membership) => membership.status === 'active');

        if (workspaces.length === 0 || memberships.length === 0) {
            const workspaceId = this.getDefaultWorkspaceId(authContext.tenantId);
            const defaultWorkspace = await this.ensureDefaultWorkspace(authContext, tenant.subscriptionPlan, workspaceId);
            workspaces = [defaultWorkspace];
            memberships = [(await this.workspaceMembershipRepo.findByWorkspaceAndUser(authContext.tenantId, workspaceId, authContext.userId))!];
        }

        const workspaceIndex = new Map(workspaces.map((workspace) => [workspace.workspaceId, workspace]));
        const requestedWorkspaceId = authContext.workspaceId;
        const currentMembership = memberships.find((membership) => membership.workspaceId === requestedWorkspaceId)
            || memberships[0];
        const currentWorkspace = workspaceIndex.get(currentMembership.workspaceId);

        if (!currentWorkspace) {
            throw new AppError('Unable to resolve current workspace.', 500);
        }

        await this.attachLegacyProjectsToWorkspace(authContext.tenantId, currentWorkspace.workspaceId);
        await this.refreshWorkspaceUsage(authContext.tenantId, currentWorkspace.workspaceId);

        const refreshedWorkspaces = await this.workspaceRepo.findAllForTenant(authContext.tenantId);

        return {
            user,
            memberships,
            workspaces: refreshedWorkspaces.filter((workspace) =>
                memberships.some((membership) => membership.workspaceId === workspace.workspaceId)
            ),
            currentWorkspace: refreshedWorkspaces.find((workspace) => workspace.workspaceId === currentWorkspace.workspaceId) || currentWorkspace,
            currentMembership
        };
    }

    public async getAccountSnapshot(authContext: AuthContext) {
        const snapshot = await this.ensureBootstrap(authContext);
        const invitations = await this.workspaceInvitationRepo.findAllForWorkspace(authContext.tenantId, snapshot.currentWorkspace.workspaceId);
        const activity = await this.listWorkspaceActivity(authContext, snapshot.currentWorkspace.workspaceId, 20);

        return {
            user: snapshot.user,
            workspaces: snapshot.workspaces,
            currentWorkspace: snapshot.currentWorkspace,
            currentMembership: snapshot.currentMembership,
            invitations,
            activity
        };
    }

    public async listAccessibleWorkspaces(authContext: AuthContext): Promise<WorkspaceEntity[]> {
        const snapshot = await this.ensureBootstrap(authContext);
        return snapshot.workspaces;
    }

    public async resolveWorkspace(authContext: AuthContext, requestedWorkspaceId?: string): Promise<{ workspace: WorkspaceEntity; membership: WorkspaceMembershipEntity }> {
        const snapshot = await this.ensureBootstrap(authContext);
        const targetWorkspaceId = requestedWorkspaceId || authContext.workspaceId || snapshot.currentWorkspace.workspaceId;
        const membership = snapshot.memberships.find((entry) => entry.workspaceId === targetWorkspaceId);

        if (!membership || membership.status !== 'active') {
            throw new AppError('You do not have access to this workspace.', 403);
        }

        const workspace = snapshot.workspaces.find((entry) => entry.workspaceId === targetWorkspaceId);
        if (!workspace) {
            throw new AppError('Workspace not found.', 404);
        }

        await this.refreshWorkspaceUsage(authContext.tenantId, workspace.workspaceId);

        return { workspace, membership };
    }

    public async createWorkspace(authContext: AuthContext, input: { name: string }): Promise<WorkspaceEntity> {
        const snapshot = await this.ensureBootstrap(authContext);
        const workspaceId = `ws_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        const createdAt = new Date().toISOString();

        const workspace: WorkspaceEntity = {
            tenantId: authContext.tenantId,
            workspaceId,
            name: input.name.trim(),
            slug: this.slugify(input.name),
            status: 'active',
            plan: snapshot.currentWorkspace.plan,
            limits: this.createWorkspaceLimits(snapshot.currentWorkspace.plan),
            createdByUserId: authContext.userId,
            createdByEmail: authContext.email,
            createdAt,
            PK: '',
            SK: ''
        };

        await this.workspaceRepo.createOrUpdate(workspace);
        await this.workspaceMembershipRepo.createOrUpdate({
            tenantId: authContext.tenantId,
            workspaceId,
            userId: authContext.userId,
            email: authContext.email || `${authContext.userId}@workspace.local`,
            role: 'owner',
            status: 'active',
            joinedAt: createdAt,
            createdAt
        });

        await this.recordAuditEvent(authContext, workspaceId, 'workspace.created', 'workspace', workspaceId, `Created workspace ${input.name.trim()}`);
        await this.refreshWorkspaceUsage(authContext.tenantId, workspaceId);

        return (await this.workspaceRepo.findById(authContext.tenantId, workspaceId))!;
    }

    public async getWorkspaceDetail(authContext: AuthContext, workspaceId: string) {
        const { workspace, membership } = await this.resolveWorkspace(authContext, workspaceId);
        const members = await this.listWorkspaceMembers(authContext, workspaceId);
        const invitations = await this.workspaceInvitationRepo.findAllForWorkspace(authContext.tenantId, workspaceId);
        const activity = await this.listWorkspaceActivity(authContext, workspaceId, 50);

        return {
            workspace,
            membership,
            members,
            invitations,
            activity
        };
    }

    public async listWorkspaceMembers(authContext: AuthContext, workspaceId: string) {
        await this.resolveWorkspace(authContext, workspaceId);
        const members = await this.workspaceMembershipRepo.findAllForWorkspace(authContext.tenantId, workspaceId);
        const users = await this.userRepo.findAllForTenant(authContext.tenantId);
        const userIndex = new Map(users.map((user) => [user.userId, user]));

        return members
            .filter((member) => member.status === 'active')
            .map((member) => ({
                ...member,
                name: userIndex.get(member.userId)?.name || member.email.split('@')[0],
                status: member.status,
                joined: member.joinedAt,
            }));
    }

    public async createInvitation(authContext: AuthContext, workspaceId: string, input: { email: string; role: WorkspaceRole; projectIds?: string[] }): Promise<WorkspaceInvitationEntity> {
        const { membership } = await this.resolveWorkspace(authContext, workspaceId);
        if (!['owner', 'admin'].includes(membership.role)) {
            throw new AppError('Only workspace owners and admins can invite collaborators.', 403);
        }

        const createdAt = new Date().toISOString();
        const invitationId = uuidv4();
        const invitation: WorkspaceInvitationEntity = {
            tenantId: authContext.tenantId,
            workspaceId,
            invitationId,
            email: input.email.trim().toLowerCase(),
            role: input.role,
            status: 'pending',
            inviteToken: uuidv4(),
            invitedByUserId: authContext.userId,
            invitedByEmail: authContext.email,
            projectIds: input.projectIds,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
            createdAt,
            PK: '',
            SK: ''
        };

        await this.workspaceInvitationRepo.createOrUpdate(invitation);
        await this.recordAuditEvent(
            authContext,
            workspaceId,
            'workspace.invited_member',
            'invitation',
            invitationId,
            `Invited ${invitation.email} to workspace`
        );

        return invitation;
    }

    public async previewInvitation(tenantId: string, workspaceId: string, inviteToken: string): Promise<{ workspace: WorkspaceEntity; invitation: WorkspaceInvitationEntity }> {
        const workspace = await this.workspaceRepo.findById(tenantId, workspaceId);
        if (!workspace) {
            throw new AppError('Workspace not found.', 404);
        }

        const invitations = await this.workspaceInvitationRepo.findAllForWorkspace(tenantId, workspaceId);
        const invitation = invitations.find((entry) => entry.inviteToken === inviteToken);

        if (!invitation) {
            throw new AppError('Invitation not found.', 404);
        }

        if (invitation.status === 'revoked') {
            throw new AppError('Invitation has been revoked.', 410);
        }

        if (invitation.expiresAt && invitation.expiresAt < new Date().toISOString()) {
            invitation.status = 'expired';
            await this.workspaceInvitationRepo.createOrUpdate(invitation);
            throw new AppError('Invitation has expired.', 410);
        }

        return { workspace, invitation };
    }

    public async acceptInvitation(authContext: AuthContext, tenantId: string, workspaceId: string, inviteToken: string) {
        if (authContext.tenantId !== tenantId) {
            throw new AppError('Invitation tenant does not match the signed-in account.', 403);
        }

        const { workspace, invitation } = await this.previewInvitation(tenantId, workspaceId, inviteToken);
        const normalizedUserEmail = (authContext.email || '').trim().toLowerCase();

        if (invitation.email !== normalizedUserEmail) {
            throw new AppError('Invitation email does not match the signed-in user.', 403);
        }

        await this.upsertUser(authContext);

        const now = new Date().toISOString();
        await this.workspaceMembershipRepo.createOrUpdate({
            tenantId,
            workspaceId,
            userId: authContext.userId,
            email: normalizedUserEmail,
            role: invitation.role,
            status: 'active',
            joinedAt: now,
            invitedByUserId: invitation.invitedByUserId,
            createdAt: now
        });

        if (Array.isArray(invitation.projectIds) && invitation.projectIds.length > 0) {
            for (const projectId of invitation.projectIds) {
                const existingMembers = await this.projectAccessRepo.findAllForProject(tenantId, projectId);
                const alreadyPresent = existingMembers.some((member) => (
                    member.userId === authContext.userId || member.account === normalizedUserEmail
                ));

                if (!alreadyPresent) {
                    await this.projectAccessRepo.replaceForProject(
                        tenantId,
                        workspaceId,
                        projectId,
                        [
                            ...existingMembers.map((member) => ({
                                userId: member.userId,
                                account: member.account,
                                access: member.access
                            })),
                            { userId: authContext.userId, account: normalizedUserEmail, access: 'viewer' }
                        ],
                        invitation.invitedByUserId
                    );
                }
            }
        }

        invitation.status = 'accepted';
        await this.workspaceInvitationRepo.createOrUpdate(invitation);
        await this.refreshWorkspaceUsage(tenantId, workspaceId);
        await this.recordAuditEvent(
            authContext,
            workspaceId,
            'workspace.invitation_accepted',
            'invitation',
            invitation.invitationId,
            `Accepted invite for ${workspace.name}`
        );

        return { workspace, invitation };
    }

    public async listWorkspaceActivity(authContext: AuthContext, workspaceId: string, limit = 50) {
        await this.resolveWorkspace(authContext, workspaceId);
        const events = await this.auditEventRepo.findAllForWorkspace(authContext.tenantId, workspaceId);
        return events
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .slice(0, limit);
    }

    public async assertProjectAccess(authContext: AuthContext, projectId: string): Promise<{ project: ProjectEntity; workspace: WorkspaceEntity; membership: WorkspaceMembershipEntity; members: ProjectAccessEntity[] }> {
        const project = await this.projectRepo.findById(authContext.tenantId, projectId);
        if (!project) {
            throw new AppError('Project not found.', 404);
        }

        const workspaceId = project.workspaceId || this.getDefaultWorkspaceId(authContext.tenantId);
        const { workspace, membership } = await this.resolveWorkspace(authContext, workspaceId);
        const explicitMembers = await this.projectAccessRepo.findAllForProject(authContext.tenantId, projectId);

        if (explicitMembers.length > 0 && !['owner', 'admin'].includes(membership.role)) {
            const normalizedEmail = authContext.email?.trim().toLowerCase();
            const isAllowed = explicitMembers.some((member) => (
                member.userId === authContext.userId
                || (!!normalizedEmail && member.account === normalizedEmail)
            ));

            if (!isAllowed) {
                throw new AppError('You do not have access to this project.', 403);
            }
        }

        return { project, workspace, membership, members: explicitMembers };
    }

    public async listProjectShareLinks(authContext: AuthContext, projectId: string): Promise<ProjectShareEntity[]> {
        const { workspace } = await this.assertProjectAccess(authContext, projectId);
        const links = await this.projectShareRepo.findAllForProject(authContext.tenantId, projectId);
        const now = new Date().toISOString();

        return links.map((link) => {
            if (link.expiresAt && link.expiresAt < now && link.status === 'active') {
                link.status = 'expired';
            }
            return link;
        }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }

    public async createProjectShareLink(
        authContext: AuthContext,
        projectId: string,
        input: { label?: string; expiresInDays?: number; appBaseUrl?: string }
    ): Promise<ProjectShareEntity & { shareUrl: string }> {
        const { workspace, membership, project } = await this.assertProjectAccess(authContext, projectId);

        if (!['owner', 'admin', 'member'].includes(membership.role)) {
            throw new AppError('Your role cannot create share links for this project.', 403);
        }

        const shareId = uuidv4();
        const shareToken = uuidv4();
        const createdAt = new Date().toISOString();
        const expiresAt = typeof input.expiresInDays === 'number' && input.expiresInDays > 0
            ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
            : undefined;

        const share: ProjectShareEntity = {
            tenantId: authContext.tenantId,
            workspaceId: workspace.workspaceId,
            projectId,
            shareId,
            shareToken,
            label: input.label?.trim(),
            access: 'viewer',
            status: 'active',
            createdByUserId: authContext.userId,
            createdByEmail: authContext.email,
            expiresAt,
            createdAt,
            PK: '',
            SK: ''
        };

        await this.projectShareRepo.createOrUpdate(share);
        project.viewLink = this.buildShareUrl(authContext.tenantId, projectId, shareToken, input.appBaseUrl);
        await this.projectRepo.createOrUpdate(project);
        await this.recordAuditEvent(
            authContext,
            workspace.workspaceId,
            'project.share_link_created',
            'project',
            projectId,
            `Created share link for ${project.name}`,
            { shareId, expiresAt }
        );

        return {
            ...share,
            shareUrl: this.buildShareUrl(authContext.tenantId, projectId, shareToken, input.appBaseUrl)
        };
    }

    public async resolveSharedProject(tenantId: string, projectId: string, shareToken: string) {
        const project = await this.projectRepo.findById(tenantId, projectId);
        if (!project) {
            throw new AppError('Shared project not found.', 404);
        }

        const share = await this.projectShareRepo.findByToken(tenantId, projectId, shareToken);
        if (!share) {
            throw new AppError('Share link not found.', 404);
        }

        if (share.status === 'revoked') {
            throw new AppError('Share link has been revoked.', 410);
        }

        if (share.expiresAt && share.expiresAt < new Date().toISOString()) {
            share.status = 'expired';
            await this.projectShareRepo.createOrUpdate(share);
            throw new AppError('Share link has expired.', 410);
        }

        const workspace = await this.workspaceRepo.findById(tenantId, share.workspaceId);
        if (!workspace) {
            throw new AppError('Workspace not found for shared project.', 404);
        }

        return { project, workspace, share };
    }

    public async syncProjectMembers(
        authContext: AuthContext,
        workspaceId: string,
        projectId: string,
        members: ProjectMemberInput[] | undefined
    ): Promise<ProjectAccessEntity[]> {
        if (!members) {
            return this.projectAccessRepo.findAllForProject(authContext.tenantId, projectId);
        }

        const { membership } = await this.resolveWorkspace(authContext, workspaceId);
        if (!['owner', 'admin', 'member'].includes(membership.role)) {
            throw new AppError('Your workspace role cannot edit project access.', 403);
        }

        const savedMembers = await this.projectAccessRepo.replaceForProject(
            authContext.tenantId,
            workspaceId,
            projectId,
            members,
            authContext.userId
        );

        await this.recordAuditEvent(
            authContext,
            workspaceId,
            'project.access_updated',
            'project',
            projectId,
            `Updated project access for ${savedMembers.length} account(s)`
        );

        return savedMembers;
    }

    public async listWorkspaceProjects(authContext: AuthContext, workspaceId?: string) {
        const { workspace } = await this.resolveWorkspace(authContext, workspaceId);
        await this.attachLegacyProjectsToWorkspace(authContext.tenantId, workspace.workspaceId);

        const projects = await this.projectRepo.findAllForTenant(authContext.tenantId);
        const workspaceProjects = projects.filter((project) => (
            (project.workspaceId || this.getDefaultWorkspaceId(authContext.tenantId)) === workspace.workspaceId
        ));

        return Promise.all(workspaceProjects.map(async (project) => {
            const members = await this.projectAccessRepo.findAllForProject(authContext.tenantId, project.projectId);
            return {
                ...project,
                workspaceId: workspace.workspaceId,
                members: members.map((member) => ({
                    userId: member.userId,
                    account: member.account,
                    access: member.access
                })),
                viewLink: project.viewLink || this.buildDefaultViewLink(project.name, project.projectId)
            };
        }));
    }

    public async recordProjectEvent(
        authContext: AuthContext,
        workspaceId: string,
        projectId: string,
        action: string,
        summary: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await this.recordAuditEvent(authContext, workspaceId, action, 'project', projectId, summary, metadata);
    }

    private async upsertUser(authContext: AuthContext): Promise<UserEntity> {
        const existing = await this.userRepo.findById(authContext.tenantId, authContext.userId);
        const createdAt = existing?.createdAt || new Date().toISOString();
        const nextUser: UserEntity = {
            tenantId: authContext.tenantId,
            userId: authContext.userId,
            email: (authContext.email || `${authContext.userId}@workspace.local`).toLowerCase(),
            name: authContext.name || this.deriveNameFromEmail(authContext.email) || authContext.userId,
            status: 'active',
            createdAt,
            lastSeenAt: new Date().toISOString(),
            PK: '',
            SK: ''
        };

        await this.userRepo.createOrUpdate(nextUser);
        return (await this.userRepo.findById(authContext.tenantId, authContext.userId))!;
    }

    private async ensureDefaultWorkspace(
        authContext: AuthContext,
        subscriptionPlan: 'free' | 'pro' | 'enterprise',
        workspaceId: string
    ): Promise<WorkspaceEntity> {
        const existingWorkspace = await this.workspaceRepo.findById(authContext.tenantId, workspaceId);
        if (!existingWorkspace) {
            await this.workspaceRepo.createOrUpdate({
                tenantId: authContext.tenantId,
                workspaceId,
                name: `${authContext.name || this.deriveNameFromEmail(authContext.email) || 'Primary'} Workspace`,
                slug: this.slugify(`${authContext.name || 'primary'} workspace`),
                status: 'active',
                plan: subscriptionPlan,
                limits: this.createWorkspaceLimits(subscriptionPlan),
                createdByUserId: authContext.userId,
                createdByEmail: authContext.email,
                createdAt: new Date().toISOString()
            });

            await this.recordAuditEvent(
                authContext,
                workspaceId,
                'workspace.bootstrapped',
                'workspace',
                workspaceId,
                'Bootstrapped default workspace for the tenant'
            );
        }

        const membership = await this.workspaceMembershipRepo.findByWorkspaceAndUser(authContext.tenantId, workspaceId, authContext.userId);
        if (!membership) {
            await this.workspaceMembershipRepo.createOrUpdate({
                tenantId: authContext.tenantId,
                workspaceId,
                userId: authContext.userId,
                email: (authContext.email || `${authContext.userId}@workspace.local`).toLowerCase(),
                role: 'owner',
                status: 'active',
                joinedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            });
        }

        return (await this.workspaceRepo.findById(authContext.tenantId, workspaceId))!;
    }

    private async attachLegacyProjectsToWorkspace(tenantId: string, workspaceId: string): Promise<void> {
        const projects = await this.projectRepo.findAllForTenant(tenantId);
        const legacyProjects = projects.filter((project) => !project.workspaceId);

        for (const project of legacyProjects) {
            project.workspaceId = workspaceId;
            project.viewLink = project.viewLink || this.buildDefaultViewLink(project.name, project.projectId);
            await this.projectRepo.createOrUpdate(project);
        }
    }

    private async refreshWorkspaceUsage(tenantId: string, workspaceId: string): Promise<void> {
        const workspace = await this.workspaceRepo.findById(tenantId, workspaceId);
        if (!workspace) {
            return;
        }

        const [allProjects, allMembers] = await Promise.all([
            this.projectRepo.findAllForTenant(tenantId),
            this.workspaceMembershipRepo.findAllForWorkspace(tenantId, workspaceId)
        ]);

        const currentProjects = allProjects.filter((project) => (
            (project.workspaceId || this.getDefaultWorkspaceId(tenantId)) === workspaceId
        )).length;
        const currentSeats = allMembers.filter((member) => member.status === 'active').length;
        const nextLimits: WorkspaceLimits = {
            ...workspace.limits,
            currentProjects,
            currentSeats
        };

        if (JSON.stringify(nextLimits) !== JSON.stringify(workspace.limits)) {
            workspace.limits = nextLimits;
            await this.workspaceRepo.createOrUpdate(workspace);
        }
    }

    private async recordAuditEvent(
        authContext: AuthContext,
        workspaceId: string,
        action: string,
        targetType: 'workspace' | 'project' | 'invitation' | 'membership' | 'system',
        targetId: string,
        summary: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await this.auditEventRepo.createEvent({
            tenantId: authContext.tenantId,
            workspaceId,
            eventId: uuidv4(),
            actorUserId: authContext.userId,
            actorEmail: authContext.email,
            action,
            targetType,
            targetId,
            summary,
            metadata,
            createdAt: new Date().toISOString()
        });
    }

    private createWorkspaceLimits(plan: 'free' | 'pro' | 'enterprise'): WorkspaceLimits {
        if (plan === 'enterprise') {
            return {
                maxProjects: 250,
                maxSeats: 100,
                maxDataIngestedGb: 5000,
                currentProjects: 0,
                currentSeats: 0,
                currentDataIngestedGb: 0
            };
        }

        if (plan === 'pro') {
            return {
                maxProjects: 25,
                maxSeats: 15,
                maxDataIngestedGb: 500,
                currentProjects: 0,
                currentSeats: 0,
                currentDataIngestedGb: 0
            };
        }

        return {
            maxProjects: 5,
            maxSeats: 5,
            maxDataIngestedGb: 25,
            currentProjects: 0,
            currentSeats: 0,
            currentDataIngestedGb: 0
        };
    }

    private buildDefaultViewLink(projectName: string, projectId: string): string {
        const slug = this.slugify(projectName || projectId);
        return `https://app.sentry.local/view/${slug || projectId}`;
    }

    private buildShareUrl(tenantId: string, projectId: string, shareToken: string, appBaseUrl?: string): string {
        const baseUrl = (appBaseUrl || process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
        return `${baseUrl}/shared/${tenantId}/${projectId}/${shareToken}`;
    }

    private getDefaultWorkspaceId(tenantId: string): string {
        return `ws_${tenantId}_main`;
    }

    private slugify(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || `workspace-${Date.now()}`;
    }

    private deriveNameFromEmail(email?: string): string | undefined {
        if (!email) {
            return undefined;
        }

        const localPart = email.split('@')[0] || '';
        return localPart
            .split(/[._-]/g)
            .filter(Boolean)
            .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join(' ');
    }
}
