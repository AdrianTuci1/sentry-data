export class User {
  constructor(data = {}) {
    this.id = data.id || null;
    this.email = data.email || '';
    this.passwordHash = data.passwordHash || '';
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.roles = data.roles || ['user'];
    this.orgMemberships = data.orgMemberships || []; // [{ orgId, role }]
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  getFullName() {
    return `${this.firstName} ${this.lastName}`.trim() || this.email;
  }

  getOrgRole(orgId) {
    const membership = this.orgMemberships.find(m => m.orgId === orgId);
    return membership ? membership.role : null;
  }

  hasOrgAccess(orgId) {
    return this.orgMemberships.some(m => m.orgId === orgId);
  }

  toFirestore() {
    return {
      email: this.email,
      passwordHash: this.passwordHash,
      firstName: this.firstName,
      lastName: this.lastName,
      roles: this.roles,
      orgMemberships: this.orgMemberships,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromFirestore(id, data) {
    return new User({ id, ...data });
  }
}
