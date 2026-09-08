---
note: GENERATED. DO NOT EDIT.
title: statsparrot env pull
---
## statsparrot env pull

Pull cloud credentials into local .env file

```
statsparrot env pull [<project-name>] [flags]
```

### Flags

```
      --environment string   Environment to resolve for (options: dev, prod) (default "dev")
      --path string          Project directory (default ".")
      --project string       Cloud project name (will attempt to infer from Git remote if not provided)
```

### Global flags

```
      --api-token string   Token for authenticating with the cloud API
      --format string      Output format (options: "human", "json", "csv") (default "human")
  -h, --help               Print usage
      --interactive        Prompt for missing required parameters (default true)
      --org string         Organization Name
```

### SEE ALSO

* [statsparrot env](env.md)	 - Manage variables for a project

