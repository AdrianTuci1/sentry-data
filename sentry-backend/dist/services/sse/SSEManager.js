"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseManager = exports.SSEManager = void 0;
const uuid_1 = require("uuid");
class SSEManager {
    constructor() {
        this.clients = [];
    }
    // Add a new client
    addClient(res, tenantId) {
        const id = (0, uuid_1.v4)();
        const client = { id, res, tenantId };
        this.clients.push(client);
        // Initial connection setup
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });
        const keepAlive = setInterval(() => {
            res.write(': keep-alive\n\n');
        }, 15000);
        // Remove client on close
        res.on('close', () => {
            clearInterval(keepAlive);
            this.clients = this.clients.filter((c) => c.id !== id);
        });
        // Send initial connection success message
        this.sendToClient(id, { type: 'CONNECTION_ESTABLISHED', id });
    }
    // Send an event to a specific client
    sendToClient(clientId, data) {
        const client = this.clients.find((c) => c.id === clientId);
        if (client) {
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }
    // Broadcast to all connected clients
    broadcast(data) {
        this.clients.forEach((client) => {
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        });
    }
    // Broadcast to all clients of a specific tenant
    broadcastToTenant(tenantId, data) {
        this.clients
            .filter((client) => client.tenantId === tenantId)
            .forEach((client) => {
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        });
    }
}
exports.SSEManager = SSEManager;
exports.sseManager = new SSEManager();
