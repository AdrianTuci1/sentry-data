---
note: GENERATED. DO NOT EDIT.
title: statsparrot init
---
## statsparrot init

Initialize a new Parrot project

### Synopsis

Initialize a new Parrot project. Use flags to customize the project or run interactively to be prompted for each option.

Available example projects:
  - statsparrot-cost-monitoring (duckdb)
  - statsparrot-github-analytics (duckdb)
  - statsparrot-openrtb-prog-ads (duckdb)


```
statsparrot init [<path>] [flags]
```

### Examples

```
  # Interactive initialization (prompts for all options)
  statsparrot init

  # Create an empty DuckDB project with Claude agent instructions
  statsparrot init my-project --olap duckdb --agent claude

  # Add Claude agent instructions to an existing Parrot project
  statsparrot init ./existing-project --agent claude
```

### Flags

```
      --agent string     Agent instructions (options: claude, cursor, agentsmd, all, none) (default "claude")
      --example string   Example project name (default: empty project)
      --olap string      OLAP engine (options: duckdb, clickhouse) (default "duckdb")
```

### Global flags

```
      --api-token string   Token for authenticating with the cloud API
      --format string      Output format (options: "human", "json", "csv") (default "human")
  -h, --help               Print usage
      --interactive        Prompt for missing required parameters (default true)
```

### SEE ALSO

* [statsparrot](cli.md)	 - A CLI for Parrot

