/**
 * DirectQueryService — queries external data sources directly without going through BigQuery.
 *
 * Supported sources:
 *   prometheus  — PromQL via Prometheus REST API
 *   api         — generic REST endpoint (template is the full URL)
 *   ga4         — Google Analytics Data API (future, requires OAuth backend proxy)
 *
 * For sources that need auth (GA4, Stripe, etc.), queries should go through
 * backend proxy endpoints to keep secrets server-side.
 */

const DEFAULT_PROMETHEUS_URL = 'http://localhost:9090';

function parseTimeRange(range) {
  if (!range) return '1h';
  return range;
}

/**
 * Substitute $param placeholders in a template string.
 */
function substituteParams(template, params, context) {
  let result = template;

  if (params.includes('timeRange')) {
    result = result.replace(/\$timeRange/g, context.timeRange || '1h');
  }
  if (params.includes('host')) {
    result = result.replace(/\$host/g, context.host || '.*');
  }

  return result;
}

/**
 * Execute a Prometheus instant query.
 * Prometheus API: GET /api/v1/query?query=<promql>
 */
async function queryPrometheus(template, params, context) {
  const promUrl = context.prometheusUrl || DEFAULT_PROMETHEUS_URL;
  const promql = substituteParams(template, params, context);
  const url = `${promUrl}/api/v1/query?query=${encodeURIComponent(promql)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Prometheus query failed: ${response.status}`);
  }

  const json = await response.json();
  if (json.status !== 'success') {
    throw new Error(`Prometheus error: ${json.error || 'unknown'}`);
  }

  // Prometheus returns { status: 'success', data: { resultType: 'vector', result: [...] } }
  return json.data.result;
}

/**
 * Execute a generic REST API query.
 * The template is the full URL path relative to the API base.
 */
async function queryApi(template, params, context) {
  const url = substituteParams(template, params, context);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API query failed: ${response.status} ${url}`);
  }
  return response.json();
}

/**
 * Transform raw source results to widget-compatible data format.
 */
function transformResult(rawResult, source, widgetType) {
  if (!rawResult || (Array.isArray(rawResult) && rawResult.length === 0)) {
    return emptyDataForType(widgetType);
  }

  switch (source) {
    case 'prometheus': {
      // Prometheus vector result: [{ metric: {...}, value: [timestamp, "value"] }]
      if (rawResult.length === 1) {
        // Single metric → metric widget
        const value = parseFloat(rawResult[0].value?.[1]) || 0;
        return { value };
      }
      // Multiple metrics → list format
      const items = rawResult.map((r) => ({
        label: Object.values(r.metric || {}).join('/') || 'value',
        value: parseFloat(r.value?.[1]) || 0,
      }));
      return { items };
    }

    case 'api': {
      // Try to detect shape: array of objects → list items
      if (Array.isArray(rawResult) && rawResult.length > 0) {
        const first = rawResult[0];
        if (typeof first === 'object') {
          const keys = Object.keys(first);
          const items = rawResult.map((row) => ({
            label: row[keys[0]] || row.label || row.name || '',
            value: row[keys[1]] || row.value || row.count || 0,
            percent: row.percent || row.share || 0,
            status: row.status || null,
          }));
          return { items };
        }
      }
      // Scalar or unknown → metric
      return { value: Number(rawResult) || 0 };
    }

    default:
      return emptyDataForType(widgetType);
  }
}

function emptyDataForType(widgetType) {
  switch (widgetType) {
    case 'metric':
      return { value: 0, trend: '0' };
    case 'sparkline':
      return { sparklineData: [] };
    case 'bar-chart':
    case 'line-chart':
    case 'progress-list':
    case 'status-list':
    case 'pie-chart':
    case 'segmented-bar':
      return { items: [] };
    case 'heatmap':
      return { cells: [] };
    case 'text-insight':
      return { text: 'No data available.' };
    case 'active-deployments':
      return { deployments: [] };
    default:
      return {};
  }
}

/**
 * Execute a direct query — main entry point.
 *
 * @param {string} source — 'prometheus', 'api', 'ga4'
 * @param {string} template — PromQL query, URL template, or GA4 report config
 * @param {string[]} params — parameter names to substitute
 * @param {Object} context — { timeRange, host, prometheusUrl }
 * @param {string} widgetType — for result transformation
 * @returns {Promise<Object>} widget-compatible data
 */
export async function executeDirectQuery(source, template, params, context, widgetType) {
  let rawResult;

  switch (source) {
    case 'prometheus':
      rawResult = await queryPrometheus(template, params, context);
      break;
    case 'api':
      rawResult = await queryApi(template, params, context);
      break;
    case 'ga4':
      // Future: proxy through backend GA4 endpoint
      throw new Error('GA4 direct queries not yet supported. Use analytics/warehouse source.');
    default:
      throw new Error(`Unknown direct query source: ${source}`);
  }

  return transformResult(rawResult, source, widgetType);
}
