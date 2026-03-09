import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
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
     * Check if a script already exists in the system prefix for a given project.
     */
    public async scriptExists(tenantId: string, projectId: string, taskName: string): Promise<boolean> {
        const key = `tenants/${tenantId}/projects/${projectId}/system/scripts/${taskName}.py`;
        try {
            await this.client.send(new HeadObjectCommand({
                Bucket: this.dataBucket,
                Key: key
            }));
            return true;
        } catch (error: any) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Permanent URI for a generated script.
     */
    public getScriptUri(tenantId: string, projectId: string, taskName: string): string {
        const key = `tenants/${tenantId}/projects/${projectId}/system/scripts/${taskName}.py`;
        return `s3://${this.dataBucket}/${key}`;
    }

    /**
     * Save a generated script from an agent back to R2.
     */
    public async saveScript(tenantId: string, projectId: string, taskName: string, content: string): Promise<void> {
        const key = `tenants/${tenantId}/projects/${projectId}/system/scripts/${taskName}.py`;
        await this.client.send(new PutObjectCommand({
            Bucket: this.dataBucket,
            Key: key,
            Body: content,
            ContentType: 'text/x-python'
        }));
    }

    /**
     * Fetch a system prompt from the generic boilerplates area.
     */
    public async getPrompt(promptFileName: string): Promise<string> {
        const key = `system/boilerplates/prompts/${promptFileName}`;
        try {
            const result = await this.client.send(new GetObjectCommand({
                Bucket: this.dataBucket,
                Key: key
            }));
            const str = await result.Body?.transformToString();
            return str || '';
        } catch (error: any) {
            console.error(`Failed to fetch prompt ${promptFileName} from R2:`, error);
            throw error;
        }
    }

    /**
     * Generate a temporary presigned URL so an external App/Agent can upload Parquet directly to R2.
     */
    public async generateUploadUrl(tenantId: string, projectId: string, filename: string): Promise<string> {
        const key = `tenants/${tenantId}/projects/${projectId}/bronze/${filename}`;

        const command = new PutObjectCommand({
            Bucket: this.dataBucket,
            Key: key,
            ContentType: 'application/octet-stream',
        });

        // URL valid for 1 hour
        return await getSignedUrl(this.client, command, { expiresIn: 3600 });
    }

    /**
     * Retrieve the file stream or simply the URI for an internal microservice (DuckDB).
     */
    public getS3Uri(tenantId: string, projectId: string, layer: 'bronze' | 'silver' | 'gold' | 'system', filename: string): string {
        return `s3://${this.dataBucket}/tenants/${tenantId}/projects/${projectId}/${layer}/${filename}`;
    }
}
