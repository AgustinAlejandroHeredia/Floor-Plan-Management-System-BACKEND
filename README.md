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
python -m pip install uv
uv sync

```

Set `PYTHON_EXECUTABLE` in `.env` to the path of the virtualenv Python if it differs from `python3` (e.g. `.venv/bin/python`).

## Environment

Copy `.env.example` to `.env` and fill in all values.

## Run

Activate the Python env for running the inference script.


```bash
source  .venv/bin/activate

```

```bash
npm install
```

Use these two commands in separate terminals:

Frontend:

```bash
npm run dev
```
Backend:

cd d:\gitworkspace\AgusHeredia\Floor-Plan-Management-System-BACKEND
```bash
npm run start:dev
```
If you want to stop them later, use:
Ctrl+C in each terminal
or, if no terminal is visible, run:
```bash
taskkill /F /IM node.exe
```
