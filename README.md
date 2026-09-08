<p align="center">
    <a href="https://statsparrot.com/" target="_blank">
        <img width="10%" src="https://statsparrot.com/logo/statsparrot_logo_sq_gradient.svg" alt="Parrot logo">
    </a>
</p>

<h3 align="center">Agent-first, human-friendly business intelligence</h3>

<p align="center">
    <a href="LICENSE.md" target="_blank">
        <img src="https://img.shields.io/github/license/statsparrot/statsparrot.svg" alt="GitHub license">
    </a>
    <a href="https://github.com/statsparrot/statsparrot/releases" target="_blank">
        <img src="https://img.shields.io/github/tag/statsparrot/statsparrot.svg" alt="GitHub tag (latest SemVer)">
    </a>
    <a href="https://github.com/statsparrot/statsparrot/commits" target="_blank">
        <img src="https://img.shields.io/github/commit-activity/y/statsparrot/statsparrot.svg" alt="GitHub commit activity">
    </a>
    <a href="https://github.com/statsparrot/statsparrot/graphs/contributors" target="_blank">
        <img src="https://img.shields.io/github/contributors-anon/statsparrot/statsparrot.svg" alt="GitHub contributors">
    </a>
    <a href="https://github.com/statsparrot/statsparrot/releases" target="_blank">
        <img src="https://img.shields.io/github/downloads/statsparrot/statsparrot/total.svg" alt="GitHub downloads">
    </a>
    <a href="https://github.com/statsparrot/statsparrot/actions/workflows/statsparrot-cloud.yml" target="_blank">
        <img src="https://github.com/statsparrot/statsparrot/actions/workflows/statsparrot-cloud.yml/badge.svg" alt="CI/CD">
    </a>
</p>

<p align="center">
  <a href="https://docs.statsparrot.com/">Docs</a> · <a href="https://datatalks.statsparrot.com/">Data Talks</a>
</p>

---

<p align="center">
  <img src="https://docs.statsparrot.com/img/explore/dashboard101/multi-measure-select.png" alt="Parrot dashboard" width="80%">
</p>

**Parrot** is the fastest BI tool for humans and agents, powered by OLAP engines like ClickHouse and DuckDB.

> This project is a fork of the Apache-2.0 licensed Parrot project. It has been rebranded and modified; see `LICENSE.md` and `NOTICE` for the original copyright and the list of changes.

## Get Started

```bash
curl https://statsparrot.sh | sh        # install
statsparrot start my-project            # create a project and open the UI
```

### Scaffold a project with agent context

Use `statsparrot init` to scaffold a project interactively:

```
➜ statsparrot init
? Project name my-statsparrot-project
? OLAP engine duckdb
? Agent instructions claude

Created a new Parrot project at ~/my-statsparrot-project
Added Claude instructions in .claude and .mcp.json

Success! Run the following command to start the project:

  statsparrot start my-statsparrot-project
```

## Why Parrot?

- **Build with agents** — BI-as-code (YAML + SQL) means coding agents like Claude Code and Cursor can author projects, dashboards, and security policies end-to-end
- **Semantic layer** — Single source of truth for dimensions, measures, and time grains — defined in YAML, generating SQL at query time against your OLAP engine
- **Explore with agents** — Conversational BI lets business users query metrics in natural language; the [MCP server](https://docs.statsparrot.com/explore/mcp) connects AI agents directly to your semantic layer
- **Real-time performance** — Sub-second queries at any scale; ClickHouse for billions of rows, DuckDB for smaller datasets and fast iteration
- **Embeddable** — Dashboards, APIs, and agent interfaces you can ship in your product

## Capabilities

### Parrot Developer (local)

- [**Connectors**](https://docs.statsparrot.com/build/connectors/) — S3, GCS, databases, and 20+ sources
- [**OLAP Engines**](https://docs.statsparrot.com/developers/build/connectors/olap) — Managed ClickHouse or DuckDB included, or connect an external engine (ClickHouse Cloud, Druid, Pinot, MotherDuck)
- [**SQL Models**](https://docs.statsparrot.com/build/models/) — Transform raw data with SQL, join models together
- [**Data Profiling**](https://docs.statsparrot.com/build/models) — Instant column stats and distributions
- [**Incremental Ingestion**](https://docs.statsparrot.com/build/models/incremental-models) — Load only new data on each run to keep large datasets current without full refreshes
- [**Semantic Layer**](https://docs.statsparrot.com/build/metrics-view/) — Dimensions, measures, and time grains in YAML
- [**Row Access Policies**](https://docs.statsparrot.com/build/metrics-view/security) — Per-user, per-group data access control
- [**Local Dashboards**](https://docs.statsparrot.com/build/dashboards) — Preview and explore dashboards locally

### Parrot Cloud

- [**Deploy**](https://docs.statsparrot.com/deploy/deploy-dashboard/) — Git-backed, versioned deployments — push with `statsparrot deploy` or connect a repo for automatic CI/CD
- [**Explore & Canvas Dashboards**](https://docs.statsparrot.com/build/dashboards) — Interactive dashboards, embeddable in your product
- [**Conversational BI**](https://docs.statsparrot.com/explore/ai-chat) — Ask questions in natural language
- [**MCP Server**](https://docs.statsparrot.com/explore/mcp) — Connect Claude, ChatGPT, or any AI agent to your metrics
- [**Custom APIs & Embedding**](https://docs.statsparrot.com/build/custom-apis/) — Expose metrics via REST or embed dashboards
- [**Alerts & Reports**](https://docs.statsparrot.com/developers/build/alerts) — Threshold alerting, code-defined or UI-defined

## How It Works

Define everything in code — models, metrics, dashboards — and Parrot handles the rest.

**1. Connect data** — `models/events.yaml`

```yaml
type: model
connector: duckdb
materialize: true

sql: |
  select * from read_parquet('gs://statsparrot-public/auction_data.parquet')
```

**2. Define metrics** — `metrics/events_metrics.yaml`

```yaml
version: 1
type: metrics_view
model: events
timeseries: timestamp

dimensions:
  - name: country
    column: country
  - name: device
    column: device_type

measures:
  - name: total_events
    expression: count(*)
  - name: revenue
    expression: sum(price * quantity)
    description: Total revenue
```

**3. Create a dashboard** — `dashboards/events_explore.yaml`

```yaml
type: explore

display_name: "Events Dashboard"
metrics_view: events_metrics

dimensions: "*"
measures: "*"
```

**4. Deploy**

```bash
statsparrot deploy                   # push to Parrot Cloud
```

Your metrics view is immediately queryable on Parrot Cloud — add YAML files to configure dashboards, alerts, and custom APIs.

## Learn More

[Getting Started with Parrot Developer](https://www.youtube.com/watch?v=oQSok8Dy-D0) • [Exploring Data with Parrot](https://www.youtube.com/watch?v=wTP46eOzoCk&list=PL_ZoDsg2yFKgi7ud_fOOD33AH8ONWQS7I&index=1)
• [Data Talks on the Rocks](https://www.youtube.com/playlist?list=PL_ZoDsg2yFKgr_YEc4XOY0wlRLqzyR07q) • [Agentic Analytics with Claude Code and Parrot](https://www.youtube.com/watch?v=k6Lbu2cVH4g&t=2s)

## Examples

| Example              | Description                                         | Links                                                                                                                                            |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Programmatic Ads** | Bidstream data for pricing and campaign performance | [GitHub](https://github.com/statsparrot/statsparrot-examples/tree/main/statsparrot-openrtb-prog-ads) · [Demo](https://ui.statsparrot.com/demo/statsparrot-openrtb-prog-ads) |
| **Cost Monitoring**  | Cloud infra merged with customer data               | [GitHub](https://github.com/statsparrot/statsparrot-examples/tree/main/statsparrot-cost-monitoring) · [Demo](https://ui.statsparrot.com/demo/statsparrot-cost-monitoring)   |
| **GitHub Analytics** | Contributor activity and commit patterns            | [GitHub](https://github.com/statsparrot/statsparrot-examples/tree/main/statsparrot-github-analytics) · [Demo](https://ui.statsparrot.com/demo/statsparrot-github-analytics) |

Or explore a [live embedded dashboard](https://statsparrot-embedding-example.netlify.app/).

## Community

[![Discord](https://img.shields.io/badge/Discord-Join%20Chat-7289da?logo=discord&logoColor=white)](https://discord.gg/statsparrot) [![Twitter](https://img.shields.io/badge/Twitter-Follow-1da1f2?logo=twitter&logoColor=white)](https://twitter.com/Parrot) [![GitHub Discussions](https://img.shields.io/badge/GitHub-Discussions-181717?logo=github&logoColor=white)](https://github.com/statsparrot/statsparrot/discussions)

## Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) to get started.
