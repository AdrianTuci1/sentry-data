"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orchestrator_1 = require("../../services/orchestrator");
const SSEManager_1 = require("../../services/sse/SSEManager");
const context_1 = require("../middlewares/context");
const router = (0, express_1.Router)();
// POST /api/orchestration/trigger-sync
// Triggers ingestion (e.g. Airbyte sync)
router.post('/trigger-sync', context_1.requireAuth, async (req, res) => {
    const { source, jobId } = req.body;
    const tenantId = req.user.tenantId;
    try {
        // 1. Trigger EventBridge Event
        await orchestrator_1.orchestrator.triggerEvent('sentry.api', 'TriggerSync', {
            tenantId,
            source,
            jobId,
            timestamp: new Date().toISOString()
        });
        // 2. Notify Frontend via SSE (Optimistic UI)
        SSEManager_1.sseManager.broadcastToTenant(tenantId, {
            type: 'JOB_STARTED',
            jobId,
            status: 'SYNCING'
        });
        res.json({ success: true, message: 'Sync triggered successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to trigger sync' });
    }
});
// POST /api/orchestration/run-flow
// Manually start a Step Function execution
router.post('/run-flow', context_1.requireAuth, async (req, res) => {
    const { stateMachineArn, input } = req.body;
    try {
        const result = await orchestrator_1.orchestrator.startWorkflow(stateMachineArn, input || {});
        res.json({ success: true, executionArn: result.executionArn });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to start flow' });
    }
});
exports.default = router;
