import { Router } from 'express';
import projectRoutes from './projects';
import orchestrationRoutes from './orchestration';
import layersRoutes from './layers';
import webhookRoutes from './webhooks';

const router = Router();

router.use('/projects', projectRoutes);
router.use('/orchestration', orchestrationRoutes);
router.use('/layers', layersRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
