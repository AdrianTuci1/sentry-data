import { R2StorageService } from '../../../infrastructure/storage/R2StorageService';
import { ProjectRepository } from '../../../infrastructure/repositories/ProjectRepository';
import { SSEManager } from '../../../services/sse/SSEManager';

export class DiscoveryManager {
    constructor(
        private r2StorageService: R2StorageService,
        private projectRepo: ProjectRepository,
        private sseManager: SSEManager
    ) {}

    public merge(cumulative: any, disco: any) {
        if (!disco) return;

        const keysToAppend = ['connector', 'actionType', 'adjustedData', 'group', 'insight', 'tables', 'metricGroups', 'sourceClassifications'];
        for (const key of keysToAppend) {
            const sourceKey = key === 'group' ? (disco.group ? 'group' : 'dashboardGroups') :
                key === 'insight' ? (disco.insight ? 'insight' : 'dashboards') : key;
                
            if (disco[sourceKey]) {
                const items = Array.isArray(disco[sourceKey]) ? disco[sourceKey] : [disco[sourceKey]];
                if (items.length > 0) {
                    cumulative[key] = cumulative[key] || [];
                    items.forEach((newItem: any) => {
                        if (newItem.id != null) {
                            const existingIndex = cumulative[key].findIndex((c: any) => c.id === newItem.id);
                            if (existingIndex >= 0) {
                                cumulative[key][existingIndex] = { ...cumulative[key][existingIndex], ...newItem };
                            } else {
                                cumulative[key].push(newItem);
                            }
                        } else {
                            cumulative[key].push(newItem);
                        }
                    });
                }
            }
        }
    }

    public async broadcast(tenantId: string, projectId: string, discovery: any) {
        await this.r2StorageService.saveDiscovery(tenantId, projectId, discovery);
        try {
            const project = await this.projectRepo.findById(tenantId, projectId);
            if (project) {
                project.discoveryMetadata = discovery;
                await this.projectRepo.createOrUpdate(project);
                console.log(`[DiscoveryManager] Discovery persisted for ${projectId}`);
            }
        } catch (err: any) {
            console.warn(`[DiscoveryManager] Failed to persist discovery: ${err.message}`);
        }
        this.sseManager.broadcastToTenant(tenantId, 'discovery_updated', { projectId });
    }
}
