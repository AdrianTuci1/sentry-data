import { Router } from 'express';
import { OrganizationService } from '../services/OrganizationService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { success } from '../utils/response.js';

const router = Router();
const orgService = new OrganizationService();

const createSchema = {
  name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
  slug: { required: true, type: 'string', pattern: /^[a-z0-9-]+$/ },
  plan: { required: false, type: 'string', enum: ['free', 'team', 'enterprise'] },
};

const updateSchema = {
  name: { required: false, type: 'string', minLength: 1, maxLength: 100 },
  plan: { required: false, type: 'string', enum: ['free', 'team', 'enterprise'] },
  settings: { required: false, type: 'object' },
};

router.use(authenticate);

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const org = await orgService.create(req.body, req.user.userId);
    success(res, org, 201);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const orgs = await orgService.findByAccount(req.user.userId);
    success(res, orgs);
  } catch (err) {
    next(err);
  }
});

router.get('/:orgId', async (req, res, next) => {
  try {
    const org = await orgService.findById(req.params.orgId);
    success(res, org);
  } catch (err) {
    next(err);
  }
});

router.patch('/:orgId', validate(updateSchema), async (req, res, next) => {
  try {
    const org = await orgService.update(req.params.orgId, req.body);
    success(res, org);
  } catch (err) {
    next(err);
  }
});

router.delete('/:orgId', requireRole('admin', 'owner'), async (req, res, next) => {
  try {
    await orgService.delete(req.params.orgId);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
