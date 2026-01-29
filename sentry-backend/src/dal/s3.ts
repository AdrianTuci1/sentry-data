import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from 'dotenv';

dotenv.config();

const itemClient = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'sentry-data-bucket';

export const s3 = {
    // Get Signed URL for retrieval
    getSignedDownloadUrl: async (key: string) => {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        return getSignedUrl(itemClient, command, { expiresIn: 3600 });
    },

    // Get Signed URL for upload
    getSignedUploadUrl: async (key: string, contentType: string = 'application/json') => {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });
        return getSignedUrl(itemClient, command, { expiresIn: 3600 });
    },

    // List objects (e.g. for Bronze/Silver/Gold layers)
    listObjects: async (prefix: string) => {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix
        });
        const result = await itemClient.send(command);
        return result.Contents || [];
    }
};
