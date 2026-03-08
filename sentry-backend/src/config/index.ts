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
        dynamoTable: process.env.DYNAMO_TABLE_NAME || 'SentryAppTable',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'super-secure-dev-secret',
    },
    r2: {
        endpoint: process.env.R2_ENDPOINT || '', // e.g., https://<account_id>.r2.cloudflarestorage.com
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        bucketBronze: process.env.R2_BUCKET_BRONZE || 'sentry-bronze',
    },
    providers: {
        sandbox: (process.env.SANDBOX_PROVIDER || 'e2b') as 'e2b' | 'modal',
        e2bApiKey: process.env.E2B_API_KEY || '',
        modalApiKey: process.env.MODAL_API_KEY || '',
    },
    // Cheile pentru inteligența artificială, pe care le vom pasa în Interiorul Sandbox-ului
    llm: {
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    worker: {
        url: process.env.ANALYTICS_WORKER_URL || 'http://localhost:4000/execute',
        secret: process.env.INTERNAL_API_SECRET || 'secret'
    }
};
