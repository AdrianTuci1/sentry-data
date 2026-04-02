import dotenv from 'dotenv';
import path from 'path';

// Load variables from .env
dotenv.config({ path: path.join(__dirname, '../../../.env') });
// fallback if we run directly in sentry-backend
dotenv.config();

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    aws: {
        region: process.env.AWS_REGION || 'eu-central-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        dynamoTable: process.env.DYNAMO_TABLE_NAME || 'SentryAppTable',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'super-secure-dev-secret',
    },
    r2: {
        endpoint: process.env.R2_ENDPOINT || '', // e.g., https://<account_id>.r2.cloudflarestorage.com
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        region: process.env.R2_REGION || 'auto',
        bucketData: process.env.R2_BUCKET_DATA || 'statsparrot-data',
    },
    modal: {
        modalTokenId: process.env.MODAL_TOKEN_ID || '',
        modalTokenSecret: process.env.MODAL_TOKEN_SECRET || '',
    },
    parrot: {
        pneApiUrl: process.env.PNE_API_URL || '',
        sentinelApiUrl: process.env.SENTINEL_API_URL || '',
        mlExecutorApiUrl: process.env.ML_EXECUTOR_API_URL || '',
    },
    worker: {
        url: process.env.ANALYTICS_WORKER_URL || 'http://localhost:4000/execute',
        secret: process.env.INTERNAL_API_SECRET || 'secret'
    },
    execution: {
        defaultEngine: (process.env.PARROT_EXECUTION_DEFAULT_ENGINE || 'auto') as 'auto' | 'modal' | 'ray_daft',
        modalControlUrl: process.env.MODAL_EXECUTION_CONTROL_URL || '',
        rayControlUrl: process.env.RAY_EXECUTION_CONTROL_URL || '',
        k8sNamespace: process.env.RAY_K8S_NAMESPACE || 'statsparrot',
        k8sCluster: process.env.RAY_K8S_CLUSTER || 'default',
        rayQueue: process.env.RAY_JOB_QUEUE || 'parrot-default'
    },
    mapboxToken: process.env.VITE_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || ''
};
