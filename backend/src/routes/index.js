import { Router } from 'express';
import authRoutes from './auth.js';
import orgRoutes from './organizations.js';
import projectRoutes from './projects.js';
import agentRoutes from './agents.js';
import integrationRoutes from './integrations.js';
import analyticsRoutes from './analytics.js';
import meltanoRoutes from './meltano.js';
import specsRoutes from './specs.js';
import alertsRoutes from './alerts.js';
import chatRoutes from './chat.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/organizations', orgRoutes);
router.use('/organizations/:orgId/projects', projectRoutes);
router.use('/organizations/:orgId/projects/:projectId/agents', agentRoutes);
router.use('/organizations/:orgId/projects/:projectId/integrations', integrationRoutes);
router.use('/organizations/:orgId/projects/:projectId/analytics', analyticsRoutes);
router.use('/organizations/:orgId/projects/:projectId/meltano', meltanoRoutes);
router.use('/organizations/:orgId/projects/:projectId/specs', specsRoutes);
router.use('/organizations/:orgId/projects/:projectId/alerts', alertsRoutes);
router.use('/organizations/:orgId/projects/:projectId/chat', chatRoutes);

export default router;
