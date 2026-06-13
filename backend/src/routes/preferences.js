import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { success } from '../utils/response.js';

const router = Router({ mergeParams: true });

// In-memory store for preferences (replace with DB in production)
const preferencesStore = new Map();

function getKey(orgId, projectId) {
  return `${orgId}:${projectId}`;
}

router.use(authenticate);

// Get preferences for project
router.get('/', async (req, res, next) => {
  try {
    const { orgId, projectId } = req.params;
    const key = getKey(orgId, projectId);
    const prefs = preferencesStore.get(key) || {
      version: 1,
      views: {},
      widgets: {},
      global: {
        autoHarness: true, // allow harness to decide by default
      },
    };
    success(res, prefs);
  } catch (err) {
    next(err);
  }
});

// Set preference for a view
router.post('/views/:viewId', async (req, res, next) => {
  try {
    const { orgId, projectId, viewId } = req.params;
    const { blocked, sources, title } = req.body;
    const key = getKey(orgId, projectId);
    
    let prefs = preferencesStore.get(key);
    if (!prefs) {
      prefs = {
        version: 1,
        views: {},
        widgets: {},
        global: { autoHarness: true },
      };
    }
    
    prefs.views[viewId] = {
      ...(prefs.views[viewId] || {}),
      blocked: blocked !== undefined ? blocked : prefs.views[viewId]?.blocked,
      sources: sources !== undefined ? sources : prefs.views[viewId]?.sources,
      title: title !== undefined ? title : prefs.views[viewId]?.title,
      updatedAt: new Date().toISOString(),
    };
    
    preferencesStore.set(key, prefs);
    success(res, prefs.views[viewId]);
  } catch (err) {
    next(err);
  }
});

// Set preference for a widget
router.post('/widgets/:widgetId', async (req, res, next) => {
  try {
    const { orgId, projectId, widgetId } = req.params;
    const { blocked, sources, title } = req.body;
    const key = getKey(orgId, projectId);
    
    let prefs = preferencesStore.get(key);
    if (!prefs) {
      prefs = {
        version: 1,
        views: {},
        widgets: {},
        global: { autoHarness: true },
      };
    }
    
    prefs.widgets[widgetId] = {
      ...(prefs.widgets[widgetId] || {}),
      blocked: blocked !== undefined ? blocked : prefs.widgets[widgetId]?.blocked,
      sources: sources !== undefined ? sources : prefs.widgets[widgetId]?.sources,
      title: title !== undefined ? title : prefs.widgets[widgetId]?.title,
      updatedAt: new Date().toISOString(),
    };
    
    preferencesStore.set(key, prefs);
    success(res, prefs.widgets[widgetId]);
  } catch (err) {
    next(err);
  }
});

// Remove preference (let harness decide)
router.delete('/views/:viewId', async (req, res, next) => {
  try {
    const { orgId, projectId, viewId } = req.params;
    const key = getKey(orgId, projectId);
    const prefs = preferencesStore.get(key);
    
    if (prefs && prefs.views[viewId]) {
      delete prefs.views[viewId];
      preferencesStore.set(key, prefs);
    }
    
    success(res, { removed: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/widgets/:widgetId', async (req, res, next) => {
  try {
    const { orgId, projectId, widgetId } = req.params;
    const key = getKey(orgId, projectId);
    const prefs = preferencesStore.get(key);
    
    if (prefs && prefs.widgets[widgetId]) {
      delete prefs.widgets[widgetId];
      preferencesStore.set(key, prefs);
    }
    
    success(res, { removed: true });
  } catch (err) {
    next(err);
  }
});

// Global preferences
router.post('/global', async (req, res, next) => {
  try {
    const { orgId, projectId } = req.params;
    const { autoHarness } = req.body;
    const key = getKey(orgId, projectId);
    
    let prefs = preferencesStore.get(key);
    if (!prefs) {
      prefs = {
        version: 1,
        views: {},
        widgets: {},
        global: { autoHarness: true },
      };
    }
    
    if (autoHarness !== undefined) {
      prefs.global.autoHarness = autoHarness;
    }
    
    preferencesStore.set(key, prefs);
    success(res, prefs.global);
  } catch (err) {
    next(err);
  }
});

export default router;
