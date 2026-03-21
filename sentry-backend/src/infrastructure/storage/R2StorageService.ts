import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
// Allows us to generate presigned URLs if we want the Agent to upload directly
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config';

export class R2StorageService {
    private client: S3Client;
    private dataBucket: string;

    constructor() {
        this.client = new S3Client({
            region: 'auto',
            endpoint: config.r2.endpoint, // Must be provided in env
            credentials: {
                accessKeyId: config.r2.accessKeyId,
                secretAccessKey: config.r2.secretAccessKey,
            },
        });
        this.dataBucket = config.r2.bucketData;
    }

    /**
     * Get the base key for a project.
     */
    private getProjectBase(tenantId: string, projectId: string): string {
        return `tenants/${tenantId}/projects/${projectId}`;
    }

    /**
     * Generic key builder.
     */
    public getS3Key(tenantId: string, projectId: string, layer: string, ...parts: string[]): string {
        return `${this.getProjectBase(tenantId, projectId)}/${layer}/${parts.join('/')}`;
    }

    /**
     * Generic URI builder.
     */
    public getS3Uri(tenantId: string, projectId: string, layer: string, ...parts: string[]): string {
        return `s3://${this.dataBucket}/${this.getS3Key(tenantId, projectId, layer, ...parts)}`;
    }

    /**
     * Check if a script already exists (deprecated in favor of listScripts for bulk).
     */
    public async scriptExists(tenantId: string, projectId: string, taskName: string): Promise<boolean> {
        const key = this.getS3Key(tenantId, projectId, 'system', 'scripts', `${taskName}.py`);
        try {
            await this.client.send(new HeadObjectCommand({ Bucket: this.dataBucket, Key: key }));
            return true;
        } catch (error: any) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) return false;
            throw error;
        }
    }

    /**
     * Bulk check for scripts to avoid N R2 calls.
     */
    public async listScripts(tenantId: string, projectId: string): Promise<Set<string>> {
        const prefix = `${this.getProjectBase(tenantId, projectId)}/system/scripts/`;
        const keys = await this.listAllUnder(prefix);
        return new Set(keys.map(k => k.split('/').pop()?.replace('.py', '') || ''));
    }

    public getScriptUri(tenantId: string, projectId: string, taskName: string): string {
        return this.getS3Uri(tenantId, projectId, 'system', 'scripts', `${taskName}.py`);
    }

    public async saveScript(tenantId: string, projectId: string, taskName: string, content: string): Promise<void> {
        const key = this.getS3Key(tenantId, projectId, 'system', 'scripts', `${taskName}.py`);
        await this.client.send(new PutObjectCommand({
            Bucket: this.dataBucket,
            Key: key,
            Body: content,
            ContentType: 'text/x-python'
        }));
    }

    public async saveLog(tenantId: string, projectId: string, taskName: string, content: string): Promise<void> {
        const key = this.getS3Key(tenantId, projectId, 'system', 'logs', `${taskName}.log`);
        await this.client.send(new PutObjectCommand({
            Bucket: this.dataBucket,
            Key: key,
            Body: content,
            ContentType: 'text/plain'
        }));
    }

    /**
     * Fetch a system prompt from the generic boilerplates area.
     */
    public async getPrompt(promptFileName: string): Promise<string> {
        return this.getFileContent(`system/boilerplates/prompts/${promptFileName}`);
    }

    /**
     * Generic method to fetch file content from R2.
     */
    public async getFileContent(key: string): Promise<string> {
        try {
            const result = await this.client.send(new GetObjectCommand({ Bucket: this.dataBucket, Key: key }));
            const str = await result.Body?.transformToString();
            return str || '';
        } catch (error: any) {
            console.error(`Failed to fetch ${key} from R2:`, error.message);
            throw error;
        }
    }

    /**
     * Lists ALL objects under a prefix (flat list, no delimiter).
     */
    public async listAllUnder(prefix: string): Promise<string[]> {
        try {
            const command = new ListObjectsV2Command({ Bucket: this.dataBucket, Prefix: prefix });
            const response = await this.client.send(command);
            return (response.Contents || []).map(c => c.Key || '').filter(Boolean);
        } catch (error: any) {
            console.error(`[R2StorageService] Failed to list objects for ${prefix}:`, error.message);
            return [];
        }
    }

    /**
     * Lists immediate "subdirectories" (prefixes with delimiter) under a path.
     */
    public async listPrefixGroups(prefix: string): Promise<string[]> {
        try {
            const command = new ListObjectsV2Command({ Bucket: this.dataBucket, Prefix: prefix, Delimiter: '/' });
            const response = await this.client.send(command);
            return (response.CommonPrefixes || [])
                .map(p => p.Prefix?.replace(prefix, '').replace('/', '') || '')
                .filter(Boolean);
        } catch (error: any) {
            console.error(`[R2StorageService] Failed to list prefixes for ${prefix}:`, error.message);
            return [];
        }
    }

    public async generateUploadUrl(tenantId: string, projectId: string, filename: string): Promise<string> {
        const key = this.getS3Key(tenantId, projectId, 'bronze', filename);
        const command = new PutObjectCommand({ Bucket: this.dataBucket, Key: key, ContentType: 'application/octet-stream' });
        return await getSignedUrl(this.client, command, { expiresIn: 3600 });
    }

    public getBronzeUri(tenantId: string, projectId: string, sourceName: string, filename: string, date?: string): string {
        return this.getS3Uri(tenantId, projectId, 'bronze', sourceName, date || this.getDatePartition(), filename);
    }

    public getBronzeGlobUri(tenantId: string, projectId: string, sourceName: string): string {
        return this.getS3Uri(tenantId, projectId, 'bronze', sourceName, '*', '*.parquet');
    }

    public getSilverUri(tenantId: string, projectId: string, sourceName: string, filename: string, date?: string): string {
        return this.getS3Uri(tenantId, projectId, 'silver', sourceName, date || this.getDatePartition(), filename);
    }

    public getSilverGlobUri(tenantId: string, projectId: string, sourceName: string): string {
        return this.getS3Uri(tenantId, projectId, 'silver', sourceName, '*', '*.parquet');
    }

    public getGoldUri(tenantId: string, projectId: string, sourceName: string, filename: string, date?: string): string {
        return this.getS3Uri(tenantId, projectId, 'gold', sourceName, date || this.getDatePartition(), filename);
    }

    public getGoldGlobUri(tenantId: string, projectId: string, sourceName: string): string {
        return this.getS3Uri(tenantId, projectId, 'gold', sourceName, '*', '*.parquet');
    }

    public async generatePartitionedUploadUrl(tenantId: string, projectId: string, sourceName: string, filename: string): Promise<{ url: string; uri: string }> {
        const key = this.getS3Key(tenantId, projectId, 'bronze', sourceName, this.getDatePartition(), filename);
        const command = new PutObjectCommand({ Bucket: this.dataBucket, Key: key, ContentType: 'application/octet-stream' });
        const url = await getSignedUrl(this.client, command, { expiresIn: 3600 });
        return { url, uri: `s3://${this.dataBucket}/${key}` };
    }

    public async saveDiscovery(tenantId: string, projectId: string, discovery: any): Promise<void> {
        const key = this.getS3Key(tenantId, projectId, 'discovery', 'source_classification.json');
        await this.client.send(new PutObjectCommand({
            Bucket: this.dataBucket, Key: key,
            Body: JSON.stringify(discovery, null, 2),
            ContentType: 'application/json'
        }));
    }

    private getDatePartition(): string {
        return new Date().toISOString().split('T')[0];
    }
}
