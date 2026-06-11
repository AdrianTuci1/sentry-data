import { Router } from 'express';
import { SpecService } from '../services/SpecService.js';
import { authenticate } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';

const router = Router({ mergeParams: true });
const specService = new SpecService();

router.use(authenticate);

// GET /specs/:orgId/:projectId — return cached spec
router.get('/', async (req, res, next) => {
  try {
    const { orgId, projectId } = req.params;
    const spec = await specService.getSpec(orgId, projectId);

    if (!spec) {
      return error(res, 'No spec found. Use POST /generate to create one.', 404, 'SPEC_NOT_FOUND');
    }

    success(res, spec);
  } catch (err) {
    next(err);
  }
});

// GET /specs/:orgId/:projectId/data-catalog — return data catalog
router.get('/data-catalog', async (req, res, next) => {
  try {
    const { orgId, projectId } = req.params;
    const catalog = await specService.getDataCatalog(orgId, projectId);

    if (!catalog) {
      return error(res, 'No data catalog found. Generate a spec first.', 404, 'CATALOG_NOT_FOUND');
    }

    success(res, catalog);
  } catch (err) {
    next(err);
  }
});

// POST /specs/:orgId/:projectId/generate — trigger spec generation
router.post('/generate', async (req, res, next) => {
  try {
    const { orgId, projectId } = req.params;
    const userId = req.user?.userId || 'system';

    const result = await specService.generateSpec(orgId, projectId, userId);

    success(res, {
      message: 'Spec generation started',
      ...result,
    }, 202);
  } catch (err) {
    next(err);
  }
});

// DELETE /specs/:orgId/:projectId — invalidate cached spec
router.delete('/', async (req, res, next) => {
  try {
    const { orgId, projectId } = req.params;
    const result = await specService.invalidateSpec(orgId, projectId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
