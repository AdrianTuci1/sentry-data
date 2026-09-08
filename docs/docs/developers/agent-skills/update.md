---
title: "Updating Agent Skills"
description: Keep Parrot agent skills up to date with new Parrot releases
sidebar_label: "Updating"
sidebar_position: 20
---

Agent skills are bundled with the Parrot CLI, so each Parrot release may include updated instructions that reflect new resource types, YAML properties, and best practices. The generated files in your project are a snapshot from the CLI version that created them — they do not update automatically.

## Update the skills

First, make sure you are on the latest version of Parrot:

```bash
statsparrot upgrade
```

Then re-run `statsparrot init` in your project to regenerate the skill files:

```bash
statsparrot init . --agent all
```

Use the same `--agent` option you installed with (`all`, `claude`, `cursor`, or `agentsmd`). The command overwrites the previously generated files with the latest versions and leaves the rest of your project untouched.

:::warning Regenerating overwrites customizations
Re-running `statsparrot init --agent` replaces the generated files, including the entry points (`.claude/CLAUDE.md`, `.cursor/rules/AGENTS.mdc`, or `AGENTS.md`). Keep your own project-specific agent instructions in separate files — for example, a `CLAUDE.md` at the repository root for Claude Code, or additional rule files in `.cursor/rules/` — so they survive updates.
:::

## When to update

- After upgrading Parrot to a new version, especially if the release notes mention new resource types or YAML properties
- If your agent generates YAML that Parrot rejects — the skills embed the YAML schema for each resource type, so stale skills can produce stale configuration

## Verify the update

The generated files are plain text, so a `git diff` after regenerating shows exactly what changed. Review and commit the changes like any other update to your project.
