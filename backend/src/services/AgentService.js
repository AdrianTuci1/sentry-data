import { gcpService } from './GcpService.js';
import { AgentSession } from '../models/AgentSession.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { config } from '../config/index.js';

export class AgentService {
  constructor() {
    this.gcp = gcpService;
  }

  getSessionsCollection(orgId, projectId) {
    return this.gcp.getSessionsCollection(orgId, projectId);
  }

  async createSession(orgId, projectId, userId, dto) {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const session = new AgentSession({
      id: sessionId,
      projectId,
      orgId,
      userId,
      agentType: dto.agentType || 'default',
      context: dto.context || {},
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    await this.getSessionsCollection(orgId, projectId).doc(sessionId).set(session.toFirestore());
    return session;
  }

  async findSession(orgId, projectId, sessionId) {
    const doc = await this.getSessionsCollection(orgId, projectId).doc(sessionId).get();
    if (!doc.exists) {
      throw new NotFoundError('Session not found');
    }
    return AgentSession.fromFirestore(doc.id, doc.data());
  }

  async findByProject(orgId, projectId) {
    const snapshot = await this.getSessionsCollection(orgId, projectId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => AgentSession.fromFirestore(doc.id, doc.data()));
  }

  async updateSession(orgId, projectId, sessionId, updates) {
    await this.findSession(orgId, projectId, sessionId);
    const data = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.getSessionsCollection(orgId, projectId).doc(sessionId).update(data);
    return this.findSession(orgId, projectId, sessionId);
  }

  async launchOnModal(orgId, projectId, sessionId, context) {
    if (!config.enableModalAgents) {
      throw new ForbiddenError('Modal agents are disabled');
    }

    if (!config.modalApiUrl) {
      throw new ForbiddenError('Modal API URL not configured');
    }

    // Generate temporary credentials for the agent
    const gcsToken = await this.gcp.generateTemporaryToken(orgId, projectId);
    const signedUrl = await this.gcp.generateSignedUrl(orgId, projectId, `session_${sessionId}.json`, 'write');

    // Prepare agent payload
    const payload = {
      sessionId,
      orgId,
      projectId,
      context,
      credentials: {
        gcsToken,
        signedUrl,
        bucketName: config.gcsBucketName,
        prefix: this.gcp.getProjectPrefix(orgId, projectId),
      },
      bigQuery: {
        datasetName: this.gcp.getDatasetName(orgId, projectId),
        projectId: config.gcpProjectId,
      },
    };

    // Call Modal webhook
    const response = await fetch(config.modalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Modal-Secret': config.modalWebhookSecret,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Modal launch failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Update session with Modal run ID
    await this.updateSession(orgId, projectId, sessionId, {
      status: 'running',
      modalRunId: result.runId || null,
    });

    return result;
  }

  async handleModalWebhook(orgId, projectId, sessionId, payload) {
    const session = await this.findSession(orgId, projectId, sessionId);

    if (payload.status === 'completed') {
      await this.updateSession(orgId, projectId, sessionId, {
        status: 'completed',
        result: payload.result,
        completedAt: new Date().toISOString(),
      });
    } else if (payload.status === 'failed') {
      await this.updateSession(orgId, projectId, sessionId, {
        status: 'failed',
        result: { error: payload.error },
        completedAt: new Date().toISOString(),
      });
    }

    return session;
  }

  async getAgentCredentials(orgId, projectId) {
    const gcsToken = await this.gcp.generateTemporaryToken(orgId, projectId);
    return {
      gcsToken,
      bucketName: config.gcsBucketName,
      prefix: this.gcp.getProjectPrefix(orgId, projectId),
      bigQueryDataset: this.gcp.getDatasetName(orgId, projectId),
      bigQueryProjectId: config.gcpProjectId,
    };
  }
}
