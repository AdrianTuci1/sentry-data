import React, { useMemo } from 'react';
import './MicroGraphicCard.css';
import * as LucideIcons from 'lucide-react';
import { prepareMicroGraphicData, resolveMicroGraphicComponent } from './micrographics/registry';

const GenericDataExplorer = ({ data, title }) => {
    const isArray = Array.isArray(data);
    const displayData = isArray ? data.slice(0, 5) : (data ? [data] : []);

    return (
        <div className="generic-explorer">
            <div className="explorer-header">
                <LucideIcons.Table size={14} />
                <span>Raw Data View</span>
            </div>
            <div className="explorer-content">
                {!displayData.length && <div className="explorer-more">No aggregated data yet for {title || 'this widget'}.</div>}
                {displayData.map((item, i) => (
                    <div key={i} className="explorer-row">
                        {Object.entries(item && typeof item === 'object' ? item : { value: item }).map(([key, val]) => (
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

const getExplorerPayload = (data) => data?.results ||
    data?.data ||
    data?.leads ||
    data?.metrics ||
    data?.models ||
    data?.funnel ||
    data?.steps ||
    data?.cohorts ||
    data?.scatterData ||
    data?.curvePoints ||
    data?.heatmapData ||
    data?.historical ||
    data?.forecast ||
    null;

const MicroGraphicCard = ({ data: initialData = {}, isExpanded, onClick }) => {
    const data = useMemo(() => prepareMicroGraphicData(initialData), [initialData]);
    const GraphicComponent = useMemo(() => resolveMicroGraphicComponent(data), [data]);
    const explorerPayload = getExplorerPayload(data);
    const spanClass = data.gridSpan && data.gridSpan !== 'default' ? data.gridSpan : '';
    const editorialCardIds = new Set(['marketing-pclv', 'live-traffic', 'retention-cohorts']);
    const immersiveEditorialCardIds = new Set(['marketing-pclv', 'retention-cohorts']);
    const immersiveCardIds = new Set(['sales-funnel']);
    const visualClass = [
        data.type === '3d-map' ? 'map-bleed-card' : '',
        data.type === 'optimal-time' ? 'optimal-time-card' : '',
        editorialCardIds.has(data.id) ? 'editorial-card' : '',
        data.id === 'live-traffic' ? 'compact-editorial-card' : '',
        data.id === 'sales-funnel' ? 'funnel-hero-card' : '',
    ].filter(Boolean).join(' ');
    const isImmersiveCard = data.type === '3d-map' || data.type === 'optimal-time' || immersiveEditorialCardIds.has(data.id) || immersiveCardIds.has(data.id);

    // Render specific graphic based on type
    const renderGraphic = () => {
        if (GraphicComponent) {
            try {
                return <GraphicComponent data={data} isMock={data.isMock} />;
            } catch (err) {
                console.error(`[MicroGraphicCard] Render error for ${data.id}`, err);
                return <GenericDataExplorer data={explorerPayload || data} title={data.title} />;
            }
        }

        if (explorerPayload) {
            return <GenericDataExplorer data={explorerPayload} title={data.title} />;
        }

        return <div className="no-ssr-placeholder">No visualization available yet.</div>;
    };

    return (
        <div
            className={`micro-card ${data.colorTheme || 'theme-productivity'} ${spanClass} ${visualClass} ${isExpanded ? 'expanded' : ''}`}
            onClick={() => onClick?.(data.id)}
        >
            {!isImmersiveCard && (
                <div className="micro-card-header">
                    {data.title && <h3 className="micro-title">{data.title}</h3>}
                    {data.subtitle && <span className="micro-subtitle">{data.subtitle}</span>}
                </div>
            )}

            <div className="micro-card-body">
                {renderGraphic()}
            </div>

            {!isImmersiveCard && (
                <div className="micro-card-footer">
                    {data.footerText && <span className="footer-main">{data.footerText}</span>}
                    {data.footerBottom && <span className="footer-bottom">{data.footerBottom}</span>}
                </div>
            )}

            {/* Expand indicator icon */}
            {!isExpanded && (
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
