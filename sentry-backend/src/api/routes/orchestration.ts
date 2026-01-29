import { Router, Request, Response } from 'express';
import { orchestrator } from '../../services/orchestrator';
import { sseManager } from '../../services/sse/SSEManager';
import { requireAuth } from '../middlewares/context';

const router = Router();

// POST /api/orchestration/trigger-sync
// Triggers ingestion (e.g. Airbyte sync)
router.post('/trigger-sync', requireAuth, async (req: Request, res: Response) => {
    const { source, jobId } = req.body;
    const tenantId = req.user!.tenantId;

    try {
        // 1. Trigger EventBridge Event
        await orchestrator.triggerEvent('sentry.api', 'TriggerSync', {
            tenantId,
            source,
            jobId,
            timestamp: new Date().toISOString()
        });

        // 2. Notify Frontend via SSE (Optimistic UI)
        sseManager.broadcastToTenant(tenantId, {
            type: 'JOB_STARTED',
            jobId,
            status: 'SYNCING'
        });

        res.json({ success: true, message: 'Sync triggered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to trigger sync' });
    }
});

// POST /api/orchestration/run-flow
// Manually start a Step Function execution
router.post('/run-flow', requireAuth, async (req: Request, res: Response) => {
    const { stateMachineArn, input } = req.body;

    try {
        const result = await orchestrator.startWorkflow(stateMachineArn, input || {});
        res.json({ success: true, executionArn: result.executionArn });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start flow' });
    }
});

export default router;
