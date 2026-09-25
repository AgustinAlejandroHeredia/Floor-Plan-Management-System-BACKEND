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

The AI inference step runs `scripts/inference_engine.py`. For YOLO models, standard Python environments work. However, Cascade R-CNN models (MMDetection) require **full** `mmcv==2.1.0` with compiled C++/CUDA operators (`mmcv._ext`), which OpenMMLab only pre-builds for **Python 3.11** (not Python 3.12 or 3.13) on Windows.

To set up the full environment (supporting both YOLO and Cascade MMDetection) on Windows using `uv`:

```bash
uv venv .venv-mmdet --python 3.11
uv pip install --python .venv-mmdet/Scripts/python.exe torch==2.1.0+cpu torchvision==0.16.0+cpu --find-links https://download.pytorch.org/whl/cpu/torch_stable.html
uv pip install --python .venv-mmdet/Scripts/python.exe "mmcv==2.1.0" --find-links https://download.openmmlab.com/mmcv/dist/cpu/torch2.1.0/index.html "numpy<2.0.0"
uv pip install --python .venv-mmdet/Scripts/python.exe "mmdet==3.3.0" "mmengine==0.10.7" "sahi>=0.11.36" "ultralytics>=8.4.47" "gdown>=5.0.0" "pydantic>=2.0.0" "scikit-image>=0.24.0" "rapidocr-onnxruntime>=1.4.4" pycocotools shapely python-dotenv
```

The backend automatically detects and prefers `.venv-mmdet` if present, or you can explicitly set `PYTHON_EXECUTABLE` in `.env`.

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
