import { Router, Request, Response } from 'express';
import { dynamo } from '../../dal/dynamo';
import { requireAuth } from '../middlewares/context';

const router = Router();

// GET /api/projects/:projectId/state
router.get('/:projectId/state', requireAuth, async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const tenantId = req.user!.tenantId; // Safe due to requireAuth

    try {
        const state = await dynamo.getProjectState(tenantId, projectId);
        if (!state) {
            return res.status(404).json({ error: 'Project state not found' });
        }
        res.json(state);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch project state' });
    }
});

// POST /api/projects/:projectId/cost (Internal/Mock update)
router.post('/:projectId/cost', requireAuth, async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { cost } = req.body;
    const tenantId = req.user!.tenantId;

    try {
        await dynamo.updateProjectCost(tenantId, projectId, cost);
        res.json({ success: true, newCost: cost });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update cost' });
    }
});

export default router;
