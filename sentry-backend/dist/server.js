"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const container_1 = require("./core/container");
const config_1 = require("./config");
/**
 * Server Lifecycle Manager
 */
class Server {
    constructor() {
        this.shutdown = () => {
            console.log('\n😴 Shutting down Server gracefully...');
            if (this.server) {
                this.server.close(() => {
                    console.log('Central Server HTTP listener closed.');
                    process.exit(0);
                });
            }
            else {
                process.exit(0);
            }
        };
        console.log('Initializing Central Server dependencies (OOP Route)...');
        // Boot up our manual IoC container
        const container = (0, container_1.initContainer)();
        // Pass controllers directly to the generic express App wrapper
        this.app = new app_1.App(container.controllers);
    }
    start() {
        this.server = this.app.expressApp.listen(config_1.config.port, () => {
            console.log(`🚀 Central Server running on port ${config_1.config.port}`);
            console.log(`🌍 Environment: ${config_1.config.env}`);
            console.log(`🧠 PNE Service: ${config_1.config.parrot.pneApiUrl ? 'remote' : 'local_fallback'}`);
            console.log(`🛡️ Sentinel Service: ${config_1.config.parrot.sentinelApiUrl ? 'remote' : 'local_fallback'}`);
            console.log(`🧪 ML Executor: ${config_1.config.parrot.mlExecutorApiUrl ? 'remote' : 'not_configured'}`);
        });
        this.setupProcessHandlers();
    }
    setupProcessHandlers() {
        process.on('SIGINT', this.shutdown);
        process.on('SIGTERM', this.shutdown);
    }
}
// Instantiate and start server
const server = new Server();
server.start();
