export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';
export type WorkspaceMembershipStatus = 'active' | 'pending' | 'removed';
export type WorkspaceInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type ProjectAccessRole = 'admin' | 'contributor' | 'viewer';

export interface WorkspaceLimits {
    maxProjects: number;
    maxSeats: number;
    maxDataIngestedGb: number;
    currentProjects: number;
    currentSeats: number;
    currentDataIngestedGb: number;
}

export interface AuthContext {
    tenantId: string;
    userId: string;
    role: string;
    email?: string;
    name?: string;
    workspaceId?: string;
}

export interface ProjectMemberInput {
    account: string;
    access: ProjectAccessRole;
    userId?: string;
}
