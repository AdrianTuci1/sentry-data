export class Organization {
  constructor(data = {}) {
    this.id = data.id || null;
    this.accountId = data.accountId || null;
    this.name = data.name || '';
    this.slug = data.slug || '';
    this.plan = data.plan || 'free'; // free, team, enterprise
    this.status = data.status || 'active';
    this.settings = data.settings || {};
    this.stats = data.stats || {
      projectsCount: 0,
      membersCount: 0,
      storageUsed: 0,
      queriesUsed: 0,
    };
    this.limits = data.limits || this.getDefaultLimits(this.plan);
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  getDefaultLimits(plan) {
    const limits = {
      free: { maxProjects: 2, maxStorage: 1073741824, maxQueries: 1000 },
      team: { maxProjects: 10, maxStorage: 10737418240, maxQueries: 10000 },
      enterprise: { maxProjects: -1, maxStorage: -1, maxQueries: -1 },
    };
    return limits[plan] || limits.free;
  }

  canAddProject() {
    return this.limits.maxProjects === -1 || this.stats.projectsCount < this.limits.maxProjects;
  }

  toFirestore() {
    return {
      accountId: this.accountId,
      name: this.name,
      slug: this.slug,
      plan: this.plan,
      status: this.status,
      settings: this.settings,
      stats: this.stats,
      limits: this.limits,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromFirestore(id, data) {
    return new Organization({ id, ...data });
  }
}
