import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import {
    widgetCatalogMap,
    widgetManifestIndex,
    widgetManifestLookupIndex,
} from './index.js';

const require = createRequire(import.meta.url);
const yaml = require('../../sentry-backend/node_modules/js-yaml');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toYaml = (value) => yaml.dump(value, {
    noRefs: true,
    sortKeys: false,
    lineWidth: 120,
    forceQuotes: true,
    quotingType: '"',
});

const writeYamlFile = async (relativePath, value) => {
    const absolutePath = path.join(__dirname, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, toYaml(value), 'utf8');
};

const buildCatalogPayload = () => ({
    version: 1,
    source_of_truth: 'boilerplates/widgets/index.js',
    widget_count: widgetManifestIndex.length,
    widgets: widgetCatalogMap,
});

const buildIndexPayload = () => ({
    version: 1,
    source_of_truth: 'boilerplates/widgets/index.js',
    widget_count: widgetManifestIndex.length,
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
            search_keywords: widgetCatalogMap[widget.id]?.search_keywords || [],
        },
    ])),
    lookups: widgetManifestLookupIndex,
});

const getReturnShape = (mappingMode) => {
    if (mappingMode === 'list') return 'list';
    if (mappingMode === 'matrix') return 'matrix';
    if (mappingMode === 'array') return 'array';
    return 'single';
};

const buildManifestPayload = (widget) => ({
    title: widget.title,
    description: widget.description,
    component: widget.component,
    runtime_type: widget.runtimeType,
    aliases: widget.aliases,
    category: widget.category,
    selection_hints: widget.selectionHints,
    component_id_overrides: widget.componentIdOverrides,
    data_requirements: widget.dataRequirements,
    sql_aliases: widget.sqlAliases,
    data_structure_template: widget.dataStructureTemplate,
    grid_span: widget.defaultGridSpan,
    color_theme: widget.defaultColorTheme,
    sdui: {
        root_key: 'data',
        mapping_mode: widget.mappingMode,
    },
    query_guidance: {
        sql_shape: widget.sqlShape,
        data_root: 'data',
        return_shape: getReturnShape(widget.mappingMode),
        rules: [
            'Return SQL-derived fields under the `data` object.',
            'Use aliases exactly as listed in `sql_aliases`.',
            'Prefer one final row per widget payload; use DuckDB list/struct aggregations for nested arrays or objects.',
        ],
        duckdb_patterns: [
            'Use `list(value ORDER BY sort_key)` for arrays.',
            'Use `struct_pack(key := value, ...)` for nested objects.',
            'Use `list(struct_pack(... ) ORDER BY sort_key)` for arrays of objects.',
        ],
        alias_projection_examples: Object.fromEntries(
            (widget.sqlAliases || []).map((alias) => [alias.alias, alias.expression_hint]),
        ),
        recommended_grain: widget.sqlShape === 'single_row' ? 'single row' : widget.sqlShape.replace(/_/g, ' '),
        implementation_notes: [
            'Aggregate to the widget grain before packaging the payload.',
            'Return metadata like title, type, gridSpan and colorTheme outside the `data` object; place SQL-derived fields inside `data`.',
            'Format strings in SQL only when the component explicitly expects formatted labels; otherwise return numerics and let the UI format them.',
        ],
    },
    insight_payload_contract: {
        type: widget.runtimeType,
        gridSpan: widget.defaultGridSpan,
        colorTheme: widget.defaultColorTheme,
        data: widget.dataStructureTemplate?.data || {},
    },
});

const main = async () => {
    await writeYamlFile('catalog.yml', buildCatalogPayload());
    await writeYamlFile('index.yml', buildIndexPayload());

    for (const widget of widgetManifestIndex) {
        await writeYamlFile(widget.manifestPath, buildManifestPayload(widget));
    }

    console.log(`Generated catalog, index and ${widgetManifestIndex.length} manifests.`);
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
