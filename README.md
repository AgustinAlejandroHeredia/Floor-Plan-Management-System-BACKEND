# Backend setup

## Prerequisites

- Node.js, npm
- Auth0 account
- MongoDB Atlas account
- Backblaze B2 account

## Auth0

1. Create an **SPA application** — set Allowed Callback URLs, Logout URLs, and Web Origins to your frontend URL.
2. Create an **API** — authorize the SPA application under *Application Access*.  
   In the API settings → *Application Access Policy*, set both User Access and Client Access to **Allow via client-grant**.
3. Create an **M2M application** — authorize it on your API (Client Access) and on the Auth0 Management API (User Access).

## Infrastructure

4. **MongoDB Atlas** — create a cluster, connect via the Node.js driver URI, and add it to `.env`.
5. **Backblaze B2** — create a bucket and an application key, and add both to `.env`.

## Python (inference script)

The AI inference step runs `scripts/yolo_inference.py`. Dependencies are declared in `pyproject.toml` (requires Python ≥ 3.13).

```bash
uv sync

```

Set `PYTHON_EXECUTABLE` in `.env` to the path of the virtualenv Python if it differs from `python3` (e.g. `.venv/bin/python`).

## Environment

Copy `.env.example` to `.env` and fill in all values.

## Run

```bash
npm install
npm run start:dev   # development (watch mode)
npm run start       # production
```
