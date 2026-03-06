import React from 'react';
import './MicroGraphicCard.css';
import RealMapbox from './micrographics/RealMapbox';
import LiveTrafficChart from './micrographics/LiveTrafficChart';
import SankeyChart from './micrographics/SankeyChart';
import StreamGraph from './micrographics/StreamGraph';
import RangeAreaChart from './micrographics/RangeAreaChart';
import WaffleChart from './micrographics/WaffleChart';
import SemiCircleDonut from './micrographics/SemiCircleDonut';
import ScatterPlot from './micrographics/ScatterPlot';
import CovarianceMatrix from './micrographics/CovarianceMatrix';
import FunnelChart from './micrographics/FunnelChart';
import LeadsList from './micrographics/LeadsList';
import InterestRadar from './micrographics/InterestRadar';
import ActivityHeatmap from './micrographics/ActivityHeatmap';
import CohortAnalysis from './micrographics/CohortAnalysis';
import PredictiveForecast from './micrographics/PredictiveForecast';
import FinancialBreakdown from './micrographics/FinancialBreakdown';
import TechnicalHealth from './micrographics/TechnicalHealth';
import AttributionModels from './micrographics/AttributionModels';
import MarketSentimentRadar from './micrographics/MarketSentimentRadar';
import IncrementalLift from './micrographics/IncrementalLift';
import AnomalyStream from './micrographics/AnomalyStream';
import OptimalTimeHeatmap from './micrographics/OptimalTimeHeatmap';
import LeadClustering from './micrographics/LeadClustering';
import BudgetSensitivity from './micrographics/BudgetSensitivity';
import IntentSunburst from './micrographics/IntentSunburst';
import ShapleyAttribution from './micrographics/ShapleyAttribution';
import MarketEvolution from './micrographics/MarketEvolution';
import CreativeQuadrant from './micrographics/CreativeQuadrant';
import LiquidGauge from './micrographics/LiquidGauge';
import NeuralNexus from './micrographics/NeuralNexus';
import IntensityHeat from './micrographics/IntensityHeat';
import EmotionWave from './micrographics/EmotionWave';
import ChronoDial from './micrographics/ChronoDial';
import TrendSpotter from './micrographics/TrendSpotter';

import BarChartMicro from './micrographics/legacy/BarChartMicro';
import DialMicro from './micrographics/legacy/DialMicro';
import PieChartMicro from './micrographics/legacy/PieChartMicro';

const MicroGraphicCard = ({ data, isExpanded, onClick }) => {
    // Generate class names for grid span
    const spanClass = data.gridSpan && data.gridSpan !== 'default' ? data.gridSpan : '';

    // Render specific graphic based on type
    const renderGraphic = () => {
        switch (data.type) {
            case '3d-map':
                return <RealMapbox data={data} />;
            case 'sankey':
                return <SankeyChart data={data} />;
            case 'stream-graph':
                return <StreamGraph data={data} />;
            case 'range-area':
                return <RangeAreaChart data={data} />;
            case 'waffle':
                return <WaffleChart data={data} />;
            case 'semi-circle':
                return <SemiCircleDonut data={data} />;
            case 'scatter':
                return <ScatterPlot data={data} />;
            case 'covariance':
                return <CovarianceMatrix data={data} />;
            case 'funnel':
                return <FunnelChart data={data} />;
            case 'leads-list':
                return <LeadsList data={data} />;
            case 'radar':
                return <InterestRadar data={data} />;
            case 'heatmap-cartesian':
                return <ActivityHeatmap data={data} />;
            case 'cohorts':
                return <CohortAnalysis data={data} />;
            case 'predictive':
                return <PredictiveForecast data={data} />;
            case 'waterfall':
                return <FinancialBreakdown data={data} />;
            case 'vitals':
                return <TechnicalHealth data={data} />;
            case 'attribution':
                return <AttributionModels data={data} />;
            case 'market-radar':
                return <MarketSentimentRadar data={data} />;
            case 'incremental-lift':
                return <IncrementalLift data={data} />;
            case 'anomaly-stream':
                return <AnomalyStream data={data} />;
            case 'optimal-time':
                return <OptimalTimeHeatmap data={data} />;
            case 'lead-clustering':
                return <LeadClustering data={data} />;
            case 'budget-sensitivity':
                return <BudgetSensitivity data={data} />;
            case 'intent-sunburst':
                return <IntentSunburst data={data} />;
            case 'shapley-attribution':
                return <ShapleyAttribution data={data} />;
            case 'market-evolution':
                return <MarketEvolution data={data} />;
            case 'creative-quadrant':
                return <CreativeQuadrant data={data} />;
            case 'liquid-gauge':
                return <LiquidGauge data={data} />;
            case 'neural-nexus':
                return <NeuralNexus data={data} />;
            case 'intensity-heat':
                return <IntensityHeat data={data} />;
            case 'chrono-dial':
                return <ChronoDial data={data} />;
            case 'emotion-wave':
                return <EmotionWave data={data} />;
            case 'trend-spotter':
                return <TrendSpotter data={data} />;
            case 'weather':
                return (
                    <div className="micro-weather-card">
                        <div className="weather-value-wrapper">
                            <span className="weather-val">{data.value}</span>
                            <span className="weather-unit">{data.unit}</span>
                        </div>
                        <div className="weather-lines-card">
                            <span></span><span></span><span></span><span></span><span className="active"></span><span></span><span></span><span></span><span></span>
                        </div>
                    </div>
                );
            case 'natural':
                return (
                    <div className="micro-natural-card">
                        <div className="natural-value-wrapper">
                            <span className="natural-val">{data.value}</span>
                            <span className="natural-unit">{data.unit}</span>
                        </div>
                        <div className="natural-bar-container">
                            <div className="natural-slider-card">
                                <div className="natural-fill" style={{ width: `${data.sliderValue}%` }}></div>
                                <div className="natural-thumb" style={{ left: `${data.sliderValue}%` }}></div>
                            </div>
                        </div>
                        {data.footerTextLeft && (
                            <div className="natural-labels">
                                <span>{data.footerTextLeft}</span>
                                <span>{data.footerTextRight}</span>
                            </div>
                        )}
                    </div>
                );
            case 'light-dial':
                return <DialMicro data={data} />;
            case 'color-slider':
                return (
                    <div className="micro-color-card">
                        <div className="color-indicator">
                            <div className="color-dot"></div>
                        </div>
                        <div className="color-slider-track">
                            <div className="color-slider-thumb" style={{ left: `${data.sliderValue}%` }}></div>
                            <div className="color-ticks">
                                {[...Array(20)].map((_, i) => <span key={i}></span>)}
                            </div>
                        </div>
                    </div>
                );
            case 'animated-line':
                return <LiveTrafficChart data={data} />;
            case 'campaign-list':
                return (
                    <div className="micro-campaign-list">
                        {data.campaigns?.map((camp, i) => (
                            <div key={i} className="campaign-item">
                                <div className="camp-info">
                                    <span className="camp-name">{camp.name}</span>
                                    <span className={`camp-trend ${camp.trend === '+' ? 'positive' : 'negative'}`}>
                                        {camp.trend === '+' ? '▲' : '▼'}
                                    </span>
                                </div>
                                <div className="camp-val">{camp.value}</div>
                            </div>
                        ))}
                    </div>
                );
            case 'red-gradient':
                return (
                    <div className="micro-red-card">
                        <div className="red-gauge-track">
                            <div className="red-gauge-fill" style={{ width: `${data.sliderValue}%` }}></div>
                            <div className="red-gauge-thumb" style={{ left: `${data.sliderValue}%` }}></div>
                        </div>
                    </div>
                );
            case 'productivity-chart':
                return (
                    <div className="micro-productivity">
                        <div className="dots-container">
                            {data.dataPoints?.map((val, i) => (
                                <div
                                    key={i}
                                    className="prod-dot"
                                    style={{
                                        height: `${val * 3}px`,
                                        opacity: 0.3 + (i / data.dataPoints.length) * 0.7
                                    }}
                                ></div>
                            ))}
                        </div>
                    </div>
                );
            case 'pie-chart':
                return <PieChartMicro data={data} />;
            case 'bar-chart':
                return (
                    <div style={{ width: '30%', alignSelf: 'center', height: '100%' }}>
                        <BarChartMicro data={data} />
                    </div>
                );
            default:
                return null;
        }
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
