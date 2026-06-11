/**
 * Harness Service — spec generation agent.
 *
 * POST /generate  → full or incremental spec generation
 * POST /discover  → data discovery only (dry run)
 * GET  /health    → health check
 */

import express from 'express';
import cors from 'cors';
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.PORT) || 8081;
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'dev-internal-token';

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'gemini';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash';
const GCS_BUCKET = process.env.GCS_BUCKET || 'sentry-platform-data';

function requireInternalToken(req, res, next) {
  if (req.headers['x-internal-token'] !== INTERNAL_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
app.use(requireInternalToken);

// ─── PASS 1: Data Discovery ───

async function discoverData(dataset) {
  const bigquery = new BigQuery();
  const tables = [];
  try {
    const [tableList] = await bigquery.dataset(dataset).getTables();
    for (const table of tableList) {
      const tableId = dataset + '.' + table.id;
      try {
        const [countRows] = await bigquery.query('SELECT COUNT(*) AS cnt FROM `' + tableId + '`');
        const rowCount = countRows[0]?.cnt || 0;
        if (rowCount === 0) continue;

        const [metadata] = await bigquery.dataset(dataset).table(table.id).getMetadata();
        const columns = (metadata.schema?.fields || []).map(f => ({ name: f.name, type: f.type }));

        const [sampleRows] = await bigquery.query('SELECT * FROM `' + tableId + '` LIMIT 5');
        tables.push({
          table: tableId, short_name: table.id, row_count: rowCount, columns,
          sample: sampleRows.map(r => Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, v?.value ?? v])
          )),
        });
      } catch (e) { console.warn('[DISCOVER] Skip ' + tableId + ': ' + e.message); }
    }
  } catch (e) { console.error('[DISCOVER] ' + e.message); }
  return { tables, total_tables: tables.length };
}

// ─── PASS 2+3: LLM Prompts ───

const SPEC_PROMPT = 'You are a dashboard spec generator. Given a DATA CATALOG, output valid JSON dashboard spec.\nRULES:\n1. Every widget has queryRef matching a table short_name from the catalog.\n2. Cannot create widgets for tables not in catalog.\n3. At least one widget per table with data.\n4. Widget types: numeric+time->sparkline, numeric->metric, string+count->bar-chart, string+status->status-list, text->text-insight.\n5. queries array leave empty (generated separately).\nOutput ONLY valid JSON: {"layout":"server-monitor","title":"Dashboard","widgets":[...], "queries":[]}';

const QUERY_PROMPT = 'You are a SQL query generator. Given widgets and table info, output query objects:\n{"id":"table_name","source":"analytics","template":"SELECT ... FROM ...","params":["timeRange"],"refresh":"60s"}\nOutput ONLY a JSON array.';

async function callLLM(systemPrompt, userPrompt) {
  if (LLM_PROVIDER === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + LLM_API_KEY },
      body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], response_format: { type: 'json_object' } }),
    });
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }
  const { GoogleGenAI } = await import('@google/genai');
  const genai = new GoogleGenAI({ apiKey: LLM_API_KEY });
  const result = await genai.models.generateContent({
    model: LLM_MODEL,
    config: { systemInstruction: systemPrompt, responseMimeType: 'application/json' },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  });
  return JSON.parse(result.text);
}

async function generateSpec(catalog, existingSpec) {
  const tablesJson = JSON.stringify(catalog.tables);
  if (existingSpec?.queries) {
    const existingIds = new Set(existingSpec.queries.map(q => q.id));
    const newTables = catalog.tables.filter(t => !existingIds.has(t.short_name));
    if (newTables.length === 0) return null;
    catalog.tables = newTables;
  }
  const spec = await callLLM(SPEC_PROMPT, 'DATA CATALOG:\n' + tablesJson + '\n\nGenerate spec.');
  if (existingSpec?.widgets) {
    const existingIds = new Set(existingSpec.widgets.map(w => w.id));
    for (const w of spec.widgets || []) {
      if (!existingIds.has(w.id)) existingSpec.widgets.push(w);
    }
    return existingSpec;
  }
  return spec;
}

async function generateQueries(widgets, catalog) {
  const tableInfo = {};
  for (const t of catalog.tables) tableInfo[t.short_name] = { columns: t.columns, sample: t.sample?.slice(0, 2) };
  const queries = await callLLM(QUERY_PROMPT, 'WIDGETS:\n' + JSON.stringify(widgets) + '\n\nTABLE INFO:\n' + JSON.stringify(tableInfo) + '\n\nGenerate queries.');
  return Array.isArray(queries) ? queries : (queries.queries || []);
}

// ─── GCS ───

async function saveSpec(orgId, projectId, spec) {
  const storage = new Storage();
  const bucket = storage.bucket(GCS_BUCKET);
  const prefix = 'specs/' + orgId + '/' + projectId;
  await bucket.file(prefix + '/dashboard_spec.json').save(JSON.stringify(spec, null, 2), { contentType: 'application/json' });
  return 'gs://' + GCS_BUCKET + '/' + prefix + '/dashboard_spec.json';
}

async function loadExistingSpec(orgId, projectId) {
  try {
    const storage = new Storage();
    const bucket = storage.bucket(GCS_BUCKET);
    const prefix = 'specs/' + orgId + '/' + projectId;
    const [content] = await bucket.file(prefix + '/dashboard_spec.json').download();
    return JSON.parse(content.toString());
  } catch { return null; }
}

// ─── ENDPOINTS ───

app.post('/generate', async (req, res) => {
  const { orgId, projectId, dataset, forceFull } = req.body;
  if (!orgId || !projectId || !dataset) return res.status(400).json({ error: 'orgId, projectId, dataset required' });
  try {
    console.log('[HARNESS] Generate ' + orgId + '/' + projectId + ' (' + dataset + ')');
    const existing = forceFull ? null : await loadExistingSpec(orgId, projectId);
    const catalog = await discoverData(dataset);
    const spec = await generateSpec(catalog, existing);
    if (!spec) return res.json({ status: 'completed', added: 0, message: 'All tables covered' });
    const queries = await generateQueries(spec.widgets, catalog);
    const existingQids = new Set((existing?.queries || []).map(q => q.id));
    spec.queries = spec.queries || [];
    for (const q of queries) { if (!existingQids.has(q.id)) spec.queries.push(q); }
    const url = await saveSpec(orgId, projectId, spec);
    res.json({ status: 'completed', spec_url: url, widgets: spec.widgets?.length || 0, queries: spec.queries?.length || 0 });
  } catch (err) {
    console.error('[HARNESS]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/discover', async (req, res) => {
  const { dataset } = req.body;
  if (!dataset) return res.status(400).json({ error: 'dataset required' });
  const catalog = await discoverData(dataset);
  res.json(catalog);
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log('Harness Service running on :' + PORT));
