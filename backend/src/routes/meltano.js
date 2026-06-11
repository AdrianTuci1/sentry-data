import { Router } from 'express';
import { MeltanoService } from '../services/MeltanoService.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { success } from '../utils/response.js';

const router = Router({ mergeParams: true });
const meltanoService = new MeltanoService();

const configSchema = {
  type: { required: true, type: 'string' },
  variant: { required: false, type: 'string' },
  settings: { required: true, type: 'object' },
  schedule: { required: false, type: 'string' },
};

router.use(authenticate);

router.get('/credentials', async (req, res, next) => {
  try {
    const { orgId, projectId } = req.params;
    const credentials = await meltanoService.getLandingZoneCredentials(orgId, projectId);
    success(res, credentials);
  } catch (err) {
    next(err);
  }
});

router.post('/validate', validate(configSchema), async (req, res, next) => {
  try {
    const { type, settings } = req.body;
    const result = await meltanoService.validateExtractorConfig(type, settings);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

router.post('/config/:integrationId', validate(configSchema), async (req, res, next) => {
  try {
    const { orgId, projectId, integrationId } = req.params;
    const config = await meltanoService.generateMeltanoConfig(orgId, projectId, integrationId, req.body);
    success(res, config);
  } catch (err) {
    next(err);
  }
});

router.post('/cleanup/:integrationId', async (req, res, next) => {
  try {
    const { orgId, projectId, integrationId } = req.params;
    const result = await meltanoService.cleanupLandingZone(orgId, projectId, integrationId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
