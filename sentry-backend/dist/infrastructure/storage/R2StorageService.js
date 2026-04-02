"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2StorageService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
// Allows us to generate presigned URLs if we want the Agent to upload directly
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const config_1 = require("../../config");
class R2StorageService {
    constructor() {
        this.client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: config_1.config.r2.endpoint, // Must be provided in env
            credentials: {
                accessKeyId: config_1.config.r2.accessKeyId,
                secretAccessKey: config_1.config.r2.secretAccessKey,
            },
        });
        this.dataBucket = config_1.config.r2.bucketData;
    }
    /**
     * Get the base key for a project.
     */
    getProjectBase(tenantId, projectId) {
        return `tenants/${tenantId}/projects/${projectId}`;
    }
    /**
     * Generic key builder.
     */
    getS3Key(tenantId, projectId, layer, ...parts) {
        return `${this.getProjectBase(tenantId, projectId)}/${layer}/${parts.join('/')}`;
    }
    /**
     * Generic URI builder.
     */
    getS3Uri(tenantId, projectId, layer, ...parts) {
        return `s3://${this.dataBucket}/${this.getS3Key(tenantId, projectId, layer, ...parts)}`;
    }
    /**
     * Check if a script already exists (deprecated in favor of listScripts for bulk).
     */
    async scriptExists(tenantId, projectId, taskName) {
        const key = this.getS3Key(tenantId, projectId, 'agents', `${taskName}.py`);
        try {
            await this.client.send(new client_s3_1.HeadObjectCommand({ Bucket: this.dataBucket, Key: key }));
            return true;
        }
        catch (error) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404)
                return false;
            throw error;
        }
    }
    /**
     * Bulk check for scripts to avoid N R2 calls.
     */
    async listScripts(tenantId, projectId) {
        const prefix = `${this.getProjectBase(tenantId, projectId)}/agents/`;
        const keys = await this.listAllUnder(prefix);
        return new Set(keys.map(k => k.split('/').pop()?.replace('.py', '') || ''));
    }
    getScriptUri(tenantId, projectId, taskName) {
        return this.getS3Uri(tenantId, projectId, 'agents', `${taskName}.py`);
    }
    async saveScript(tenantId, projectId, taskName, content) {
        const key = this.getS3Key(tenantId, projectId, 'agents', `${taskName}.py`);
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.dataBucket,
            Key: key,
            Body: content,
            ContentType: 'text/x-python'
        }));
    }
    async saveLog(tenantId, projectId, taskName, content) {
        const key = this.getS3Key(tenantId, projectId, 'system', 'logs', `${taskName}.log`);
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.dataBucket,
            Key: key,
            Body: content,
            ContentType: 'text/plain'
        }));
    }
    /**
     * Generic method to fetch file content from R2.
     */
    async getFileContent(key) {
        try {
            const result = await this.client.send(new client_s3_1.GetObjectCommand({ Bucket: this.dataBucket, Key: key }));
            const str = await result.Body?.transformToString();
            return str || '';
        }
        catch (error) {
            console.error(`Failed to fetch ${key} from R2:`, error.message);
            throw error;
        }
    }
    /**
     * Lists ALL objects under a prefix (flat list, no delimiter).
     */
    async listAllUnder(prefix) {
        try {
            const command = new client_s3_1.ListObjectsV2Command({ Bucket: this.dataBucket, Prefix: prefix });
            const response = await this.client.send(command);
            return (response.Contents || []).map(c => c.Key || '').filter(Boolean);
        }
        catch (error) {
            console.error(`[R2StorageService] Failed to list objects for ${prefix}:`, error.message);
            return [];
        }
    }
    /**
     * Lists immediate "subdirectories" (prefixes with delimiter) under a path.
     */
    async listPrefixGroups(prefix) {
        try {
            const command = new client_s3_1.ListObjectsV2Command({ Bucket: this.dataBucket, Prefix: prefix, Delimiter: '/' });
            const response = await this.client.send(command);
            return (response.CommonPrefixes || [])
                .map(p => p.Prefix?.replace(prefix, '').replace('/', '') || '')
                .filter(Boolean);
        }
        catch (error) {
            console.error(`[R2StorageService] Failed to list prefixes for ${prefix}:`, error.message);
            return [];
        }
    }
    async generateUploadUrl(tenantId, projectId, filename) {
        const key = this.getS3Key(tenantId, projectId, 'bronze', filename);
        const command = new client_s3_1.PutObjectCommand({ Bucket: this.dataBucket, Key: key, ContentType: 'application/octet-stream' });
        return await (0, s3_request_presigner_1.getSignedUrl)(this.client, command, { expiresIn: 3600 });
    }
    getBronzeUri(tenantId, projectId, sourceName, filename, date) {
        return this.getS3Uri(tenantId, projectId, 'bronze', sourceName, date || this.getDatePartition(), filename);
    }
    getBronzeGlobUri(tenantId, projectId, sourceName) {
        return this.getS3Uri(tenantId, projectId, 'bronze', sourceName, '*', '*.parquet');
    }
    getSilverUri(tenantId, projectId, sourceName, filename, date) {
        return this.getS3Uri(tenantId, projectId, 'silver', sourceName, date || this.getDatePartition(), filename);
    }
    getSilverGlobUri(tenantId, projectId, sourceName) {
        return this.getS3Uri(tenantId, projectId, 'silver', sourceName, '*', '*.parquet');
    }
    getGoldUri(tenantId, projectId, sourceName, filename, date) {
        return this.getS3Uri(tenantId, projectId, 'gold', sourceName, date || this.getDatePartition(), filename);
    }
    getGoldGlobUri(tenantId, projectId, sourceName) {
        return this.getS3Uri(tenantId, projectId, 'gold', sourceName, '*', '*.parquet');
    }
    async generatePartitionedUploadUrl(tenantId, projectId, sourceName, filename) {
        const key = this.getS3Key(tenantId, projectId, 'bronze', sourceName, this.getDatePartition(), filename);
        const command = new client_s3_1.PutObjectCommand({ Bucket: this.dataBucket, Key: key, ContentType: 'application/octet-stream' });
        const url = await (0, s3_request_presigner_1.getSignedUrl)(this.client, command, { expiresIn: 3600 });
        return { url, uri: `s3://${this.dataBucket}/${key}` };
    }
    async saveDiscovery(tenantId, projectId, discovery) {
        const key = this.getS3Key(tenantId, projectId, 'discovery', 'source_classification.json');
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.dataBucket, Key: key,
            Body: JSON.stringify(discovery, null, 2),
            ContentType: 'application/json'
        }));
    }
    async saveJson(tenantId, projectId, layer, data, ...parts) {
        const key = this.getS3Key(tenantId, projectId, layer, ...parts);
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.dataBucket,
            Key: key,
            Body: JSON.stringify(data, null, 2),
            ContentType: 'application/json'
        }));
        return {
            key,
            uri: `s3://${this.dataBucket}/${key}`
        };
    }
    async saveText(tenantId, projectId, layer, content, contentType, ...parts) {
        const key = this.getS3Key(tenantId, projectId, layer, ...parts);
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.dataBucket,
            Key: key,
            Body: content,
            ContentType: contentType
        }));
        return {
            key,
            uri: `s3://${this.dataBucket}/${key}`
        };
    }
    getDatePartition() {
        return new Date().toISOString().split('T')[0];
    }
}
exports.R2StorageService = R2StorageService;
