import React from 'react';
import { renderToString } from 'react-dom/server';
import * as esbuild from 'esbuild';
import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { config } from '../../config';

/**
 * WidgetRenderer provides pre-compiled Javascript code for JSX widgets.
 * It dynamically loads components from R2 and transforms them for browser consumption.
 */
export class WidgetRenderer {
    private r2Prefix = 'system/boilerplates/widgets/';

    constructor(private r2Storage: R2StorageService) {}

    /**
     * Fetches and compiles a widget component to browser-executable Javascript.
     */
    public async getCompiledCode(widgetType: string, category: string): Promise<string> {
        try {
            const componentKey = `${this.r2Prefix}${category}/${widgetType}/component.jsx`;
            const codeContent = await this.r2Storage.getFileContent(componentKey);
            
            if (!codeContent) {
                console.warn(`[WidgetRenderer] Component not found in R2 at ${componentKey}`);
                return "";
            }

            // Compile the JSX string content for browser consumption
            const result = await esbuild.transform(codeContent, {
                loader: 'jsx',
                format: 'cjs',
                target: 'es2020',
                define: {
                    'import.meta.env.VITE_MAPBOX_TOKEN': JSON.stringify(config.mapboxToken)
                },
                // We don't bundle dependencies here, the frontend host must provide them
            });

            return result.code;
        } catch (error: any) {
            console.error(`[WidgetRenderer] Failed to compile ${widgetType}:`, error.message);
            return "";
        }
    }
}
