import React from 'react';
import './MicroGraphicCard.css';
import * as Graphics from './micrographics';

const GRAPHIC_COMPONENTS = {
    '3d-map': Graphics.RealMapbox,
    'sankey': Graphics.SankeyChart,
    'stream-graph': Graphics.StreamGraph,
    'range-area': Graphics.RangeAreaChart,
    'waffle': Graphics.WaffleChart,
    'semi-circle': Graphics.SemiCircleDonut,
    'scatter': Graphics.ScatterPlot,
    'covariance': Graphics.CovarianceMatrix,
    'funnel': Graphics.FunnelChart,
    'leads-list': Graphics.LeadsList,
    'radar': Graphics.InterestRadar,
    'heatmap-cartesian': Graphics.ActivityHeatmap,
    'cohorts': Graphics.CohortAnalysis,
    'predictive': Graphics.PredictiveForecast,
    'waterfall': Graphics.FinancialBreakdown,
    'vitals': Graphics.TechnicalHealth,
    'attribution': Graphics.AttributionModels,
    'market-radar': Graphics.MarketSentimentRadar,
    'incremental-lift': Graphics.IncrementalLift,
    'anomaly-stream': Graphics.AnomalyStream,
    'optimal-time': Graphics.OptimalTimeHeatmap,
    'lead-clustering': Graphics.LeadClustering,
    'budget-sensitivity': Graphics.BudgetSensitivity,
    'intent-sunburst': Graphics.IntentSunburst,
    'shapley-attribution': Graphics.ShapleyAttribution,
    'market-evolution': Graphics.MarketEvolution,
    'creative-quadrant': Graphics.CreativeQuadrant,
    'liquid-gauge': Graphics.LiquidGauge,
    'neural-nexus': Graphics.NeuralNexus,
    'intensity-heat': Graphics.IntensityHeat,
    'chrono-dial': Graphics.ChronoDial,
    'emotion-wave': Graphics.EmotionWave,
    'trend-spotter': Graphics.TrendSpotter,
    'weather': Graphics.WeatherMicro,
    'natural': Graphics.NaturalMicro,
    'light-dial': Graphics.DialMicro,
    'color-slider': Graphics.ColorSliderMicro,
    'animated-line': Graphics.LiveTrafficChart,
    'campaign-list': Graphics.CampaignListMicro,
    'red-gradient': Graphics.RedGradientMicro,
    'productivity-chart': Graphics.ProductivityMicro,
};

const MicroGraphicCard = ({ data, isExpanded, onClick }) => {
    // Generate class names for grid span
    const spanClass = data.gridSpan && data.gridSpan !== 'default' ? data.gridSpan : '';

    // Render specific graphic based on type
    const renderGraphic = () => {
        const Component = GRAPHIC_COMPONENTS[data.type];
        return Component ? <Component data={data} /> : null;
    };

    return (
        <div
            className={`micro-card ${data.colorTheme} ${spanClass} ${isExpanded ? 'expanded' : ''}`}
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
