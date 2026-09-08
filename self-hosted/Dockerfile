# syntax = docker/dockerfile:1.1-experimental
# Statsparrot self-hosted image.
#
# Builds the Statsparrot (open-source Parrot) CLI: the Go runtime plus the
# embedded web UI. The image boots the full self-hosted application through the
# `sp` command (see entrypoint.sh). Build steps mirror `make cli` in the repo
# Makefile:
#
#   npm install && npm run build                          -> build frontend
#   rm -rf cli/pkg/web/embed/dist; mkdir -p ...           -> stage embed output
#   cp -r web-local/build/* cli/pkg/web/embed/dist
#   go run scripts/embed_duckdb_ext/main.go               -> embed DuckDB extensions
#   go build -o statsparrot cli/main.go

# ---- Stage 1: build the embedded web UI -------------------------------------
FROM node:20-slim AS web
WORKDIR /app

# Install workspace dependencies first (root + all npm workspaces) so the build
# layer can be cached independently of source changes.
COPY package.json package-lock.json ./
COPY web-common/package.json web-common/
COPY web-local/package.json web-local/
COPY web-admin/package.json web-admin/
COPY web-integration/package.json web-integration/
COPY docs/package.json docs/
RUN npm install

# Build the full source tree.
COPY . .
RUN npm run build

# ---- Stage 2: build the Go CLI with the embedded UI -------------------------
FROM golang:1.26-bookworm AS go
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY . .

# Overlay the built frontend so go:embed picks up the web UI.
RUN rm -rf cli/pkg/web/embed/dist && mkdir -p cli/pkg/web/embed/dist
COPY --from=web /app/web-local/build ./cli/pkg/web/embed/dist

# Resolve module dependencies, embed DuckDB extensions, then build the CLI binary.
RUN go mod download
RUN go run scripts/embed_duckdb_ext/main.go
RUN go build -ldflags "-s -w" -o statsparrot cli/main.go

# ---- Stage 3: runtime image --------------------------------------------------
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git curl \
    && rm -rf /var/lib/apt/lists/*

# The `sp` command group is a subcommand of the `statsparrot` binary and is invoked as
# `statsparrot sp <command>` (Cobra dispatches on the first CLI token, os.Args[1],
# ignoring the binary name and any symlink). The `sp` symlink below is a
# cosmetic alias only; the entrypoint calls `statsparrot sp start` / `statsparrot sp init`
# explicitly. STATSPARROT_SELF_HOSTED restricts the CLI to the `sp` group.
ENV STATSPARROT_SELF_HOSTED=1
COPY --from=go /app/statsparrot /usr/local/bin/statsparrot
RUN chmod 755 /usr/local/bin/statsparrot \
    && ln -sf /usr/local/bin/statsparrot /usr/local/bin/sp

RUN groupadd -g 1001 statsparrot \
    && useradd -m -u 1001 -s /bin/sh -g statsparrot statsparrot

# Project directory is mutable on the runtime image.
RUN mkdir -p /var/lib/statsparrot/project \
    && chown -R 1001:1001 /var/lib/statsparrot

WORKDIR /var/lib/statsparrot

COPY self-hosted/entrypoint.sh /usr/local/bin/sp-entrypoint
RUN chmod 755 /usr/local/bin/sp-entrypoint

USER 1001

ENTRYPOINT ["/usr/local/bin/sp-entrypoint"]
