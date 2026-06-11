export class AgentSession {
  constructor(data = {}) {
    this.id = data.id || null;
    this.projectId = data.projectId || null;
    this.orgId = data.orgId || null;
    this.userId = data.userId || null;
    this.status = data.status || 'pending'; // pending, running, completed, failed
    this.agentType = data.agentType || 'default';
    this.context = data.context || {};
    this.result = data.result || null;
    this.modalRunId = data.modalRunId || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.completedAt = data.completedAt || null;
  }

  toFirestore() {
    return {
      projectId: this.projectId,
      orgId: this.orgId,
      userId: this.userId,
      status: this.status,
      agentType: this.agentType,
      context: this.context,
      result: this.result,
      modalRunId: this.modalRunId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
    };
  }

  static fromFirestore(id, data) {
    return new AgentSession({ id, ...data });
  }
}
