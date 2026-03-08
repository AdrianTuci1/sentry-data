"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectRepository = void 0;
const BaseRepository_1 = require("./BaseRepository");
class ProjectRepository extends BaseRepository_1.BaseRepository {
    constructor(docClient, tableName) {
        super(docClient, tableName);
    }
    // PK Mapping rule: TENANT#<tenantId>
    getPartitionKey(tenantId) {
        return `TENANT#${tenantId}`;
    }
    // SK Mapping rule: PROJECT#<projectId>
    getSortKey(projectId) {
        if (!projectId) {
            throw new Error("projectId must be provided to determine the Sort Key for a Project.");
        }
        return `PROJECT#${projectId}`;
    }
    // Fetch a single project by its ID for a specific Tenant
    async findOne(tenantId, projectId) {
        return this.get(tenantId, projectId);
    }
    // Fetch ALL projects for a specific Tenant using the SK prefix `PROJECT#`
    async findAllForTenant(tenantId) {
        return this.queryByPrefix(tenantId, 'PROJECT#');
    }
    async createOrUpdate(project) {
        const entityToSave = {
            tenantId: project.tenantId,
            projectId: project.projectId,
            name: project.name,
            sourceType: project.sourceType,
            status: project.status,
            createdAt: project.createdAt,
            queryConfigs: project.queryConfigs,
            PK: this.getPartitionKey(project.tenantId),
            SK: this.getSortKey(project.projectId),
        };
        await this.save(entityToSave);
    }
}
exports.ProjectRepository = ProjectRepository;
