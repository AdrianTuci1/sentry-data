import { Router, Request, Response } from 'express';
import { IController } from './IController';

// A simple Health Controller to verify our DI setup is working
export class HealthController implements IController {
    public path = '/sys';
    public router = Router();

    constructor() {
        this.initRoutes();
    }

    public initRoutes() {
        console.log(`[Route Mounted] ${this.path}/ping`);
        this.router.get('/ping', this.pong);
    }

    private pong = (req: Request, res: Response) => {
        res.status(200).json({ status: 'Container and Routing are Healthy!' });
    };
}
