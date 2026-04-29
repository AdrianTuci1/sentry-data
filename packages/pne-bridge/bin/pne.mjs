#!/usr/bin/env node

import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoPackagesDir = resolve(__dirname, '..', '..');
const Module = require('node:module');
const repoPackageMap = {
  '@statsparrot/connector-sdk': resolve(repoPackagesDir, 'connector-sdk', 'dist', 'index.js'),
  '@statsparrot/observability': resolve(repoPackagesDir, 'observability', 'dist', 'index.js'),
  '@statsparrot/pne-core': resolve(repoPackagesDir, 'pne-core', 'dist', 'index.js'),
  '@statsparrot/sentinel-core': resolve(repoPackagesDir, 'sentinel-core', 'dist', 'index.js'),
  '@statsparrot/sentinel-domain-packs': resolve(repoPackagesDir, 'sentinel-domain-packs', 'dist', 'index.js'),
  '@statsparrot/codex-adapter': resolve(repoPackagesDir, 'codex-adapter', 'dist', 'index.js'),
  '@statsparrot/agent-playbooks': resolve(repoPackagesDir, 'agent-playbooks', 'dist', 'index.js'),
  '@statsparrot/widget-contracts': resolve(repoPackagesDir, 'widget-contracts', 'dist', 'index.js'),
  '@statsparrot/ml-contracts': resolve(repoPackagesDir, 'ml-contracts', 'dist', 'index.js'),
  '@statsparrot/powerbi-adapter': resolve(repoPackagesDir, 'powerbi-adapter', 'dist', 'index.js')
};
const vendorPackageMap = {
  '@statsparrot/connector-sdk': resolve(__dirname, '..', 'vendor', 'connector-sdk', 'index.cjs'),
  '@statsparrot/observability': resolve(__dirname, '..', 'vendor', 'observability', 'index.cjs'),
  '@statsparrot/pne-core': resolve(__dirname, '..', 'vendor', 'pne-core', 'index.cjs'),
  '@statsparrot/sentinel-core': resolve(__dirname, '..', 'vendor', 'sentinel-core', 'index.cjs'),
  '@statsparrot/sentinel-domain-packs': resolve(__dirname, '..', 'vendor', 'sentinel-domain-packs', 'index.cjs'),
  '@statsparrot/codex-adapter': resolve(__dirname, '..', 'vendor', 'codex-adapter', 'index.cjs'),
  '@statsparrot/agent-playbooks': resolve(__dirname, '..', 'vendor', 'agent-playbooks', 'index.cjs'),
  '@statsparrot/widget-contracts': resolve(__dirname, '..', 'vendor', 'widget-contracts', 'index.cjs'),
  '@statsparrot/ml-contracts': resolve(__dirname, '..', 'vendor', 'ml-contracts', 'index.cjs'),
  '@statsparrot/powerbi-adapter': resolve(__dirname, '..', 'vendor', 'powerbi-adapter', 'index.cjs')
};
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveLocalStatsParrotPackage(request, parent, isMain, options) {
  if (repoPackageMap[request] && existsSync(repoPackageMap[request])) {
    return repoPackageMap[request];
  }

  if (vendorPackageMap[request] && existsSync(vendorPackageMap[request])) {
    return vendorPackageMap[request];
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const loadPackage = (name, fallback) => {
  try {
    return require(name);
  } catch {
    const vendorPath = resolve(__dirname, '..', 'vendor', fallback, 'index.cjs');
    if (existsSync(vendorPath)) {
      return require(vendorPath);
    }
    return require(resolve(repoPackagesDir, fallback, 'dist', 'index.js'));
  }
};

const {
  createBigQueryConnector,
  createDuckDbConnector,
  createPostgresConnector,
  createSnowflakeConnector,
  createSqlFunctionConnector
} = loadPackage('@statsparrot/connector-sdk', 'connector-sdk');
const { createPNERuntime } = loadPackage('@statsparrot/pne-core', 'pne-core');
const {
  emptySessionState,
  buildFirstRunPlaybook,
  recommendNextSteps,
  planMlModels
} = loadPackage('@statsparrot/agent-playbooks', 'agent-playbooks');
const {
  resolveWidgetContract
} = loadPackage('@statsparrot/widget-contracts', 'widget-contracts');
const {
  buildMlExperimentContract
} = loadPackage('@statsparrot/ml-contracts', 'ml-contracts');
const {
  buildPowerBIQueryDefinition,
  buildPowerBIDatasetDefinition
} = loadPackage('@statsparrot/powerbi-adapter', 'powerbi-adapter');

const PNE_HOME = process.env.PNE_HOME || join(homedir(), '.pne');
const CONFIG_PATH = join(PNE_HOME, 'config.json');
const CACHE_PATH = join(PNE_HOME, 'cache.json');
const SESSION_PATH = join(PNE_HOME, 'session.json');
const PROJECTS_DIR = join(PNE_HOME, 'projects');
const CONTRACTS_DIR = join(PNE_HOME, 'contracts');

const ensureHome = () => mkdirSync(PNE_HOME, { recursive: true });
const ensureDir = (path) => mkdirSync(path, { recursive: true });

const readJson = (path, fallback) => {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
};

const writeJson = (path, value) => {
  ensureHome();
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const loadConfig = () => readJson(CONFIG_PATH, {
  version: 1,
  defaultConnectorId: undefined,
  connectors: {},
  cache: {
    ttlMs: 300000
  }
});

const saveConfig = (config) => writeJson(CONFIG_PATH, config);
const loadSessionState = () => readJson(SESSION_PATH, emptySessionState());
const saveSessionState = (sessionState) => writeJson(SESSION_PATH, {
  ...sessionState,
  lastUpdatedAt: new Date().toISOString()
});

const safePathSegment = (value) => {
  const normalized = String(value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'default';
};

const resolveProjectKey = (payload = {}, connectorId) => safePathSegment(
  payload.projectKey
  || payload.memoryProjectKey
  || payload.projectId
  || connectorId
  || 'default'
);

const getProjectDir = (projectKey) => join(PROJECTS_DIR, safePathSegment(projectKey));
const getProjectMemoryPath = (projectKey) => join(getProjectDir(projectKey), 'memory.json');
const getContractsProjectDir = (projectKey) => join(CONTRACTS_DIR, safePathSegment(projectKey));

const emptyProjectMemory = (projectKey, projectId, connectorId) => ({
  version: 1,
  projectKey,
  projectId: projectId || null,
  connectorId: connectorId || null,
  updatedAt: new Date().toISOString(),
  notes: [],
  recentQuestions: [],
  recentInsights: [],
  contractExports: []
});

const loadProjectMemory = (projectKey, payload = {}, connectorId) => (
  readJson(getProjectMemoryPath(projectKey), emptyProjectMemory(projectKey, payload.projectId, connectorId))
);

const saveProjectMemory = (projectKey, memory) => {
  const projectDir = getProjectDir(projectKey);
  ensureDir(projectDir);
  writeFileSync(getProjectMemoryPath(projectKey), `${JSON.stringify({
    ...memory,
    projectKey,
    updatedAt: new Date().toISOString()
  }, null, 2)}\n`);
};

const listContractVersions = (projectKey, contractType) => {
  const projectDir = getContractsProjectDir(projectKey);
  if (!existsSync(projectDir)) {
    return [];
  }

  const types = contractType
    ? [safePathSegment(contractType)]
    : readdirSync(projectDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

  return types.flatMap((typeName) => {
    const manifestPath = join(projectDir, typeName, 'index.json');
    const manifest = readJson(manifestPath, null);
    const versions = Array.isArray(manifest?.versions) ? manifest.versions : [];
    return versions.map((version) => ({
      contractType: typeName,
      ...version
    }));
  }).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
};

const exportContractArtifact = ({
  projectKey,
  projectId,
  connectorId,
  contractType,
  name,
  artifact,
  metadata,
  outputFile
}) => {
  if (!contractType) {
    throw new Error('Missing contractType for contract export.');
  }
  if (artifact === undefined) {
    throw new Error('Missing artifact for contract export.');
  }

  const safeType = safePathSegment(contractType);
  const safeName = safePathSegment(name || safeType);
  const contractsDir = join(getContractsProjectDir(projectKey), safeType);
  ensureDir(contractsDir);

  const createdAt = new Date().toISOString();
  const versionId = `${createdAt.replace(/[:.]/g, '-')}-${safeName}`;
  const filename = `${versionId}.json`;
  const filePath = join(contractsDir, filename);
  const payload = {
    version: 1,
    projectKey,
    projectId: projectId || null,
    connectorId: connectorId || null,
    contractType,
    name: name || safeType,
    versionId,
    createdAt,
    metadata: metadata || {},
    artifact
  };

  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);

  const manifestPath = join(contractsDir, 'index.json');
  const manifest = readJson(manifestPath, {
    version: 1,
    projectKey,
    contractType,
    updatedAt: createdAt,
    versions: []
  });
  manifest.updatedAt = createdAt;
  manifest.versions = [
    {
      versionId,
      name: payload.name,
      createdAt,
      filePath,
      metadata: payload.metadata
    },
    ...(Array.isArray(manifest.versions) ? manifest.versions : [])
  ].slice(0, 100);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  if (outputFile) {
    const resolvedOutputFile = resolve(String(outputFile));
    ensureDir(dirname(resolvedOutputFile));
    writeFileSync(resolvedOutputFile, `${JSON.stringify(payload, null, 2)}\n`);
  }

  return {
    status: 'exported',
    projectKey,
    contractType,
    versionId,
    createdAt,
    filePath,
    outputFile: outputFile ? resolve(String(outputFile)) : undefined,
    manifestPath
  };
};

const commandExists = (command) => {
  const result = spawnSync(command, ['--help'], {
    stdio: 'ignore',
    shell: false
  });
  if (!result.error) {
    return true;
  }
  return result.error.code !== 'ENOENT' ? true : false;
};

const listConfiguredConnectors = (config = loadConfig()) => (
  Object.entries(config.connectors || {}).map(([connectorId, connector]) => ({
    connectorId,
    type: connector.type,
    engine: connector.engine || connector.type,
    isDefault: connectorId === config.defaultConnectorId
  }))
);

const getSetupGuide = () => ({
  recommendedFlow: [
    'Check local prerequisites and available connector recipes.',
    'Choose hosted, BigQuery, DuckDB-on-R2, DuckDB local, Postgres or Snowflake.',
    'Configure the connector through PNE tools or CLI.',
    'Run a connector test to confirm introspection works.',
    'Inspect sources and snapshots before asking analytical questions.'
  ],
  recipes: [
    {
      connectorType: 'hosted',
      title: 'Hosted StatsParrot control plane',
      required: ['endpoint'],
      optional: ['apiKey', 'apiBaseUrl', 'workspaceId'],
      commands: [
        'pne connect hosted --id hosted --endpoint https://your-host/analyze --api-key "$PNE_API_KEY"',
        'pne tool pne_get_environment_status'
      ]
    },
    {
      connectorType: 'bigquery',
      title: 'BigQuery via bq CLI',
      required: ['project'],
      optional: ['dataset', 'location'],
      prerequisites: ['bq CLI', 'gcloud auth application-default login or bq auth'],
      commands: [
        'pne connect bigquery --id bq --project my-project --dataset ecommerce',
        'pne tool pne_test_connector'
      ]
    },
    {
      connectorType: 'duckdb-r2',
      title: 'Direct R2 / S3-style parquet querying through DuckDB',
      required: ['one or more source specs (table + uri)'],
      optional: ['database', 'endpoint', 'region', 'accessKeyId', 'secretAccessKey', 'sessionToken', 'tablesJson', 'specFile'],
      prerequisites: ['python3 with the duckdb module', 'R2 credentials or environment variables'],
      commands: [
        'pne connect duckdb-r2 --id r2 --database ./.pne/pne-r2.duckdb --table raw_data --uri "s3://bucket/path/**/*.parquet" --endpoint https://<account>.r2.cloudflarestorage.com --region auto',
        'pne connect duckdb-r2 --id r2 --tables-json \'[{"table":"olist_orders","uri":"s3://bucket/orders/**/*.parquet"},{"table":"olist_reviews","uri":"s3://bucket/reviews/**/*.parquet"}]\'',
        'pne tool pne_test_connector'
      ]
    },
    {
      connectorType: 'duckdb',
      title: 'DuckDB local database',
      required: ['database'],
      optional: ['tables'],
      prerequisites: ['duckdb CLI'],
      commands: [
        'pne connect duckdb --id local-duck --database ./warehouse.duckdb',
        'pne tool pne_test_connector'
      ]
    },
    {
      connectorType: 'postgres',
      title: 'Postgres via psql',
      required: ['connectionString'],
      optional: ['schema', 'tables'],
      prerequisites: ['psql CLI'],
      commands: [
        'pne connect postgres --id app-db --connection-string postgresql://user:pass@host:5432/db',
        'pne tool pne_test_connector'
      ]
    },
    {
      connectorType: 'snowflake',
      title: 'Snowflake via snowsql',
      required: ['database', 'schema'],
      optional: ['connectionName', 'warehouse', 'role', 'tables'],
      prerequisites: ['snowsql CLI'],
      commands: [
        'pne connect snowflake --id snow --connection analytics --database RAW --schema PUBLIC',
        'pne tool pne_test_connector'
      ]
    }
  ]
});

const getLocalPrerequisites = () => ({
  binaries: {
    node: commandExists('node'),
    python3: commandExists('python3'),
    bq: commandExists('bq'),
    duckdb: commandExists('duckdb'),
    psql: commandExists('psql'),
    snowsql: commandExists('snowsql')
  },
  env: {
    PNE_ENDPOINT: Boolean(process.env.PNE_ENDPOINT),
    PNE_API_KEY: Boolean(process.env.PNE_API_KEY),
    R2_ENDPOINT: Boolean(process.env.R2_ENDPOINT),
    R2_ACCESS_KEY_ID: Boolean(process.env.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY: Boolean(process.env.R2_SECRET_ACCESS_KEY),
    R2_REGION: Boolean(process.env.R2_REGION)
  }
});

const parseArgs = (args) => {
  const parsed = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      parsed._.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }
  return parsed;
};

const normalizeDuckDbR2SourceSpecs = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => {
    const table = item?.table || item?.tableId || item?.id;
    const uri = item?.uri;
    if (!table || !uri) {
      throw new Error(`DuckDB R2 source at index ${index} is missing table/tableId or uri.`);
    }
    return {
      table: String(table).trim(),
      name: String(item?.name || item?.displayName || table).trim(),
      uri: String(uri)
    };
  });
};

const parseDuckDbR2SourceSpecs = (args) => {
  if (Array.isArray(args.sources)) {
    return normalizeDuckDbR2SourceSpecs(args.sources);
  }

  if (Array.isArray(args.tables) && typeof args.tables[0] === 'object') {
    return normalizeDuckDbR2SourceSpecs(args.tables);
  }

  if (args['spec-file']) {
    const payload = readJson(resolve(args['spec-file']), []);
    const items = Array.isArray(payload) ? payload : payload.tables || payload.sources || [];
    return normalizeDuckDbR2SourceSpecs(items);
  }

  if (args['tables-json']) {
    const payload = JSON.parse(String(args['tables-json']));
    const items = Array.isArray(payload) ? payload : payload.tables || payload.sources || [];
    return normalizeDuckDbR2SourceSpecs(items);
  }

  if (args.table && args.uri) {
    return normalizeDuckDbR2SourceSpecs([{
      table: args.table,
      name: args.name || args.table,
      uri: args.uri
    }]);
  }

  return [];
};

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
};

const runCommand = (command, input) => new Promise((resolvePromise, reject) => {
  const child = spawn(command, {
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  child.on('error', reject);
  child.on('close', (code) => {
    const out = Buffer.concat(stdout).toString('utf8').trim();
    const err = Buffer.concat(stderr).toString('utf8').trim();
    if (code !== 0) {
      reject(new Error(err || `Command failed: ${command}`));
      return;
    }
    resolvePromise(out);
  });
  child.stdin.end(input ? JSON.stringify(input) : '');
});

const runExecutable = (command, args = [], input, extraEnv = {}) => new Promise((resolvePromise, reject) => {
  const child = spawn(command, args, {
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...extraEnv
    }
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  child.on('error', reject);
  child.on('close', (code) => {
    const out = Buffer.concat(stdout).toString('utf8').trim();
    const err = Buffer.concat(stderr).toString('utf8').trim();
    if (code !== 0) {
      reject(new Error(err || `Command failed: ${command}`));
      return;
    }
    resolvePromise(out);
  });
  child.stdin.end(
    input
      ? (typeof input === 'string' ? input : JSON.stringify(input))
      : ''
  );
});

const getCache = () => readJson(CACHE_PATH, {});

const setCacheValue = (key, value, ttlMs) => {
  const cache = getCache();
  cache[key] = {
    value,
    expiresAt: Date.now() + ttlMs
  };
  writeJson(CACHE_PATH, cache);
};

const getCacheValue = (key) => {
  const cache = getCache();
  const entry = cache[key];
  if (!entry || entry.expiresAt < Date.now()) {
    return undefined;
  }
  return entry.value;
};

const setResourceSnapshot = (connectorId, sources) => {
  const cache = getCache();
  cache.resourceSnapshots = cache.resourceSnapshots || {};
  const snapshot = {
    version: `${Date.now()}`,
    sourceCount: Array.isArray(sources) ? sources.length : 0,
    updatedAt: new Date().toISOString(),
    sources
  };
  cache.resourceSnapshots[connectorId] = snapshot;
  writeJson(CACHE_PATH, cache);
  return snapshot;
};

const getResourceSnapshot = (connectorId) => {
  const cache = getCache();
  return cache.resourceSnapshots?.[connectorId];
};

const resolveConnectorConfig = (config, connectorId) => {
  const id = connectorId || config.defaultConnectorId;
  if (!id || !config.connectors[id]) {
    throw new Error('No connector configured. Run `pne connect profile`, `pne connect custom`, or `pne connect hosted` first.');
  }
  return { id, connector: config.connectors[id] };
};

const readProfilesFromFile = (file) => {
  const payload = readJson(resolve(file), []);
  return Array.isArray(payload) ? payload : payload.sources || payload.tables || [];
};

let widgetCatalogEntriesPromise;
const loadWidgetCatalogEntries = async () => {
  if (!widgetCatalogEntriesPromise) {
    widgetCatalogEntriesPromise = (async () => {
      const candidates = [
        resolve(repoPackagesDir, '..', 'r2-system', 'widgets', 'index.js'),
        resolve(__dirname, '..', 'widgets', 'index.js')
      ];
      const path = candidates.find((candidate) => existsSync(candidate));
      if (!path) {
        return [];
      }

      const module = await import(`file://${path}`);
      if (Array.isArray(module.widgetManifestIndex)) {
        return module.widgetManifestIndex;
      }
      if (typeof module.getWidgetCatalogEntries === 'function') {
        return module.getWidgetCatalogEntries();
      }
      return [];
    })();
  }
  return widgetCatalogEntriesPromise;
};

const resolveDuckDbR2BridgeScriptPath = () => {
  const packagedPath = resolve(__dirname, '..', 'scripts', 'pne_duckdb_r2.py');
  if (existsSync(packagedPath)) {
    return packagedPath;
  }

  const repoPath = resolve(repoPackagesDir, '..', 'scripts', 'pne_duckdb_r2.py');
  if (existsSync(repoPath)) {
    return repoPath;
  }

  throw new Error('DuckDB R2 bridge script is missing. Expected packages/pne-bridge/scripts/pne_duckdb_r2.py.');
};

const getDuckDbR2SourceSpecs = (connectorConfig) => (
  normalizeDuckDbR2SourceSpecs(
    connectorConfig.sourceSpecs
    || connectorConfig.tables?.map((tableId, index) => ({
      table: tableId,
      name: tableId,
      uri: connectorConfig.virtualTables?.[index]?.metadata?.uri
    }))
    || []
  )
);

const writeDuckDbR2SpecFile = (connectorId, connectorConfig) => {
  ensureHome();
  const specsDir = join(PNE_HOME, 'generated');
  mkdirSync(specsDir, { recursive: true });
  const path = join(specsDir, `${connectorId || 'default'}-duckdb-r2-spec.json`);
  const sourceSpecs = getDuckDbR2SourceSpecs(connectorConfig);
  if (!sourceSpecs.length) {
    throw new Error('DuckDB R2 connector has no source specs configured.');
  }
  writeFileSync(path, `${JSON.stringify({ tables: sourceSpecs }, null, 2)}\n`);
  return path;
};

const buildDuckDbR2BridgeEnv = (connectorConfig) => ({
  ...(connectorConfig.endpoint ? { R2_ENDPOINT: connectorConfig.endpoint } : {}),
  ...(connectorConfig.region ? { R2_REGION: connectorConfig.region } : {}),
  ...(connectorConfig.accessKeyId ? { R2_ACCESS_KEY_ID: connectorConfig.accessKeyId } : {}),
  ...(connectorConfig.secretAccessKey ? { R2_SECRET_ACCESS_KEY: connectorConfig.secretAccessKey } : {}),
  ...(connectorConfig.sessionToken ? { R2_SESSION_TOKEN: connectorConfig.sessionToken } : {})
});

const runDuckDbR2Bridge = async (mode, connectorId, connectorConfig, input) => {
  const pythonCommand = connectorConfig.pythonCommand || 'python3';
  const scriptPath = resolveDuckDbR2BridgeScriptPath();
  const specPath = writeDuckDbR2SpecFile(connectorId, connectorConfig);
  const output = await runExecutable(
    pythonCommand,
    [scriptPath, mode, '--spec-file', specPath],
    input,
    buildDuckDbR2BridgeEnv(connectorConfig)
  );
  return output ? JSON.parse(output) : {};
};

const introspectDuckDbR2 = async (connectorId, connectorConfig) => {
  const payload = await runDuckDbR2Bridge('introspect', connectorId, connectorConfig);
  return Array.isArray(payload) ? payload : payload.sources || payload.tables || [];
};

const toPneSources = (sources) => sources.map((source) => ({
  sourceId: source.sourceId || source.tableId || source.id,
  sourceName: source.sourceName || source.displayName || source.name || source.tableId || source.id,
  engine: source.engine || 'custom',
  tableId: source.tableId,
  uri: source.uri,
  domain: source.domain || source.metadata?.domain,
  columns: source.columns || [],
  metricCandidates: source.metricCandidates || [],
  entityKeyCandidates: source.entityKeyCandidates || [],
  timestampCandidates: source.timestampCandidates || [],
  sampleRows: source.sampleRows || [],
  metadata: source.metadata || {}
})).filter((source) => source.sourceId);

const makeConnector = (connectorConfig) => {
  if (connectorConfig.type === 'profile') {
    return createSqlFunctionConnector({
      engine: connectorConfig.engine || 'custom',
      tables: readProfilesFromFile(connectorConfig.profileFile),
      executeSql: async (request) => ({
        requestId: request.requestId,
        rows: [],
        rowCount: 0,
        error: {
          code: 'profile_connector_read_only',
          message: 'Profile connector has no query command. Add a custom connector with --query-cmd to execute SQL.'
        }
      })
    });
  }

  if (connectorConfig.type === 'custom') {
    return createSqlFunctionConnector({
      engine: connectorConfig.engine || 'custom',
      tables: connectorConfig.profileFile ? readProfilesFromFile(connectorConfig.profileFile) : [],
      dryRunSql: async () => ({ warnings: connectorConfig.queryCmd ? [] : ['query_cmd_not_configured'] }),
      executeSql: async (request) => {
        if (!connectorConfig.queryCmd) {
          return {
            requestId: request.requestId,
            rows: [],
            rowCount: 0,
            error: {
              code: 'query_cmd_not_configured',
              message: 'Custom connector requires queryCmd.'
            }
          };
        }
        const output = await runCommand(connectorConfig.queryCmd, request);
        const parsed = output ? JSON.parse(output) : {};
        const rows = Array.isArray(parsed) ? parsed : parsed.rows || [];
        return {
          requestId: parsed.requestId || request.requestId,
          rows,
          rowCount: parsed.rowCount ?? rows.length,
          elapsedMs: parsed.elapsedMs,
          bytesProcessed: parsed.bytesProcessed,
          error: parsed.error
        };
      }
    });
  }

  if (connectorConfig.type === 'bigquery') {
    return createBigQueryConnector({
      projectId: connectorConfig.project,
      datasetId: connectorConfig.dataset,
      location: connectorConfig.location,
      command: connectorConfig.command || 'bq'
    });
  }

  if (connectorConfig.type === 'duckdb') {
    return createDuckDbConnector({
      databasePath: connectorConfig.databasePath,
      command: connectorConfig.command || 'duckdb',
      tables: connectorConfig.tables,
      bootstrapSql: connectorConfig.bootstrapSql,
      virtualTables: connectorConfig.virtualTables
    });
  }

  if (connectorConfig.type === 'duckdb-r2') {
    return {
      engine: 'duckdb',
      introspect: async () => introspectDuckDbR2('default', connectorConfig),
      sample: async (tableId, limit = 20) => {
        const result = await runDuckDbR2Bridge('query', 'default', connectorConfig, {
          requestId: `sample-${Date.now()}`,
          sql: `SELECT * FROM ${tableId} LIMIT ${limit}`,
          maxRows: limit
        });
        return Array.isArray(result.rows) ? result.rows : [];
      },
      dryRun: async () => ({
        warnings: ['duckdb_r2_python_bridge_no_dry_run']
      }),
      execute: async (request) => {
        const result = await runDuckDbR2Bridge('query', 'default', connectorConfig, request);
        const rows = Array.isArray(result.rows) ? result.rows : [];
        return {
          requestId: result.requestId || request.requestId,
          rows,
          rowCount: result.rowCount ?? rows.length,
          elapsedMs: result.elapsedMs,
          bytesProcessed: result.bytesProcessed,
          error: result.error
        };
      }
    };
  }

  if (connectorConfig.type === 'postgres') {
    return createPostgresConnector({
      connectionString: connectorConfig.connectionString,
      schema: connectorConfig.schema,
      command: connectorConfig.command || 'psql',
      tables: connectorConfig.tables
    });
  }

  if (connectorConfig.type === 'snowflake') {
    return createSnowflakeConnector({
      connectionName: connectorConfig.connectionName,
      database: connectorConfig.database,
      schema: connectorConfig.schema,
      warehouse: connectorConfig.warehouse,
      role: connectorConfig.role,
      command: connectorConfig.command || 'snowsql',
      tables: connectorConfig.tables
    });
  }

  throw new Error(`Connector type ${connectorConfig.type} is not supported locally.`);
};

const buildDuckDbR2BootstrapSql = (connectorConfig) => {
  const statements = [
    'INSTALL httpfs',
    'LOAD httpfs'
  ];
  const region = connectorConfig.region || process.env.R2_REGION || 'auto';
  const endpoint = connectorConfig.endpoint || process.env.R2_ENDPOINT;
  const accessKeyId = connectorConfig.accessKeyId || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = connectorConfig.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
  const sessionToken = connectorConfig.sessionToken || process.env.R2_SESSION_TOKEN;

  if (region) statements.push(`SET s3_region='${String(region).replace(/'/g, "''")}'`);
  if (endpoint) statements.push(`SET s3_endpoint='${String(endpoint).replace(/^https?:\/\//, '').replace(/'/g, "''")}'`);
  if (accessKeyId) statements.push(`SET s3_access_key_id='${String(accessKeyId).replace(/'/g, "''")}'`);
  if (secretAccessKey) statements.push(`SET s3_secret_access_key='${String(secretAccessKey).replace(/'/g, "''")}'`);
  if (sessionToken) statements.push(`SET s3_session_token='${String(sessionToken).replace(/'/g, "''")}'`);
  statements.push(`SET s3_url_style='${connectorConfig.urlStyle || 'path'}'`);
  statements.push(`SET s3_use_ssl=${connectorConfig.useSsl === false ? 'false' : 'true'}`);

  return statements;
};

const buildConnectorConfig = (type, args) => {
  const id = args.id || type;
  if (type === 'profile') {
    if (!args.file) throw new Error('Missing --file for profile connector.');
    return {
      id,
      connector: {
        type: 'profile',
        engine: args.engine || 'custom',
        profileFile: resolve(args.file)
      }
    };
  }

  if (type === 'custom') {
    if (!args['profile-file'] && !args['query-cmd']) {
      throw new Error('Custom connector needs --profile-file, --query-cmd, or both.');
    }
    return {
      id,
      connector: {
        type: 'custom',
        engine: args.engine || 'custom',
        profileFile: args['profile-file'] ? resolve(args['profile-file']) : undefined,
        queryCmd: args['query-cmd'],
        introspectCmd: args['introspect-cmd']
      }
    };
  }

  if (type === 'hosted') {
    if (!args.endpoint) throw new Error('Missing --endpoint for hosted connector.');
    return {
      id,
      connector: {
        type: 'hosted',
        endpoint: args.endpoint,
        apiKey: args['api-key'] || process.env.PNE_API_KEY,
        apiBaseUrl: args['api-base-url'],
        workspaceId: args['workspace-id']
      }
    };
  }

  if (type === 'bigquery') {
    if (!args.project) throw new Error('Missing --project for BigQuery connector.');
    return {
      id,
      connector: {
        type: 'bigquery',
        engine: 'bigquery',
        project: args.project,
        dataset: args.dataset,
        location: args.location,
        command: args.command || 'bq'
      }
    };
  }

  if (type === 'duckdb') {
    if (!args.database) throw new Error('Missing --database for DuckDB connector.');
    return {
      id,
      connector: {
        type: 'duckdb',
        engine: 'duckdb',
        databasePath: resolve(args.database),
        command: args.command || 'duckdb',
        tables: args.tables ? String(args.tables).split(',').map((item) => item.trim()).filter(Boolean) : undefined
      }
    };
  }

  if (type === 'duckdb-r2') {
    const sourceSpecs = parseDuckDbR2SourceSpecs(args);
    if (!sourceSpecs.length) {
      throw new Error('DuckDB R2 connector requires --table/--uri, --tables-json, --spec-file, or structured sources.');
    }
    const connector = {
      type: 'duckdb-r2',
      engine: 'duckdb',
      adapter: 'python-bridge',
      databasePath: resolve(args.database || join(PNE_HOME, `${id}.duckdb`)),
      command: args.command || 'duckdb',
      pythonCommand: args['python-command'] || 'python3',
      endpoint: args.endpoint || process.env.R2_ENDPOINT,
      region: args.region || process.env.R2_REGION || 'auto',
      accessKeyId: args['access-key-id'] || process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: args['secret-access-key'] || process.env.R2_SECRET_ACCESS_KEY,
      sessionToken: args['session-token'] || process.env.R2_SESSION_TOKEN,
      urlStyle: args['url-style'] || 'path',
      useSsl: args['use-ssl'] !== 'false',
      sourceSpecs,
      tables: sourceSpecs.map((spec) => spec.table),
      virtualTables: sourceSpecs.map((spec) => ({
        tableId: spec.table,
        sql: `SELECT * FROM read_parquet('${String(spec.uri).replace(/'/g, "''")}')`,
        displayName: spec.name,
        metadata: {
          uri: spec.uri,
          storage: 'r2'
        }
      }))
    };
    connector.bootstrapSql = buildDuckDbR2BootstrapSql(connector);
    return { id, connector };
  }

  if (type === 'postgres') {
    if (!args['connection-string']) throw new Error('Missing --connection-string for Postgres connector.');
    return {
      id,
      connector: {
        type: 'postgres',
        engine: 'postgres',
        connectionString: args['connection-string'],
        schema: args.schema || 'public',
        command: args.command || 'psql',
        tables: args.tables ? String(args.tables).split(',').map((item) => item.trim()).filter(Boolean) : undefined
      }
    };
  }

  if (type === 'snowflake') {
    if (!args.database || !args.schema) throw new Error('Missing --database or --schema for Snowflake connector.');
    return {
      id,
      connector: {
        type: 'snowflake',
        engine: 'snowflake',
        connectionName: args.connection,
        database: args.database,
        schema: args.schema,
        warehouse: args.warehouse,
        role: args.role,
        command: args.command || 'snowsql',
        tables: args.tables ? String(args.tables).split(',').map((item) => item.trim()).filter(Boolean) : undefined
      }
    };
  }

  throw new Error(`Unknown connector type: ${type}`);
};

const callHosted = async (connectorConfig, request) => {
  const response = await fetch(connectorConfig.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(connectorConfig.apiKey ? { Authorization: `Bearer ${connectorConfig.apiKey}` } : {})
    },
    body: JSON.stringify(request)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `PNE hosted request failed with ${response.status}`);
  return payload;
};

const normalizeApiBaseUrl = (connectorConfig) => {
  const explicit = connectorConfig.apiBaseUrl || connectorConfig['api-base-url'];
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  if (!connectorConfig.endpoint) {
    throw new Error('Hosted connector is missing endpoint/api base URL.');
  }

  const trimmed = connectorConfig.endpoint.replace(/\/$/, '').replace(/\/analyze$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const fetchHostedControlPlane = async (connectorConfig, path, options = {}) => {
  const baseUrl = normalizeApiBaseUrl(connectorConfig);
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(connectorConfig.apiKey ? { Authorization: `Bearer ${connectorConfig.apiKey}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Hosted control plane request failed with ${response.status}`);
  }
  return payload?.data ?? payload;
};

const summarizeProjectStatus = async (connectorConfig, projectId) => {
  const project = await fetchHostedControlPlane(connectorConfig, `/projects/${projectId}`);
  const sources = await fetchHostedControlPlane(connectorConfig, `/projects/${projectId}/sources`).catch(() => []);
  const lineage = await fetchHostedControlPlane(connectorConfig, `/projects/${projectId}/lineage`).catch(() => ({}));
  const formulas = await fetchHostedControlPlane(connectorConfig, `/projects/${projectId}/runtime/code-formulas`).catch(() => ({ formulas: [] }));

  const discovery = lineage || project.discoveryMetadata || {};
  const projectionSpecs = discovery.projectionSpecs || discovery.projectionPlan?.projectionSpecs || [];
  const querySpecs = discovery.querySpecs || discovery.projectionPlan?.querySpecs || [];
  const mlRecommendations = discovery.mlRecommendations || discovery.projectionPlan?.mlRecommendations || [];
  const queryConfigs = Array.isArray(project.queryConfigs) ? project.queryConfigs : [];

  return {
    projectId: project.projectId,
    name: project.name,
    workspaceId: project.workspaceId,
    runtimeMode: project.runtimeMode,
    sourceCount: Array.isArray(sources) ? sources.length : 0,
    hasSources: Array.isArray(sources) && sources.length > 0,
    analyzed: Boolean(project.discoveryMetadata || (Array.isArray(querySpecs) && querySpecs.length > 0)),
    projectionCount: projectionSpecs.length,
    queryCount: querySpecs.length,
    queryConfigCount: queryConfigs.length,
    mlRecommendationCount: Array.isArray(mlRecommendations) ? mlRecommendations.length : 0,
    formulaCount: Array.isArray(formulas.formulas) ? formulas.formulas.length : 0,
    runtimeVitals: project.runtimeVitals || null,
    metadataArtifacts: discovery.metadataArtifacts || null
  };
};

const getEnvironmentStatus = async (connectorConfig, input = {}) => {
  const config = existsSync(CONFIG_PATH) ? loadConfig() : null;
  const configuredConnectors = config ? listConfiguredConnectors(config) : [];
  if (!connectorConfig || connectorConfig.type !== 'hosted') {
    return {
      mode: 'local',
      connectorConfigured: Boolean(connectorConfig),
      configuredConnectors,
      connectors: connectorConfig ? [{
        type: connectorConfig.type,
        engine: connectorConfig.engine || connectorConfig.type
      }] : [],
      workspaceCount: 0,
      projectCount: 0,
      analyzedProjectCount: 0,
      message: connectorConfig
        ? 'Local or BYO connector is configured. Workspace and project inventory is available in hosted mode.'
        : 'No connector is configured yet.'
    };
  }

  const workspaces = await fetchHostedControlPlane(connectorConfig, '/workspaces').catch(() => []);
  const workspaceId = input.workspaceId
    || connectorConfig.workspaceId
    || (Array.isArray(workspaces) && workspaces[0]?.workspaceId);
  const projects = workspaceId
    ? await fetchHostedControlPlane(connectorConfig, `/projects?workspaceId=${encodeURIComponent(workspaceId)}`).catch(() => [])
    : [];
  const analyzedProjectCount = (Array.isArray(projects) ? projects : []).filter((project) => (
    Boolean(project.discoveryMetadata)
    || (Array.isArray(project.queryConfigs) && project.queryConfigs.length > 0)
    || Boolean(project.runtimeVitals?.lastRunAt)
  )).length;

  return {
    mode: 'hosted',
    connectorConfigured: true,
    configuredConnectors,
    workspaceCount: Array.isArray(workspaces) ? workspaces.length : 0,
    activeWorkspaceId: workspaceId || null,
    projectCount: Array.isArray(projects) ? projects.length : 0,
    analyzedProjectCount,
    workspaces: Array.isArray(workspaces) ? workspaces.map((workspace) => ({
      workspaceId: workspace.workspaceId,
      name: workspace.name,
      plan: workspace.plan,
      status: workspace.status
    })) : [],
    projects: Array.isArray(projects) ? projects.map((project) => ({
      projectId: project.projectId,
      name: project.name,
      workspaceId: project.workspaceId,
      runtimeMode: project.runtimeMode,
      hasDiscoveryMetadata: Boolean(project.discoveryMetadata),
      hasQueryConfigs: Array.isArray(project.queryConfigs) && project.queryConfigs.length > 0,
      lastRunAt: project.runtimeVitals?.lastRunAt || null
    })) : []
  };
};

const listRuntimeRequests = async (connectorConfig, projectId) => (
  fetchHostedControlPlane(connectorConfig, `/projects/${projectId}/runtime/requests`)
);

const summarizeRuntimeRequestStatus = (payload) => {
  const progressFile = payload?.progressFile || {};
  const status = progressFile.status || payload?.status || 'unknown';
  const lastCompletedStage = progressFile.last_completed_stage || null;
  const terminal = Boolean(payload?.terminal || status === 'completed' || status === 'error');
  const artifacts = progressFile.artifacts || {};
  const availableArtifacts = Object.entries(artifacts)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);

  return {
    projectId: payload?.projectId || null,
    requestId: payload?.requestId || progressFile.request_id || null,
    status,
    terminal,
    lastCompletedStage,
    updatedAt: progressFile.updated_at || null,
    warnings: Array.isArray(progressFile.warnings) ? progressFile.warnings : [],
    errors: Array.isArray(progressFile.errors) ? progressFile.errors : [],
    sourceFingerprint: progressFile.source_fingerprint || null,
    translatorVersion: progressFile.translator_version || null,
    availableArtifacts,
    recommendedPollAfterMs: terminal ? null : 2500,
    runtimeVitals: payload?.runtimeVitals || null,
    parrotRuntime: payload?.parrotRuntime || null,
    raw: payload
  };
};

const pollRuntimeRequest = async (connectorConfig, projectId, requestId) => {
  const requestInventory = await listRuntimeRequests(connectorConfig, projectId);
  const requestIds = Array.isArray(requestInventory?.requestIds)
    ? requestInventory.requestIds
    : Array.isArray(requestInventory)
      ? requestInventory
      : [];
  const resolvedRequestId = requestId || requestIds[0];

  if (!resolvedRequestId) {
    return {
      projectId,
      requestId: null,
      status: 'no_runtime_requests',
      terminal: true,
      lastCompletedStage: null,
      recommendedPollAfterMs: null,
      availableArtifacts: [],
      requestIds,
      runtimeVitals: requestInventory?.runtimeVitals || null,
      parrotRuntime: requestInventory?.parrotRuntime || null
    };
  }

  const statusPayload = await fetchHostedControlPlane(
    connectorConfig,
    `/projects/${projectId}/runtime/requests/${resolvedRequestId}`
  );

  return {
    ...summarizeRuntimeRequestStatus(statusPayload),
    requestIds
  };
};

const configurationMissingResponse = (requestId = `pne-${Date.now()}`) => ({
  requestId,
  answer: 'PNE is not connected to a warehouse yet. Run `pne connect profile`, `pne connect custom`, `pne connect hosted`, or set PNE_ENDPOINT for hosted mode.',
  sql: [],
  evidence: [],
  caveats: ['No local connector or hosted PNE endpoint is configured.'],
  followUps: [
    'Do you want to connect a hosted PNE endpoint, a local profile file, or a custom query command?'
  ],
  nextActions: [
    {
      type: 'connect_warehouse',
      message: 'Connect a hosted endpoint, profiled source file, or custom query engine before asking analytical questions.'
    }
  ],
  agentPackage: {
    status: 'needs_connection',
    nextActions: [
      {
        type: 'connect_warehouse',
        message: 'Connect a hosted endpoint, profiled source file, or custom query engine before asking analytical questions.'
      }
    ]
  },
  raw: {
    status: 'configuration_missing'
  }
});

const getBridgeCapabilities = (connectorConfig) => ({
  transport: ['cli', 'mcp', 'http'],
  modes: ['answer', 'explore', 'dashboard', 'sql', 'diagnose'],
  toolCalling: {
    supported: true,
    tools: [
      'pne_get_capabilities',
      'pne_get_setup_guide',
      'pne_check_local_prerequisites',
      'pne_list_configured_connectors',
      'pne_configure_connector',
      'pne_test_connector',
      'pne_get_session_state',
      'pne_reset_session_state',
      'pne_get_first_run_playbook',
      'pne_get_project_memory',
      'pne_update_project_memory',
      'pne_reset_project_memory',
      'pne_get_recommended_next_steps',
      'pne_plan_ml_model',
      'pne_build_ml_experiment_contract',
      'pne_export_contract',
      'pne_list_contract_versions',
      'pne_execute_sql',
      'pne_get_widget_catalog',
      'pne_resolve_widget_contract',
      'pne_build_powerbi_query',
      'pne_build_powerbi_dataset',
      'pne_get_account_snapshot',
      'pne_get_environment_status',
      'pne_get_connector_catalog',
      'pne_list_workspaces',
      'pne_create_workspace',
      'pne_get_workspace_detail',
      'pne_get_workspace_members',
      'pne_get_workspace_invitations',
      'pne_create_workspace_invitation',
      'pne_get_workspace_activity',
      'pne_list_projects',
      'pne_create_project',
      'pne_update_project',
      'pne_get_project_status',
      'pne_list_project_share_links',
      'pne_create_project_share_link',
      'pne_list_sources',
      'pne_list_project_sources',
      'pne_add_project_source',
      'pne_delete_project_source',
      'pne_discover_project_sources',
      'pne_get_project_lineage',
      'pne_get_project_analytics',
      'pne_get_project_formulas',
      'pne_get_project_overrides',
      'pne_create_project_override',
      'pne_list_project_recommendations',
      'pne_train_project_recommendation',
      'pne_run_project_runtime',
      'pne_list_runtime_requests',
      'pne_get_runtime_request_status',
      'pne_get_runtime_request_artifacts',
      'pne_poll_runtime_request',
      'pne_check_project_updates',
      'pne_record_sentinel_feedback',
      'pne_get_dashboard_data',
      'pne_get_dashboard_manifest',
      'pne_get_dashboard_widget_data',
      'pne_reload_widget_registry',
      'pne_preview_workspace_invitation',
      'pne_accept_workspace_invitation',
      'pne_get_shared_project',
      'pne_analyze_question',
      'pne_get_resource_snapshot'
    ]
  },
  runtime: {
    localDeterministic: true,
    hostedDelegation: Boolean(process.env.PNE_ENDPOINT || connectorConfig?.type === 'hosted'),
    widgetPlanningHostedOnly: true
  },
  dataAccess: {
    liveTimeWindowQueries: true,
    explicitSqlExecution: true,
    federatedCrossConnectorExecution: false,
    customConnectorCommands: true
  },
  connector: connectorConfig
    ? {
      type: connectorConfig.type,
      engine: connectorConfig.engine || connectorConfig.type,
      configured: true
    }
    : {
      configured: false
    },
  cache: {
    path: CACHE_PATH,
    configPath: CONFIG_PATH
  }
});

const buildAnalysisRequest = async (input, fallbackConnectorId) => {
  const config = existsSync(CONFIG_PATH) ? loadConfig() : null;
  const connectorId = input.connectorId || fallbackConnectorId;
  const connectorResolution = config && (connectorId || config.defaultConnectorId)
    ? resolveConnectorConfig(config, connectorId)
    : null;
  const sources = input.sources?.length
    ? input.sources
    : connectorResolution
      ? await listSources(connectorResolution.id)
      : [];

  return {
    connectorResolution,
    request: {
      requestId: input.requestId || `pne-${Date.now()}`,
      question: input.question,
      mode: input.mode || 'answer',
      domain: input.domain,
      sources,
      conversation: input.conversation,
      hostContext: input.hostContext,
      interpretedIntent: input.interpretedIntent,
      constraints: input.constraints,
      executeQueries: input.executeQueries === true
    }
  };
};

const runAnalysisRequest = async (input, fallbackConnectorId) => {
  const { connectorResolution, request } = await buildAnalysisRequest(input, fallbackConnectorId);
  if (!request.question) {
    throw new Error('Missing question.');
  }

  if (!connectorResolution) {
    if (request.sources?.length) {
      const runtime = createPNERuntime({
        connector: createSqlFunctionConnector({
          engine: request.sources[0]?.engine || 'custom',
          tables: [],
          executeSql: async (queryRequest) => ({
            requestId: queryRequest.requestId,
            rows: [],
            rowCount: 0,
            error: {
              code: 'ad_hoc_sources_read_only',
              message: 'Ad hoc sources without a configured connector can plan analysis but cannot execute SQL.'
            }
          })
        }),
        executeQueries: false
      });
      const result = await runtime.analyze(request);
      recordAnalysisInProjectMemory(input, fallbackConnectorId, result);
      return result;
    }

    if (!process.env.PNE_ENDPOINT) {
      return configurationMissingResponse(request.requestId);
    }
    return callHosted({
      endpoint: process.env.PNE_ENDPOINT,
      apiKey: process.env.PNE_API_KEY
    }, request);
  }

  const { connector: connectorConfig } = connectorResolution;
  if (connectorConfig.type === 'hosted') {
    const result = await callHosted(connectorConfig, request);
    recordAnalysisInProjectMemory(input, connectorResolution.id, result);
    return result;
  }

  const runtime = createPNERuntime({
    connector: makeConnector(connectorConfig),
    executeQueries: request.executeQueries
  });
  const result = await runtime.analyze(request);
  recordAnalysisInProjectMemory(input, connectorResolution.id, result);
  return result;
};

const executeSqlRequest = async (input, fallbackConnectorId) => {
  const config = existsSync(CONFIG_PATH) ? loadConfig() : null;
  const connectorId = input.connectorId || fallbackConnectorId;
  const connectorResolution = config && (connectorId || config?.defaultConnectorId)
    ? resolveConnectorConfig(config, connectorId)
    : null;

  if (!input.sql) {
    throw new Error('Missing sql.');
  }

  if (!connectorResolution) {
    throw new Error('No connector configured for SQL execution.');
  }

  if (connectorResolution.connector.type === 'hosted') {
    return callHosted(connectorResolution.connector, {
      requestId: input.requestId || `pne-sql-${Date.now()}`,
      mode: 'sql',
      question: input.question || 'Execute explicit SQL query.',
      sql: input.sql,
      executeQueries: true,
      sources: input.sources || []
    });
  }

  const result = await makeConnector(connectorResolution.connector).execute({
    requestId: input.requestId || `pne-sql-${Date.now()}`,
    sql: input.sql,
    maxRows: input.maxRows,
    dryRun: input.dryRun === true,
    timeoutMs: input.timeoutMs
  });

  return {
    requestId: result.requestId,
    rows: result.rows,
    rowCount: result.rowCount,
    elapsedMs: result.elapsedMs,
    bytesProcessed: result.bytesProcessed,
    error: result.error
  };
};

const collectPlaybookContext = async (payload = {}, connectorOverride) => {
  const config = existsSync(CONFIG_PATH) ? loadConfig() : loadConfig();
  const connectorId = payload.connectorId || connectorOverride || config.defaultConnectorId;
  const connectorConfig = connectorId ? config.connectors?.[connectorId] : undefined;
  const setupGuide = getSetupGuide();
  const localPrerequisites = getLocalPrerequisites();
  const configuredConnectors = listConfiguredConnectors(config);
  const environmentStatus = await getEnvironmentStatus(connectorConfig, payload);
  let projectStatus;
  let sources = [];

  if (payload.projectId && connectorConfig?.type === 'hosted') {
    projectStatus = await summarizeProjectStatus(connectorConfig, payload.projectId).catch(() => undefined);
  }

  if (payload.includeSources) {
    sources = await listSources(connectorId).catch(() => []);
  } else if (Array.isArray(payload.sources)) {
    sources = payload.sources;
  }

  return {
    config,
    connectorId,
    connectorConfig,
    setupGuide,
    localPrerequisites,
    configuredConnectors,
    environmentStatus,
    projectStatus,
    sessionState: loadSessionState(),
    sources
  };
};

const updateProjectMemoryRecord = (projectKey, payload, connectorId, updater) => {
  const current = loadProjectMemory(projectKey, payload, connectorId);
  const next = updater ? updater(current) : current;
  saveProjectMemory(projectKey, next);
  return next;
};

const recordAnalysisInProjectMemory = (payload, connectorId, result) => {
  const projectKey = resolveProjectKey(payload, connectorId);
  const question = payload.question;
  if (!question) {
    return null;
  }

  const snapshotVersion = connectorId ? getResourceSnapshot(connectorId)?.version : undefined;
  return updateProjectMemoryRecord(projectKey, payload, connectorId, (current) => {
    const recentQuestions = [
      {
        askedAt: new Date().toISOString(),
        question,
        mode: payload.mode || 'answer',
        requestId: result?.requestId || null,
        answerPreview: String(result?.answer || '').slice(0, 280),
        resourceSnapshotVersion: snapshotVersion || null
      },
      ...(Array.isArray(current.recentQuestions) ? current.recentQuestions : [])
    ].slice(0, 25);

    const recentInsights = result?.answer
      ? [
        {
          createdAt: new Date().toISOString(),
          requestId: result.requestId || null,
          summary: String(result.answer).slice(0, 280)
        },
        ...(Array.isArray(current.recentInsights) ? current.recentInsights : [])
      ].slice(0, 25)
      : (Array.isArray(current.recentInsights) ? current.recentInsights : []);

    return {
      ...current,
      projectId: payload.projectId || current.projectId || null,
      connectorId: connectorId || current.connectorId || null,
      lastQuestion: question,
      lastAnswerPreview: String(result?.answer || '').slice(0, 280),
      lastResourceSnapshotVersion: snapshotVersion || current.lastResourceSnapshotVersion || null,
      recentQuestions,
      recentInsights
    };
  });
};

const commandInit = () => {
  const config = loadConfig();
  saveConfig(config);
  console.log(`PNE config ready at ${CONFIG_PATH}`);
};

const commandConnect = (type, args) => {
  const config = loadConfig();
  const { id, connector } = buildConnectorConfig(type, args);
  config.connectors[id] = connector;
  config.defaultConnectorId = id;
  saveConfig(config);
  console.log(`Connected ${id} (${type}).`);
};

const listSources = async (connectorId) => {
  const config = loadConfig();
  const { id, connector: connectorConfig } = resolveConnectorConfig(config, connectorId);
  const cacheKey = `sources:${id}`;
  const cached = getCacheValue(cacheKey);
  if (cached) return cached;

  let sources = [];
  if (connectorConfig.type === 'hosted') {
    const result = await callHosted(connectorConfig, {
      requestId: `sources-${Date.now()}`,
      mode: 'explore',
      question: 'List available warehouse sources.',
      sources: []
    });
    sources = result.sources || result.plan?.sources || [];
  } else if (connectorConfig.introspectCmd) {
    const output = await runCommand(connectorConfig.introspectCmd);
    const parsed = output ? JSON.parse(output) : [];
    sources = Array.isArray(parsed) ? parsed : parsed.sources || parsed.tables || [];
  } else {
    sources = await makeConnector(connectorConfig).introspect();
  }

  setCacheValue(cacheKey, sources, config.cache?.ttlMs || 300000);
  const normalizedSources = toPneSources(sources);
  setResourceSnapshot(id, normalizedSources);
  return normalizedSources;
};

const commandSources = async (args) => {
  const sources = await listSources(args.connector);
  console.log(JSON.stringify(sources, null, 2));
};

const commandResources = (args) => {
  const config = loadConfig();
  const { id } = resolveConnectorConfig(config, args.connector);
  const snapshot = getResourceSnapshot(id);
  console.log(JSON.stringify(snapshot || {
    connectorId: id,
    status: 'no_snapshot_cached'
  }, null, 2));
};

const commandCapabilities = (args) => {
  const config = existsSync(CONFIG_PATH) ? loadConfig() : null;
  const connectorConfig = config?.connectors?.[args.connector || config.defaultConnectorId];
  console.log(JSON.stringify(getBridgeCapabilities(connectorConfig), null, 2));
};

const commandAnalyzeJson = async () => {
  const raw = await readStdin();
  const input = raw ? JSON.parse(raw) : {};
  if (!input.question) throw new Error('Missing question in analyze-json payload.');
  console.log(JSON.stringify(await runAnalysisRequest(input, input.connectorId), null, 2));
};

const executeToolCall = async (toolName, payload = {}, connectorOverride, defaultSurface = 'api') => {
  const config = existsSync(CONFIG_PATH) ? loadConfig() : null;
  const connectorConfig = config?.connectors?.[payload.connectorId || connectorOverride || config?.defaultConnectorId];

  if (toolName === 'pne_get_capabilities') {
    return getBridgeCapabilities(connectorConfig);
  }

  if (toolName === 'pne_get_setup_guide') {
    return getSetupGuide();
  }

  if (toolName === 'pne_check_local_prerequisites') {
    return getLocalPrerequisites();
  }

  if (toolName === 'pne_list_configured_connectors') {
    return listConfiguredConnectors(loadConfig());
  }

  if (toolName === 'pne_configure_connector') {
    if (!payload.connectorType) {
      throw new Error('Missing connectorType for pne_configure_connector.');
    }
    const config = loadConfig();
    const { id, connector } = buildConnectorConfig(payload.connectorType, payload.arguments || {});
    config.connectors[id] = connector;
    if (payload.setDefault !== false) {
      config.defaultConnectorId = id;
    }
    saveConfig(config);
    return {
      status: 'configured',
      connectorId: id,
      connectorType: connector.type,
      defaultConnectorId: config.defaultConnectorId
    };
  }

  if (toolName === 'pne_test_connector') {
    const connectorId = payload.connectorId || connectorOverride;
    const sources = await listSources(connectorId);
    return {
      status: 'ok',
      connectorId: connectorId || loadConfig().defaultConnectorId,
      sourceCount: sources.length,
      sampleSourceIds: sources.slice(0, 5).map((source) => source.sourceId),
      snapshot: connectorId ? getResourceSnapshot(connectorId) : undefined
    };
  }

  if (toolName === 'pne_execute_sql') {
    return executeSqlRequest(payload, payload.connectorId || connectorOverride);
  }

  if (toolName === 'pne_get_widget_catalog') {
    return loadWidgetCatalogEntries();
  }

  if (toolName === 'pne_resolve_widget_contract') {
    const catalogEntries = payload.catalogEntries || await loadWidgetCatalogEntries();
    return resolveWidgetContract({
      widgetType: payload.widgetType,
      inlineContract: payload.inlineContract || payload.contract || null,
      catalogEntries,
      query: payload.query,
      rows: payload.rows || payload.data || null
    });
  }

  if (toolName === 'pne_get_session_state') {
    return loadSessionState();
  }

  if (toolName === 'pne_reset_session_state') {
    const nextState = emptySessionState();
    saveSessionState(nextState);
    return nextState;
  }

  if (toolName === 'pne_get_first_run_playbook') {
    const context = await collectPlaybookContext(payload, connectorOverride);
    const result = buildFirstRunPlaybook({
      question: payload.question,
      domain: payload.domain,
      connectorId: context.connectorId,
      environmentStatus: context.environmentStatus,
      setupGuide: context.setupGuide,
      localPrerequisites: context.localPrerequisites,
      configuredConnectors: context.configuredConnectors,
      projectStatus: context.projectStatus,
      sessionState: context.sessionState
    });
    saveSessionState(result.sessionState);
    return result;
  }

  if (toolName === 'pne_get_project_memory') {
    const connectorId = payload.connectorId || connectorOverride;
    const projectKey = resolveProjectKey(payload, connectorId);
    return loadProjectMemory(projectKey, payload, connectorId);
  }

  if (toolName === 'pne_update_project_memory') {
    const connectorId = payload.connectorId || connectorOverride;
    const projectKey = resolveProjectKey(payload, connectorId);
    return updateProjectMemoryRecord(projectKey, payload, connectorId, (current) => ({
      ...current,
      projectId: payload.projectId || current.projectId || null,
      connectorId: connectorId || current.connectorId || null,
      notes: payload.note
        ? [String(payload.note), ...(Array.isArray(current.notes) ? current.notes : [])].slice(0, 50)
        : (payload.patch?.notes || current.notes || []),
      ...(payload.patch || {})
    }));
  }

  if (toolName === 'pne_reset_project_memory') {
    const connectorId = payload.connectorId || connectorOverride;
    const projectKey = resolveProjectKey(payload, connectorId);
    const nextState = emptyProjectMemory(projectKey, payload.projectId, connectorId);
    saveProjectMemory(projectKey, nextState);
    return nextState;
  }

  if (toolName === 'pne_get_recommended_next_steps') {
    const context = await collectPlaybookContext(payload, connectorOverride);
    const result = recommendNextSteps({
      question: payload.question,
      domain: payload.domain,
      connectorId: context.connectorId,
      environmentStatus: context.environmentStatus,
      setupGuide: context.setupGuide,
      localPrerequisites: context.localPrerequisites,
      configuredConnectors: context.configuredConnectors,
      projectStatus: context.projectStatus,
      sessionState: context.sessionState
    });
    saveSessionState(result.sessionState);
    return result;
  }

  if (toolName === 'pne_plan_ml_model') {
    const context = await collectPlaybookContext({ ...payload, includeSources: true }, connectorOverride);
    const sources = context.sources.length
      ? context.sources
      : (payload.sources || []);
    if (!Array.isArray(sources) || sources.length === 0) {
      throw new Error('ML planning requires sources or a connector that can introspect sources.');
    }
    const result = planMlModels({
      question: payload.question,
      domain: payload.domain,
      sources: sources.map((source) => ({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        columns: Array.isArray(source.columns) ? source.columns : []
      }))
    });
    const sessionState = {
      ...context.sessionState,
      lastUpdatedAt: new Date().toISOString(),
      lastPlaybookId: 'ml_planning',
      lastRecommendedTool: result.candidates[0] ? 'pne_train_project_recommendation' : 'pne_analyze_question',
      lastBlockingIssue: result.blockingIssues[0]
    };
    saveSessionState(sessionState);
    return {
      ...result,
      sessionState
    };
  }

  if (toolName === 'pne_build_ml_experiment_contract') {
    const context = await collectPlaybookContext({ ...payload, includeSources: true }, connectorOverride);
    const sources = context.sources.length
      ? context.sources
      : (payload.sources || []);
    const candidate = payload.candidate || payload.mlCandidate;
    if (!candidate) {
      throw new Error('Missing candidate for pne_build_ml_experiment_contract.');
    }
    return buildMlExperimentContract(candidate, sources);
  }

  if (toolName === 'pne_build_powerbi_query') {
    const catalogEntries = payload.catalogEntries || await loadWidgetCatalogEntries();
    const widgetContract = resolveWidgetContract({
      widgetType: payload.widgetType,
      inlineContract: payload.inlineContract || payload.contract || null,
      catalogEntries,
      query: payload.query,
      rows: payload.rows || null
    });
    const query = payload.query || {};
    const nativeSql = payload.sql || query.sql;
    if (!nativeSql) {
      throw new Error('Missing sql or query.sql for pne_build_powerbi_query.');
    }
    return buildPowerBIQueryDefinition({
      queryName: payload.queryName || query.title || query.queryId || widgetContract.widget.id,
      nativeSql,
      bridgeUrl: payload.bridgeUrl,
      connectorId: payload.connectorId || connectorOverride,
      widgetContract
    });
  }

  if (toolName === 'pne_build_powerbi_dataset') {
    const definitions = Array.isArray(payload.queries) ? payload.queries : [];
    if (!definitions.length) {
      throw new Error('Missing queries for pne_build_powerbi_dataset.');
    }
    return buildPowerBIDatasetDefinition({
      datasetName: payload.datasetName || 'PNE Dataset',
      queries: definitions
    });
  }

  if (toolName === 'pne_export_contract') {
    const connectorId = payload.connectorId || connectorOverride;
    const projectKey = resolveProjectKey(payload, connectorId);
    const exportResult = exportContractArtifact({
      projectKey,
      projectId: payload.projectId,
      connectorId,
      contractType: payload.contractType,
      name: payload.name,
      artifact: payload.artifact,
      metadata: payload.metadata,
      outputFile: payload.outputFile
    });
    updateProjectMemoryRecord(projectKey, payload, connectorId, (current) => ({
      ...current,
      contractExports: [
        {
          contractType: payload.contractType,
          versionId: exportResult.versionId,
          createdAt: exportResult.createdAt,
          filePath: exportResult.filePath,
          outputFile: exportResult.outputFile || null
        },
        ...(Array.isArray(current.contractExports) ? current.contractExports : [])
      ].slice(0, 100)
    }));
    return exportResult;
  }

  if (toolName === 'pne_list_contract_versions') {
    const connectorId = payload.connectorId || connectorOverride;
    const projectKey = resolveProjectKey(payload, connectorId);
    return {
      projectKey,
      contractType: payload.contractType || null,
      versions: listContractVersions(projectKey, payload.contractType)
    };
  }

  if (toolName === 'pne_get_account_snapshot') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Account inspection requires a hosted connector.');
    }
    return fetchHostedControlPlane(connectorConfig, '/account/me');
  }

  if (toolName === 'pne_get_environment_status') {
    return getEnvironmentStatus(connectorConfig, payload);
  }

  if (toolName === 'pne_get_connector_catalog') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Connector catalog inspection requires a hosted connector.');
    }
    return fetchHostedControlPlane(connectorConfig, '/projects/connectors/catalog');
  }

  if (toolName === 'pne_list_workspaces') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      return [];
    }
    return fetchHostedControlPlane(connectorConfig, '/workspaces');
  }

  if (toolName === 'pne_create_workspace') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Workspace creation requires a hosted connector.');
    }
    return fetchHostedControlPlane(connectorConfig, '/workspaces', {
      method: 'POST',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_get_workspace_detail') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Workspace detail inspection requires a hosted connector.');
    }
    if (!payload.workspaceId) {
      throw new Error('Missing workspaceId for pne_get_workspace_detail.');
    }
    return fetchHostedControlPlane(connectorConfig, `/workspaces/${payload.workspaceId}`);
  }

  if (toolName === 'pne_get_workspace_members') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Workspace member inspection requires a hosted connector.');
    }
    if (!payload.workspaceId) {
      throw new Error('Missing workspaceId for pne_get_workspace_members.');
    }
    return fetchHostedControlPlane(connectorConfig, `/workspaces/${payload.workspaceId}/members`);
  }

  if (toolName === 'pne_get_workspace_invitations') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Workspace invitation inspection requires a hosted connector.');
    }
    if (!payload.workspaceId) {
      throw new Error('Missing workspaceId for pne_get_workspace_invitations.');
    }
    return fetchHostedControlPlane(connectorConfig, `/workspaces/${payload.workspaceId}/invitations`);
  }

  if (toolName === 'pne_create_workspace_invitation') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Workspace invitation creation requires a hosted connector.');
    }
    if (!payload.workspaceId) {
      throw new Error('Missing workspaceId for pne_create_workspace_invitation.');
    }
    return fetchHostedControlPlane(connectorConfig, `/workspaces/${payload.workspaceId}/invitations`, {
      method: 'POST',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_get_workspace_activity') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Workspace activity inspection requires a hosted connector.');
    }
    if (!payload.workspaceId) {
      throw new Error('Missing workspaceId for pne_get_workspace_activity.');
    }
    const limit = payload.limit ? `?limit=${encodeURIComponent(String(payload.limit))}` : '';
    return fetchHostedControlPlane(connectorConfig, `/workspaces/${payload.workspaceId}/activity${limit}`);
  }

  if (toolName === 'pne_list_projects') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      return [];
    }
    const workspaceId = payload.workspaceId || connectorConfig.workspaceId;
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return fetchHostedControlPlane(connectorConfig, `/projects${query}`);
  }

  if (toolName === 'pne_create_project') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project creation requires a hosted connector.');
    }
    return fetchHostedControlPlane(connectorConfig, '/projects', {
      method: 'POST',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_update_project') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project updates require a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_update_project.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}`, {
      method: 'PATCH',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_get_project_status') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project status inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_get_project_status.');
    }
    return summarizeProjectStatus(connectorConfig, payload.projectId);
  }

  if (toolName === 'pne_list_project_share_links') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project share link inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_list_project_share_links.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/share-links`);
  }

  if (toolName === 'pne_create_project_share_link') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project share link creation requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_create_project_share_link.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/share-links`, {
      method: 'POST',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_list_project_sources') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project source inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_list_project_sources.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/sources`);
  }

  if (toolName === 'pne_add_project_source') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project source creation requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_add_project_source.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/sources`, {
      method: 'POST',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_delete_project_source') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project source deletion requires a hosted connector.');
    }
    if (!payload.projectId || !payload.sourceId) {
      throw new Error('Missing projectId or sourceId for pne_delete_project_source.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/sources/${payload.sourceId}`, {
      method: 'DELETE'
    });
  }

  if (toolName === 'pne_get_project_lineage') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project lineage inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_get_project_lineage.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/lineage`);
  }

  if (toolName === 'pne_get_project_analytics') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project analytics inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_get_project_analytics.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/analytics`);
  }

  if (toolName === 'pne_get_project_formulas') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project formula inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_get_project_formulas.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/runtime/code-formulas`);
  }

  if (toolName === 'pne_get_project_overrides') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project override inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_get_project_overrides.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/runtime/overrides`);
  }

  if (toolName === 'pne_list_project_recommendations') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project recommendation inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_list_project_recommendations.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/ml/recommendations`);
  }

  if (toolName === 'pne_train_project_recommendation') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('ML recommendation training requires a hosted connector.');
    }
    if (!payload.projectId || !payload.recommendationId) {
      throw new Error('Missing projectId or recommendationId for pne_train_project_recommendation.');
    }
    return fetchHostedControlPlane(
      connectorConfig,
      `/projects/${payload.projectId}/ml/recommendations/${payload.recommendationId}/train`,
      {
        method: 'POST',
        body: payload.body || {}
      }
    );
  }

  if (toolName === 'pne_run_project_runtime') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project runtime execution requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_run_project_runtime.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/runtime/run`, {
      method: 'POST',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_list_runtime_requests') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Runtime request inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_list_runtime_requests.');
    }
    return listRuntimeRequests(connectorConfig, payload.projectId);
  }

  if (toolName === 'pne_get_runtime_request_status') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Runtime request status inspection requires a hosted connector.');
    }
    if (!payload.projectId || !payload.requestId) {
      throw new Error('Missing projectId or requestId for pne_get_runtime_request_status.');
    }
    const statusPayload = await fetchHostedControlPlane(
      connectorConfig,
      `/projects/${payload.projectId}/runtime/requests/${payload.requestId}`
    );
    return summarizeRuntimeRequestStatus(statusPayload);
  }

  if (toolName === 'pne_get_runtime_request_artifacts') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Runtime request artifact inspection requires a hosted connector.');
    }
    if (!payload.projectId || !payload.requestId) {
      throw new Error('Missing projectId or requestId for pne_get_runtime_request_artifacts.');
    }
    return fetchHostedControlPlane(
      connectorConfig,
      `/projects/${payload.projectId}/runtime/requests/${payload.requestId}/artifacts`
    );
  }

  if (toolName === 'pne_poll_runtime_request') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Runtime polling requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_poll_runtime_request.');
    }
    return pollRuntimeRequest(connectorConfig, payload.projectId, payload.requestId);
  }

  if (toolName === 'pne_check_project_updates') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project update checks require a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_check_project_updates.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/runtime/check-updates`, {
      method: 'POST',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_discover_project_sources') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project source discovery requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_discover_project_sources.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/sources/discover`, {
      method: 'POST',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_create_project_override') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Project override creation requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_create_project_override.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/runtime/overrides`, {
      method: 'POST',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_record_sentinel_feedback') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Sentinel feedback recording requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_record_sentinel_feedback.');
    }
    return fetchHostedControlPlane(connectorConfig, `/projects/${payload.projectId}/feedback/sentinel`, {
      method: 'POST',
      body: payload.body || {}
    });
  }

  if (toolName === 'pne_get_dashboard_data') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Dashboard inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_get_dashboard_data.');
    }
    return fetchHostedControlPlane(connectorConfig, `/dashboard/${payload.projectId}`);
  }

  if (toolName === 'pne_get_dashboard_manifest') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Dashboard manifest inspection requires a hosted connector.');
    }
    if (!payload.projectId) {
      throw new Error('Missing projectId for pne_get_dashboard_manifest.');
    }
    return fetchHostedControlPlane(connectorConfig, `/dashboard/${payload.projectId}/manifest`);
  }

  if (toolName === 'pne_get_dashboard_widget_data') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Widget data inspection requires a hosted connector.');
    }
    if (!payload.projectId || !payload.widgetId) {
      throw new Error('Missing projectId or widgetId for pne_get_dashboard_widget_data.');
    }
    return fetchHostedControlPlane(connectorConfig, `/dashboard/${payload.projectId}/widget/${payload.widgetId}`);
  }

  if (toolName === 'pne_reload_widget_registry') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Widget reload requires a hosted connector.');
    }
    return fetchHostedControlPlane(connectorConfig, '/dashboard/system/reload');
  }

  if (toolName === 'pne_preview_workspace_invitation') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Invitation preview requires a hosted connector.');
    }
    if (!payload.tenantId || !payload.workspaceId || !payload.inviteToken) {
      throw new Error('Missing tenantId, workspaceId or inviteToken for pne_preview_workspace_invitation.');
    }
    return fetchHostedControlPlane(
      connectorConfig,
      `/public/invitations/${payload.tenantId}/${payload.workspaceId}/${payload.inviteToken}`
    );
  }

  if (toolName === 'pne_accept_workspace_invitation') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Invitation acceptance requires a hosted connector.');
    }
    if (!payload.tenantId || !payload.workspaceId || !payload.inviteToken) {
      throw new Error('Missing tenantId, workspaceId or inviteToken for pne_accept_workspace_invitation.');
    }
    return fetchHostedControlPlane(
      connectorConfig,
      `/public/invitations/${payload.tenantId}/${payload.workspaceId}/${payload.inviteToken}/accept`,
      {
        method: 'POST',
        body: payload.body || {}
      }
    );
  }

  if (toolName === 'pne_get_shared_project') {
    if (!connectorConfig || connectorConfig.type !== 'hosted') {
      throw new Error('Shared project access requires a hosted connector.');
    }
    if (!payload.tenantId || !payload.projectId || !payload.shareToken) {
      throw new Error('Missing tenantId, projectId or shareToken for pne_get_shared_project.');
    }
    return fetchHostedControlPlane(
      connectorConfig,
      `/public/projects/${payload.tenantId}/${payload.projectId}/share/${payload.shareToken}`
    );
  }

  if (toolName === 'pne_list_sources') {
    return listSources(payload.connectorId || connectorOverride);
  }

  if (toolName === 'pne_get_resource_snapshot') {
    const config = loadConfig();
    const { id } = resolveConnectorConfig(config, payload.connectorId || connectorOverride);
    return getResourceSnapshot(id) || {
      connectorId: id,
      status: 'no_snapshot_cached'
    };
  }

  if (toolName === 'pne_analyze_question' || toolName === 'pne_analyze_warehouse') {
    if (!payload.question) {
      throw new Error('Missing question for pne_analyze_question.');
    }
    return runAnalysisRequest({
      ...payload,
      hostContext: {
        surface: payload.hostContext?.surface || defaultSurface,
        ...(payload.hostContext || {})
      }
    }, payload.connectorId || connectorOverride);
  }

  throw new Error(`Unknown tool: ${toolName}`);
};

const commandTool = async (toolName, args) => {
  const stdin = args['input-file'] ? '' : await readStdin();
  const payload = args['input-file']
    ? readJson(resolve(args['input-file']), {})
    : (stdin ? JSON.parse(stdin) : {});
  const result = await executeToolCall(toolName, payload, args.connector, args.surface || 'cli');
  console.log(JSON.stringify(result, null, 2));
};

const commandServe = async (args) => {
  const port = Number(args.port || process.env.PNE_PORT || 8765);
  const host = args.host || process.env.PNE_HOST || '127.0.0.1';
  const server = createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
      if (req.method === 'GET' && requestUrl.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/capabilities') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const result = await executeToolCall('pne_get_capabilities', { connectorId }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/setup/guide') {
        const result = await executeToolCall('pne_get_setup_guide', {}, undefined, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/setup/prerequisites') {
        const result = await executeToolCall('pne_check_local_prerequisites', {}, undefined, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/session') {
        const result = await executeToolCall('pne_get_session_state', {}, undefined, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/playbooks/first-run') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const workspaceId = requestUrl.searchParams.get('workspaceId') || undefined;
        const projectId = requestUrl.searchParams.get('projectId') || undefined;
        const result = await executeToolCall('pne_get_first_run_playbook', {
          connectorId,
          workspaceId,
          projectId
        }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/connectors') {
        const result = await executeToolCall('pne_list_configured_connectors', {}, undefined, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/account/me') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const result = await executeToolCall('pne_get_account_snapshot', { connectorId }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/connectors/catalog') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const result = await executeToolCall('pne_get_connector_catalog', { connectorId }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/environment') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const workspaceId = requestUrl.searchParams.get('workspaceId') || undefined;
        const result = await executeToolCall('pne_get_environment_status', { connectorId, workspaceId }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname.startsWith('/workspaces/')) {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const pathParts = requestUrl.pathname.split('/').filter(Boolean);
        const workspaceId = pathParts[1];
        let toolName = 'pne_get_workspace_detail';

        if (pathParts.length === 3 && pathParts[2] === 'members') {
          toolName = 'pne_get_workspace_members';
        } else if (pathParts.length === 3 && pathParts[2] === 'invitations') {
          toolName = 'pne_get_workspace_invitations';
        } else if (pathParts.length === 3 && pathParts[2] === 'activity') {
          toolName = 'pne_get_workspace_activity';
        }

        const result = await executeToolCall(
          toolName,
          {
            connectorId,
            workspaceId,
            limit: requestUrl.searchParams.get('limit') || undefined
          },
          connectorId,
          'api'
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/workspaces') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const result = await executeToolCall('pne_list_workspaces', { connectorId }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/projects') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const workspaceId = requestUrl.searchParams.get('workspaceId') || undefined;
        const result = await executeToolCall('pne_list_projects', { connectorId, workspaceId }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname.startsWith('/projects/')) {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const pathParts = requestUrl.pathname.split('/').filter(Boolean);
        const projectId = pathParts[1];

        if (pathParts.length === 4 && pathParts[2] === 'runtime' && pathParts[3] === 'poll') {
          const requestId = requestUrl.searchParams.get('requestId') || undefined;
          const result = await executeToolCall(
            'pne_poll_runtime_request',
            { connectorId, projectId, requestId },
            connectorId,
            'api'
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        if (pathParts.length === 4 && pathParts[2] === 'runtime' && pathParts[3] === 'requests') {
          const result = await executeToolCall(
            'pne_list_runtime_requests',
            { connectorId, projectId },
            connectorId,
            'api'
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        if (pathParts.length >= 5 && pathParts[2] === 'runtime' && pathParts[3] === 'requests') {
          const requestId = pathParts[4];
          const toolName = pathParts[5] === 'artifacts'
            ? 'pne_get_runtime_request_artifacts'
            : 'pne_get_runtime_request_status';
          const result = await executeToolCall(
            toolName,
            { connectorId, projectId, requestId },
            connectorId,
            'api'
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        let toolName = 'pne_get_project_status';

        if (pathParts.length === 3 && pathParts[2] === 'sources') {
          toolName = 'pne_list_project_sources';
        } else if (pathParts.length === 3 && pathParts[2] === 'lineage') {
          toolName = 'pne_get_project_lineage';
        } else if (pathParts.length === 3 && pathParts[2] === 'analytics') {
          toolName = 'pne_get_project_analytics';
        } else if (pathParts.length === 3 && pathParts[2] === 'share-links') {
          toolName = 'pne_list_project_share_links';
        } else if (pathParts.length === 4 && pathParts[2] === 'runtime' && pathParts[3] === 'code-formulas') {
          toolName = 'pne_get_project_formulas';
        } else if (pathParts.length === 4 && pathParts[2] === 'runtime' && pathParts[3] === 'overrides') {
          toolName = 'pne_get_project_overrides';
        } else if (pathParts.length === 4 && pathParts[2] === 'ml' && pathParts[3] === 'recommendations') {
          toolName = 'pne_list_project_recommendations';
        }

        const result = await executeToolCall(toolName, { connectorId, projectId }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname.startsWith('/dashboard/')) {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const pathParts = requestUrl.pathname.split('/').filter(Boolean);
        const projectId = pathParts[1];
        let toolName = 'pne_get_dashboard_data';
        const payload = { connectorId, projectId };

        if (pathParts.length === 3 && pathParts[2] === 'manifest') {
          toolName = 'pne_get_dashboard_manifest';
        } else if (pathParts.length === 4 && pathParts[2] === 'widget') {
          toolName = 'pne_get_dashboard_widget_data';
          payload.widgetId = pathParts[3];
        } else if (pathParts.length === 3 && pathParts[1] === 'system' && pathParts[2] === 'reload') {
          toolName = 'pne_reload_widget_registry';
          delete payload.projectId;
        }

        const result = await executeToolCall(toolName, payload, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname.startsWith('/public/invitations/')) {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const pathParts = requestUrl.pathname.split('/').filter(Boolean);
        const [, tenantId, workspaceId, inviteToken] = pathParts;
        const result = await executeToolCall(
          'pne_preview_workspace_invitation',
          { connectorId, tenantId, workspaceId, inviteToken },
          connectorId,
          'api'
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname.startsWith('/public/projects/')) {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const pathParts = requestUrl.pathname.split('/').filter(Boolean);
        const [, tenantId, projectId, , shareToken] = pathParts;
        const result = await executeToolCall(
          'pne_get_shared_project',
          { connectorId, tenantId, projectId, shareToken },
          connectorId,
          'api'
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/sources') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const result = await executeToolCall('pne_list_sources', { connectorId }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/resources') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const result = await executeToolCall('pne_get_resource_snapshot', { connectorId }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/projects/memory') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const projectId = requestUrl.searchParams.get('projectId') || undefined;
        const projectKey = requestUrl.searchParams.get('projectKey') || undefined;
        const result = await executeToolCall('pne_get_project_memory', { connectorId, projectId, projectKey }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/contracts/widgets/catalog') {
        const result = await executeToolCall('pne_get_widget_catalog', {}, undefined, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'GET' && requestUrl.pathname === '/contracts/versions') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const projectId = requestUrl.searchParams.get('projectId') || undefined;
        const projectKey = requestUrl.searchParams.get('projectKey') || undefined;
        const contractType = requestUrl.searchParams.get('contractType') || undefined;
        const result = await executeToolCall('pne_list_contract_versions', { connectorId, projectId, projectKey, contractType }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method === 'DELETE' && requestUrl.pathname === '/projects/memory') {
        const connectorId = requestUrl.searchParams.get('connectorId') || undefined;
        const projectId = requestUrl.searchParams.get('projectId') || undefined;
        const projectKey = requestUrl.searchParams.get('projectKey') || undefined;
        const result = await executeToolCall('pne_reset_project_memory', { connectorId, projectId, projectKey }, connectorId, 'api');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method !== 'POST' || !['/analyze', '/tool', '/session/reset', '/playbooks/recommend', '/playbooks/first-run', '/ml/plan', '/ml/experiment', '/query/sql', '/contracts/widgets/resolve', '/contracts/export', '/bi/powerbi/query', '/bi/powerbi/dataset', '/connectors', '/projects/memory'].includes(requestUrl.pathname)) {
        if (req.method === 'POST' && requestUrl.pathname === '/connectors') {
          const raw = await new Promise((resolvePromise) => {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
          });
          const input = raw ? JSON.parse(raw) : {};
          const result = await executeToolCall('pne_configure_connector', input, undefined, 'api');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Not found' }));
        return;
      }
      const raw = await new Promise((resolvePromise) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
      });
      const input = raw ? JSON.parse(raw) : {};
      const result = requestUrl.pathname === '/tool'
        ? await executeToolCall(input.toolName, input.arguments || {}, input.connectorId, 'api')
        : requestUrl.pathname === '/session/reset'
          ? await executeToolCall('pne_reset_session_state', input, input.connectorId, 'api')
          : requestUrl.pathname === '/playbooks/first-run'
            ? await executeToolCall('pne_get_first_run_playbook', input, input.connectorId, 'api')
          : requestUrl.pathname === '/playbooks/recommend'
            ? await executeToolCall('pne_get_recommended_next_steps', input, input.connectorId, 'api')
            : requestUrl.pathname === '/ml/plan'
              ? await executeToolCall('pne_plan_ml_model', input, input.connectorId, 'api')
              : requestUrl.pathname === '/ml/experiment'
                ? await executeToolCall('pne_build_ml_experiment_contract', input, input.connectorId, 'api')
                : requestUrl.pathname === '/query/sql'
                  ? await executeToolCall('pne_execute_sql', input, input.connectorId, 'api')
                  : requestUrl.pathname === '/contracts/widgets/resolve'
                    ? await executeToolCall('pne_resolve_widget_contract', input, input.connectorId, 'api')
                    : requestUrl.pathname === '/contracts/export'
                      ? await executeToolCall('pne_export_contract', input, input.connectorId, 'api')
                    : requestUrl.pathname === '/bi/powerbi/query'
                      ? await executeToolCall('pne_build_powerbi_query', input, input.connectorId, 'api')
                      : requestUrl.pathname === '/bi/powerbi/dataset'
                        ? await executeToolCall('pne_build_powerbi_dataset', input, input.connectorId, 'api')
                        : requestUrl.pathname === '/projects/memory'
                          ? await executeToolCall('pne_update_project_memory', input, input.connectorId, 'api')
              : requestUrl.pathname === '/connectors'
                ? await executeToolCall('pne_configure_connector', input, input.connectorId, 'api')
                : await runAnalysisRequest(input, input.connectorId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
    }
  });
  server.listen(port, host, () => console.error(`PNE bridge listening on http://${host}:${port}`));
};

const writeMcp = (message) => {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
};

let mcpBuffer = Buffer.alloc(0);
const readMcpMessages = (chunk) => {
  mcpBuffer = Buffer.concat([mcpBuffer, chunk]);
  const messages = [];
  while (true) {
    const headerEnd = mcpBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const header = mcpBuffer.slice(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      mcpBuffer = mcpBuffer.slice(headerEnd + 4);
      continue;
    }
    const length = Number(match[1]);
    const start = headerEnd + 4;
    const end = start + length;
    if (mcpBuffer.length < end) break;
    messages.push(JSON.parse(mcpBuffer.slice(start, end).toString('utf8')));
    mcpBuffer = mcpBuffer.slice(end);
  }
  return messages;
};

const commandMcp = async () => {
  const tools = [
    {
      name: 'pne_get_capabilities',
      description: 'Describe PNE runtime capabilities, configured connector status, cache behavior and hosted support.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_get_setup_guide',
      description: 'Return guided setup recipes for hosted, BigQuery, DuckDB-on-R2, DuckDB local, Postgres and Snowflake.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'pne_get_session_state',
      description: 'Read the local session state used for adaptive playbook guidance.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'pne_reset_session_state',
      description: 'Reset the local adaptive session state.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'pne_get_first_run_playbook',
      description: 'Return a strict first-run onboarding playbook with explicit steps from connector choice to first executed analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          workspaceId: { type: 'string' },
          projectId: { type: 'string' },
          question: { type: 'string' },
          domain: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_get_project_memory',
      description: 'Read project-scoped conversation memory, recent questions and exported contract history.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          projectKey: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_update_project_memory',
      description: 'Persist notes or project-scoped memory updates so future agent runs can continue with context.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          projectKey: { type: 'string' },
          note: { type: 'string' },
          patch: { type: 'object', additionalProperties: true }
        }
      }
    },
    {
      name: 'pne_reset_project_memory',
      description: 'Reset project-scoped conversation memory and local history.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          projectKey: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_get_recommended_next_steps',
      description: 'Run deterministic playbooks and return the next recommended tool calls for the current setup or project state.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          workspaceId: { type: 'string' },
          projectId: { type: 'string' },
          question: { type: 'string' },
          domain: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_plan_ml_model',
      description: 'Suggest plausible ML tasks and baseline model plans from the available schema.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          question: { type: 'string' },
          domain: { type: 'string' },
          sources: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }
      }
    },
    {
      name: 'pne_build_ml_experiment_contract',
      description: 'Convert an ML planning candidate into a sandbox-ready ML experiment contract with split strategy, evaluation and artifacts.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          candidate: { type: 'object', additionalProperties: true },
          sources: { type: 'array', items: { type: 'object', additionalProperties: true } }
        },
        required: ['candidate']
      }
    },
    {
      name: 'pne_export_contract',
      description: 'Export a widget, PowerBI or ML contract as a versioned JSON artifact and register it in local project history.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          projectKey: { type: 'string' },
          contractType: { type: 'string' },
          name: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
          artifact: { type: 'object', additionalProperties: true },
          outputFile: { type: 'string' }
        },
        required: ['contractType', 'artifact']
      }
    },
    {
      name: 'pne_list_contract_versions',
      description: 'List previously exported contract versions for a project, optionally filtered by contract type.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          projectKey: { type: 'string' },
          contractType: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_execute_sql',
      description: 'Execute explicit SQL against the active connector and return row data directly.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          sql: { type: 'string' },
          maxRows: { type: 'number' },
          dryRun: { type: 'boolean' },
          timeoutMs: { type: 'number' }
        },
        required: ['sql']
      }
    },
    {
      name: 'pne_get_widget_catalog',
      description: 'Return the portable widget catalog that external BI surfaces can consume as contracts.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'pne_resolve_widget_contract',
      description: 'Resolve a widget type or inline widget contract into a normalized query/payload contract.',
      inputSchema: {
        type: 'object',
        properties: {
          widgetType: { type: 'string' },
          contract: { type: 'object', additionalProperties: true },
          query: { type: 'object', additionalProperties: true },
          rows: { anyOf: [{ type: 'array', items: { type: 'object', additionalProperties: true } }, { type: 'object', additionalProperties: true }] }
        }
      }
    },
    {
      name: 'pne_build_powerbi_query',
      description: 'Build a PowerBI-friendly query definition, including Power Query M, from a SQL query and widget contract.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          queryName: { type: 'string' },
          sql: { type: 'string' },
          widgetType: { type: 'string' },
          contract: { type: 'object', additionalProperties: true },
          query: { type: 'object', additionalProperties: true },
          bridgeUrl: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_build_powerbi_dataset',
      description: 'Build a PowerBI dataset definition from one or more PowerBI query definitions.',
      inputSchema: {
        type: 'object',
        properties: {
          datasetName: { type: 'string' },
          queries: { type: 'array', items: { type: 'object', additionalProperties: true } }
        },
        required: ['queries']
      }
    },
    {
      name: 'pne_check_local_prerequisites',
      description: 'Check which local CLIs and environment variables are available for connector setup.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'pne_list_configured_connectors',
      description: 'List connectors already configured in the local PNE config.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'pne_configure_connector',
      description: 'Create or update a local connector configuration for hosted, BigQuery, DuckDB, DuckDB-on-R2, Postgres or Snowflake.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorType: { type: 'string' },
          setDefault: { type: 'boolean' },
          arguments: { type: 'object', additionalProperties: true }
        },
        required: ['connectorType', 'arguments']
      }
    },
    {
      name: 'pne_test_connector',
      description: 'Test the active connector by introspecting sources and building a fresh resource snapshot.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_get_account_snapshot',
      description: 'Read the authenticated hosted account snapshot, including current workspace context.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_get_environment_status',
      description: 'Summarize whether a warehouse is connected, whether hosted workspaces and projects exist, and how many projects are already analyzed.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          workspaceId: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_get_connector_catalog',
      description: 'List the hosted connector catalog and supported discovery modes for project setup.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_list_workspaces',
      description: 'List hosted workspaces available through the configured control plane connector.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_create_workspace',
      description: 'Create a new hosted workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        }
      }
    },
    {
      name: 'pne_get_workspace_detail',
      description: 'Read the full hosted workspace detail object.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          workspaceId: { type: 'string' }
        },
        required: ['workspaceId']
      }
    },
    {
      name: 'pne_get_workspace_members',
      description: 'List members of a hosted workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          workspaceId: { type: 'string' }
        },
        required: ['workspaceId']
      }
    },
    {
      name: 'pne_get_workspace_invitations',
      description: 'List invitations of a hosted workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          workspaceId: { type: 'string' }
        },
        required: ['workspaceId']
      }
    },
    {
      name: 'pne_create_workspace_invitation',
      description: 'Create a hosted workspace invitation.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          workspaceId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['workspaceId']
      }
    },
    {
      name: 'pne_get_workspace_activity',
      description: 'Read recent hosted workspace activity.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          workspaceId: { type: 'string' },
          limit: { type: 'number' }
        },
        required: ['workspaceId']
      }
    },
    {
      name: 'pne_list_projects',
      description: 'List hosted projects for a workspace so the agent can decide what to inspect next.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          workspaceId: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_create_project',
      description: 'Create a new hosted project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        }
      }
    },
    {
      name: 'pne_update_project',
      description: 'Update a hosted project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_get_project_status',
      description: 'Inspect whether a hosted project has sources, discovery metadata, projections, query specs, query configs and runtime artifacts.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_list_project_share_links',
      description: 'List share links for a hosted project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_create_project_share_link',
      description: 'Create a share link for a hosted project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_list_project_sources',
      description: 'List persisted sources for a hosted project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_add_project_source',
      description: 'Attach a new source to a hosted project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_delete_project_source',
      description: 'Delete a persisted source from a hosted project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          sourceId: { type: 'string' }
        },
        required: ['projectId', 'sourceId']
      }
    },
    {
      name: 'pne_get_project_lineage',
      description: 'Read hosted discovery metadata and lineage for a project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_get_project_analytics',
      description: 'Read the hosted analytics payload for a project dashboard.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_get_project_formulas',
      description: 'Inspect generated formulas and code views for a hosted project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_get_project_overrides',
      description: 'Inspect existing decision overrides for a hosted project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_list_project_recommendations',
      description: 'List hosted ML recommendations for a project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_train_project_recommendation',
      description: 'Trigger ML training for a hosted recommendation.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          recommendationId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['projectId', 'recommendationId']
      }
    },
    {
      name: 'pne_run_project_runtime',
      description: 'Trigger the hosted Parrot runtime for a project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_list_runtime_requests',
      description: 'List hosted runtime request IDs for a project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_get_runtime_request_status',
      description: 'Read the persisted status and progress metadata for a hosted runtime request.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          requestId: { type: 'string' }
        },
        required: ['projectId', 'requestId']
      }
    },
    {
      name: 'pne_get_runtime_request_artifacts',
      description: 'Read the persisted artifacts for a hosted runtime request.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          requestId: { type: 'string' }
        },
        required: ['projectId', 'requestId']
      }
    },
    {
      name: 'pne_poll_runtime_request',
      description: 'Return an agent-friendly polling summary for the latest or specified hosted runtime request.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          requestId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_check_project_updates',
      description: 'Ask the hosted runtime whether project sources changed since the last run.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_discover_project_sources',
      description: 'Discover sources for a hosted project from an object storage config.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_create_project_override',
      description: 'Create a hosted decision override for a projection, query or recommendation.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_record_sentinel_feedback',
      description: 'Record a Sentinel feedback event for a hosted project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_get_dashboard_data',
      description: 'Read hosted dashboard data for a project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_get_dashboard_manifest',
      description: 'Read the hosted dashboard manifest for a project.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'pne_get_dashboard_widget_data',
      description: 'Read a single hosted widget payload for a project dashboard.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          projectId: { type: 'string' },
          widgetId: { type: 'string' }
        },
        required: ['projectId', 'widgetId']
      }
    },
    {
      name: 'pne_reload_widget_registry',
      description: 'Reload the hosted widget registry/cache.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_preview_workspace_invitation',
      description: 'Preview a public workspace invitation without accepting it.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          tenantId: { type: 'string' },
          workspaceId: { type: 'string' },
          inviteToken: { type: 'string' }
        },
        required: ['tenantId', 'workspaceId', 'inviteToken']
      }
    },
    {
      name: 'pne_accept_workspace_invitation',
      description: 'Accept a public workspace invitation in hosted mode.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          tenantId: { type: 'string' },
          workspaceId: { type: 'string' },
          inviteToken: { type: 'string' },
          body: { type: 'object', additionalProperties: true }
        },
        required: ['tenantId', 'workspaceId', 'inviteToken']
      }
    },
    {
      name: 'pne_get_shared_project',
      description: 'Resolve a public shared project and its analytics payload.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' },
          tenantId: { type: 'string' },
          projectId: { type: 'string' },
          shareToken: { type: 'string' }
        },
        required: ['tenantId', 'projectId', 'shareToken']
      }
    },
    {
      name: 'pne_list_sources',
      description: 'List the connected warehouse sources and their profiled analysis capabilities.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_get_resource_snapshot',
      description: 'Return the cached resource snapshot and version for the active connector.',
      inputSchema: {
        type: 'object',
        properties: {
          connectorId: { type: 'string' }
        }
      }
    },
    {
      name: 'pne_analyze_question',
      description: 'Analyze a business question with PNE using raw question plus host-interpreted intent.',
      inputSchema: {
        type: 'object',
        properties: {
          requestId: { type: 'string' },
          question: { type: 'string' },
          mode: { type: 'string' },
          domain: { type: 'string' },
          connectorId: { type: 'string' },
          sources: { type: 'array', items: { type: 'object', additionalProperties: true } },
          conversation: { type: 'array', items: { type: 'object', additionalProperties: true } },
          hostContext: { type: 'object', additionalProperties: true },
          interpretedIntent: { type: 'object', additionalProperties: true },
          constraints: { type: 'object', additionalProperties: true },
          executeQueries: { type: 'boolean' }
        },
        required: ['question']
      }
    },
    {
      name: 'pne_analyze_warehouse',
      description: 'Backward-compatible alias for pne_analyze_question.',
      inputSchema: {
        type: 'object',
        properties: {
          requestId: { type: 'string' },
          question: { type: 'string' },
          mode: { type: 'string' },
          domain: { type: 'string' },
          connectorId: { type: 'string' },
          sources: { type: 'array', items: { type: 'object', additionalProperties: true } },
          conversation: { type: 'array', items: { type: 'object', additionalProperties: true } },
          hostContext: { type: 'object', additionalProperties: true },
          interpretedIntent: { type: 'object', additionalProperties: true },
          constraints: { type: 'object', additionalProperties: true },
          executeQueries: { type: 'boolean' }
        },
        required: ['question']
      }
    }
  ];

  process.stdin.on('data', (chunk) => {
    for (const message of readMcpMessages(chunk)) {
      void (async () => {
        if (message.method === 'initialize') {
          writeMcp({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'pne-bridge', version: '0.1.0' }
            }
          });
        } else if (message.method === 'tools/list') {
          writeMcp({ jsonrpc: '2.0', id: message.id, result: { tools } });
        } else if (message.method === 'tools/call') {
          try {
            const input = message.params?.arguments || {};
            const toolName = message.params?.name;
            const result = await executeToolCall(toolName, input, input.connectorId, 'mcp');
            writeMcp({
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
              }
            });
          } catch (error) {
            writeMcp({
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32000, message: error instanceof Error ? error.message : String(error) }
            });
          }
        }
      })();
    }
  });
};

const commandCache = (subcommand) => {
  if (subcommand === 'clear') {
    if (existsSync(CACHE_PATH)) rmSync(CACHE_PATH);
    console.log('PNE cache cleared.');
    return;
  }
  console.log(JSON.stringify(getCache(), null, 2));
};

const usage = () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'));
  console.log(`pne v${pkg.version} - Universal StatsParrot Bridge

AGENT ONBOARDING GUIDE:
1. Run 'pne version' to verify the installation and Python/DuckDB dependencies.
2. Run 'pne tool pne_get_setup_guide' to understand the current configuration.
3. Run 'pne tool pne_list_sources' to see available data tables.
4. Use 'pne tool pne_analyze_question' to answer data/business questions.

Usage:
  pne init
  pne version
  pne setup (Repair dependencies)
  pne connect profile --id demo --file ./warehouse-profile.json
  pne connect custom --id local --profile-file ./warehouse-profile.json --query-cmd "./run-query.sh"
  pne connect hosted --id hosted --endpoint https://your-pne-host/analyze
  pne connect bigquery --id bq --project p --dataset d
  pne connect snowflake --id sn --account a --warehouse w --database d --schema s
  pne connect duckdb --id local-db --database ./data.duckdb
  pne connect duckdb-r2 --id olist-r2 --endpoint https://... --access-key-id ... --secret-access-key ...
  pne connect postgres --id pg --host h --port p --database d --user u --password p
  pne capabilities [--connector id]
  pne sources [--connector id]
  pne resources [--connector id]
  pne tool pne_get_setup_guide
  pne tool pne_get_setup_guide
  pne tool pne_get_widget_catalog
  pne tool pne_resolve_widget_contract
  pne tool pne_check_local_prerequisites
  pne tool pne_list_configured_connectors
  pne tool pne_configure_connector
  pne tool pne_test_connector
  pne tool pne_execute_sql
  pne tool pne_plan_ml_model
  pne tool pne_build_ml_experiment_contract
  pne tool pne_build_powerbi_query
  pne tool pne_build_powerbi_dataset
  pne tool pne_get_account_snapshot
  pne tool pne_get_environment_status
  pne tool pne_get_connector_catalog
  pne tool pne_list_workspaces
  pne tool pne_get_workspace_detail
  pne tool pne_get_workspace_members
  pne tool pne_get_workspace_invitations
  pne tool pne_get_workspace_activity
  pne tool pne_list_projects
  pne tool pne_get_project_status
  pne tool pne_list_project_sources
  pne tool pne_get_project_lineage
  pne tool pne_get_project_analytics
  pne tool pne_get_project_formulas
  pne tool pne_get_project_overrides
  pne tool pne_list_project_recommendations
  pne tool pne_run_project_runtime
  pne tool pne_list_runtime_requests
  pne tool pne_get_runtime_request_status
  pne tool pne_get_runtime_request_artifacts
  pne tool pne_poll_runtime_request
  pne tool pne_check_project_updates
  pne tool pne_discover_project_sources
  pne tool pne_create_project_override
  pne tool pne_record_sentinel_feedback
  pne tool pne_get_dashboard_data
  pne tool pne_get_dashboard_manifest
  pne tool pne_get_dashboard_widget_data
  pne tool pne_reload_widget_registry
  pne tool pne_preview_workspace_invitation
  pne tool pne_accept_workspace_invitation
  pne tool pne_get_shared_project
  pne tool pne_list_sources
  pne tool pne_get_resource_snapshot
  pne tool pne_analyze_question < request.json
  pne analyze-json < request.json
  pne serve [--port 8765] [--host 127.0.0.1]
  pne mcp
  pne cache clear`);
};

const main = async () => {
  const [command, subcommand, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (!command || command === 'help' || command === '--help') return usage();
  if (command === 'init') return commandInit();
  if (command === 'connect') return commandConnect(subcommand, args);
  if (command === 'capabilities') return commandCapabilities(parseArgs([subcommand, ...rest].filter(Boolean)));
  if (command === 'sources') return commandSources(parseArgs([subcommand, ...rest].filter(Boolean)));
  if (command === 'resources') return commandResources(parseArgs([subcommand, ...rest].filter(Boolean)));
  if (command === 'tool') return commandTool(subcommand, parseArgs(rest));
  if (command === 'analyze-json') return commandAnalyzeJson();
  if (command === 'serve') return commandServe(parseArgs([subcommand, ...rest].filter(Boolean)));
  if (command === 'mcp') return commandMcp();
  if (command === 'cache') return commandCache(subcommand);
  if (command === 'version' || command === '--version') {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'));
    console.log(`pne v${pkg.version}`);
    const hasPython = commandExists('python3');
    console.log(`python3: ${hasPython ? '✅' : '❌'}`);
    if (hasPython) {
      try {
        execSync('python3 -c "import duckdb"', { stdio: 'ignore' });
        console.log('duckdb: ✅');
      } catch (e) {
        console.log('duckdb: ❌ (Run "pne setup" to fix)');
      }
    }
    return;
  }
  if (command === 'setup') {
    console.log('Checking PNE bridge prerequisites...');
    const hasPython = commandExists('python3');
    if (!hasPython) {
      console.error('❌ python3 not found. Please install Python 3.');
      process.exit(1);
    }
    console.log('✅ python3 found.');
    try {
      execSync('python3 -c "import duckdb"', { stdio: 'ignore' });
      console.log('✅ duckdb module found.');
    } catch (e) {
      console.log('⚠️ duckdb module missing. Attempting to install...');
      try {
        execSync('python3 -m pip install duckdb', { stdio: 'inherit' });
        console.log('✅ duckdb module installed.');
      } catch (err) {
        console.error('❌ Failed to install duckdb. Please run: pip install duckdb');
        process.exit(1);
      }
    }
    console.log('✅ PNE bridge setup complete.');
    return;
  }
  usage();
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
