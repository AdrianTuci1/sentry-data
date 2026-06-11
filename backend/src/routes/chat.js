import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/index.js';

const router = Router();

/**
 * POST /chat/message — proxy request to Chat Service (Cloud Run)
 *
 * Frontend → Backend (authenticate) → Chat Service (internal)
 * The backend validates the user's JWT, then forwards the request
 * to the Chat Service with an internal token. The Chat Service uses
 * the user's JWT to call other backend APIs on the user's behalf.
 */
router.post('/message', authenticate, async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const orgId = req.params.orgId;
    const projectId = req.params.projectId;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    // Forward to Chat Service with SSE streaming
    const response = await fetch(`${config.chatServiceUrl}/internal/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': config.internalToken,
      },
      body: JSON.stringify({
        orgId,
        projectId,
        sessionId,
        message,
        backendToken: userToken, // pass user's JWT so Chat Service can call backend APIs
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Chat service unavailable' }));
      return res.status(response.status).json(err);
    }

    // Stream SSE response back to frontend
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Chat service unreachable' });
    } else {
      res.end();
    }
  }
});

export default router;
