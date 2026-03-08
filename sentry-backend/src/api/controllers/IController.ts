import { Router } from 'express';

// Interface that all Controllers must implement to mount their routes
export interface IController {
    path: string;
    router: Router;
    initRoutes(): void;
}
