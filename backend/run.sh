#!/usr/bin/env bash
set -euo pipefail

# Install dependencies (recommended inside a venv)
if [ ! -f .venv/bin/activate ]; then
  python3 -m venv .venv || true
fi
. .venv/bin/activate
pip install -r requirements.txt

# Run uvicorn
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
