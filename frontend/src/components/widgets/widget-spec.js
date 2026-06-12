import { WEB_WIDGET_BLUE, WEB_WIDGET_BLUE_MUTED } from './webWidgetTheme';

/**
 * Widget Spec System - Generative UI for Sentry Dashboard
 * 
 * Un LLM agent generează un spec JSON care descrie complet un dashboard.
 * Acest spec este consumat de WidgetRenderer care construiește UI-ul.
 * 
 * Structura spec:
 * {
 *   layout: 'server-monitor' | 'analytics' | 'campaign-sales',
 *   title: string,
 *   timeRange: { default: string, options: string[] },
 *   widgets: WidgetSpec[],
 *   queries: QuerySpec[]
 * }
 */

// ═══════════════════════════════════════════════════════════════
// TIPURI DE WIDGET (6 dimensiuni)
// ═══════════════════════════════════════════════════════════════

export const WIDGET_SIZES = {
  '1x1': { cols: 1, rows: 1, className: 'col-span-1 row-span-1' },
  '2x1': { cols: 2, rows: 1, className: 'col-span-2 row-span-1' },
  '1x2': { cols: 1, rows: 2, className: 'col-span-1 row-span-2' },
  '2x2': { cols: 2, rows: 2, className: 'col-span-2 row-span-2' },
  '4x1': { cols: 4, rows: 1, className: 'col-span-4 row-span-1' },
  '4x2': { cols: 4, rows: 2, className: 'col-span-4 row-span-2' },
};

export const WIDGET_TYPES = {
  // Metrică simplă: valoare + label + trend
  // Size: 1x1, 2x1
  METRIC: 'metric',

  // Sparkline: linie simplă fără axe
  // Size: 2x1, 2x2
  SPARKLINE: 'sparkline',

  // Bar chart: bare verticale sau orizontale
  // Size: 2x2, 4x2
  BAR_CHART: 'bar-chart',

  // Line chart: linie cu sau fără fill
  // Size: 2x2, 4x2
  LINE_CHART: 'line-chart',

  // Progress list: listă cu bară de progres per element
  // Size: 1x2, 2x2
  PROGRESS_LIST: 'progress-list',

  // Status list: listă cu badge-uri de status
  // Size: 1x2, 2x2, 4x2
  STATUS_LIST: 'status-list',

  // Pie/Doughnut: distribuție circulară
  // Size: 1x2, 2x2
  PIE_CHART: 'pie-chart',

  // Text/Insight: bloc de text cu highlight
  // Size: 1x1, 2x1, 2x2
  TEXT_INSIGHT: 'text-insight',

  // Segmented bar: bară orizontală segmentată (P50/P95/P99)
  // Size: 2x1, 2x2
  SEGMENTED_BAR: 'segmented-bar',

  // Heatmap: grid de celule colorate
  // Size: 2x2, 4x2
  HEATMAP: 'heatmap',

  // Custom widget types
  VISITORS_ONLINE: 'visitors-online',
  CORE_WEB_VITALS: 'core-web-vitals',
  STACKED_BAR_CHART: 'stacked-bar-chart',
  BUDGET_GAUGE: 'budget-gauge',
  ACTIVE_DEPLOYMENTS: 'active-deployments',
  SALES_OVERVIEW: 'sales-overview',
  SALES_TRANSACTIONS: 'sales-transactions',
};

// ═══════════════════════════════════════════════════════════════
// EXEMPLE DE SPEC PENTRU FIECARE LAYOUT
// ═══════════════════════════════════════════════════════════════

export const serverMonitorSpec = {
  layout: 'server-monitor',
  title: 'Server Monitor',
  timeRange: {
    default: '1h',
    options: ['15m', '1h', '6h', '24h', '7d'],
  },
  widgets: [
    {
      id: 'requests',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'Requests',
      queryRef: 'requests',
      config: { sparkline: true, compact: true },
    },
    {
      id: 'errors',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'Errors',
      queryRef: 'errors',
      config: { sparkline: true, compact: true },
    },
    {
      id: 'cpu-time',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'CPU Time',
      queryRef: 'cpu-time',
      config: { sparkline: true },
    },
    {
      id: 'wall-time',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'Wall Time',
      queryRef: 'wall-time',
      config: { sparkline: true },
    },
    {
      id: 'execution-duration',
      type: WIDGET_TYPES.METRIC,
      size: '2x2',
      title: 'Execution Duration',
      queryRef: 'execution-duration',
      config: {
        sparkline: true,
      },
    },
    {
      id: 'request-duration',
      type: WIDGET_TYPES.METRIC,
      size: '2x2',
      title: 'Request Duration',
      queryRef: 'request-duration',
      config: { sparkline: true },
    },
    {
      id: 'server-ai-insight',
      type: WIDGET_TYPES.TEXT_INSIGHT,
      size: '2x2',
      title: 'AI Insight',
      queryRef: 'server-ai-insight',
      config: {},
    },
    {
      id: 'latency-dist',
      type: WIDGET_TYPES.SEGMENTED_BAR,
      size: '2x2',
      title: 'Latency Distribution',
      queryRef: 'latency-percentiles',
      config: {
        segments: [
          { key: 'p50', label: 'P50', color: '#E4E4E7' },
          { key: 'p95', label: 'P95', color: '#6B7280' },
          { key: 'p99', label: 'P99', color: '#2A2A2D' },
        ],
      },
    },
    {
      id: 'active-deployments',
      type: WIDGET_TYPES.ACTIVE_DEPLOYMENTS,
      size: '4x2',
      title: '',
      queryRef: 'active-deployments',
      config: {},
    },
  ],
  queries: [
    {
      id: 'active-deployments',
      source: 'api',
      template: '/api/v1/deployments/active?window=$timeRange',
      params: ['timeRange'],
      refresh: '60s',
    },
    {
      id: 'requests',
      source: 'prometheus',
      template: 'sum(rate(http_requests_total{host=~"$host"}[$timeRange]))',
      params: ['host', 'timeRange'],
      refresh: '30s',
    },
    {
      id: 'errors',
      source: 'prometheus',
      template: 'sum(rate(http_request_errors_total{host=~"$host"}[$timeRange]))',
      params: ['host', 'timeRange'],
      refresh: '30s',
    },
    {
      id: 'cpu-time',
      source: 'prometheus',
      template: 'sum(rate(process_cpu_seconds_total{host=~"$host"}[$timeRange]))',
      params: ['host', 'timeRange'],
      refresh: '30s',
    },
    {
      id: 'wall-time',
      source: 'prometheus',
      template: 'sum(rate(process_wall_seconds_total{host=~"$host"}[$timeRange]))',
      params: ['host', 'timeRange'],
      refresh: '30s',
    },
    {
      id: 'execution-duration',
      source: 'prometheus',
      template: 'sum(execution_duration_gb_seconds{host=~"$host"})',
      params: ['host', 'timeRange'],
      refresh: '30s',
    },
    {
      id: 'request-duration',
      source: 'prometheus',
      template: 'histogram_quantile(0.95, rate(request_duration_ms_bucket{host=~"$host"}[$timeRange]))',
      params: ['host', 'timeRange'],
      refresh: '30s',
    },
    {
      id: 'server-ai-insight',
      source: 'api',
      template: '/api/v1/insights/server?window=$timeRange',
      params: ['timeRange'],
      refresh: '60s',
    },
    {
      id: 'latency-percentiles',
      source: 'prometheus',
      template: 'histogram_quantile(0.5, rate(request_duration_seconds_bucket{host=~"$host"}[$timeRange]))',
      params: ['host', 'timeRange'],
      refresh: '30s',
    },
  ],
};

export const analyticsSpec = {
  layout: 'analytics',
  title: 'Web Analytics',
  timeRange: {
    default: '24h',
    options: ['1h', '24h', '7d', '30d', '90d'],
  },
  widgets: [
    // Row 1: Total Visitors (wide) & Visitors Online: Desktop, Mobile, Tablet
    {
      id: 'total-visitors',
      type: WIDGET_TYPES.METRIC,
      size: '2x1',
      title: 'Total Visitors',
      queryRef: 'total-visitors',
      config: { sparkline: true },
    },
    {
      id: 'visitors-online',
      type: WIDGET_TYPES.VISITORS_ONLINE,
      size: '2x1',
      title: 'Visitors Online',
      queryRef: 'visitors-online',
      config: {},
    },
    // Row 2: Top Pages & Top Countries
    {
      id: 'top-pages',
      type: WIDGET_TYPES.PROGRESS_LIST,
      size: '2x2',
      title: 'Top Pages (Routes)',
      queryRef: 'top-pages',
      config: { maxItems: 6, showValue: true },
    },
    {
      id: 'top-countries',
      type: WIDGET_TYPES.PROGRESS_LIST,
      size: '2x2',
      title: 'Top Countries',
      queryRef: 'top-countries',
      config: { maxItems: 6, showPercent: true },
    },
    // Row 3: Sessions by Source, Audience Mix, Browsers, Top Referrers
    {
      id: 'sessions-by-source',
      type: WIDGET_TYPES.PROGRESS_LIST,
      size: '1x2',
      title: 'Sessions by Source',
      queryRef: 'sessions-by-source',
      config: { maxItems: 5, showPercent: true },
    },
    {
      id: 'audience-mix',
      type: WIDGET_TYPES.PIE_CHART,
      size: '1x2',
      title: 'Audience Mix',
      queryRef: 'audience-mix',
      config: { donut: true },
    },
    {
      id: 'browsers',
      type: WIDGET_TYPES.PROGRESS_LIST,
      size: '1x2',
      title: 'Browsers',
      queryRef: 'browsers',
      config: { maxItems: 5, showPercent: true },
    },
    {
      id: 'referrers',
      type: WIDGET_TYPES.PROGRESS_LIST,
      size: '1x2',
      title: 'Top Referrers',
      queryRef: 'referrers',
      config: { maxItems: 5, showValue: true },
    },
    // Row 4: Core Web Vitals
    {
      id: 'core-web-vitals',
      type: WIDGET_TYPES.CORE_WEB_VITALS,
      size: '4x1',
      title: 'Core Web Vitals',
      queryRef: 'core-web-vitals',
      config: {},
    },
  ],
  queries: [
    {
      id: 'total-visitors',
      source: 'analytics',
      template: 'SELECT COUNT(DISTINCT visitor_id) FROM pageviews WHERE timestamp >= $__timeFrom',
      params: ['timeRange'],
      refresh: '60s',
    },
    {
      id: 'visitors-online',
      source: 'api',
      template: '/api/v1/visitors/online',
      params: [],
      refresh: '10s',
    },
    {
      id: 'top-pages',
      source: 'analytics',
      template: 'SELECT path, COUNT(*) as views FROM pageviews WHERE timestamp >= $__timeFrom GROUP BY path ORDER BY views DESC LIMIT 6',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'top-countries',
      source: 'analytics',
      template: 'SELECT country, COUNT(*) as views FROM pageviews WHERE timestamp >= $__timeFrom GROUP BY country ORDER BY views DESC LIMIT 6',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'sessions-by-source',
      source: 'analytics',
      template: 'SELECT source, COUNT(*) as sessions FROM sessions WHERE timestamp >= $__timeFrom GROUP BY source ORDER BY sessions DESC LIMIT 5',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'audience-mix',
      source: 'analytics',
      template: 'SELECT user_type, COUNT(*) FROM sessions WHERE timestamp >= $__timeFrom GROUP BY user_type',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'browsers',
      source: 'analytics',
      template: 'SELECT browser, COUNT(*) FROM pageviews WHERE timestamp >= $__timeFrom GROUP BY browser',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'referrers',
      source: 'analytics',
      template: 'SELECT referrer, COUNT(*) FROM pageviews WHERE timestamp >= $__timeFrom GROUP BY referrer ORDER BY COUNT(*) DESC LIMIT 5',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'core-web-vitals',
      source: 'lighthouse',
      template: 'SELECT metric, value FROM web_vitals WHERE url = $url',
      params: ['url'],
      refresh: '600s',
    },
  ],
};

export const campaignSalesSpec = {
  layout: 'campaign-sales',
  title: 'Campaign Performance',
  timeRange: {
    default: '7d',
    options: ['24h', '7d', '30d', '90d'],
  },
  widgets: [
    {
      id: 'total-revenue',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'Revenue',
      queryRef: 'revenue-total',
      config: { prefix: '$', sparkline: true },
    },
    {
      id: 'total-conversions',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'Conversions',
      queryRef: 'conversions-total',
      config: { sparkline: true },
    },
    {
      id: 'conversion-rate',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'Conv. Rate',
      queryRef: 'conversion-rate',
      config: { unit: '%', sparkline: true },
    },
    {
      id: 'roas',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'ROAS',
      queryRef: 'roas',
      config: { sparkline: true },
    },
    {
      id: 'revenue-chart',
      type: WIDGET_TYPES.BAR_CHART,
      size: '4x2',
      title: 'Revenue by Campaign',
      queryRef: 'revenue-by-campaign',
      config: { orientation: 'vertical', stacked: true },
    },
    {
      id: 'funnel',
      type: WIDGET_TYPES.PROGRESS_LIST,
      size: '2x2',
      title: 'Conversion Funnel',
      queryRef: 'funnel-stages',
      config: { maxItems: 6, showPercent: true },
    },
    {
      id: 'campaign-status',
      type: WIDGET_TYPES.STATUS_LIST,
      size: '2x2',
      title: 'Active Campaigns',
      queryRef: 'active-campaigns',
      config: { maxItems: 10, showBudget: true },
    },
    {
      id: 'channel-breakdown',
      type: WIDGET_TYPES.PIE_CHART,
      size: '2x2',
      title: 'By Channel',
      queryRef: 'channel-breakdown',
      config: { donut: true },
    },
    {
      id: 'insight',
      type: WIDGET_TYPES.TEXT_INSIGHT,
      size: '2x2',
      title: 'AI Insight',
      queryRef: 'ai-insight',
      config: { highlightNumbers: true },
    },
  ],
  queries: [
    {
      id: 'revenue-total',
      source: 'warehouse',
      template: 'SELECT SUM(revenue) FROM conversions WHERE timestamp >= $__timeFrom',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'revenue-by-campaign',
      source: 'warehouse',
      template: 'SELECT campaign_name, SUM(revenue) as rev, SUM(spend) as spend FROM conversions WHERE timestamp >= $__timeFrom GROUP BY campaign_name',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'funnel-stages',
      source: 'warehouse',
      template: 'SELECT stage, COUNT(*) as count FROM funnel WHERE timestamp >= $__timeFrom GROUP BY stage ORDER BY stage_order',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'active-campaigns',
      source: 'api',
      template: '/api/v1/campaigns?status=active',
      params: [],
      refresh: '60s',
    },
  ],
};

export const marketingSpec = {
  layout: 'marketing-performance',
  title: 'Marketing Performance',
  timeRange: {
    default: '24h',
    options: ['24h', '7d', '30d', '90d'],
  },
  widgets: [
    {
      id: 'active-campaigns-total',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'Active Campaigns',
      queryRef: 'active-campaigns-total',
      config: {},
    },
    {
      id: 'posts-published',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'Posts Published',
      queryRef: 'posts-published',
      config: {},
    },
    {
      id: 'total-reach',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'Total Reach',
      queryRef: 'total-reach',
      config: { compact: true },
    },
    {
      id: 'avg-engagement',
      type: WIDGET_TYPES.METRIC,
      size: '1x1',
      title: 'Avg. Engagement',
      queryRef: 'avg-engagement',
      config: { unit: '%' },
    },
    {
      id: 'gross-revenue',
      type: WIDGET_TYPES.STACKED_BAR_CHART,
      size: '4x2',
      title: 'Gross Revenue',
      queryRef: 'gross-revenue',
      config: { mode: 'overlay' },
    },
    {
      id: 'todays-budget',
      type: WIDGET_TYPES.BUDGET_GAUGE,
      size: '4x1',
      title: "Today's Budget",
      queryRef: 'todays-budget',
      config: {},
    },
  ],
  queries: [
    {
      id: 'active-campaigns-total',
      source: 'api',
      template: '/api/v1/campaigns/active/count',
      params: [],
      refresh: '60s',
    },
    {
      id: 'posts-published',
      source: 'api',
      template: '/api/v1/social/posts?window=$timeRange',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'total-reach',
      source: 'analytics',
      template: 'SELECT SUM(reach) FROM campaign_posts WHERE timestamp >= $__timeFrom',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'avg-engagement',
      source: 'analytics',
      template: 'SELECT AVG(engagement_rate) FROM campaign_posts WHERE timestamp >= $__timeFrom',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'gross-revenue',
      source: 'warehouse',
      template: 'SELECT hour_bucket, today_revenue, yesterday_revenue FROM marketing_gross_revenue WHERE timestamp >= $__timeFrom',
      params: ['timeRange'],
      refresh: '300s',
    },
    {
      id: 'todays-budget',
      source: 'warehouse',
      template: 'SELECT spent, allowance FROM daily_budget WHERE day = CURRENT_DATE',
      params: [],
      refresh: '60s',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// UTILITARE PENTRU GENERAREA SPEC-ULUI
// ═══════════════════════════════════════════════════════════════

export function createWidgetSpec(overrides = {}) {
  return {
    id: `widget_${Date.now()}`,
    type: WIDGET_TYPES.METRIC,
    size: '1x1',
    title: 'Untitled',
    queryRef: null,
    config: {},
    ...overrides,
  };
}

export function createQuerySpec(overrides = {}) {
  return {
    id: `query_${Date.now()}`,
    source: 'api',
    template: '',
    params: [],
    refresh: '60s',
    ...overrides,
  };
}

export function validateSpec(spec) {
  const errors = [];
  
  if (!spec.layout) errors.push('Missing layout');
  if (!spec.title) errors.push('Missing title');
  if (!Array.isArray(spec.widgets)) errors.push('Widgets must be an array');
  if (!Array.isArray(spec.queries)) errors.push('Queries must be an array');
  
  spec.widgets?.forEach((w, i) => {
    if (!w.id) errors.push(`Widget ${i}: missing id`);
    if (!WIDGET_TYPES[w.type]) errors.push(`Widget ${i}: invalid type "${w.type}"`);
    if (!WIDGET_SIZES[w.size]) errors.push(`Widget ${i}: invalid size "${w.size}"`);
    if (!w.queryRef) errors.push(`Widget ${i}: missing queryRef`);
  });
  
  const queryIds = new Set(spec.queries?.map(q => q.id) || []);
  spec.widgets?.forEach(w => {
    if (w.queryRef && !queryIds.has(w.queryRef)) {
      errors.push(`Widget "${w.id}": queryRef "${w.queryRef}" not found`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ═══════════════════════════════════════════════════════════════
// MOCK DATA GENERATOR (pentru development)
// ═══════════════════════════════════════════════════════════════

export function generateMockData(widgetType, config = {}, queryRef = null) {
  // Generare date de înaltă fidelitate dacă avem queryRef
  if (queryRef) {
    if (queryRef === 'total-visitors') {
      return {
        value: 84293,
        previous: 78124,
        trend: '7.9',
        sparklineData: [45, 52, 49, 62, 58, 65, 70, 68, 72, 80, 85, 78, 82, 90, 88, 92, 95, 89, 94, 98],
      };
    }
    if (queryRef === 'visitors-online') {
      return {
        totalOnline: 1482,
        devices: [
          { label: 'Desktop', value: 771, percent: 52, color: WEB_WIDGET_BLUE },
          { label: 'Mobile', value: 563, percent: 38, color: WEB_WIDGET_BLUE_MUTED },
          { label: 'Tablet', value: 148, percent: 10, color: 'rgba(168, 199, 250, 0.2)' },
        ],
      };
    }
    if (queryRef === 'top-pages') {
      return {
        items: [
          { label: '/', value: 34120, percent: 100 },
          { label: '/dashboard', value: 21490, percent: 63 },
          { label: '/analytics', value: 15201, percent: 45 },
          { label: '/settings', value: 8943, percent: 26 },
          { label: '/billing', value: 4520, percent: 13 },
        ],
      };
    }
    if (queryRef === 'top-countries') {
      return {
        items: [
          { label: 'United States', percent: 42, value: '42%' },
          { label: 'Germany', percent: 18, value: '18%' },
          { label: 'United Kingdom', percent: 12, value: '12%' },
          { label: 'France', percent: 9, value: '9%' },
          { label: 'Romania', percent: 5, value: '5%' },
          { label: 'Canada', percent: 4, value: '4%' },
        ],
      };
    }
    if (queryRef === 'sessions-by-source') {
      return {
        items: [
          { label: 'Organic Search', percent: 45, value: '45%' },
          { label: 'Direct', percent: 25, value: '25%' },
          { label: 'Referral', percent: 15, value: '15%' },
          { label: 'Social', percent: 10, value: '10%' },
          { label: 'Email', percent: 5, value: '5%' },
        ],
      };
    }
    if (queryRef === 'audience-mix') {
      return {
        segments: [
          { label: 'New Users', value: 60, color: WEB_WIDGET_BLUE },
          { label: 'Returning Users', value: 40, color: WEB_WIDGET_BLUE_MUTED },
        ],
      };
    }
    if (queryRef === 'browsers') {
      return {
        items: [
          { label: 'Chrome', percent: 62, value: '62%' },
          { label: 'Safari', percent: 22, value: '22%' },
          { label: 'Firefox', percent: 8, value: '8%' },
          { label: 'Edge', percent: 6, value: '6%' },
          { label: 'Other', percent: 2, value: '2%' },
        ],
      };
    }
    if (queryRef === 'referrers') {
      return {
        items: [
          { label: 'google.com', value: 14230, percent: 100 },
          { label: 'github.com', value: 8940, percent: 63 },
          { label: 't.co', value: 4320, percent: 30 },
          { label: 'linkedin.com', value: 3120, percent: 22 },
          { label: 'ycombinator.com', value: 1850, percent: 13 },
        ],
      };
    }
    if (queryRef === 'core-web-vitals') {
      return {
        metrics: [
          { id: 'lcp', label: 'Largest Contentful Paint', acronym: 'LCP', value: '1.2s', status: 'good', description: 'Optimal loading speed.' },
          { id: 'inp', label: 'Interaction to Next Paint', acronym: 'INP', value: '85ms', status: 'good', description: 'Excellent responsiveness.' },
          { id: 'cls', label: 'Cumulative Layout Shift', acronym: 'CLS', value: '0.04', status: 'good', description: 'High visual stability.' }
        ],
      };
    }
    if (queryRef === 'latency-percentiles') {
      return {
        summaryValue: '23.7 ms',
        summaryLabel: 'p95',
        actionLabel: 'Open metrics',
        segments: [
          { key: 'p50', label: 'P50', value: 45, displayValue: '45%', color: '#E4E4E7' },
          { key: 'p95', label: 'P95', value: 35, displayValue: '35%', color: '#6B7280' },
          { key: 'p99', label: 'P99', value: 20, displayValue: '20%', color: '#2A2A2D' },
        ],
        total: 100,
      };
    }
    if (queryRef === 'server-ai-insight') {
      return {
        text: 'Cold starts fell by 18% in the last 4 hours vs. the previous window after the v2.8.1 deploy.',
        highlights: [
          { text: '18%', type: 'metric' },
          { text: 'last 4 hours', type: 'timeframe' },
          { text: 'v2.8.1 deploy', type: 'release' },
        ],
        actionLabel: 'View traces',
      };
    }
    if (queryRef === 'requests') {
      return {
        value: 128400,
        previous: 118900,
        trend: '7.99',
        sparklineData: [24, 31, 28, 35, 32, 38, 41, 39, 44, 48, 46, 51, 54, 50, 58, 62, 57, 61, 66, 70],
      };
    }
    if (queryRef === 'errors') {
      return {
        value: 184,
        previous: 163,
        trend: '12.88',
        sparklineData: [4, 5, 4, 7, 6, 8, 7, 9, 8, 10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 18],
      };
    }
    if (queryRef === 'cpu-time') {
      return {
        value: 6.8,
        displayValue: '6.8h',
        previous: 6.2,
        trend: '9.68',
        sparklineData: [1.2, 1.4, 1.3, 1.8, 1.6, 2.0, 2.2, 2.1, 2.4, 2.8, 2.6, 3.0, 3.3, 3.1, 3.5, 3.9, 3.6, 4.2, 4.6, 4.9],
      };
    }
    if (queryRef === 'wall-time') {
      return {
        value: 14.2,
        displayValue: '14.2h',
        previous: 13.4,
        trend: '5.97',
        sparklineData: [2.1, 2.4, 2.3, 2.7, 2.6, 3.1, 3.0, 3.4, 3.3, 3.8, 4.0, 3.9, 4.4, 4.7, 4.5, 5.0, 5.3, 5.1, 5.7, 6.0],
      };
    }
    if (queryRef === 'execution-duration') {
      return {
        value: 2.4,
        displayValue: '2.4 GB-sec',
        previous: 2.37,
        trend: '1.19',
        sparklineData: [0.4, 0.4, 1.7, 0.4, 1.0, 0.4, 1.0, 0.4, 1.7, 0.4, 1.0, 0.4, 1.7, 0.4, 2.3, 0.4, 1.0, 0.4, 3.0, 0.4, 1.7],
      };
    }
    if (queryRef === 'request-duration') {
      return {
        value: 23.7,
        displayValue: '23.7 ms',
        previous: 18.2,
        trend: '30.30',
        sparklineData: [0.3, 0.7, 0.3, 0.7, 0.3, 1.1, 0.3, 0.7, 0.3, 1.6, 0.3, 1.1, 0.3, 1.9, 0.3, 1.6, 0.3, 2.3, 0.3, 1.1, 0.3, 2.7],
      };
    }
    if (queryRef === 'active-campaigns-total') {
      return {
        value: 12,
        previous: 10,
        trend: '20.0',
      };
    }
    if (queryRef === 'posts-published') {
      return {
        value: 48,
        previous: 41,
        trend: '17.1',
      };
    }
    if (queryRef === 'total-reach') {
      return {
        value: 284300,
        previous: 251900,
        trend: '12.9',
      };
    }
    if (queryRef === 'avg-engagement') {
      return {
        value: 6.4,
        previous: 5.8,
        trend: '10.3',
      };
    }
    if (queryRef === 'gross-revenue') {
      return {
        summary: {
          primaryLabel: 'Today',
          primaryValue: 243.65,
          primaryColor: 'rgba(228, 228, 231, 0.95)',
          secondaryLabel: 'Yesterday',
          secondaryValue: 208.19,
          secondaryColor: 'rgba(142, 145, 143, 0.38)',
          delta: 17.0,
        },
        labels: ['19:00', '21:00', '23:00', '01:00', '03:00', '05:00', '07:00', '09:00', '11:00', '13:00', '15:00', '17:00'],
        datasets: [
          {
            key: 'yesterday',
            label: 'Yesterday',
            color: 'rgba(142, 145, 143, 0.34)',
            data: [3.6, 5.8, 4.1, 5.1, 3.8, 4.9, 6.4, 5.7, 7.2, 5.3, 5.9, 6.6],
          },
          {
            key: 'today',
            label: 'Today',
            color: 'rgba(228, 228, 231, 0.86)',
            data: [4.2, 6.55, 4.7, 5.6, 4.1, 5.7, 6.9, 6.2, 8.1, 5.8, 6.3, 7.1],
          },
        ],
      };
    }
    if (queryRef === 'todays-budget') {
      return {
        spent: 223.65,
        allowance: 480.0,
        percentUsed: 46.6,
        leftLabel: 'Used today',
        rightLabel: "Today's allowance",
      };
    }
    if (queryRef === 'sales-revenue-overview') {
      return {
        metrics: {
          revenue: { label: 'Revenue', value: '€84.3K', trend: '+12.4', axisTicks: ['0', '2.7K', '5.4K', '8.2K', '10.9K'] },
          orders: { label: 'Orders', value: '1,247', trend: '+8.1', axisTicks: ['0', '42', '85', '127', '170'] },
          aov: { label: 'AOV', value: '€67.58', trend: '+4.0', axisTicks: ['45', '54', '63', '72', '81'] },
          conversion: { label: 'Conversion', value: '3.2%', trend: '-0.8', axisTicks: ['1.0', '2.0', '3.0', '4.0', '5.0'] },
        },
        timeseries: {
          revenue: [2.1, 2.4, 2.2, 2.8, 3.0, 3.3, 3.1, 3.6, 3.8, 4.1, 3.9, 4.3, 4.6, 5.0, 4.8, 5.2, 5.5, 5.3, 5.8, 6.1, 6.3, 6.0, 6.6, 6.8, 7.0, 7.3, 7.1, 7.5, 7.8, 8.2],
          orders: [74, 82, 78, 88, 92, 95, 90, 98, 102, 108, 105, 112, 118, 115, 122, 128, 132, 128, 136, 140, 138, 134, 142, 148, 152, 155, 150, 158, 162, 168],
          aov: [57.20, 58.10, 57.80, 59.40, 60.20, 61.50, 60.80, 62.10, 63.40, 64.00, 63.20, 64.80, 65.50, 66.20, 65.80, 67.10, 67.90, 67.30, 68.20, 68.80, 69.10, 68.50, 69.80, 70.20, 70.60, 71.00, 70.40, 71.50, 71.80, 72.10],
          conversion: [2.8, 3.0, 2.9, 3.1, 3.2, 3.0, 3.3, 3.1, 3.4, 3.2, 3.5, 3.3, 3.4, 3.6, 3.5, 3.7, 3.6, 3.8, 3.7, 3.5, 3.9, 3.8, 4.0, 3.9, 4.1, 4.0, 3.8, 4.2, 4.0, 4.3],
        },
        labels: ['Jun 13', '', '', 'Jun 16', '', '', 'Jun 19', '', '', 'Jun 22', '', '', 'Jun 25', '', '', 'Jun 28', '', '', 'Jul 1', '', '', 'Jul 4', '', '', 'Jul 7', '', '', 'Jul 10', '', ''],
      };
    }
    if (queryRef === 'sales-transactions-table') {
      return {
        transactions: [
          { id: 'TXN-1842', customer: 'Acme Corp', product: 'Enterprise Plan', status: 'Success', qty: 1, unitPrice: '$2,400', totalRevenue: '$2,400.00' },
          { id: 'TXN-1841', customer: 'Globex Inc', product: 'Growth Plan', status: 'Success', qty: 3, unitPrice: '$500', totalRevenue: '$1,500.00' },
          { id: 'TXN-1840', customer: 'Initech', product: 'Scale Plan', status: 'Pending', qty: 1, unitPrice: '$1,500', totalRevenue: '$1,500.00' },
          { id: 'TXN-1839', customer: 'Umbrella Co', product: 'Starter Plan', status: 'Success', qty: 5, unitPrice: '$150', totalRevenue: '$750.00' },
          { id: 'TXN-1838', customer: 'Hooli', product: 'Enterprise Plan', status: 'Refunded', qty: 1, unitPrice: '$2,400', totalRevenue: '$2,400.00' },
          { id: 'TXN-1837', customer: 'Massive Dynamic', product: 'Growth Plan', status: 'Success', qty: 2, unitPrice: '$500', totalRevenue: '$1,000.00' },
          { id: 'TXN-1836', customer: 'Stark Industries', product: 'Scale Plan', status: 'Success', qty: 1, unitPrice: '$1,500', totalRevenue: '$1,500.00' },
          { id: 'TXN-1835', customer: 'Wayne Enterprises', product: 'Starter Plan', status: 'Pending', qty: 4, unitPrice: '$150', totalRevenue: '$600.00' },
        ],
      };
    }
    if (queryRef === 'active-deployments') {
      return {
        deployments: [
          {
            version: 'v2.8.1',
            environment: 'Production',
            status: 'Healthy',
            branch: 'main',
            commit: 'Improve edge cache invalidation strategy',
            date: 'May 19',
            cache: 'Cached',
          },
          {
            version: 'v2.8.0',
            environment: 'Production',
            status: 'Stable',
            branch: 'release/2.8',
            commit: 'Patch payment webhook retry logic',
            date: 'May 18',
            cache: 'Cached',
          },
          {
            version: 'v2.9.0-rc.1',
            environment: 'Staging',
            status: 'Warning',
            branch: 'release/2.9',
            commit: 'Add budget dashboard summary cards',
            date: 'May 18',
            cache: 'Cold',
          },
          {
            version: 'v2.7.6',
            environment: 'Production',
            status: 'Healthy',
            branch: 'hotfix/auth-session',
            commit: 'Fix stale session token refresh race',
            date: 'May 17',
            cache: 'Cached',
          },
          {
            version: 'v2.9.0-beta.3',
            environment: 'Staging',
            status: 'Stable',
            branch: 'feature/usage-breakdown',
            commit: 'Refine monthly budget usage graph labels',
            date: 'May 17',
            cache: 'Cold',
          },
          {
            version: 'v2.7.5',
            environment: 'Production',
            status: 'Healthy',
            branch: 'hotfix/cdn-rules',
            commit: 'Tune cache headers for checkout assets',
            date: 'May 16',
            cache: 'Cached',
          },
          {
            version: 'v2.9.0-beta.2',
            environment: 'Staging',
            status: 'Warning',
            branch: 'feature/server-rollouts',
            commit: 'Prepare progressive deployment toggles',
            date: 'May 15',
            cache: 'Cold',
          },
        ],
      };
    }
  }

  // Fallback bazat pe widgetType
  switch (widgetType) {
    case WIDGET_TYPES.METRIC:
      return {
        value: Math.floor(Math.random() * 10000),
        previous: Math.floor(Math.random() * 10000),
        trend: (Math.random() * 40 - 20).toFixed(1),
        sparklineData: Array.from({ length: 20 }, () => Math.random() * 100),
      };
    
    case WIDGET_TYPES.SPARKLINE:
    case WIDGET_TYPES.LINE_CHART:
      return {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: config.lines?.map(line => ({
          key: line.key,
          label: line.label,
          data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 1000)),
        })) || [{
          key: 'default',
          label: 'Value',
          data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 1000)),
        }],
      };
    
    case WIDGET_TYPES.BAR_CHART:
      return {
        labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        datasets: [{
          key: 'value',
          label: 'Value',
          data: Array.from({ length: 8 }, () => Math.floor(Math.random() * 1000)),
        }],
      };

    case WIDGET_TYPES.STACKED_BAR_CHART:
      return {
        summary: {
          primaryLabel: 'Today',
          primaryValue: 243.65,
          primaryColor: 'rgba(228, 228, 231, 0.95)',
          secondaryLabel: 'Yesterday',
          secondaryValue: 208.19,
          secondaryColor: 'rgba(142, 145, 143, 0.38)',
          delta: 17.0,
        },
        labels: ['19:00', '21:00', '23:00', '01:00', '03:00', '05:00', '07:00', '09:00'],
        datasets: [
          {
            key: 'yesterday',
            label: 'Yesterday',
            color: 'rgba(142, 145, 143, 0.34)',
            data: Array.from({ length: 8 }, () => Number((Math.random() * 6 + 2).toFixed(2))),
          },
          {
            key: 'today',
            label: 'Today',
            color: 'rgba(228, 228, 231, 0.86)',
            data: Array.from({ length: 8 }, () => Number((Math.random() * 7 + 2).toFixed(2))),
          },
        ],
      };

    case WIDGET_TYPES.BUDGET_GAUGE:
      return {
        spent: 223.65,
        allowance: 480.0,
        percentUsed: 46.6,
      };

    case WIDGET_TYPES.ACTIVE_DEPLOYMENTS:
      return {
        deployments: [
          {
            version: 'v2.8.1',
            environment: 'Production',
            status: 'Healthy',
            branch: 'main',
            commit: 'Improve edge cache invalidation strategy',
            date: 'May 19',
            cache: 'Cached',
          },
        ],
      };
    
    case WIDGET_TYPES.PROGRESS_LIST:
      return {
        items: Array.from({ length: config.maxItems || 6 }, (_, i) => ({
          label: `Item ${i + 1}`,
          value: Math.floor(Math.random() * 100),
          max: 100,
          percent: Math.floor(Math.random() * 100),
        })),
      };
    
    case WIDGET_TYPES.STATUS_LIST:
      return {
        items: Array.from({ length: config.maxItems || 6 }, (_, i) => ({
          name: `Service ${i + 1}`,
          status: ['healthy', 'stable', 'warning', 'error'][Math.floor(Math.random() * 4)],
          detail: `v${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
          meta: Math.random() > 0.5 ? 'Cached' : 'Cold',
        })),
      };
    
    case WIDGET_TYPES.PIE_CHART:
      return {
        segments: [
          { label: 'Desktop', value: 45, color: '#E4E4E7' },
          { label: 'Mobile', value: 35, color: '#6B7280' },
          { label: 'Tablet', value: 15, color: '#3F3F46' },
          { label: 'Other', value: 5, color: '#27272A' },
        ],
      };
    
    case WIDGET_TYPES.SEGMENTED_BAR:
      return {
        segments: [
          { key: 'p50', label: 'P50', value: 45, color: '#E4E4E7' },
          { key: 'p95', label: 'P95', value: 120, color: '#6B7280' },
          { key: 'p99', label: 'P99', value: 350, color: '#3F3F46' },
        ],
        total: 515,
      };
    
    case WIDGET_TYPES.HEATMAP:
      return {
        rows: config.rows || 7,
        cols: config.cols || 24,
        data: Array.from({ length: (config.rows || 7) * (config.cols || 24) }, () =>
          Math.floor(Math.random() * 100)
        ),
      };
    
    case WIDGET_TYPES.TEXT_INSIGHT:
      return {
        text: 'Revenue increased by 18% compared to last period. The "Summer Sale" campaign drove 42% of total conversions. Consider increasing budget for high-performing channels.',
        highlights: [
          { text: '18%', type: 'metric' },
          { text: '42%', type: 'metric' },
        ],
      };
    
    default:
      return {};
  }
}
