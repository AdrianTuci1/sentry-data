"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dynamo_1 = require("../../dal/dynamo");
const context_1 = require("../middlewares/context");
const router = (0, express_1.Router)();
// GET /api/projects/:projectId/state
router.get('/:projectId/state', context_1.requireAuth, async (req, res) => {
    const { projectId } = req.params;
    const tenantId = req.user.tenantId; // Safe due to requireAuth
    try {
        const state = await dynamo_1.dynamo.getProjectState(tenantId, projectId);
        if (!state) {
            return res.status(404).json({ error: 'Project state not found' });
        }
        res.json(state);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch project state' });
    }
});
// POST /api/projects/:projectId/cost (Internal/Mock update)
router.post('/:projectId/cost', context_1.requireAuth, async (req, res) => {
    const { projectId } = req.params;
    const { cost } = req.body;
    const tenantId = req.user.tenantId;
    try {
        await dynamo_1.dynamo.updateProjectCost(tenantId, projectId, cost);
        res.json({ success: true, newCost: cost });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update cost' });
    }
});
exports.default = router;
