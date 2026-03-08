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
        this.bronzeBucket = config_1.config.r2.bucketBronze;
    }
    /**
     * Geberate a temporary presigned URL so an external App/Agent can upload Parquet directly to R2.
     */
    async generateUploadUrl(tenantId, projectId, filename) {
        const key = `tenants/${tenantId}/projects/${projectId}/bronze/${filename}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bronzeBucket,
            Key: key,
            ContentType: 'application/octet-stream',
        });
        // URL valid for 1 hour
        return await (0, s3_request_presigner_1.getSignedUrl)(this.client, command, { expiresIn: 3600 });
    }
    /**
     * Retrieve the file stream or simply the URI for an internal microservice (DuckDB).
     */
    getS3Uri(tenantId, projectId, layer, filename) {
        return `s3://${this.bronzeBucket}/tenants/${tenantId}/projects/${projectId}/${layer}/${filename}`;
    }
}
exports.R2StorageService = R2StorageService;
