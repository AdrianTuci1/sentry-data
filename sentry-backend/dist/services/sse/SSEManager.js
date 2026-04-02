"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSEManager = void 0;
class SSEManager {
    constructor() {
        this.clients = new Map();
    }
    /**
     * Registers a new client connection for a specific tenant.
     */
    addClient(tenantId, req, res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // Prevent Nginx/Proxy buffering
        res.setHeader('X-Accel-Buffering', 'no');
        // Send initial connection message immediately
        res.write(`data: ${JSON.stringify({ type: 'connected', message: "Connected to Sentry Analytics Stream" })}\n\n`);
        const tenantClients = this.clients.get(tenantId) || [];
        tenantClients.push(res);
        this.clients.set(tenantId, tenantClients);
        console.log(`[SSE] Client connected for Tenant: ${tenantId}. Total: ${tenantClients.length}`);
        // Setup heartbeat interval (every 30 seconds) to prevent idle timeouts
        const heartbeat = setInterval(() => {
            res.write(': heartbeat\n\n');
        }, 30000);
        // Cleanup on connection close
        req.on('close', () => {
            clearInterval(heartbeat);
            this.removeClient(tenantId, res);
        });
    }
    /**
     * Removes a disconnected client
     */
    removeClient(tenantId, res) {
        const tenantClients = this.clients.get(tenantId) || [];
        const updatedClients = tenantClients.filter(client => client !== res);
        if (updatedClients.length === 0) {
            this.clients.delete(tenantId);
        }
        else {
            this.clients.set(tenantId, updatedClients);
        }
        console.log(`[SSE] Client disconnected for Tenant: ${tenantId}. Remaining: ${updatedClients.length}`);
    }
    /**
     * Broadcasts an event to all connected clients of a specific tenant.
     * Often called after the Analytics Worker finishes processing new generic data.
     */
    broadcastToTenant(tenantId, eventType, payload) {
        const tenantClients = this.clients.get(tenantId);
        if (!tenantClients || tenantClients.length === 0) {
            return; // No active listeners for this tenant
        }
        const dataString = JSON.stringify({ type: eventType, data: payload });
        tenantClients.forEach(client => {
            // Standard SSE format: data: {...}\n\n
            client.write(`data: ${dataString}\n\n`);
        });
        console.log(`[SSE] Broadcasted '${eventType}' to ${tenantClients.length} clients of Tenant ${tenantId}`);
    }
}
exports.SSEManager = SSEManager;
