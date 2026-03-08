"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const logger_1 = require("./api/middlewares/logger");
const errorHandler_1 = require("./api/middlewares/errorHandler");
/**
 * Object Oriented Application Wrapper
 */
class App {
    constructor(controllers) {
        this.expressApp = (0, express_1.default)();
        this.initializeMiddlewares();
        this.initializeControllers(controllers);
        this.initializeErrorHandling();
    }
    initializeMiddlewares() {
        this.expressApp.use((0, cors_1.default)());
        this.expressApp.use(express_1.default.json());
        this.expressApp.use(logger_1.requestLogger);
    }
    initializeControllers(controllers) {
        // Fast endpoint
        this.expressApp.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'api.sentry.app' });
        });
        const apiRouter = express_1.default.Router();
        controllers.forEach((controller) => {
            apiRouter.use(controller.path, controller.router);
        });
        this.expressApp.use('/api', apiRouter);
    }
    initializeErrorHandling() {
        // Must be attached after controllers
        this.expressApp.use(errorHandler_1.globalErrorHandler);
    }
}
exports.App = App;
