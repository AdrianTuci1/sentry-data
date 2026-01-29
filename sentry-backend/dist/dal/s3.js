"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3 = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const itemClient = new client_s3_1.S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'sentry-data-bucket';
exports.s3 = {
    // Get Signed URL for retrieval
    getSignedDownloadUrl: async (key) => {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(itemClient, command, { expiresIn: 3600 });
    },
    // Get Signed URL for upload
    getSignedUploadUrl: async (key, contentType = 'application/json') => {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(itemClient, command, { expiresIn: 3600 });
    },
    // List objects (e.g. for Bronze/Silver/Gold layers)
    listObjects: async (prefix) => {
        const command = new client_s3_1.ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix
        });
        const result = await itemClient.send(command);
        return result.Contents || [];
    }
};
