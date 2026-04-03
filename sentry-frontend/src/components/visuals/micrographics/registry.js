import fallbackAnalyticsData from '../../../data/analyticsData.json';
import {
    ActivityHeatmap,
    AnomalyStream,
    AttributionModels,
    AudienceCopilot,
    BudgetSensitivity,
    ChronoDial,
    CohortAnalysis,
    CovarianceMatrix,
    CreativeQuadrant,
    EmotionWave,
    FinancialBreakdown,
    FunnelChart,
    GaugePanelMicro,
    IncrementalLift,
    IntentSunburst,
    InterestRadar,
    LeadClustering,
    LeadsList,
    LiquidGauge,
    LiveTrafficChart,
    MarketEvolution,
    MarketSentimentRadar,
    NaturalMicro,
    NeuralNexus,
    OptimalTimeHeatmap,
    PredictiveForecast,
    ProductivityMicro,
    PulseCircle,
    RangeAreaChart,
    RealMapbox,
    RedGradientMicro,
    SankeyChart,
    ScanningOrbit,
    ScatterPlot,
    SemiCircleDonut,
    ShapleyAttribution,
    SignalScaleMicro,
    SparklineStatMicro,
    StreamGraph,
    TechnicalHealth,
    TrendSpotter,
    UptimeStripMicro,
    WaffleChart,
    WeatherMicro,
    ColorSliderMicro,
    CampaignListMicro,
    IntensityHeat,
    MetricTrendMicro,
} from './index';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeLookupKey = (value) => String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s/]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const fallbackById = new Map();
const fallbackByType = new Map();

fallbackAnalyticsData.forEach((widget) => {
    const idKey = normalizeLookupKey(widget?.id);
    const typeKey = normalizeLookupKey(widget?.type);

    if (idKey && !fallbackById.has(idKey)) {
        fallbackById.set(idKey, widget);
    }

    if (typeKey && !fallbackByType.has(typeKey)) {
        fallbackByType.set(typeKey, widget);
    }
});

const componentRegistryById = {
    'ai-coverage': GaugePanelMicro,
    'budget-burn': SparklineStatMicro,
    'data-saturation': SignalScaleMicro,
    'marketing-conv-rate': SignalScaleMicro,
    'marketing-cpa': SparklineStatMicro,
    'marketing-roas': MetricTrendMicro,
    'ad-fatigue': SignalScaleMicro,
    'refresh-cycle': MetricTrendMicro,
    'technical-health': UptimeStripMicro,
    'viral-k-factor': MetricTrendMicro,
};

const componentRegistryByType = {
    '3d-map': RealMapbox,
    'activity-heatmap': ActivityHeatmap,
    'animated-line': LiveTrafficChart,
    'anomaly-stream': AnomalyStream,
    attribution: AttributionModels,
    'audience-copilot': AudienceCopilot,
    'budget-sensitivity': BudgetSensitivity,
    'campaign-list': CampaignListMicro,
    campaigns: CampaignListMicro,
    'chrono-dial': ChronoDial,
    cohorts: CohortAnalysis,
    'color-slider': ColorSliderMicro,
    'covariance-matrix': CovarianceMatrix,
    'creative-quadrant': CreativeQuadrant,
    'emotion-wave': EmotionWave,
    funnel: FunnelChart,
    'incremental-lift': IncrementalLift,
    'intent-sunburst': IntentSunburst,
    'interest-radar': InterestRadar,
    'lead-clustering': LeadClustering,
    'leads-list': LeadsList,
    'light-dial': ColorSliderMicro,
    'liquid-gauge': LiquidGauge,
    'live-traffic': LiveTrafficChart,
    'market-evolution': MarketEvolution,
    'market-radar': MarketSentimentRadar,
    natural: NaturalMicro,
    'neural-nexus': NeuralNexus,
    'optimal-time': OptimalTimeHeatmap,
    predictive: PredictiveForecast,
    productivity: ProductivityMicro,
    'pulse-circle': PulseCircle,
    'range-area-chart': RangeAreaChart,
    'real-mapbox': RealMapbox,
    'red-gradient': RedGradientMicro,
    sankey: SankeyChart,
    'sankey-chart': SankeyChart,
    'scanning-orbit': ScanningOrbit,
    scatter: ScatterPlot,
    'semi-circle-donut': SemiCircleDonut,
    'shapley-attribution': ShapleyAttribution,
    'stream-graph': StreamGraph,
    'technical-health': TechnicalHealth,
    'trend-spotter': TrendSpotter,
    vitals: TechnicalHealth,
    waterfall: FinancialBreakdown,
    waffle: WaffleChart,
    weather: WeatherMicro,
    'intensity-heat': IntensityHeat,
};

const getWidgetFallback = (payload = {}) => {
    const idMatch = fallbackById.get(normalizeLookupKey(payload?.id));
    if (idMatch) {
        return idMatch;
    }

    return fallbackByType.get(normalizeLookupKey(payload?.type || payload?.widget_type)) || null;
};

export const prepareMicroGraphicData = (payload = {}) => {
    const fallbackWidget = getWidgetFallback(payload);
    const fallbackFields = fallbackWidget ? { ...fallbackWidget } : {};
    const payloadFields = isPlainObject(payload) ? { ...payload } : {};
    const fallbackDataFields = isPlainObject(fallbackWidget?.data) ? fallbackWidget.data : {};
    const payloadDataFields = isPlainObject(payload?.data) ? payload.data : {};

    delete fallbackFields.data;
    delete payloadFields.data;

    const merged = {
        ...fallbackFields,
        ...fallbackDataFields,
        ...payloadFields,
        ...payloadDataFields,
    };

    if (payload?.data !== undefined) {
        merged.data = payload.data;
    } else if (fallbackWidget?.data !== undefined) {
        merged.data = fallbackWidget.data;
    }

    if (payload?.results !== undefined) {
        merged.results = payload.results;
    } else if (fallbackWidget?.results !== undefined) {
        merged.results = fallbackWidget.results;
    }

    return merged;
};

export const resolveMicroGraphicComponent = (payload = {}) => {
    const idCandidate = componentRegistryById[normalizeLookupKey(payload?.id)];
    if (idCandidate) {
        return idCandidate;
    }

    const candidates = [payload?.type, payload?.widget_type, payload?.widgetType];

    for (const candidate of candidates) {
        const component = componentRegistryByType[normalizeLookupKey(candidate)];
        if (component) {
            return component;
        }
    }

    return null;
};
