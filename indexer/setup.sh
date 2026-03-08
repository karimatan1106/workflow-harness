#!/usr/bin/env bash
# Serena LSP setup — called by npm postinstall or manually.
# Creates Python 3.11 venv and installs serena-agent.
# Requires: uv (https://docs.astral.sh/uv/getting-started/installation/)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

# Skip if already set up
if [ -f "$VENV_DIR/Scripts/python.exe" ] || [ -f "$VENV_DIR/bin/python" ]; then
  PYTHON="$VENV_DIR/Scripts/python.exe"
  [ -f "$PYTHON" ] || PYTHON="$VENV_DIR/bin/python"
  if "$PYTHON" -c "from serena.agent import SerenaAgent" 2>/dev/null; then
    echo "Serena already installed in $VENV_DIR"
    exit 0
  fi
fi

# Check uv availability
if ! command -v uv >/dev/null 2>&1; then
  echo "WARNING: uv not found. Serena LSP setup skipped."
  echo "Install uv: https://docs.astral.sh/uv/getting-started/installation/"
  echo "Then run: bash indexer/setup.sh"
  exit 0
fi

echo "Setting up Serena LSP (Python 3.11 venv)..."

# Install Python 3.11 if not available
uv python install 3.11 2>/dev/null || true

# Create venv
uv venv --python 3.11 "$VENV_DIR"

# Determine python path
PYTHON="$VENV_DIR/Scripts/python.exe"
[ -f "$PYTHON" ] || PYTHON="$VENV_DIR/bin/python"

# Install serena-agent
uv pip install --python "$PYTHON" "serena-agent @ git+https://github.com/oraios/serena"

echo "Serena LSP setup complete."
echo "Test: $PYTHON -c 'from serena.agent import SerenaAgent; print(\"OK\")'"
