import { App } from './app';
import { initContainer } from './core/container';
import { config } from './config';
import http from 'http';

/**
 * Server Lifecycle Manager
 */
class Server {
    private app: App;
    private server!: http.Server;

    constructor() {
        console.log('Initializing Central Server dependencies (OOP Route)...');

        // Boot up our manual IoC container
        const container = initContainer();

        // Pass controllers directly to the generic express App wrapper
        this.app = new App(container.controllers);
    }

    public start() {
        this.server = this.app.expressApp.listen(config.port, () => {
            console.log(`🚀 Central Server running on port ${config.port}`);
            console.log(`🌍 Environment: ${config.env}`);
            console.log(`🧠 PNE Service: ${config.parrot.pneApiUrl ? 'remote' : 'local_fallback'}`);
            console.log(`🛡️ Sentinel Service: ${config.parrot.sentinelApiUrl ? 'remote' : 'local_fallback'}`);
            console.log(`🧪 ML Executor: ${config.parrot.mlExecutorApiUrl ? 'remote' : 'not_configured'}`);
        });

        this.setupProcessHandlers();
    }

    private setupProcessHandlers() {
        process.on('SIGINT', this.shutdown);
        process.on('SIGTERM', this.shutdown);
    }

    private shutdown = () => {
        console.log('\n😴 Shutting down Server gracefully...');
        if (this.server) {
            this.server.close(() => {
                console.log('Central Server HTTP listener closed.');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    };
}

// Instantiate and start server
const server = new Server();
server.start();
