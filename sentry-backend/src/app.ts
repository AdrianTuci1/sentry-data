import express, { Application } from 'express';
import cors from 'cors';
import { requestLogger } from './api/middlewares/logger';
import { globalErrorHandler } from './api/middlewares/errorHandler';
import { IController } from './api/controllers/IController';

/**
 * Object Oriented Application Wrapper
 */
export class App {
    public expressApp: Application;

    constructor(controllers: IController[]) {
        this.expressApp = express();

        this.initializeMiddlewares();
        this.initializeControllers(controllers);
        this.initializeErrorHandling();
    }

    private initializeMiddlewares() {
        this.expressApp.use(cors());
        this.expressApp.use(express.json());
        this.expressApp.use(requestLogger);
    }

    private initializeControllers(controllers: IController[]) {
        // Fast endpoint
        this.expressApp.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'api.sentry.app' });
        });

        const apiRouter = express.Router();

        controllers.forEach((controller) => {
            apiRouter.use(controller.path, controller.router);
        });

        this.expressApp.use('/api', apiRouter);
    }

    private initializeErrorHandling() {
        // Must be attached after controllers
        this.expressApp.use(globalErrorHandler);
    }
}
