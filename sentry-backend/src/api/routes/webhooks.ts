import { Router, Request, Response } from 'express';
import { dynamo } from '../../dal/dynamo';
import { sseManager } from '../../services/sse/SSEManager';

const router = Router();

// POST /api/webhooks/sandbox-callback
// Called by E2B/Modal when a job finishes
router.post('/sandbox-callback', async (req: Request, res: Response) => {
    const { tenantId, projectId, layer, status, output, jobId } = req.body;

    console.log(`Received webhook for Job ${jobId}, Status: ${status}`);

    // Validate minimal payload
    if (!jobId || !status) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    try {
        // 1. Update State in DynamoDB (Mock call for now, can extend dynamo util)
        // await dynamo.updateJobStatus(tenantId, projectId, jobId, status);

        // 2. Notify Frontend via SSE
        if (tenantId) {
            sseManager.broadcastToTenant(tenantId, {
                type: 'JOB_COMPLETED',
                jobId,
                status,
                layer,
                output
            });
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Processing failed' });
    }
});

export default router;
