import yaml from 'js-yaml';
import { R2StorageService } from '../../infrastructure/storage/R2StorageService';

export interface WidgetDefinition {
    id: string;
    title: string;
    description: string;
    category: string;
    data_requirements: string[];
    sql_aliases: Record<string, string>[];
    data_structure_template: any;
    grid_span: string;
    color_theme?: string;
    sdui?: {
        root_key?: string;
        mapping_mode?: 'list' | 'single' | 'matrix' | 'array';
        format_rules?: Record<string, string>;
    }
}

/**
 * WidgetService manages the modularized widget manifest.
 * It provides lean discovery for LLMs and deep technical contracts on-demand.
 * Now fetches everything from R2 storage.
 */
export class WidgetService {
    private r2Prefix = 'system/boilerplates/widgets/';
    private cache: Map<string, WidgetDefinition> = new Map();
    private catalogPromise: Promise<void> | null = null;

    constructor(private r2Storage: R2StorageService) {}

    /**
     * Clears the internal cache, forcing a re-discovery on the next request.
     */
    public clearCache(): void {
        this.cache.clear();
        this.catalogPromise = null;
        console.log('[WidgetService] Cache cleared.');
    }

    /**
     * Internal method to ensure the cache is populated.
     */
    private async ensureCache(): Promise<void> {
        if (this.cache.size > 0) return;
        if (this.catalogPromise) return this.catalogPromise;

        this.catalogPromise = (async () => {
            console.log('[WidgetService] Populating widget cache using FLAT DISCOVERY...');
            try {
                // Flat listing of EVERYTHING under system/boilerplates/widgets/
                const allKeys = await this.r2Storage.listAllUnder(this.r2Prefix);
                
                // We search for manifests: .../widgets/{category}/{id}/manifest.yml
                const manifestKeys = allKeys.filter(key => key.endsWith('manifest.yml'));
                console.log(`[WidgetService] Found ${manifestKeys.length} potential manifest files.`);

                for (const key of manifestKeys) {
                    try {
                        // Extract category and ID from path
                        const relativePath = key.replace(this.r2Prefix, '');
                        const parts = relativePath.split('/');
                        
                        if (parts.length < 3) continue; 
                        
                        const cat = parts[0];
                        const widgetId = parts[1];

                        const contentStr = await this.r2Storage.getFileContent(key);
                        if (contentStr) {
                            const content = yaml.load(contentStr) as any;
                            const definition: WidgetDefinition = { 
                                id: widgetId, 
                                category: cat, 
                                ...content 
                            };
                            this.cache.set(widgetId, definition);
                            console.log(`[WidgetService] Cached: [${cat}] ${widgetId}`);
                        }
                    } catch (e) {
                        console.warn(`[WidgetService] Failed to parse manifest at ${key}`, e);
                    }
                }
                console.log(`[WidgetService] Cache populated with ${this.cache.size} widgets.`);
            } catch (error) {
                console.error('[WidgetService] Failed to populate cache:', error);
            } finally {
                this.catalogPromise = null;
            }
        })();

        return this.catalogPromise;
    }

    /**
     * Returns a lean catalog of available widgets for LLM selection.
     */
    public async getCatalog(): Promise<WidgetDefinition[]> {
        await this.ensureCache();
        return Array.from(this.cache.values());
    }

    /**
     * Returns the full technical contract for a specific widget.
     */
    public async getWidgetContract(category: string, id: string): Promise<WidgetDefinition | null> {
        await this.ensureCache();
        return this.cache.get(id) || null;
    }

    /**
     * Finds a widget definition by ID.
     */
    public async findWidget(id: string): Promise<WidgetDefinition | null> {
        await this.ensureCache();
        return this.cache.get(id) || null;
    }
}
