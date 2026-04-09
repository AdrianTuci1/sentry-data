export type ObjectStorageProvider = 'r2' | 's3' | 'generic_s3';

export interface ObjectStorageCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}

export interface ObjectStorageConfig {
    provider?: ObjectStorageProvider;
    endpoint?: string;
    bucket: string;
    prefix?: string;
    region?: string;
    useSsl?: boolean;
    urlStyle?: 'path' | 'virtual_hosted';
    fileFormat?: 'parquet' | 'csv' | 'json';
    globPattern?: string;
    credentials?: ObjectStorageCredentials;
}

export interface SourceDataCursor {
    fingerprint: string;
    objectCount: number;
    totalBytes: number;
    latestModifiedAt?: string;
    sampledKeys?: string[];
    scannedAt: string;
}

export interface SourceStorageMetrics {
    objectCount: number;
    totalBytes: number;
    latestModifiedAt?: string;
    rowCountEstimate?: number;
    distinctEntityCountEstimate?: number;
    sourcePrefix?: string;
    scannedAt: string;
}
