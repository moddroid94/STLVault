# STLVault Backend (Simple FastAPI)

This lightweight backend implements the endpoints expected by the frontend `services/api.ts` when `USE_MOCK_API` is set to `false`.

Quick start:

```bash
cd backend
./run.sh
```

This creates a `.venv`, installs dependencies from `requirements.txt`, and runs the FastAPI server on port `8000`.

Notes:
- Storage is in-memory for folders/models and files are stored under `backend/uploads`.
- CORS allows all origins for local development. Restrict in production.
