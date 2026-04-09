import { createHash } from 'crypto';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { config } from '../../config';
import { SourceEntity } from '../../infrastructure/repositories/SourceRepository';
import { ObjectStorageConfig, SourceDataCursor, SourceStorageMetrics } from '../../types/storage';
import { DiscoveredStorageSource } from '../../types/connectors';

export interface SourceObjectSummary {
    key: string;
    size: number;
    lastModified?: string;
}

interface ParsedSourceLocation {
    bucket: string;
    prefix: string;
}

export class ObjectStorageService {
    public buildSourceUri(storageConfig: ObjectStorageConfig): string {
        const prefix = this.normalizePrefix(storageConfig.prefix);
        const fileFormat = storageConfig.fileFormat || 'parquet';
        const globPattern = storageConfig.globPattern || `**/*.${fileFormat}`;

        if (!prefix) {
            return `s3://${storageConfig.bucket}/${globPattern}`;
        }

        return `s3://${storageConfig.bucket}/${prefix}/${globPattern}`;
    }

    public resolveSourceUri(uri: string | undefined, storageConfig?: ObjectStorageConfig): string {
        if (uri && uri.trim().length > 0) {
            return uri;
        }

        if (!storageConfig) {
            throw new Error('source_uri_or_storage_config_required');
        }

        return this.buildSourceUri(storageConfig);
    }

    public buildWorkerStorageConfig(storageConfig?: ObjectStorageConfig): ObjectStorageConfig | undefined {
        if (!storageConfig) {
            return undefined;
        }

        return {
            provider: storageConfig.provider || 'generic_s3',
            endpoint: storageConfig.endpoint,
            bucket: storageConfig.bucket,
            prefix: this.normalizePrefix(storageConfig.prefix),
            region: storageConfig.region || 'auto',
            useSsl: storageConfig.useSsl !== false,
            urlStyle: storageConfig.urlStyle || 'path',
            fileFormat: storageConfig.fileFormat || 'parquet',
            globPattern: storageConfig.globPattern,
            credentials: storageConfig.credentials,
        };
    }

    public resolveSharedWorkerStorageConfig(sources: SourceEntity[]): ObjectStorageConfig | undefined {
        const explicitConfigs = sources
            .map((source) => this.buildWorkerStorageConfig(source.storageConfig))
            .filter((value): value is ObjectStorageConfig => Boolean(value));

        if (explicitConfigs.length === 0) {
            return undefined;
        }

        const uniqueFingerprints = new Set(explicitConfigs.map((entry) => JSON.stringify(entry)));
        if (uniqueFingerprints.size > 1) {
            throw new Error('multi_storage_configs_not_supported_for_shared_query_execution');
        }

        return explicitConfigs[0];
    }

    public async inspectSource(source: Pick<SourceEntity, 'uri' | 'storageConfig'>): Promise<{ cursor: SourceDataCursor; metrics: SourceStorageMetrics; objects: SourceObjectSummary[] }> {
        const location = this.resolveSourceLocation(source.uri, source.storageConfig);
        const storageConfig = this.resolveEffectiveStorageConfig(source.storageConfig, location.bucket);
        const client = this.createClient(storageConfig);
        const objects = await this.listObjects(client, location.bucket, location.prefix);

        const objectCount = objects.length;
        const totalBytes = objects.reduce((sum, entry) => sum + entry.size, 0);
        const latestModifiedAt = objects
            .map((entry) => entry.lastModified)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1);
        const fingerprint = createHash('sha256')
            .update(JSON.stringify(objects.map((entry) => [entry.key, entry.size, entry.lastModified || ''])))
            .digest('hex');
        const scannedAt = new Date().toISOString();

        const metrics: SourceStorageMetrics = {
            objectCount,
            totalBytes,
            latestModifiedAt,
            sourcePrefix: location.prefix,
            scannedAt,
        };

        const cursor: SourceDataCursor = {
            fingerprint,
            objectCount,
            totalBytes,
            latestModifiedAt,
            sampledKeys: objects.slice(0, 10).map((entry) => entry.key),
            scannedAt,
        };

        return { cursor, metrics, objects };
    }

    public async discoverSources(storageConfig: ObjectStorageConfig): Promise<DiscoveredStorageSource[]> {
        if (!storageConfig.bucket) {
            throw new Error('storage_bucket_required');
        }

        const normalizedPrefix = this.normalizePrefix(storageConfig.prefix);
        const effectiveConfig = this.resolveEffectiveStorageConfig(storageConfig, storageConfig.bucket);
        const client = this.createClient(effectiveConfig);
        const childPrefixes = await this.listPrefixGroups(client, storageConfig.bucket, normalizedPrefix);
        const nonPartitionChildren = childPrefixes.filter((prefix) => !this.isPartitionOnlyChild(prefix));

        if (nonPartitionChildren.length === 0) {
            const singleSource = await this.inspectDiscoveredPrefix(storageConfig, normalizedPrefix, 'single_prefix');
            return singleSource ? [singleSource] : [];
        }

        const discovered = await Promise.all(
            nonPartitionChildren.slice(0, 25).map((prefix) => this.inspectDiscoveredPrefix(storageConfig, prefix, 'child_prefixes'))
        );
        const filtered = discovered.filter((entry): entry is DiscoveredStorageSource => Boolean(entry));

        if (filtered.length > 0) {
            return filtered;
        }

        const fallback = await this.inspectDiscoveredPrefix(storageConfig, normalizedPrefix, 'single_prefix');
        return fallback ? [fallback] : [];
    }

    private resolveSourceLocation(uri: string, storageConfig?: ObjectStorageConfig): ParsedSourceLocation {
        if (storageConfig?.bucket) {
            return {
                bucket: storageConfig.bucket,
                prefix: this.normalizePrefix(storageConfig.prefix) || this.extractPrefixFromUri(uri),
            };
        }

        const parsed = this.parseS3Uri(uri);
        return {
            bucket: parsed.bucket,
            prefix: this.normalizePrefix(parsed.prefix),
        };
    }

    private resolveEffectiveStorageConfig(storageConfig: ObjectStorageConfig | undefined, bucket: string): ObjectStorageConfig {
        return {
            provider: storageConfig?.provider || 'r2',
            endpoint: storageConfig?.endpoint || config.r2.endpoint,
            bucket: storageConfig?.bucket || bucket,
            prefix: this.normalizePrefix(storageConfig?.prefix),
            region: storageConfig?.region || config.r2.region,
            useSsl: storageConfig?.useSsl !== false,
            urlStyle: storageConfig?.urlStyle || 'path',
            fileFormat: storageConfig?.fileFormat || 'parquet',
            globPattern: storageConfig?.globPattern,
            credentials: storageConfig?.credentials || {
                accessKeyId: config.r2.accessKeyId,
                secretAccessKey: config.r2.secretAccessKey,
            },
        };
    }

    private createClient(storageConfig: ObjectStorageConfig): S3Client {
        const endpoint = storageConfig.endpoint?.replace(/\/$/, '');
        const credentials = storageConfig.credentials;

        return new S3Client({
            region: storageConfig.region || 'auto',
            endpoint,
            forcePathStyle: (storageConfig.urlStyle || 'path') === 'path',
            credentials: credentials
                ? {
                    accessKeyId: credentials.accessKeyId,
                    secretAccessKey: credentials.secretAccessKey,
                    sessionToken: credentials.sessionToken,
                }
                : undefined,
        });
    }

    private async listObjects(client: S3Client, bucket: string, prefix: string): Promise<SourceObjectSummary[]> {
        const objects: SourceObjectSummary[] = [];
        let continuationToken: string | undefined;

        do {
            const response = await client.send(new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }));

            for (const entry of response.Contents || []) {
                if (!entry.Key) continue;
                objects.push({
                    key: entry.Key,
                    size: Number(entry.Size || 0),
                    lastModified: entry.LastModified?.toISOString(),
                });
            }

            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (continuationToken);

        return objects;
    }

    private async listPrefixGroups(client: S3Client, bucket: string, prefix: string): Promise<string[]> {
        const normalizedPrefix = prefix ? `${prefix.replace(/\/+$/, '')}/` : '';
        let continuationToken: string | undefined;
        const prefixes = new Set<string>();

        do {
            const response = await client.send(new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: normalizedPrefix,
                Delimiter: '/',
                ContinuationToken: continuationToken,
            }));

            for (const group of response.CommonPrefixes || []) {
                const value = group.Prefix?.replace(/\/+$/, '');
                if (value) {
                    prefixes.add(value);
                }
            }

            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (continuationToken);

        return [...prefixes];
    }

    private async inspectDiscoveredPrefix(
        storageConfig: ObjectStorageConfig,
        prefix: string,
        detectionMode: DiscoveredStorageSource['detectionMode']
    ): Promise<DiscoveredStorageSource | null> {
        const scopedConfig: ObjectStorageConfig = {
            ...storageConfig,
            prefix,
        };
        const uri = this.buildSourceUri(scopedConfig);
        const inspection = await this.inspectSource({ uri, storageConfig: scopedConfig });

        if (inspection.cursor.objectCount === 0) {
            return null;
        }

        return {
            id: this.slugify(prefix || storageConfig.bucket),
            sourceName: this.toSourceName(prefix || storageConfig.bucket),
            prefix,
            uri,
            objectCount: inspection.cursor.objectCount,
            totalBytes: inspection.cursor.totalBytes,
            latestModifiedAt: inspection.cursor.latestModifiedAt,
            sampleKeys: inspection.cursor.sampledKeys || [],
            detectionMode,
            fileFormat: scopedConfig.fileFormat || 'parquet',
        };
    }

    private parseS3Uri(uri: string): ParsedSourceLocation {
        const sanitized = uri.replace(/^s3:\/\//, '');
        const [bucket, ...rest] = sanitized.split('/');
        if (!bucket) {
            throw new Error(`invalid_s3_uri:${uri}`);
        }

        return {
            bucket,
            prefix: this.normalizePrefix(rest.join('/')),
        };
    }

    private extractPrefixFromUri(uri: string): string {
        const { prefix } = this.parseS3Uri(uri);
        return this.normalizePrefix(prefix);
    }

    private isPartitionOnlyChild(prefix: string): boolean {
        const segment = prefix.split('/').filter(Boolean).at(-1) || '';
        return /^(dt|date|day|hour|month|year|partition|ingested_at|event_date)=/i.test(segment)
            || /^\d{4}([/-]\d{2}([/-]\d{2})?)?$/.test(segment)
            || /^\d{8}$/.test(segment);
    }

    private toSourceName(prefix: string): string {
        const segment = prefix.split('/').filter(Boolean).at(-1) || 'source';
        return segment
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    private slugify(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            || 'source';
    }

    private normalizePrefix(prefix?: string): string {
        if (!prefix) {
            return '';
        }

        return prefix
            .replace(/^\/+/, '')
            .replace(/\/?\*\*\/\*.*$/, '')
            .replace(/\/?\*.*$/, '')
            .replace(/\/+$/, '');
    }
}
