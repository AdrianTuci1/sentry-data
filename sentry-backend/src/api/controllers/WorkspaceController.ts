import { NextFunction, Request, Response, Router } from 'express';
import { IController } from './IController';
import { AuthService } from '../../application/services/AuthService';
import { ControlPlaneService } from '../../application/services/ControlPlaneService';
import { requireAuth } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import { WorkspaceRole } from '../../types/controlPlane';

export class WorkspaceController implements IController {
    public path = '/workspaces';
    public router = Router();

    constructor(
        private readonly authService: AuthService,
        private readonly controlPlaneService: ControlPlaneService
    ) {
        this.initRoutes();
    }

    public initRoutes() {
        const auth = requireAuth(this.authService);

        this.router.get('/', auth, this.listWorkspaces);
        this.router.post('/', auth, this.createWorkspace);
        this.router.get('/:workspaceId', auth, this.getWorkspace);
        this.router.get('/:workspaceId/members', auth, this.getMembers);
        this.router.get('/:workspaceId/invitations', auth, this.getInvitations);
        this.router.post('/:workspaceId/invitations', auth, this.createInvitation);
        this.router.get('/:workspaceId/activity', auth, this.getActivity);
    }

    private listWorkspaces = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.authContext) {
                throw new AppError('Auth context missing from request.', 500);
            }

            const workspaces = await this.controlPlaneService.listAccessibleWorkspaces(req.authContext);
            res.status(200).json({
                status: 'success',
                data: workspaces
            });
        } catch (error) {
            next(error);
        }
    };

    private createWorkspace = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.authContext) {
                throw new AppError('Auth context missing from request.', 500);
            }

            const { name } = req.body as { name?: string };
            if (!name?.trim()) {
                res.status(400).json({ error: 'Workspace name is required.' });
                return;
            }

            const workspace = await this.controlPlaneService.createWorkspace(req.authContext, { name });
            res.status(201).json({
                status: 'success',
                data: workspace
            });
        } catch (error) {
            next(error);
        }
    };

    private getWorkspace = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.authContext) {
                throw new AppError('Auth context missing from request.', 500);
            }

            const detail = await this.controlPlaneService.getWorkspaceDetail(req.authContext, req.params.workspaceId);
            res.status(200).json({
                status: 'success',
                data: detail
            });
        } catch (error) {
            next(error);
        }
    };

    private getMembers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.authContext) {
                throw new AppError('Auth context missing from request.', 500);
            }

            const members = await this.controlPlaneService.listWorkspaceMembers(req.authContext, req.params.workspaceId);
            res.status(200).json({
                status: 'success',
                data: members
            });
        } catch (error) {
            next(error);
        }
    };

    private getInvitations = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.authContext) {
                throw new AppError('Auth context missing from request.', 500);
            }

            const detail = await this.controlPlaneService.getWorkspaceDetail(req.authContext, req.params.workspaceId);
            res.status(200).json({
                status: 'success',
                data: detail.invitations
            });
        } catch (error) {
            next(error);
        }
    };

    private createInvitation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.authContext) {
                throw new AppError('Auth context missing from request.', 500);
            }

            const { email, role, projectIds } = req.body as { email?: string; role?: WorkspaceRole; projectIds?: string[] };
            if (!email?.trim()) {
                res.status(400).json({ error: 'Invite email is required.' });
                return;
            }

            const invitation = await this.controlPlaneService.createInvitation(req.authContext, req.params.workspaceId, {
                email,
                role: role || 'member',
                projectIds
            });

            res.status(201).json({
                status: 'success',
                data: {
                    ...invitation,
                    inviteUrl: `${(process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')}/join/${invitation.tenantId}/${invitation.workspaceId}/${invitation.inviteToken}`
                }
            });
        } catch (error) {
            next(error);
        }
    };

    private getActivity = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.authContext) {
                throw new AppError('Auth context missing from request.', 500);
            }

            const limit = Number(req.query.limit || 50);
            const activity = await this.controlPlaneService.listWorkspaceActivity(req.authContext, req.params.workspaceId, limit);
            res.status(200).json({
                status: 'success',
                data: activity
            });
        } catch (error) {
            next(error);
        }
    };
}
