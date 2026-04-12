import { NextFunction, Request, Response, Router } from 'express';
import { IController } from './IController';
import { requireAuth } from '../middlewares/auth';
import { AuthService } from '../../application/services/AuthService';
import { ControlPlaneService } from '../../application/services/ControlPlaneService';
import { AppError } from '../middlewares/errorHandler';

export class AccountController implements IController {
    public path = '/account';
    public router = Router();

    constructor(
        private readonly authService: AuthService,
        private readonly controlPlaneService: ControlPlaneService
    ) {
        this.initRoutes();
    }

    public initRoutes() {
        const auth = requireAuth(this.authService);
        this.router.get('/me', auth, this.getMe);
    }

    private getMe = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.authContext) {
                throw new AppError('Auth context missing from request.', 500);
            }

            const snapshot = await this.controlPlaneService.getAccountSnapshot(req.authContext);
            res.status(200).json({
                status: 'success',
                data: snapshot
            });
        } catch (error) {
            next(error);
        }
    };
}
