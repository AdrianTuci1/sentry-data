export class Project {
  constructor(data = {}) {
    this.id = data.id || null;
    this.orgId = data.orgId || null;
    this.name = data.name || '';
    this.slug = data.slug || '';
    this.description = data.description || '';
    this.status = data.status || 'active';
    this.settings = data.settings || {
      envVars: {},
      systemPrompt: '',
      webhooks: [],
    };
    this.modules = data.modules || {
      onboarding: true,
      analytics: true,
      integrations: true,
      graph: false,
      chat: true,
    };
    this.stats = data.stats || {
      sessionsCount: 0,
      dataSourcesCount: 0,
      lastActivity: null,
    };
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  getGcsPrefix() {
    return `org_${this.orgId}/proj_${this.id}`;
  }

  getBigQueryDatasetName() {
    return `dataset_org_${this.orgId}_proj_${this.id}`.replace(/-/g, '_');
  }

  toFirestore() {
    return {
      orgId: this.orgId,
      name: this.name,
      slug: this.slug,
      description: this.description,
      status: this.status,
      settings: this.settings,
      modules: this.modules,
      stats: this.stats,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromFirestore(id, data) {
    return new Project({ id, ...data });
  }
}
