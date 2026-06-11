import { gcpService } from './GcpService.js';
import { Project } from '../models/Project.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

export class ProjectService {
  constructor() {
    this.gcp = gcpService;
  }

  getCollection(orgId) {
    return this.gcp.getProjectsCollection(orgId);
  }

  async create(orgId, dto) {
    const existing = await this.getCollection(orgId)
      .where('slug', '==', dto.slug)
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new ConflictError('Project slug already exists in this organization');
    }

    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();

    const project = new Project({
      id: projectId,
      orgId,
      name: dto.name,
      slug: dto.slug,
      description: dto.description || '',
      settings: dto.settings || {},
      modules: dto.modules || {},
      createdAt: now,
      updatedAt: now,
    });

    // Create Firestore document
    await this.getCollection(orgId).doc(projectId).set(project.toFirestore());

    // Create BigQuery dataset if enabled
    if (config.enableBigQueryAnalytics) {
      try {
        await this.gcp.createDataset(orgId, projectId);
      } catch (err) {
        // Dataset might already exist, continue
      }
    }

    return project;
  }

  async findById(orgId, projectId) {
    const doc = await this.getCollection(orgId).doc(projectId).get();
    if (!doc.exists) {
      throw new NotFoundError('Project not found');
    }
    return Project.fromFirestore(doc.id, doc.data());
  }

  async findByOrg(orgId) {
    const snapshot = await this.getCollection(orgId).get();
    return snapshot.docs.map(doc => Project.fromFirestore(doc.id, doc.data()));
  }

  async update(orgId, projectId, dto) {
    await this.findById(orgId, projectId);
    const updates = {
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    await this.getCollection(orgId).doc(projectId).update(updates);
    return this.findById(orgId, projectId);
  }

  async delete(orgId, projectId) {
    await this.findById(orgId, projectId);
    
    // Delete BigQuery dataset
    if (config.enableBigQueryAnalytics) {
      try {
        await this.gcp.deleteDataset(orgId, projectId);
      } catch (err) {
        // Dataset might not exist, continue
      }
    }

    // Delete GCS prefix contents
    try {
      const bucket = this.gcp.getBucket();
      const prefix = this.gcp.getProjectPrefix(orgId, projectId);
      const [files] = await bucket.getFiles({ prefix: prefix + '/' });
      await Promise.all(files.map(file => file.delete()));
    } catch (err) {
      // Continue even if GCS deletion fails
    }

    await this.getCollection(orgId).doc(projectId).delete();
  }

  async getSettings(orgId, projectId) {
    const doc = await this.gcp.getSettingsRef(orgId, projectId).get();
    if (!doc.exists) {
      return {};
    }
    return doc.data();
  }

  async updateSettings(orgId, projectId, settings) {
    await this.findById(orgId, projectId);
    await this.gcp.getSettingsRef(orgId, projectId).set(settings, { merge: true });
    return this.getSettings(orgId, projectId);
  }

  async generateGcsSignedUrl(orgId, projectId, filename, action = 'read') {
    return this.gcp.generateSignedUrl(orgId, projectId, filename, action);
  }
}
