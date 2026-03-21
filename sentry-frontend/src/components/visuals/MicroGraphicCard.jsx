import React, { useState, useEffect } from 'react';
import './MicroGraphicCard.css';
import { ProjectService } from '../../api/core';
import { useStore } from '../../store/StoreProvider';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import * as LucideIcons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ecStat from 'echarts-stat';
import * as ecSimpleTransform from 'echarts-simple-transform';
import mapboxgl from 'mapbox-gl';

const GenericDataExplorer = ({ data, title }) => {
    const isArray = Array.isArray(data);
    const displayData = isArray ? data.slice(0, 5) : [data];

    return (
        <div className="generic-explorer">
            <div className="explorer-header">
                <LucideIcons.Table size={14} />
                <span>Raw Data View</span>
            </div>
            <div className="explorer-content">
                {displayData.map((item, i) => (
                    <div key={i} className="explorer-row">
                        {Object.entries(item).map(([key, val]) => (
                            <div key={key} className="explorer-cell">
                                <span className="cell-key">{key}:</span>
                                <span className="cell-val">{String(val)}</span>
                            </div>
                        ))}
                    </div>
                ))}
                {isArray && data.length > 5 && (
                    <div className="explorer-more">+ {data.length - 5} more rows</div>
                )}
            </div>
        </div>
    );
};

const MicroGraphicCard = ({ data: initialData, isExpanded, onClick }) => {
    const { projectStore } = useStore();
    const [data, setData] = useState(initialData);

    // Is loading if we don't have representative data fields yet
    const hasData = initialData.leads ||
        initialData.prediction ||
        initialData.funnel ||
        initialData.heatData ||
        initialData.data ||
        initialData.results ||
        initialData.models;

    const [isLoading, setIsLoading] = useState(!hasData);

    useEffect(() => {
        // If we already have data (from parent hydration / SSR), sync state and skip fetch
        if (hasData) {
            setData(initialData);
            setIsLoading(false);
            return;
        }

        const fetchWidgetData = async () => {
            try {
                const projectId = projectStore.currentProjectId;
                if (!projectId) return;

                const res = await ProjectService.getWidgetData(projectId, initialData.id);
                if (res.status === 'success') {
                    setData(prev => ({ ...prev, ...res.data }));
                }
            } catch (error) {
                console.error(`[MicroGraphicCard] Failed to fetch data for ${initialData.id}`, error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWidgetData();
    }, [initialData.id, projectStore.currentProjectId]);

    // Generate class names for grid span
    const spanClass = data.gridSpan && data.gridSpan !== 'default' ? data.gridSpan : '';

    // Dynamic Component Loader
    const [RemoteComponent, setRemoteComponent] = useState(null);

    useEffect(() => {
        if (!data.componentCode) {
            console.warn(`[MicroGraphicCard] No componentCode for ${data.id}`, data);
            return;
        }

        try {


            const module = { exports: {} };
            // Provide import.meta.env simulation for Vite-based components
            const importMeta = { env: import.meta.env || {} };

            // We must replace property access 'import.meta' with our local variable 'importMeta'
            // because 'import.meta' is a syntax error outside of real ESM modules.
            const safeCode = data.componentCode.replace(/import\.meta/g, 'importMeta');

            const func = new Function('module', 'exports', 'require', 'React', 'importMeta', safeCode);

            const mockRequire = (name) => {
                const lowerName = name.toLowerCase();
                if (lowerName === 'react') return React;
                if (lowerName === 'echarts-for-react') return ReactECharts;
                if (lowerName === 'echarts') return echarts;
                if (lowerName === 'echarts-stat') return ecStat;
                if (lowerName === 'echarts-simple-transform') {
                    return ecSimpleTransform;
                }
                if (lowerName === 'lucide-react') return LucideIcons;
                if (lowerName === 'framer-motion') return { motion, AnimatePresence };
                if (lowerName === 'mapbox-gl') return mapboxgl;
                return {};
            };

            func(module, module.exports, mockRequire, React, importMeta);

            // Handle CJS/ESM interop
            let Component = module.exports.default || module.exports;

            // CRITICAL: Verify it's a valid React element type (string or function/class)
            const isValidType = typeof Component === 'function' ||
                (typeof Component === 'object' && Component !== null && Component.$$typeof) ||
                typeof Component === 'string';

            if (isValidType) {
                setRemoteComponent(() => Component);
            } else {
                console.error(`[MicroGraphicCard] Invalid component type for ${data.id}:`, typeof Component, Component);
                setRemoteComponent(() => null);
            }
        } catch (err) {
            console.error(`[MicroGraphicCard] Failed to evaluate component for ${data.id}`, err);
            setRemoteComponent(() => null);
        }
    }, [data.componentCode, data.id]);

    // Render specific graphic based on type
    const renderGraphic = () => {
        if (isLoading) {
            return (
                <div className="skeleton-graphic">
                    <div className="skeleton-pulse"></div>
                </div>
            );
        }

        if (RemoteComponent) {
            try {
                // Pass the mapped data as props to the dynamic component
                const componentData = data || {};
                return <RemoteComponent data={componentData} isMock={data.isMock} />;
            } catch (err) {
                console.error(`[MicroGraphicCard] Render error for ${data.id}`, err);
                // Fallback to generic explorer on render crash
                const fallbackData = data.results || data.data || data || [];
                return <GenericDataExplorer data={fallbackData} title={data.title} />;
            }
        }

        if (data.results || data.data || data.leads || data.prediction) {
            const fallbackData = data.results || data.data || data.leads || data.prediction || [];
            return <GenericDataExplorer data={fallbackData} title={data.title} />;
        }

        if (data.ssrHtml) {
            return <div className="ssr-content-wrapper" dangerouslySetInnerHTML={{ __html: data.ssrHtml }} />;
        }

        return <div className="no-ssr-placeholder">Waiting for components...</div>;
    };

    return (
        <div
            className={`micro-card ${data.colorTheme} ${spanClass} ${isExpanded ? 'expanded' : ''} ${isLoading ? 'loading' : ''}`}
            onClick={() => onClick(data.id)}
        >
            <div className="micro-card-header">
                {data.title && <h3 className="micro-title">{data.title}</h3>}
                {data.subtitle && <span className="micro-subtitle">{data.subtitle}</span>}
            </div>

            <div className="micro-card-body">
                {renderGraphic()}
            </div>

            <div className="micro-card-footer">
                {data.footerText && <span className="footer-main">{data.footerText}</span>}
                {data.footerBottom && <span className="footer-bottom">{data.footerBottom}</span>}
            </div>

            {/* Expand indicator icon */}
            {!isExpanded && !isLoading && (
                <div className="expand-indicator">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                </div>
            )}

            {/* Close indicator when expanded */}
            {isExpanded && (
                <div className="close-indicator" onClick={(e) => { e.stopPropagation(); onClick(null); }}>
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </div>
            )}
        </div>
    );
};

export default MicroGraphicCard;
