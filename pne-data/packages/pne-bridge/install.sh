#!/usr/bin/env sh
set -eu

INSTALL_DIR="${PNE_INSTALL_DIR:-$HOME/.local/bin}"
PACKAGE_SPEC="${PNE_INSTALL_PACKAGE_SPEC:-@statsparrot/pne@latest}"
mkdir -p "$INSTALL_DIR"

TARGET="$INSTALL_DIR/pne"
cat > "$TARGET" <<'SH'
#!/usr/bin/env sh
set -eu

PACKAGE_SPEC="${PNE_INSTALL_PACKAGE_SPEC:-@statsparrot/pne@latest}"
PNE_NPM_CACHE_DIR="${PNE_NPM_CACHE_DIR:-$HOME/.pne/npm-cache}"

if command -v node >/dev/null 2>&1 && command -v npx >/dev/null 2>&1; then
  mkdir -p "$PNE_NPM_CACHE_DIR"
  export npm_config_cache="$PNE_NPM_CACHE_DIR"
  exec npx --yes --package "$PACKAGE_SPEC" -- pne "$@"
fi

if [ "${1:-}" = "tool" ] && [ "${2:-}" = "pne_analyze_question" ]; then
  shift 2
  if [ -z "${PNE_ENDPOINT:-}" ]; then
    echo "PNE_ENDPOINT is required when Node is not installed." >&2
    exit 1
  fi
  if [ -n "${1:-}" ]; then
    BODY="$*"
  else
    BODY="$(cat)"
  fi
  exec curl -fsSL "$PNE_ENDPOINT" \
    -H "Content-Type: application/json" \
    ${PNE_API_KEY:+-H "Authorization: Bearer $PNE_API_KEY"} \
    -d "$BODY"
fi

echo "Node+npx are required for local PNE bridge commands. Install Node or set PNE_ENDPOINT and use: pne tool pne_analyze_question" >&2
exit 1
SH

chmod +x "$TARGET"
echo "Installed pne bridge wrapper to $TARGET"
echo "Default package source: $PACKAGE_SPEC"
