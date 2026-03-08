import { Request, Response } from 'express';

export class SSEManager {
    // Map of tenantId to array of active Response connections
    private clients: Map<string, Response[]>;

    constructor() {
        this.clients = new Map<string, Response[]>();
    }

    /**
     * Registers a new client connection for a specific tenant.
     */
    public addClient(tenantId: string, req: Request, res: Response): void {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Send initial heartbeat
        res.write('data: {"message": "Connected to Sentry Analytics Stream"}\n\n');

        const tenantClients = this.clients.get(tenantId) || [];
        tenantClients.push(res);
        this.clients.set(tenantId, tenantClients);

        console.log(`[SSE] Client connected for Tenant: ${tenantId}. Total: ${tenantClients.length}`);

        // Cleanup on connection close
        req.on('close', () => {
            this.removeClient(tenantId, res);
        });
    }

    /**
     * Removes a disconnected client
     */
    private removeClient(tenantId: string, res: Response): void {
        const tenantClients = this.clients.get(tenantId) || [];
        const updatedClients = tenantClients.filter(client => client !== res);

        if (updatedClients.length === 0) {
            this.clients.delete(tenantId);
        } else {
            this.clients.set(tenantId, updatedClients);
        }

        console.log(`[SSE] Client disconnected for Tenant: ${tenantId}. Remaining: ${updatedClients.length}`);
    }

    /**
     * Broadcasts an event to all connected clients of a specific tenant.
     * Often called after the Analytics Worker finishes processing new generic data.
     */
    public broadcastToTenant(tenantId: string, eventType: string, payload: any): void {
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
