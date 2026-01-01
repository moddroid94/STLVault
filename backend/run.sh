#!/usr/bin/env bash
set -euo pipefail

# Check if uv is installed, install if missing
if ! command -v uv &> /dev/null; then
  echo "uv not found, installing..."
  pip install uv
fi

# Install dependencies using uv (much faster than pip)
if [ ! -f .venv/bin/activate ]; then
  uv venv .venv
fi
. .venv/bin/activate
uv pip install -r requirements.txt

# Run uvicorn
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
