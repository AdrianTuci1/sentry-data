import crypto from 'crypto';

export interface SourceSchema {
    sourceId: string;
    columns: { name: string; type: string }[];
}

export interface SchemaFingerprintData {
    global: string;
    sources: Record<string, string>;
}

export class SchemaFingerprint {
    /**
     * Compute deterministic SHA-256 fingerprints for a set of data source schemas.
     * Returns a stringified JSON containing both a global hash and granular per-source hashes.
     */
    static compute(schemas: SourceSchema[]): string {
        const result: SchemaFingerprintData = {
            global: '',
            sources: {}
        };

        const sortedSchemas = [...schemas].sort((a, b) => a.sourceId.localeCompare(b.sourceId));

        // Compute per-source hashes
        for (const schema of sortedSchemas) {
            const sortedColumns = [...schema.columns].sort((a, b) => a.name.localeCompare(b.name));
            const sourcePayload = {
                sourceId: schema.sourceId,
                columns: sortedColumns.map(col => `${col.name}:${col.type}`)
            };
            
            const sourceHash = crypto.createHash('sha256').update(JSON.stringify(sourcePayload)).digest('hex');
            result.sources[schema.sourceId] = sourceHash;
        }

        // Compute global hash by combining the deterministic sorted source hashes
        const globalPayload = Object.keys(result.sources)
            .sort()
            .map(sourceId => `${sourceId}:${result.sources[sourceId]}`)
            .join('|');
            
        result.global = crypto.createHash('sha256').update(globalPayload).digest('hex');

        return JSON.stringify(result);
    }

    /**
     * Compare a stored fingerprint with the current computed one to see if anything changed.
     */
    static hasChanged(stored: string, current: string): boolean {
        try {
            const storedData: SchemaFingerprintData = JSON.parse(stored);
            const currentData: SchemaFingerprintData = JSON.parse(current);
            return storedData.global !== currentData.global;
        } catch (e) {
            // If stored string is old legacy format (just a hash string) or invalid, consider it changed
            return true;
        }
    }

    /**
     * Compares two fingerprints and returns an array of sourceIds that have changed or are newly added.
     */
    static getInvalidatedSources(stored: string, current: string): string[] {
        let storedData: SchemaFingerprintData = { global: '', sources: {} };
        const currentData: SchemaFingerprintData = JSON.parse(current);

        try {
             storedData = JSON.parse(stored);
        } catch (e) {
             // Legacy format. Everything is invalidated.
             return Object.keys(currentData.sources);
        }

        const invalidated: string[] = [];
        
        for (const [sourceId, currentHash] of Object.entries(currentData.sources)) {
            const storedHash = storedData.sources[sourceId];
            if (!storedHash || storedHash !== currentHash) {
                invalidated.push(sourceId);
            }
        }
        
        return invalidated;
    }
}
