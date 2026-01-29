import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface SSEClient {
    id: string;
    res: Response;
    tenantId?: string; // Optional: for targeted updates per tenant
}

export class SSEManager {
    private clients: SSEClient[] = [];

    // Add a new client
    addClient(res: Response, tenantId?: string) {
        const id = uuidv4();
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
    sendToClient(clientId: string, data: any) {
        const client = this.clients.find((c) => c.id === clientId);
        if (client) {
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }

    // Broadcast to all connected clients
    broadcast(data: any) {
        this.clients.forEach((client) => {
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        });
    }

    // Broadcast to all clients of a specific tenant
    broadcastToTenant(tenantId: string, data: any) {
        this.clients
            .filter((client) => client.tenantId === tenantId)
            .forEach((client) => {
                client.res.write(`data: ${JSON.stringify(data)}\n\n`);
            });
    }
}

export const sseManager = new SSEManager();
