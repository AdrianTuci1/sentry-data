import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BaseRepository, Entity } from './BaseRepository';
import { ObjectStorageConfig, SourceDataCursor, SourceStorageMetrics } from '../../types/storage';

/**
 * Represents a data source (connector) attached to a Project.
 * Persisted in DynamoDB under the same single-table design.
 */
export interface SourceEntity extends Entity {
    tenantId: string;
    projectId: string;
    sourceId: string;
    name: string;           // Human-readable label (e.g. "Shopify Orders CSV")
    uri: string;            // S3/R2 URI pointing to the raw data
    type: string;           // e.g. 'csv', 'parquet', 'shopify', 'meta', 'postgres'
    connectorId?: string;
    cronSchedule?: string;  // Optional cron expression for automatic refresh
    lastRunAt?: string;     // ISO timestamp of the last successful runtime execution
    schemaFingerprint?: string; // Hash of column names — used for cache invalidation
    storageConfig?: ObjectStorageConfig;
    dataCursor?: SourceDataCursor;
    observedMetrics?: SourceStorageMetrics;
    lastObservedAt?: string;
    createdAt: string;
}

export class SourceRepository extends BaseRepository<SourceEntity> {
    constructor(docClient: DynamoDBDocumentClient, tableName: string) {
        super(docClient, tableName);
    }

    // PK: TENANT#<tenantId>
    protected getPartitionKey(tenantId: string): string {
        return `TENANT#${tenantId}`;
    }

    // SK: SOURCE#<projectId>#<sourceId>
    protected getSortKey(compositeId?: string): string {
        if (!compositeId) {
            throw new Error('compositeId (projectId#sourceId) must be provided for Source SK.');
        }
        return `SOURCE#${compositeId}`;
    }

    /**
     * Fetch all sources for a specific project within a tenant.
     */
    public async findAllForProject(tenantId: string, projectId: string): Promise<SourceEntity[]> {
        return this.queryByPrefix(tenantId, `SOURCE#${projectId}#`);
    }

    /**
     * Fetch a single source by its ID.
     */
    public async findById(tenantId: string, projectId: string, sourceId: string): Promise<SourceEntity | null> {
        return this.get(tenantId, `${projectId}#${sourceId}`);
    }

    /**
     * Create or update a source record.
     */
    public async createOrUpdate(source: Omit<SourceEntity, 'PK' | 'SK'>): Promise<void> {
        const entityToSave = {
            tenantId: source.tenantId,
            projectId: source.projectId,
            sourceId: source.sourceId,
            name: source.name,
            uri: source.uri,
            type: source.type,
            connectorId: source.connectorId,
            cronSchedule: source.cronSchedule,
            lastRunAt: source.lastRunAt,
            schemaFingerprint: source.schemaFingerprint,
            storageConfig: source.storageConfig,
            dataCursor: source.dataCursor,
            observedMetrics: source.observedMetrics,
            lastObservedAt: source.lastObservedAt,
            createdAt: source.createdAt,
            PK: this.getPartitionKey(source.tenantId),
            SK: this.getSortKey(`${source.projectId}#${source.sourceId}`),
        } as SourceEntity;
        await this.save(entityToSave);
    }

    /**
     * Delete a source record.
     */
    public async deleteSource(tenantId: string, projectId: string, sourceId: string): Promise<void> {
        await this.delete(tenantId, `${projectId}#${sourceId}`);
    }

    /**
     * Fetch ALL sources across ALL projects for a tenant (used by scheduler).
     */
    public async findAllForTenant(tenantId: string): Promise<SourceEntity[]> {
        return this.queryByPrefix(tenantId, 'SOURCE#');
    }

    /**
     * Update lastRunAt timestamp after a runtime execution completes.
     */
    public async updateLastRunAt(tenantId: string, projectId: string, sourceId: string): Promise<void> {
        const source = await this.findById(tenantId, projectId, sourceId);
        if (source) {
            source.lastRunAt = new Date().toISOString();
            await this.createOrUpdate(source);
        }
    }
}
