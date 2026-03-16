import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { SchemaFingerprint, SourceSchema } from './SchemaFingerprint';
import { PipelineContext, PipelinePath } from './types';
import { PipelineConfig } from './PipelineConfig';

export class PathResolver {
    constructor(private r2StorageService: R2StorageService) {}

    /**
     * Evaluates the current state of the project, including schemas and cache,
     * to determine whether the pipeline should take the 'hot' (cached) path,
     * the 'cold' (generative) path, or trigger 'ml' (periodic retraining).
     */
    async resolve(
        ctx: PipelineContext, 
        currentSchemas: SourceSchema[],
        storedFingerprint?: string
    ): Promise<{ path: PipelinePath, invalidatedSources: string[] }> {
        
        // 1. Manual Overrides (from PipelineConfig)
        if (PipelineConfig.FORCE_HOT_PATH_FOR_DEBUG) {
            console.warn(`[PathResolver] OVERRIDE: Forcing HOT path due to PipelineConfig.FORCE_HOT_PATH_FOR_DEBUG`);
            return { path: 'hot', invalidatedSources: [] };
        }
        if (PipelineConfig.FORCE_COLD_PATH_FOR_DEBUG) {
            console.warn(`[PathResolver] OVERRIDE: Forcing COLD path due to PipelineConfig.FORCE_COLD_PATH_FOR_DEBUG`);
            return { path: 'cold', invalidatedSources: ctx.sourceNames || [] }; // Invalidate everything
        }

        // 2. Explicit User Override
        if (ctx.forceRediscover) {
            console.log(`[PathResolver] User explicitly requested forced re-discovery. Resolving to 'cold' path.`);
            return { path: 'cold', invalidatedSources: ctx.sourceNames || [] }; // Invalidate everything
        }

        const currentFingerprint = SchemaFingerprint.compute(currentSchemas);
        if (storedFingerprint && SchemaFingerprint.hasChanged(storedFingerprint, currentFingerprint)) {
            const invalidatedSources = SchemaFingerprint.getInvalidatedSources(storedFingerprint, currentFingerprint);
            console.log(`[PathResolver] Schema changed for sources: ${invalidatedSources.join(', ')} → COLD PATH`);
            return { path: 'cold', invalidatedSources };
        }

        // Check cache existence for normalizer (ALL sources), feature engineer and query generator
        const normalizationCacheChecks = await Promise.all(
            (ctx.sourceNames || ['source_0']).map(sourceName => 
                this.r2StorageService.scriptExists(ctx.tenantId, ctx.projectId, `Normalization_${sourceName}`)
            )
        );
        const normalizerCached = normalizationCacheChecks.every(cached => cached === true);

        const feCached = await this.r2StorageService.scriptExists(
            ctx.tenantId, ctx.projectId, `Feature_Engineering`
        );
        const qgCached = await this.r2StorageService.scriptExists(
            ctx.tenantId, ctx.projectId, `Query_Generator`
        );

        const missingSources: string[] = [];
        normalizationCacheChecks.forEach((cached, i) => {
            if (!cached) missingSources.push((ctx.sourceNames || ['source_0'])[i]);
        });

        if (!feCached || !qgCached || missingSources.length > 0) {
            console.log(`[PathResolver] Partial cache miss → COLD PATH for: ${missingSources.join(', ') || 'Global tasks'}`);
            // If global tasks (FE/QG) are missing, we might need all sources for a full rebuild, 
            // but for now let's just invalidate the missing normalizers to be efficient.
            // If FE or QG is missing, we definitely need to run them, but we only NEED to normalize what's missing.
            return { 
                path: 'cold', 
                invalidatedSources: [...new Set([...(ctx.invalidatedSources || []), ...missingSources])] 
            };
        }

        console.log(`[PathResolver] All core scripts cached and schema identical → HOT PATH`);
        return { path: 'hot', invalidatedSources: [] };
    }
}
