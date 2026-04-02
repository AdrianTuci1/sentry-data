import { config } from '../../config';

export interface MLTrainRequest {
    tenantId: string;
    projectId: string;
    requestId: string;
    datasetUri: string;
    taskType: 'classification' | 'regression' | 'clustering' | 'anomaly';
    targetColumn?: string;
    featureColumns?: string[];
    modelName?: string;
    testSize?: number;
    randomState?: number;
    hyperparameters?: Record<string, unknown>;
}

export interface MLEvaluateRequest {
    tenantId: string;
    projectId: string;
    modelId: string;
    datasetUri: string;
    targetColumn?: string;
    featureColumns?: string[];
}

export interface MLInferRequest {
    tenantId: string;
    projectId: string;
    modelId: string;
    records?: Array<Record<string, unknown>>;
    datasetUri?: string;
    featureColumns?: string[];
}

export class MLExecutorClient {
    private readonly baseUrl = config.parrot.mlExecutorApiUrl;

    public isConfigured(): boolean {
        return Boolean(this.baseUrl);
    }

    public async train(request: MLTrainRequest): Promise<any> {
        return this.post('ml/train', request);
    }

    public async evaluate(request: MLEvaluateRequest): Promise<any> {
        return this.post('ml/evaluate', request);
    }

    public async infer(request: MLInferRequest): Promise<any> {
        return this.post('ml/infer', request);
    }

    private async post(path: string, payload: unknown): Promise<any> {
        if (!this.baseUrl) {
            throw new Error('ml_executor_not_configured');
        }

        const response = await fetch(this.resolveApiUrl(path), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': config.worker.secret
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.detail || `ml_executor_http_${response.status}`);
        }

        return data;
    }

    private resolveApiUrl(path: string): string {
        const normalized = this.baseUrl.replace(/\/+$/, '');
        if (normalized.endsWith('/api/v1')) {
            return `${normalized}/${path}`;
        }

        return `${normalized}/api/v1/${path}`;
    }
}
