const normalizeLookupKey = (value) => String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s/]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const field = (alias, description, options = {}) => ({
    alias,
    path: `data.${alias}`,
    required: options.required !== false,
    sql_type: options.sqlType || 'string',
    expression_hint: options.expressionHint || alias,
    description,
});

const createWidget = ({
    id,
    title,
    component,
    category,
    description,
    dataStructureTemplate,
    sqlAliases,
    runtimeType,
    aliases = [],
    selectionHints = [],
    mappingMode = 'single',
    sqlShape = 'single_row',
    defaultGridSpan = 'default',
    defaultColorTheme = 'theme-productivity',
    componentIdOverrides = [],
}) => ({
    id,
    title,
    component,
    category,
    runtimeType: runtimeType || id,
    aliases,
    manifestPath: `${category}/${id}/manifest.yml`,
    description,
    selectionHints,
    sqlShape,
    mappingMode,
    defaultGridSpan,
    defaultColorTheme,
    componentIdOverrides,
    dataRequirements: sqlAliases.filter((entry) => entry.required !== false).map((entry) => `${entry.alias}: ${entry.description}`),
    sqlAliases,
    dataStructureTemplate,
});

const singleMetric = (config) => createWidget({
    category: 'micro',
    mappingMode: 'single',
    sqlShape: 'single_row',
    defaultGridSpan: 'default',
    defaultColorTheme: 'theme-productivity',
    ...config,
});

const arrayWidget = (config) => createWidget({
    mappingMode: 'array',
    sqlShape: 'single_row',
    defaultGridSpan: 'col-span-2',
    defaultColorTheme: 'theme-productivity',
    ...config,
});

const listWidget = (config) => createWidget({
    category: 'lists',
    mappingMode: 'list',
    sqlShape: 'single_row',
    defaultGridSpan: 'row-span-2',
    defaultColorTheme: 'theme-productivity',
    ...config,
});

const matrixWidget = (config) => createWidget({
    mappingMode: 'matrix',
    sqlShape: 'single_row',
    defaultGridSpan: 'col-span-2 row-span-2',
    defaultColorTheme: 'theme-audience',
    ...config,
});

const widgets = [
    singleMetric({
        id: 'metric-trend',
        title: 'Metric Trend',
        component: 'MetricTrendMicro',
        description: 'Single KPI card with optional unit and period-over-period delta.',
        aliases: ['trend', 'delta-kpi'],
        componentIdOverrides: ['marketing-roas', 'refresh-cycle', 'viral-k-factor'],
        selectionHints: ['single KPI', 'delta vs previous period', 'executive summary'],
        sqlAliases: [
            field('value', 'Primary KPI value shown in large type.', { sqlType: 'number|string' }),
            field('unit', 'Optional unit such as %, x, min or pts.', { required: false }),
            field('trendValue', 'Formatted delta value such as +4.2% or -3 pts.', { required: false }),
            field('trendDirection', 'up, down or flat.', { required: false, sqlType: 'string' }),
            field('trendTone', 'positive, neutral or negative.', { required: false, sqlType: 'string' }),
            field('trendLabel', 'Short comparison label like vs yesterday.', { required: false }),
        ],
        dataStructureTemplate: {
            data: {
                value: '4.8',
                unit: 'x',
                trendValue: '+0.7x',
                trendDirection: 'up',
                trendTone: 'positive',
                trendLabel: 'vs yesterday',
            },
        },
    }),
    singleMetric({
        id: 'weather',
        title: 'Weather Micro',
        component: 'WeatherMicro',
        description: 'Minimal KPI display with a compact value and unit.',
        aliases: ['kpi-chip'],
        selectionHints: ['single KPI', 'compact metric', 'minimal card'],
        sqlAliases: [
            field('value', 'Primary value shown in the center.', { sqlType: 'number|string' }),
            field('unit', 'Unit or suffix displayed next to value.', { required: false }),
        ],
        dataStructureTemplate: {
            data: { value: '91', unit: '%' },
        },
    }),
    singleMetric({
        id: 'natural',
        title: 'Natural Micro',
        component: 'NaturalMicro',
        description: 'KPI with unit and a linear slider fill.',
        aliases: ['linear-kpi'],
        selectionHints: ['single KPI', 'progress against scale', 'current status'],
        sqlAliases: [
            field('value', 'Primary displayed value.', { sqlType: 'number|string' }),
            field('unit', 'Unit or suffix.', { required: false }),
            field('sliderValue', '0-100 slider fill percentage.', { sqlType: 'number' }),
            field('footerTextLeft', 'Optional left footer label.', { required: false }),
            field('footerTextRight', 'Optional right footer label.', { required: false }),
        ],
        dataStructureTemplate: {
            data: { value: '$24', unit: 'avg', sliderValue: 68, footerTextLeft: 'target', footerTextRight: 'ceiling' },
        },
    }),
    singleMetric({
        id: 'signal-scale',
        title: 'Signal Scale',
        component: 'SignalScaleMicro',
        description: 'Segmented signal gauge for directional quality or intensity.',
        aliases: ['signal-bars', 'score-scale'],
        componentIdOverrides: ['data-saturation', 'marketing-conv-rate', 'ad-fatigue'],
        selectionHints: ['score 0-100', 'quality signal', 'health scale'],
        sqlAliases: [
            field('value', 'Primary textual value displayed beside the scale.', { sqlType: 'number|string' }),
            field('unit', 'Unit or suffix.', { required: false }),
            field('signalScore', 'Numeric score from 0 to 100.', { sqlType: 'number' }),
            field('signalOrientation', 'vertical or horizontal.', { required: false }),
            field('signalLabel', 'Short quality label.', { required: false }),
            field('signalNote', 'Optional longer note shown on vertical layout.', { required: false }),
            field('goodAtHigh', 'True when higher scores are better.', { required: false, sqlType: 'boolean' }),
        ],
        dataStructureTemplate: {
            data: {
                value: '84',
                unit: '%',
                signalScore: 84,
                signalOrientation: 'vertical',
                signalLabel: 'Strong',
                signalNote: 'Coverage is stable and healthy.',
                goodAtHigh: true,
            },
        },
    }),
    singleMetric({
        id: 'sparkline-stat',
        title: 'Sparkline Stat',
        component: 'SparklineStatMicro',
        description: 'KPI with a small sparkline showing recent movement.',
        aliases: ['sparkline', 'mini-trend'],
        componentIdOverrides: ['marketing-cpa', 'budget-burn'],
        selectionHints: ['single KPI + history', 'recent trend', 'small time series'],
        sqlAliases: [
            field('value', 'Current value displayed above the sparkline.', { sqlType: 'number|string' }),
            field('unit', 'Optional unit.', { required: false }),
            field('dataPoints', 'Ordered list of recent numeric values.', { sqlType: 'number[]', expressionHint: 'list(metric_value ORDER BY period_index)' }),
            field('sparklineColor', 'Optional hex color for the sparkline.', { required: false }),
        ],
        dataStructureTemplate: {
            data: { value: '72', unit: '%', dataPoints: [54, 57, 60, 63, 66, 69, 71, 72], sparklineColor: '#ff7676' },
        },
    }),
    singleMetric({
        id: 'gauge-panel',
        title: 'Gauge Panel',
        component: 'GaugePanelMicro',
        description: 'Circular gauge showing one percentage-like score.',
        aliases: ['radial-gauge'],
        componentIdOverrides: ['ai-coverage'],
        selectionHints: ['single percentage', 'utilization', 'coverage'],
        sqlAliases: [
            field('value', 'Display value or label at the center.', { sqlType: 'number|string' }),
            field('sliderValue', '0-100 numeric gauge value.', { sqlType: 'number' }),
            field('gaugeUnit', 'Gauge unit suffix.', { required: false }),
            field('gaugeColor', 'Optional hex color.', { required: false }),
        ],
        dataStructureTemplate: {
            data: { value: '98', sliderValue: 98, gaugeUnit: '%', gaugeColor: '#6ae3a7' },
        },
    }),
    singleMetric({
        id: 'color-slider',
        title: 'Color Slider',
        component: 'ColorSliderMicro',
        runtimeType: 'color-slider',
        aliases: ['light-dial'],
        description: 'Tick-based slider used for rate or progress style metrics.',
        selectionHints: ['simple progress', 'percentage on scale', 'compact slider'],
        sqlAliases: [
            field('sliderValue', '0-100 slider position.', { sqlType: 'number' }),
        ],
        dataStructureTemplate: {
            data: { sliderValue: 72 },
        },
    }),
    singleMetric({
        id: 'liquid-gauge',
        title: 'Liquid Gauge',
        component: 'LiquidGauge',
        description: 'Circular liquid fill used for saturation or utilization metrics.',
        selectionHints: ['percentage fill', 'saturation', 'coverage'],
        sqlAliases: [
            field('value', 'Primary displayed value.', { sqlType: 'number|string' }),
            field('unit', 'Value suffix.', { required: false }),
            field('sliderValue', '0-100 fill percentage.', { sqlType: 'number' }),
        ],
        dataStructureTemplate: {
            data: { value: '84', unit: '%', sliderValue: 84 },
        },
    }),
    singleMetric({
        id: 'neural-nexus',
        title: 'Neural Nexus',
        component: 'NeuralNexus',
        description: 'Circular tick dial for a single score.',
        selectionHints: ['score dial', 'control coverage', 'single KPI'],
        sqlAliases: [
            field('value', 'Displayed main value.', { sqlType: 'number|string' }),
            field('unit', 'Optional unit.', { required: false }),
            field('sliderValue', '0-100 tick activation percent.', { sqlType: 'number' }),
        ],
        dataStructureTemplate: {
            data: { value: '74', unit: '%', sliderValue: 74 },
        },
    }),
    singleMetric({
        id: 'intensity-heat',
        title: 'Intensity Heat',
        component: 'IntensityHeat',
        description: 'Single value card for fatigue, pressure or saturation style metrics.',
        selectionHints: ['single severity value', 'saturation index', 'fatigue score'],
        defaultColorTheme: 'theme-red',
        sqlAliases: [
            field('value', 'Single displayed score.', { sqlType: 'number|string' }),
        ],
        dataStructureTemplate: {
            data: { value: '29' },
        },
    }),
    singleMetric({
        id: 'chrono-dial',
        title: 'Chrono Dial',
        component: 'ChronoDial',
        description: 'Minimal slider-pointer dial for freshness or recency scores.',
        selectionHints: ['freshness', 'release health', 'recency score'],
        sqlAliases: [
            field('sliderValue', '0-100 pointer position.', { sqlType: 'number' }),
        ],
        dataStructureTemplate: {
            data: { sliderValue: 86 },
        },
    }),
    singleMetric({
        id: 'pulse-circle',
        title: 'Pulse Circle',
        component: 'PulseCircle',
        description: 'Breathing status circle for a single value.',
        selectionHints: ['heartbeat KPI', 'status pulse', 'compact status'],
        sqlAliases: [
            field('value', 'Single displayed value.', { sqlType: 'number|string' }),
        ],
        dataStructureTemplate: {
            data: { value: '96' },
        },
    }),
    singleMetric({
        id: 'scanning-orbit',
        title: 'Scanning Orbit',
        component: 'ScanningOrbit',
        description: 'Radar-like compact status widget with value and unit.',
        selectionHints: ['ops per second', 'scan rate', 'compact sci-fi KPI'],
        sqlAliases: [
            field('value', 'Main displayed value.', { sqlType: 'number|string' }),
            field('unit', 'Displayed unit.', { required: false }),
        ],
        dataStructureTemplate: {
            data: { value: '14,000', unit: 'ops/s' },
        },
    }),
    singleMetric({
        id: 'red-gradient',
        title: 'Red Gradient',
        component: 'RedGradientMicro',
        description: 'Single horizontal gauge used for risk-heavy progress.',
        selectionHints: ['risk progress', 'danger intensity', 'simple horizontal gauge'],
        sqlAliases: [
            field('sliderValue', '0-100 horizontal fill percentage.', { sqlType: 'number' }),
        ],
        dataStructureTemplate: {
            data: { sliderValue: 64 },
        },
    }),
    singleMetric({
        id: 'productivity',
        title: 'Productivity Micro',
        component: 'ProductivityMicro',
        description: 'Abstract vertical-dot spark widget fed by a short numeric sequence.',
        selectionHints: ['mini histogram', 'activity pulse', 'density spark'],
        sqlAliases: [
            field('dataPoints', 'Ordered array of small numeric bars.', { sqlType: 'number[]', expressionHint: 'list(metric_value ORDER BY bucket_index)' }),
        ],
        dataStructureTemplate: {
            data: { dataPoints: [12, 18, 21, 24, 27, 31, 34, 38] },
        },
    }),
    singleMetric({
        id: 'uptime-strip',
        title: 'Uptime Strip',
        component: 'UptimeStripMicro',
        description: 'Compact uptime card with bar states and current uptime value.',
        componentIdOverrides: ['technical-health'],
        selectionHints: ['uptime window', 'availability strip', 'health streak'],
        sqlAliases: [
            field('value', 'Primary uptime or availability value.', { sqlType: 'number|string' }),
            field('unit', 'Value suffix.', { required: false }),
            field('uptimeBars', 'Ordered list of status tokens: good, warn, down.', { sqlType: 'string[]', expressionHint: 'list(status ORDER BY period_index)' }),
        ],
        dataStructureTemplate: {
            data: { value: '99.94', unit: '%', uptimeBars: ['good', 'good', 'warn', 'good', 'down', 'good'] },
        },
    }),
    listWidget({
        id: 'campaign-list',
        title: 'Campaign List',
        component: 'CampaignListMicro',
        description: 'Compact ranked list with label, value and directional trend.',
        runtimeType: 'campaign-list',
        aliases: ['campaigns'],
        sqlAliases: [
            field('campaigns', 'List of campaign rows.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(name := label_col, value := metric_col, trend := trend_sign) ORDER BY metric_sort DESC)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                campaigns: [
                    { name: 'Google', value: '18.4K', trend: '+' },
                    { name: 'Meta', value: '15.1K', trend: '-' },
                ],
            },
        },
        selectionHints: ['ranked list', 'campaign leaderboard', 'compact comparison'],
    }),
    listWidget({
        id: 'leads-list',
        title: 'Leads List',
        component: 'LeadsList',
        defaultGridSpan: 'row-span-2',
        description: 'Compact live-feed of rows such as leads, incidents or routes.',
        selectionHints: ['top entities', 'recent items', 'operational feed'],
        sqlAliases: [
            field('leads', 'List of rows containing name, value, status and time.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(name := name_col, value := value_col, status := status_col, time := time_label) ORDER BY sort_index)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                leads: [
                    { name: 'Northline Energy', value: 'Google Ads', status: 'vip', time: '3m ago' },
                    { name: 'Aurora Dental', value: 'Meta', status: 'warm', time: '11m ago' },
                ],
            },
        },
    }),
    singleMetric({
        id: 'audience-copilot',
        title: 'Audience Copilot',
        component: 'AudienceCopilot',
        category: 'assistant',
        description: 'Recommendation feed with segment, action and expected impact.',
        defaultGridSpan: 'col-span-2',
        sqlAliases: [
            field('recommendations', 'Ordered list of recommendations.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(segment := segment_col, action := action_col, actionType := action_type, modification := change_note, impact := impact_text, impactTrend := impact_trend) ORDER BY priority_rank)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                recommendations: [
                    {
                        segment: 'High-value trial users',
                        action: 'Increase retargeting',
                        actionType: 'positive',
                        modification: 'Raise bid by 12%',
                        impact: '+6.4%',
                        impactTrend: 'positive',
                    },
                ],
            },
        },
        selectionHints: ['recommendations', 'AI text actions', 'next best action'],
    }),
    singleMetric({
        id: 'emotion-wave',
        title: 'Emotion Wave',
        component: 'EmotionWave',
        description: 'Sentiment-style widget driven by one percentage-like score.',
        selectionHints: ['sentiment score', 'mood level', 'single qualitative score'],
        sqlAliases: [
            field('sentimentScore', '0-100 sentiment or confidence score.', { sqlType: 'number' }),
            field('emoji', 'Optional emoji override.', { required: false }),
        ],
        dataStructureTemplate: {
            data: { sentimentScore: 78, emoji: '😊' },
        },
    }),
    createWidget({
        id: 'live-traffic',
        title: 'Live Traffic Chart',
        component: 'LiveTrafficChart',
        category: 'charts',
        runtimeType: 'live-traffic',
        aliases: ['animated-line'],
        description: 'Hero line chart with current metrics, annotation and recent series.',
        mappingMode: 'single',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2',
        defaultColorTheme: 'theme-productivity',
        selectionHints: ['recent time series', 'concurrent activity', 'hero metric with trend'],
        sqlAliases: [
            field('chartLabels', 'Ordered x-axis labels.', { sqlType: 'string[]', expressionHint: 'list(period_label ORDER BY period_index)' }),
            field('chartSeries', 'Ordered numeric series values.', { sqlType: 'number[]', expressionHint: 'list(metric_value ORDER BY period_index)' }),
            field('metricCards', 'Optional summary cards derived from the same query.', {
                required: false,
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(icon := icon_name, label := card_label, value := card_value, delta := card_delta, note := card_note) ORDER BY card_index)",
            }),
            field('chartMin', 'Optional explicit lower bound.', { required: false, sqlType: 'number' }),
            field('chartMax', 'Optional explicit upper bound.', { required: false, sqlType: 'number' }),
            field('annotation', 'Optional highlighted point.', {
                required: false,
                sqlType: 'object',
                expressionHint: "struct_pack(index := annotation_index, label := annotation_label, value := annotation_value)",
            }),
            field('description', 'Optional helper copy.', { required: false }),
        ],
        dataStructureTemplate: {
            data: {
                chartLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                chartSeries: [320, 356, 401, 462, 538],
                metricCards: [
                    { icon: 'sparkles', label: 'Active now', value: '538', delta: '+8.4%', note: 'users online' },
                    { icon: 'medal', label: 'Peak today', value: '614', delta: '+13.1%', note: 'highest concurrent users' },
                ],
                chartMin: 120,
                chartMax: 760,
                annotation: { index: 4, label: 'ACTIVE USERS', value: '538' },
            },
        },
    }),
    createWidget({
        id: 'predictive',
        title: 'Predictive Forecast',
        component: 'PredictiveForecast',
        category: 'predictive',
        description: 'Historical series with forecast extension and optional confidence bands.',
        mappingMode: 'single',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2',
        defaultColorTheme: 'theme-revenue',
        selectionHints: ['forecast', 'projection', 'historical plus future'],
        sqlAliases: [
            field('historical', 'Ordered historical values.', { sqlType: 'number[]', expressionHint: 'list(actual_value ORDER BY period_index)' }),
            field('forecast', 'Ordered predicted future values.', { sqlType: 'number[]', expressionHint: 'list(predicted_value ORDER BY forecast_index)' }),
            field('confidenceRange', 'Optional confidence band markers.', { required: false, sqlType: 'number[]', expressionHint: 'list(confidence_value ORDER BY band_index)' }),
        ],
        dataStructureTemplate: {
            data: { historical: [320, 335, 310, 350, 380, 400], forecast: [410, 425, 440, 435, 452], confidenceRange: [30, 45, 60] },
        },
    }),
    arrayWidget({
        id: 'range-area-chart',
        title: 'Range Area Chart',
        component: 'RangeAreaChart',
        category: 'charts',
        description: 'Average series with min/max envelope.',
        selectionHints: ['min max avg', 'confidence band', 'range over time'],
        sqlAliases: [
            field('dates', 'Ordered x-axis labels.', { sqlType: 'string[]', expressionHint: 'list(period_label ORDER BY period_index)' }),
            field('minData', 'Ordered minimum values.', { sqlType: 'number[]', expressionHint: 'list(min_value ORDER BY period_index)' }),
            field('avgData', 'Ordered average values.', { sqlType: 'number[]', expressionHint: 'list(avg_value ORDER BY period_index)' }),
            field('maxData', 'Ordered maximum values.', { sqlType: 'number[]', expressionHint: 'list(max_value ORDER BY period_index)' }),
        ],
        dataStructureTemplate: {
            data: { dates: ['08:00', '10:00', '12:00'], minData: [40, 70, 100], avgData: [80, 110, 150], maxData: [120, 150, 200] },
        },
    }),
    matrixWidget({
        id: 'activity-heatmap',
        title: 'Activity Heatmap',
        component: 'ActivityHeatmap',
        category: 'charts',
        description: 'Two-dimensional heatmap of bucketed activity.',
        selectionHints: ['day vs hour', 'matrix intensity', 'bucket heatmap'],
        defaultGridSpan: 'col-span-2',
        sqlAliases: [
            field('heatmapData', 'Matrix rows encoded as [x_index, y_index, value].', {
                sqlType: 'array[]',
                expressionHint: 'list([bucket_x, bucket_y, metric_value] ORDER BY bucket_y, bucket_x)',
            }),
        ],
        dataStructureTemplate: {
            data: { heatmapData: [[0, 0, 4], [1, 0, 7], [0, 1, 2], [1, 1, 9]] },
        },
    }),
    matrixWidget({
        id: 'optimal-time',
        title: 'Optimal Time Heatmap',
        component: 'OptimalTimeHeatmap',
        category: 'charts',
        description: 'Calendar-style matrix for best-performing time windows with summary cards.',
        defaultGridSpan: 'row-span-2',
        defaultColorTheme: 'theme-natural',
        selectionHints: ['best window', 'calendar heatmap', 'time-of-day optimisation'],
        sqlAliases: [
            field('calendarMonth', 'Displayed month label.', { required: false }),
            field('calendarOffset', 'Leading offset before day 1.', { required: false, sqlType: 'number' }),
            field('daysInMonth', 'Number of in-month cells.', { required: false, sqlType: 'number' }),
            field('totalCalendarCells', 'Total rendered cells.', { required: false, sqlType: 'number' }),
            field('calendarValues', 'Flat ordered day intensities.', { sqlType: 'number[]', expressionHint: 'list(day_value ORDER BY day_number)' }),
            field('engagementMatrix', 'Matrix of intensity values.', { sqlType: 'number[][]', expressionHint: 'list(row_values ORDER BY row_index)' }),
            field('summaryCards', 'Summary list of top highlights.', {
                required: false,
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(id := card_id, icon := icon_name, label := card_label, value := card_value, delta := card_delta, note := card_note, tone := card_tone) ORDER BY card_index)",
            }),
            field('marketBreakdown', 'Top markets or segments.', {
                required: false,
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(label := label_col, value := value_col) ORDER BY value_sort DESC)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                calendarMonth: 'April 2026',
                calendarOffset: 2,
                daysInMonth: 30,
                totalCalendarCells: 56,
                calendarValues: [28, 31, 33, 35],
                engagementMatrix: [[28, 31, 33, 35], [32, 31, 34, 35]],
                summaryCards: [{ id: 'weekly-peak', icon: 'sparkles', label: 'Weekly Peak', value: '8,097', delta: '+19.6%', note: '42,214 engaged sessions', tone: 'positive' }],
                marketBreakdown: [{ label: 'Los Angeles', value: '201,192' }],
            },
        },
    }),
    matrixWidget({
        id: 'covariance-matrix',
        title: 'Covariance Matrix',
        component: 'CovarianceMatrix',
        category: 'charts',
        description: 'Square matrix comparing relationships between multiple features.',
        selectionHints: ['feature correlation', 'covariance', 'NxN matrix'],
        sqlAliases: [
            field('fields', 'Ordered list of matrix dimensions.', { sqlType: 'string[]', expressionHint: 'list(feature_name ORDER BY feature_index)' }),
            field('matrix', 'Square matrix values aligned with fields.', { sqlType: 'number[][]', expressionHint: 'list(row_values ORDER BY row_index)' }),
        ],
        dataStructureTemplate: {
            data: { fields: ['Spend', 'Clicks', 'Conversions'], matrix: [[1, 0.8, 0.4], [0.8, 1, 0.6], [0.4, 0.6, 1]] },
        },
    }),
    matrixWidget({
        id: 'cohorts',
        title: 'Cohort Analysis',
        component: 'CohortAnalysis',
        category: 'marketing',
        defaultGridSpan: 'default',
        defaultColorTheme: 'theme-audience',
        description: 'Retention cohorts with headline summary.',
        selectionHints: ['retention', 'cohort decay', 'stickiness'],
        sqlAliases: [
            field('summaryValue', 'Headline retention summary.', { required: false }),
            field('summaryDelta', 'Comparison delta.', { required: false }),
            field('summaryCompare', 'Supporting comparison copy.', { required: false }),
            field('cohorts', 'Ordered cohort rows.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(week := cohort_label, size := cohort_size, data := retention_values) ORDER BY cohort_order)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                summaryValue: '38.4%',
                summaryDelta: '+3.1 pts',
                summaryCompare: 'Average last-step retention across active cohorts',
                cohorts: [
                    { week: 'Feb 01', size: 1200, data: [100, 85, 70, 62] },
                    { week: 'Feb 08', size: 1150, data: [100, 82, 68] },
                ],
            },
        },
    }),
    createWidget({
        id: 'mpl-training-loss',
        title: 'Training Loss Panel',
        component: 'MatplotlibTrainingPanel',
        category: 'ml',
        description: 'Dual-loss panel with auxiliary perplexity and headline stats.',
        mappingMode: 'single',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-productivity',
        selectionHints: ['training curves', 'train vs validation', 'ML convergence'],
        sqlAliases: [
            field('steps', 'Ordered checkpoint or step labels.', { sqlType: 'string[]', expressionHint: 'list(step_label ORDER BY step_index)' }),
            field('trainLoss', 'Ordered training loss values.', { sqlType: 'number[]', expressionHint: 'list(train_loss ORDER BY step_index)' }),
            field('valLoss', 'Ordered validation loss values.', { sqlType: 'number[]', expressionHint: 'list(val_loss ORDER BY step_index)' }),
            field('perplexity', 'Ordered perplexity values.', { required: false, sqlType: 'number[]', expressionHint: 'list(perplexity ORDER BY step_index)' }),
            field('stats', 'Summary stat cards.', {
                required: false,
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(label := stat_label, value := stat_value, accent := accent_color, meta := stat_note) ORDER BY stat_index)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                steps: ['80', '160', '240', '320'],
                trainLoss: [2.84, 2.41, 2.02, 1.78],
                valLoss: [2.95, 2.58, 2.19, 1.96],
                perplexity: [18.3, 14.8, 11.7, 9.4],
                stats: [{ label: 'Best val loss', value: '1.73', accent: '#7cff5b', meta: 'checkpoint 480' }],
            },
        },
    }),
    createWidget({
        id: 'mpl-benchmark-bars',
        title: 'Benchmark Bars',
        component: 'MatplotlibBenchmarkBars',
        category: 'ml',
        description: 'Ranked benchmark bars with score, target and delta.',
        mappingMode: 'list',
        sqlShape: 'single_row',
        defaultGridSpan: 'row-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['benchmark comparison', 'threshold pass/fail', 'eval guardrails'],
        sqlAliases: [
            field('benchmarks', 'Ordered benchmark rows.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(label := benchmark_name, score := score_value, target := target_value, delta := delta_text) ORDER BY benchmark_order)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                benchmarks: [
                    { label: 'MMLU', score: 73.2, target: 72, delta: '+1.1' },
                    { label: 'GSM8K', score: 61.8, target: 60, delta: '+2.8' },
                ],
            },
        },
    }),
    createWidget({
        id: 'mpl-attention-heatmap',
        title: 'Attention Heatmap',
        component: 'MatplotlibAttentionHeatmap',
        category: 'ml',
        description: 'Heatmap matrix with x/y labels and side notes.',
        mappingMode: 'matrix',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-natural',
        selectionHints: ['activation heatmap', 'layer vs block matrix', 'drift matrix'],
        sqlAliases: [
            field('xLabels', 'Ordered column labels.', { sqlType: 'string[]', expressionHint: 'list(column_label ORDER BY column_index)' }),
            field('yLabels', 'Ordered row labels.', { sqlType: 'string[]', expressionHint: 'list(row_label ORDER BY row_index)' }),
            field('matrix', 'Matrix values aligned to xLabels/yLabels.', { sqlType: 'number[][]', expressionHint: 'list(row_values ORDER BY row_index)' }),
            field('sideNotes', 'Summary notes shown to the right.', {
                required: false,
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(label := note_label, value := note_value) ORDER BY note_index)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                xLabels: ['B1', 'B2', 'B3'],
                yLabels: ['L0', 'L8', 'L16'],
                matrix: [[0.19, 0.24, 0.28], [0.22, 0.26, 0.31], [0.24, 0.3, 0.35]],
                sideNotes: [{ label: 'drift peak', value: 'L32 / B6' }],
            },
        },
    }),
    createWidget({
        id: 'budget-sensitivity',
        title: 'Budget Sensitivity',
        component: 'BudgetSensitivity',
        category: 'financial',
        description: 'Elasticity curve over increasing budget or capacity steps.',
        mappingMode: 'array',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2',
        defaultColorTheme: 'theme-revenue',
        selectionHints: ['elasticity curve', 'diminishing returns', 'response curve'],
        sqlAliases: [
            field('curvePoints', 'Ordered [x, y] points describing the curve.', { sqlType: 'array[]', expressionHint: 'list([x_value, y_value] ORDER BY x_value)' }),
        ],
        dataStructureTemplate: {
            data: { curvePoints: [[0, 0.66], [10, 1.79], [20, 4.74], [30, 11.92]] },
        },
    }),
    createWidget({
        id: 'waterfall',
        title: 'Waterfall',
        component: 'FinancialBreakdown',
        category: 'financial',
        description: 'Bridge from gross to net through positive and negative steps.',
        mappingMode: 'list',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2',
        defaultColorTheme: 'theme-revenue',
        selectionHints: ['bridge analysis', 'gross to net', 'step breakdown'],
        sqlAliases: [
            field('steps', 'Ordered list of bridge steps.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(name := step_name, value := step_value, isTotal := is_total) ORDER BY step_index)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                steps: [
                    { name: 'Gross Revenue', value: 124000 },
                    { name: 'COGS', value: -45000 },
                    { name: 'Net Profit', isTotal: true },
                ],
            },
        },
    }),
    createWidget({
        id: 'attribution',
        title: 'Attribution',
        component: 'AttributionModels',
        category: 'marketing',
        description: 'Donut plus supporting panels for source or channel allocation.',
        mappingMode: 'single',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-productivity',
        selectionHints: ['allocation by source', 'channel mix', 'contribution share'],
        sqlAliases: [
            field('summaryValue', 'Center summary value.', { required: false }),
            field('summaryLabel', 'Center summary label.', { required: false }),
            field('models', 'Ordered allocation rows.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(channel := channel_name, monthly := secondary_value, yearly := primary_value, yearlyColor := primary_color, monthlyColor := secondary_color) ORDER BY primary_value DESC)",
            }),
            field('periodMetrics', 'Optional headline metrics.', {
                required: false,
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(label := metric_label, value := metric_value, delta := delta_text, note := note_text, tone := tone_color) ORDER BY metric_index)",
            }),
            field('valueFormat', 'currency, number or compact-number.', { required: false }),
            field('primaryMetricLabel', 'Primary metric label, e.g. yearly or weekly.', { required: false }),
            field('secondaryMetricLabel', 'Secondary metric label, e.g. monthly or daily.', { required: false }),
        ],
        dataStructureTemplate: {
            data: {
                summaryValue: '$24.8K',
                summaryLabel: 'Monthly Budget',
                valueFormat: 'currency',
                primaryMetricLabel: 'yearly',
                secondaryMetricLabel: 'monthly',
                models: [
                    { channel: 'Google', monthly: 9200, yearly: 152000, yearlyColor: '#2EF0B2', monthlyColor: '#FFBF1F' },
                    { channel: 'Meta', monthly: 7100, yearly: 126000, yearlyColor: '#31E9C9', monthlyColor: '#FF9F1F' },
                ],
                periodMetrics: [{ label: 'Monthly', value: '$24.8K', delta: '+14.2%', note: '$21.7K baseline', tone: '#7CFF5B' }],
            },
        },
    }),
    createWidget({
        id: 'funnel',
        title: 'Funnel',
        component: 'FunnelChart',
        category: 'marketing',
        description: 'Hero funnel with summary headline and stage marker pills.',
        mappingMode: 'single',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2',
        defaultColorTheme: 'theme-productivity',
        selectionHints: ['stage drop-off', 'journey funnel', 'hero conversion flow'],
        sqlAliases: [
            field('summaryLabel', 'Headline label.', { required: false }),
            field('summaryValue', 'Headline value.', { required: false }),
            field('summaryDelta', 'Headline delta.', { required: false }),
            field('summaryCompare', 'Supporting comparison text.', { required: false }),
            field('stageColumns', 'Three stage markers for the visual envelope.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(top := stage_label, metric := stage_value, bottom := stage_note) ORDER BY stage_index)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                summaryLabel: 'Income',
                summaryValue: '$38,420',
                summaryDelta: '↑4.2%',
                summaryCompare: 'Compared to $36,870 last month',
                stageColumns: [
                    { top: 'Visits', metric: '100' },
                    { top: 'Lead', metric: '56' },
                    { top: 'Purchase', metric: '14' },
                ],
            },
        },
    }),
    createWidget({
        id: 'incremental-lift',
        title: 'Incremental Lift',
        component: 'IncrementalLift',
        category: 'marketing',
        description: 'Three-bar comparison for organic, paid and incremental contribution.',
        mappingMode: 'list',
        sqlShape: 'single_row',
        defaultGridSpan: 'default',
        defaultColorTheme: 'theme-revenue',
        selectionHints: ['control vs test', 'incremental value', 'lift decomposition'],
        sqlAliases: [
            field('bars', 'Ordered bars to display.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(label := bucket_label, value := metric_value, color := color_hex, deltaLabel := annotation_text) ORDER BY bucket_index)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                bars: [
                    { label: 'Organic', value: 4200, color: '#3B82F6' },
                    { label: 'Paid', value: 2800, color: '#8B5CF6' },
                    { label: 'Incremental', value: 1200, color: '#10B981', deltaLabel: '+22%' },
                ],
            },
        },
    }),
    createWidget({
        id: 'intent-sunburst',
        title: 'Intent Sunburst',
        component: 'IntentSunburst',
        category: 'marketing',
        description: 'Hierarchical sunburst for nested audience or behavior intent.',
        mappingMode: 'list',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['hierarchy', 'nested categories', 'intent tree'],
        sqlAliases: [
            field('sunburstData', 'Hierarchy tree with nested children arrays.', {
                sqlType: 'object[]',
                expressionHint: 'Return a nested JSON-compatible tree using list(struct_pack(..., children := ...)).',
            }),
        ],
        dataStructureTemplate: {
            data: {
                sunburstData: [
                    {
                        name: 'Ready to Buy',
                        itemStyle: { color: '#10B981' },
                        children: [{ name: 'Pricing', value: 24 }, { name: 'Checkout', value: 22 }],
                    },
                ],
            },
        },
    }),
    createWidget({
        id: 'interest-radar',
        title: 'Interest Radar',
        component: 'InterestRadar',
        category: 'marketing',
        description: 'Radar chart of multidimensional interests or attributes.',
        mappingMode: 'single',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['radar profile', 'multi-axis attributes', 'interest mix'],
        sqlAliases: [
            field('indicator', 'Radar axes as [{name,max}].', { sqlType: 'object[]', expressionHint: "list(struct_pack(name := axis_name, max := axis_max) ORDER BY axis_index)" }),
            field('radarData', 'Radar series rows.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(name := series_name, value := axis_values, itemStyle := item_style, areaStyle := area_style) ORDER BY series_index)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                indicator: [{ name: 'Technology', max: 100 }, { name: 'Fashion', max: 100 }],
                radarData: [{ name: 'High Intent', value: [85, 30], itemStyle: { color: '#34D399' }, areaStyle: { color: 'rgba(52, 211, 153, 0.3)' } }],
            },
        },
    }),
    createWidget({
        id: 'market-radar',
        title: 'Market Sentiment Radar',
        component: 'MarketSentimentRadar',
        category: 'marketing',
        description: 'Radar chart summarising current posture or sentiment.',
        mappingMode: 'single',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['brand or posture radar', 'aggregate category scores', 'multi-axis snapshot'],
        sqlAliases: [
            field('indicator', 'Radar axes as [{name,max}].', { sqlType: 'object[]', expressionHint: "list(struct_pack(name := axis_name, max := axis_max) ORDER BY axis_index)" }),
            field('radarData', 'One or more radar series.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(name := series_name, value := axis_values, itemStyle := item_style, areaStyle := area_style, lineStyle := line_style) ORDER BY series_index)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                indicator: [{ name: 'Trust', max: 100 }, { name: 'Innovation', max: 100 }],
                radarData: [{ name: 'Current Metric', value: [92, 80], itemStyle: { color: '#ec4899' } }],
            },
        },
    }),
    createWidget({
        id: 'market-evolution',
        title: 'Market Evolution',
        component: 'MarketEvolution',
        category: 'marketing',
        description: 'Force graph of nodes and weighted links.',
        mappingMode: 'list',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['network graph', 'force layout', 'entity interactions'],
        sqlAliases: [
            field('channels', 'Node definitions.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(name := node_name, color := color_hex, value := node_value, synergy := tier_label) ORDER BY node_order)",
            }),
            field('links', 'Edge definitions.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(source := source_name, target := target_name, value := edge_weight) ORDER BY edge_order)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                channels: [{ name: 'Paid Search', color: '#3B82F6', value: 85, synergy: 'High' }],
                links: [{ source: 'Paid Search', target: 'Organic SEO', value: 5 }],
            },
        },
    }),
    createWidget({
        id: 'creative-quadrant',
        title: 'Creative Quadrant',
        component: 'CreativeQuadrant',
        category: 'marketing',
        description: 'Scatter quadrant with configurable axes and zone labels.',
        mappingMode: 'single',
        sqlShape: 'single_row',
        defaultGridSpan: 'row-span-2',
        defaultColorTheme: 'theme-productivity',
        selectionHints: ['2x2 comparison', 'quadrant analysis', 'precision vs value'],
        sqlAliases: [
            field('creatives', 'Scatter rows as [x_value, y_value, label, type].', { sqlType: 'array[]', expressionHint: 'list([x_metric, y_metric, entity_name, entity_type] ORDER BY score DESC)' }),
            field('axisMetricLabels', 'Optional custom axis metric labels.', { required: false, sqlType: 'object' }),
            field('axisMetricFormats', 'Optional formatting config.', { required: false, sqlType: 'object' }),
            field('axisLabels', 'Optional low/high labels per axis.', { required: false, sqlType: 'object' }),
            field('quadrantLabels', 'Optional quadrant copy overrides.', { required: false, sqlType: 'object' }),
            field('listItemLabel', 'Optional table label override.', { required: false }),
        ],
        dataStructureTemplate: {
            data: {
                creatives: [[4.8, 6.8, 'Video: Founder Angle', 'Video'], [4.1, 7.0, 'Static: Social Proof', 'Static']],
                axisMetricLabels: { x: 'CTR', y: 'CVR' },
                axisMetricFormats: { x: 'percent', y: 'percent' },
                axisLabels: { xLow: 'Low CTR', xHigh: 'High CTR', yLow: 'Low CVR', yHigh: 'High CVR' },
            },
        },
    }),
    createWidget({
        id: 'scatter',
        title: 'Scatter Plot',
        component: 'ScatterPlot',
        category: 'charts',
        description: 'Scatter of two numeric variables with optional period labels.',
        mappingMode: 'array',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['x vs y', 'efficiency distribution', 'cohort spread'],
        sqlAliases: [
            field('periodLabels', 'Optional labels for scatter points.', { required: false, sqlType: 'string[]', expressionHint: 'list(period_label ORDER BY point_index)' }),
            field('scatterData', 'Ordered [x, y] point pairs.', { sqlType: 'array[]', expressionHint: 'list([x_metric, y_metric] ORDER BY point_index)' }),
        ],
        dataStructureTemplate: {
            data: { periodLabels: ['Jan', 'Feb', 'Mar'], scatterData: [[42, 462], [56, 718], [68, 501]] },
        },
    }),
    createWidget({
        id: 'shapley-attribution',
        title: 'Shapley Attribution',
        component: 'ShapleyAttribution',
        category: 'marketing',
        description: 'Stacked periods derived from raw [channel, score, period] contributions.',
        mappingMode: 'array',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-productivity',
        selectionHints: ['contribution over time', 'channel attribution', 'stacked period analysis'],
        sqlAliases: [
            field('rawData', 'Flat rows encoded as [channel, score, year_or_period].', { sqlType: 'array[]', expressionHint: 'list([channel_name, contribution_score, period_key] ORDER BY period_key, sample_index)' }),
        ],
        dataStructureTemplate: {
            data: { rawData: [['Email', 19.6, 2021], ['Search', 16.6, 2021], ['Meta', 38.1, 2021]] },
        },
    }),
    createWidget({
        id: 'trend-spotter',
        title: 'Trend Spotter',
        component: 'TrendSpotter',
        category: 'misc',
        description: 'Weighted keyword cloud with trend direction.',
        mappingMode: 'list',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['keyword cloud', 'emerging terms', 'weighted trend list'],
        sqlAliases: [
            field('keywords', 'Ordered keyword rows.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(text := keyword_text, weight := weight_value, trend := trend_direction) ORDER BY weight_value DESC)",
            }),
        ],
        dataStructureTemplate: {
            data: {
                keywords: [
                    { text: 'creator-led', weight: 93, trend: 'up' },
                    { text: 'ugc proof', weight: 87, trend: 'up' },
                ],
            },
        },
    }),
    createWidget({
        id: 'anomaly-stream',
        title: 'Anomaly Stream',
        component: 'AnomalyStream',
        category: 'ml',
        description: 'Scatter plot of anomaly candidates using x/y dispersion and entity label.',
        mappingMode: 'array',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2',
        defaultColorTheme: 'theme-weather',
        selectionHints: ['anomaly candidates', 'frequency vs impact', 'dispersion plot'],
        sqlAliases: [
            field('dispersionData', 'Scatter points as [x_value, y_value, label].', { sqlType: 'array[]', expressionHint: 'list([x_metric, y_metric, entity_name] ORDER BY y_metric DESC)' }),
            field('xAxisLabel', 'Optional x-axis label.', { required: false }),
            field('yAxisLabel', 'Optional y-axis label.', { required: false }),
            field('valueLabel', 'Optional tooltip value label.', { required: false }),
        ],
        dataStructureTemplate: {
            data: {
                dispersionData: [[120, 32000, 'Service A'], [180, 41000, 'Service B']],
                xAxisLabel: 'Frequency',
                yAxisLabel: 'Variance',
                valueLabel: 'score',
            },
        },
    }),
    createWidget({
        id: 'lead-clustering',
        title: 'Lead Clustering',
        component: 'LeadClustering',
        category: 'ml',
        description: 'Cluster scatter using [engagement, probability, label].',
        mappingMode: 'array',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['k-means style clusters', 'segment scatter', 'lead clustering'],
        sqlAliases: [
            field('clusteringData', 'Rows encoded as [engagement_score, probability, entity_name].', { sqlType: 'array[]', expressionHint: 'list([engagement_score, conversion_probability, entity_name] ORDER BY engagement_score DESC)' }),
        ],
        dataStructureTemplate: {
            data: { clusteringData: [[85, 0.92, 'TechFlow Corp'], [45, 0.32, 'Nexus Digital'], [22, 0.15, 'Andrei I.']] },
        },
    }),
    createWidget({
        id: 'real-mapbox',
        title: 'Mapbox / Globe',
        component: 'RealMapbox',
        category: 'geospatial',
        runtimeType: 'real-mapbox',
        aliases: ['3d-map'],
        description: 'Map or globe view fed by a list of geographic points and optional projection config.',
        mappingMode: 'list',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['geo distribution', 'global map', 'regional hotspots'],
        sqlAliases: [
            field('locations', 'List of map points with name and coordinates.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(name := label_col, address := address_col, longitude := lon_col, latitude := lat_col, intensity := score_col) ORDER BY score_col DESC)",
            }),
            field('mapProjection', 'mercator or globe.', { required: false }),
            field('mapCenter', 'Optional [lon, lat] center.', { required: false, sqlType: 'number[]' }),
            field('mapZoom', 'Optional zoom.', { required: false, sqlType: 'number' }),
            field('mapPitch', 'Optional pitch.', { required: false, sqlType: 'number' }),
            field('mapBearing', 'Optional bearing.', { required: false, sqlType: 'number' }),
            field('mapAutoRotate', 'Enable globe rotation.', { required: false, sqlType: 'boolean' }),
            field('mapRotationSpeed', 'Rotation speed when auto-rotate is enabled.', { required: false, sqlType: 'number' }),
            field('mapFitBounds', 'Auto-fit markers.', { required: false, sqlType: 'boolean' }),
        ],
        dataStructureTemplate: {
            data: {
                locations: [{ name: 'Bucharest', address: 'Bucharest', longitude: 26.1025, latitude: 44.4268, intensity: 4 }],
                mapProjection: 'globe',
                mapAutoRotate: true,
                mapCenter: [12, 20],
                mapZoom: 1.18,
            },
        },
    }),
    createWidget({
        id: 'technical-health',
        title: 'Technical Health',
        component: 'TechnicalHealth',
        category: 'misc',
        runtimeType: 'technical-health',
        aliases: ['vitals'],
        description: 'Grid of named metrics with value and status.',
        mappingMode: 'list',
        sqlShape: 'single_row',
        defaultGridSpan: 'default',
        defaultColorTheme: 'theme-weather',
        selectionHints: ['service metrics', 'health matrix', 'status grid'],
        sqlAliases: [
            field('metrics', 'List of metric rows.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(name := metric_name, value := metric_value, status := metric_status) ORDER BY metric_index)",
            }),
        ],
        dataStructureTemplate: {
            data: { metrics: [{ name: 'API', value: '99.97%', status: 'good' }, { name: 'DB', value: '99.99%', status: 'good' }] },
        },
    }),
    createWidget({
        id: 'semi-circle-donut',
        title: 'Semi-Circle Donut',
        component: 'SemiCircleDonut',
        category: 'charts',
        description: 'Half-donut chart of platform shares.',
        mappingMode: 'list',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['share by category', 'donut split', 'platform mix'],
        sqlAliases: [
            field('platforms', 'List of slices.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(name := label_col, value := metric_value, color := color_hex) ORDER BY metric_value DESC)",
            }),
        ],
        dataStructureTemplate: {
            data: { platforms: [{ name: 'Google', value: 42, color: '#34D399' }, { name: 'Meta', value: 31, color: '#818CF8' }] },
        },
    }),
    createWidget({
        id: 'sankey',
        title: 'Sankey Flow',
        component: 'SankeyChart',
        category: 'charts',
        aliases: ['sankey-chart'],
        description: 'Node-link flow diagram using nodes and links.',
        mappingMode: 'list',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2',
        defaultColorTheme: 'theme-productivity',
        selectionHints: ['flow diagram', 'source to target', 'funnel movement'],
        sqlAliases: [
            field('nodes', 'List of unique nodes.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(name := node_name) ORDER BY node_order)",
            }),
            field('links', 'List of source-target links.', {
                sqlType: 'object[]',
                expressionHint: "list(struct_pack(source := source_name, target := target_name, value := flow_value) ORDER BY link_order)",
            }),
        ],
        dataStructureTemplate: {
            data: { nodes: [{ name: 'Visits' }, { name: 'Lead' }], links: [{ source: 'Visits', target: 'Lead', value: 1200 }] },
        },
    }),
    createWidget({
        id: 'stream-graph',
        title: 'Stream Graph',
        component: 'StreamGraph',
        category: 'charts',
        description: 'Stacked stream series encoded as [period, value, category].',
        mappingMode: 'array',
        sqlShape: 'single_row',
        defaultGridSpan: 'col-span-2 row-span-2',
        defaultColorTheme: 'theme-audience',
        selectionHints: ['stacked trends', 'category flow over time', 'streamgraph'],
        sqlAliases: [
            field('streamData', 'Flat stream rows.', { sqlType: 'array[]', expressionHint: 'list([period_label, metric_value, category_name] ORDER BY period_index, category_name)' }),
        ],
        dataStructureTemplate: {
            data: { streamData: [['Jan', 120, 'Organic'], ['Jan', 84, 'Paid'], ['Feb', 138, 'Organic']] },
        },
    }),
    createWidget({
        id: 'waffle',
        title: 'Waffle Chart',
        component: 'WaffleChart',
        category: 'charts',
        description: '10x10 occupancy chart driven by a 0-100 value.',
        mappingMode: 'single',
        sqlShape: 'single_row',
        defaultGridSpan: 'default',
        defaultColorTheme: 'theme-color',
        selectionHints: ['percentage occupancy', 'share of total', 'simple proportion'],
        sqlAliases: [
            field('value', 'Integer percentage from 0 to 100.', { sqlType: 'number' }),
            field('colorTheme', 'Optional theme token.', { required: false }),
        ],
        dataStructureTemplate: {
            data: { value: 68, colorTheme: 'theme-color' },
        },
    }),
];

export const widgetManifestIndex = widgets.map((widget) => ({
    ...widget,
    searchText: normalizeLookupKey([
        widget.id,
        widget.title,
        widget.component,
        widget.category,
        widget.description,
        ...(widget.aliases || []),
        ...(widget.selectionHints || []),
    ].join(' ')),
}));

const buildSearchKeywords = (widget) => [
    widget.id,
    widget.runtimeType,
    widget.title,
    widget.component,
    widget.category,
    ...(widget.aliases || []),
    ...(widget.selectionHints || []),
    ...(widget.componentIdOverrides || []),
].filter(Boolean);

const buildCatalogEntry = (widget) => ({
    id: widget.id,
    runtime_type: widget.runtimeType,
    component: widget.component,
    category: widget.category,
    title: widget.title,
    description: widget.description,
    path: widget.manifestPath,
    manifest_path: widget.manifestPath,
    aliases: widget.aliases,
    selection_hints: widget.selectionHints,
    mapping_mode: widget.mappingMode,
    sql_shape: widget.sqlShape,
    default_grid_span: widget.defaultGridSpan,
    default_color_theme: widget.defaultColorTheme,
    component_id_overrides: widget.componentIdOverrides,
    search_keywords: buildSearchKeywords(widget),
});

export const widgetManifestMap = Object.fromEntries(
    widgetManifestIndex.map((widget) => [normalizeLookupKey(widget.id), widget]),
);

export const widgetManifestAliasMap = widgetManifestIndex.reduce((accumulator, widget) => {
    accumulator[normalizeLookupKey(widget.id)] = widget.id;
    accumulator[normalizeLookupKey(widget.runtimeType)] = widget.id;

    (widget.aliases || []).forEach((alias) => {
        accumulator[normalizeLookupKey(alias)] = widget.id;
    });

    return accumulator;
}, {});

export const getWidgetManifestEntry = (idOrAlias) => {
    const normalized = normalizeLookupKey(idOrAlias);
    const id = widgetManifestAliasMap[normalized];
    return id ? widgetManifestMap[normalizeLookupKey(id)] || null : null;
};

export const resolveWidgetManifestPath = (idOrAlias) => getWidgetManifestEntry(idOrAlias)?.manifestPath || null;

export const listWidgetManifestPaths = () => widgetManifestIndex.map((widget) => widget.manifestPath);

export const widgetCatalogMap = Object.fromEntries(
    widgetManifestIndex.map((widget) => [widget.id, buildCatalogEntry(widget)]),
);

export const widgetManifestLookupIndex = {
    widgets: Object.fromEntries(widgetManifestIndex.map((widget) => [
        widget.id,
        {
            manifest_path: widget.manifestPath,
            runtime_type: widget.runtimeType,
            component: widget.component,
            category: widget.category,
            aliases: widget.aliases,
            selection_hints: widget.selectionHints,
            component_id_overrides: widget.componentIdOverrides,
            search_keywords: buildSearchKeywords(widget),
        },
    ])),
    aliases: widgetManifestAliasMap,
    runtime_types: Object.fromEntries(widgetManifestIndex.map((widget) => [
        normalizeLookupKey(widget.runtimeType),
        widget.id,
    ])),
    components: Object.fromEntries(widgetManifestIndex.map((widget) => [
        normalizeLookupKey(widget.component),
        widget.id,
    ])),
    component_ids: Object.fromEntries(widgetManifestIndex.flatMap((widget) => (
        (widget.componentIdOverrides || []).map((componentId) => [normalizeLookupKey(componentId), widget.id])
    ))),
    manifest_paths: Object.fromEntries(widgetManifestIndex.map((widget) => [widget.id, widget.manifestPath])),
};

export const getWidgetCatalogEntries = () => Object.values(widgetCatalogMap);

export const getWidgetCatalogMap = () => ({ ...widgetCatalogMap });

export const getWidgetManifestLookupIndex = () => JSON.parse(JSON.stringify(widgetManifestLookupIndex));

export const searchWidgetManifestEntries = (query = '') => {
    const tokens = normalizeLookupKey(query)
        .split('-')
        .filter(Boolean);

    if (!tokens.length) {
        return [...widgetManifestIndex];
    }

    return widgetManifestIndex
        .map((widget) => {
            const score = tokens.reduce((sum, token) => (
                widget.searchText.includes(token) ? sum + 1 : sum
            ), 0);

            return { widget, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.widget.id.localeCompare(right.widget.id))
        .map((entry) => entry.widget);
};
