import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// Allows us to generate presigned URLs if we want the Agent to upload directly
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config';

export class R2StorageService {
    private client: S3Client;
    private bronzeBucket: string;

    constructor() {
        this.client = new S3Client({
            region: 'auto',
            endpoint: config.r2.endpoint, // Must be provided in env
            credentials: {
                accessKeyId: config.r2.accessKeyId,
                secretAccessKey: config.r2.secretAccessKey,
            },
        });
        this.bronzeBucket = config.r2.bucketBronze;
    }

    /**
     * Geberate a temporary presigned URL so an external App/Agent can upload Parquet directly to R2.
     */
    public async generateUploadUrl(tenantId: string, projectId: string, filename: string): Promise<string> {
        const key = `tenants/${tenantId}/projects/${projectId}/bronze/${filename}`;

        const command = new PutObjectCommand({
            Bucket: this.bronzeBucket,
            Key: key,
            ContentType: 'application/octet-stream',
        });

        // URL valid for 1 hour
        return await getSignedUrl(this.client, command, { expiresIn: 3600 });
    }

    /**
     * Retrieve the file stream or simply the URI for an internal microservice (DuckDB).
     */
    public getS3Uri(tenantId: string, projectId: string, layer: 'bronze' | 'silver' | 'gold', filename: string): string {
        return `s3://${this.bronzeBucket}/tenants/${tenantId}/projects/${projectId}/${layer}/${filename}`;
    }
}
