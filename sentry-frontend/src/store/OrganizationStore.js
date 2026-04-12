import { makeAutoObservable, runInAction } from "mobx";
import { AccountService, WorkspaceService } from "../api/core";
import { Organization, User } from "./models";

export class OrganizationStore {
    rootStore = null;
    organizations = [];
    currentOrgId = null;
    currentUser = null;
    workspaceDetails = new Map();
    isLoading = false;
    error = null;
    isUsingMockFallback = false;

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
    }

    get currentOrg() {
        return this.organizations.find(org => org.id === this.currentOrgId) || null;
    }

    get currentOrgMembers() {
        return this.workspaceDetails.get(this.currentOrgId)?.members || [];
    }

    get currentOrgInvitations() {
        return this.workspaceDetails.get(this.currentOrgId)?.invitations || [];
    }

    get currentOrgActivity() {
        return this.workspaceDetails.get(this.currentOrgId)?.activity || [];
    }

    get currentMembership() {
        return this.workspaceDetails.get(this.currentOrgId)?.membership || null;
    }

    async initialize() {
        await this.loadAccount();
    }

    async loadAccount() {
        this.isLoading = true;
        this.error = null;

        try {
            const res = await AccountService.getMe();
            const data = res.data || {};
            const currentWorkspaceId = this.resolveInitialWorkspaceId(data);

            runInAction(() => {
                this.currentUser = new User(data.user || {});
                this.organizations = Array.isArray(data.workspaces)
                    ? data.workspaces.map((workspace) => new Organization({
                        ...workspace,
                        id: workspace.workspaceId,
                        membershipRole: workspace.workspaceId === data.currentWorkspace?.workspaceId
                            ? data.currentMembership?.role
                            : null
                    }))
                    : [];
                this.currentOrgId = currentWorkspaceId;
                this.setWorkspaceDetail(currentWorkspaceId, {
                    workspace: data.currentWorkspace,
                    membership: data.currentMembership,
                    invitations: data.invitations || [],
                    activity: data.activity || [],
                    members: []
                });
            });

            if (currentWorkspaceId) {
                localStorage.setItem('sentry_workspace_id', currentWorkspaceId);
                await this.loadWorkspaceDetail(currentWorkspaceId);
                await this.rootStore.projectStore.loadProjectsForOrg(currentWorkspaceId);
            } else {
                this.loadMockWorkspaceFallback();
            }
        } catch (error) {
            console.error('[OrganizationStore] Failed to load account context:', error);
            runInAction(() => {
                this.error = error;
                this.loadMockWorkspaceFallback();
            });
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }

    async selectOrg(orgId) {
        if (!this.organizations.some((org) => org.id === orgId)) {
            return;
        }

        runInAction(() => {
            this.currentOrgId = orgId;
        });
        localStorage.setItem('sentry_workspace_id', orgId);

        await this.loadWorkspaceDetail(orgId);
        await this.rootStore.projectStore.loadProjectsForOrg(orgId);
    }

    async createOrganization(data) {
        const name = typeof data === 'string' ? data : data?.name;
        if (!name?.trim()) {
            return null;
        }

        const res = await WorkspaceService.createWorkspace(name.trim());
        const workspace = new Organization({
            ...res.data,
            id: res.data.workspaceId
        });

        runInAction(() => {
            this.organizations.push(workspace);
            this.currentOrgId = workspace.id;
        });

        localStorage.setItem('sentry_workspace_id', workspace.id);
        await this.loadWorkspaceDetail(workspace.id);
        await this.rootStore.projectStore.loadProjectsForOrg(workspace.id);
        return workspace;
    }

    async inviteMember({ email, role, projectIds }) {
        if (!this.currentOrgId) {
            throw new Error('No workspace selected');
        }

        const res = await WorkspaceService.createInvitation(this.currentOrgId, { email, role, projectIds });
        await this.loadWorkspaceDetail(this.currentOrgId);
        return res.data;
    }

    async acceptInvitation(tenantId, workspaceId, inviteToken) {
        const res = await AccountService.acceptInvitation(tenantId, workspaceId, inviteToken);
        localStorage.setItem('sentry_workspace_id', workspaceId);
        await this.loadAccount();
        return res.data;
    }

    async loadWorkspaceDetail(workspaceId) {
        if (!workspaceId) {
            return null;
        }

        try {
            const res = await WorkspaceService.getWorkspace(workspaceId);
            const detail = res.data;

            runInAction(() => {
                this.setWorkspaceDetail(workspaceId, detail);
                this.upsertOrganization({
                    ...detail.workspace,
                    id: detail.workspace.workspaceId,
                    membershipRole: detail.membership?.role
                });
            });

            return detail;
        } catch (error) {
            console.error('[OrganizationStore] Failed to load workspace detail:', error);
            if (this.isUsingMockFallback) {
                return this.workspaceDetails.get(workspaceId) || null;
            }
            throw error;
        }
    }

    setWorkspaceDetail(workspaceId, detail) {
        if (!workspaceId || !detail) {
            return;
        }

        this.workspaceDetails.set(workspaceId, {
            workspace: detail.workspace || null,
            membership: detail.membership || null,
            members: detail.members || [],
            invitations: detail.invitations || [],
            activity: detail.activity || []
        });
    }

    upsertOrganization(data) {
        const existing = this.organizations.find((org) => org.id === (data.id || data.workspaceId));
        if (existing) {
            existing.update(data);
            return existing;
        }

        const organization = new Organization(data);
        this.organizations.push(organization);
        return organization;
    }

    resolveInitialWorkspaceId(data) {
        const storedWorkspaceId = localStorage.getItem('sentry_workspace_id');
        if (storedWorkspaceId && Array.isArray(data.workspaces) && data.workspaces.some((workspace) => workspace.workspaceId === storedWorkspaceId)) {
            return storedWorkspaceId;
        }

        return data.currentWorkspace?.workspaceId
            || data.workspaces?.[0]?.workspaceId
            || null;
    }

    loadMockWorkspaceFallback() {
        const mockWorkspaceId = 'org_sentry';
        const mockUser = new User({
            id: 'mock_user_adrian',
            name: 'Adrian Tuci',
            email: 'adrian.tucicovenco@gmail.com'
        });
        const mockOrganization = new Organization({
            id: mockWorkspaceId,
            workspaceId: mockWorkspaceId,
            name: 'Sentry Data',
            slug: 'sentry-data',
            status: 'active',
            plan: 'pro',
            membershipRole: 'owner',
            limits: {
                maxProjects: 25,
                maxSeats: 15,
                maxDataIngestedGb: 500,
                currentProjects: 3,
                currentSeats: 1,
                currentDataIngestedGb: 12
            }
        });

        this.currentUser = mockUser;
        this.organizations = [mockOrganization];
        this.currentOrgId = mockWorkspaceId;
        this.isUsingMockFallback = true;
        this.setWorkspaceDetail(mockWorkspaceId, {
            workspace: mockOrganization,
            membership: {
                workspaceId: mockWorkspaceId,
                userId: mockUser.id,
                email: mockUser.email,
                role: 'owner',
                status: 'active',
                joinedAt: new Date().toISOString()
            },
            members: [
                {
                    userId: mockUser.id,
                    email: mockUser.email,
                    name: mockUser.name,
                    role: 'owner',
                    status: 'active',
                    joined: new Date().toISOString()
                }
            ],
            invitations: [],
            activity: [
                {
                    eventId: 'mock_activity_workspace_bootstrap',
                    action: 'workspace.mock_fallback_loaded',
                    summary: 'Loaded demo workspace because real account data is not available',
                    actorEmail: mockUser.email,
                    createdAt: new Date().toISOString()
                }
            ]
        });
        localStorage.setItem('sentry_workspace_id', mockWorkspaceId);
        this.rootStore.projectStore.loadMockProjects();
    }
}
