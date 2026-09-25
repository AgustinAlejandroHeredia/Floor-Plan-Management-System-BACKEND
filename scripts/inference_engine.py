#!/usr/bin/env python3
import sys
import json
import os
import argparse
import time
import gdown
from pathlib import Path

def get_model_from_manifest(model_id, manifest_path):
    """Finds model metadata in the JSON manifest."""
    if not os.path.exists(manifest_path):
        return None
    with open(manifest_path, 'r') as f:
        data = json.load(f)
    for m in data.get('models', []):
        if m['id'] == model_id:
            return m
    return None

def download_model(drive_id, destination):
    """Download a model atomically, resuming an interrupted transfer."""
    destination_path = Path(destination)

    if destination_path.exists():
        print(f"[+] Model found in cache: {destination_path}", file=sys.stderr)
    else:
        print("[phase:model-download]", file=sys.stderr, flush=True)
        print(f"[*] Downloading model to {destination_path}...", file=sys.stderr)
        url = f'https://drive.google.com/uc?id={drive_id}'
        destination_path.parent.mkdir(parents=True, exist_ok=True)

        last_error = None
        for attempt in range(1, 4):
            try:
                partial_files = sorted(
                    destination_path.parent.glob(destination_path.name + '*.part'),
                    key=lambda file: file.stat().st_size,
                    reverse=True,
                )
                for orphan in partial_files[1:]:
                    orphan.unlink()

                downloaded_path = gdown.download(
                    url,
                    str(destination_path),
                    quiet=False,
                    resume=True,
                )
                if not downloaded_path or not destination_path.exists():
                    raise RuntimeError('Google Drive did not produce a complete download file')
                break
            except Exception as error:
                last_error = error
                if attempt == 3:
                    raise
                print(
                    f"[!] Download attempt {attempt} failed: {error}. Retrying...",
                    file=sys.stderr,
                )
                time.sleep(2 ** attempt)

        if last_error and not destination_path.exists():
            raise last_error

    print("[phase:model-ready]", file=sys.stderr, flush=True)
        

def main():
    parser = argparse.ArgumentParser(description="YOLO inference with SAHI slicing")
    parser.add_argument("image_path", help="Path to the input image")
    parser.add_argument("model_path", help="Path to the YOLO model (.pt)")
    parser.add_argument("model_type", help="'ultralytics', 'mmdet', 'detectron2'")
    parser.add_argument("model_id", help="Model ID from models.json")
    parser.add_argument("--slice-height", type=int, default=1024, help="Slice height in pixels (default: 1024)")
    parser.add_argument("--slice-width", type=int, default=1024, help="Slice width in pixels (default: 1024)")
    parser.add_argument("--overlap-height-ratio", type=float, default=0.2, help="Vertical overlap ratio (default: 0.2)")
    parser.add_argument("--overlap-width-ratio", type=float, default=0.2, help="Horizontal overlap ratio (default: 0.2)")
    parser.add_argument("--confidence", type=float, default=0.3, help="Confidence threshold (default: 0.3)")
    parser.add_argument("--device", type=str, default=None, help="Device override: cpu, cuda, mps (default: auto-detect)")
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    default_manifest = base_dir / "src" / "data" / "models.json"
    cache_dir = base_dir / "models" / "cache"

    if not os.path.exists(args.image_path):
        print(json.dumps({"error": f"Image not found: {args.image_path}"}))
        sys.exit(1)

    model_meta = get_model_from_manifest(args.model_id, default_manifest)
    if not model_meta:
        print(json.dumps({"error": f"Model ID '{args.model_id}' not found in {default_manifest}"}), file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(args.model_path):
        print(json.dumps({"error": f"Model not found: {args.model_path}"}))
        sys.exit(1)

    model_meta = get_model_from_manifest(args.model_id, default_manifest)
    if not model_meta:
        print(json.dumps({"error": f"Model ID '{args.model_id}' not found in {default_manifest}"}), file=sys.stderr)
        sys.exit(1)

    # Resolve filename and check cache
    # NOTE: this is a raw string comparison, unlike SAHI's own AutoDetectionModel,
    # which normalizes aliases ("yolov8"/"yolov11"/"yolo11"/"yolo26" -> "ultralytics")
    # before it does anything - see ULTRALYTICS_MODEL_NAMES in sahi/auto_model.py.
    # model_type in models.json must be the literal string "ultralytics", never one
    # of those aliases, or this picks .pth for what's actually a .pt file.
    ext = ".pt" if model_meta.get("model_type") == "ultralytics" else ".pth"
    local_model_path = cache_dir / f"{model_meta['id']}_v{model_meta['version']}{ext}"
    
    try:
        download_model(model_meta['drive_id'], str(local_model_path))
    except Exception as e:
        print(json.dumps({"error": f"Download failed: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

    # INFERENCE

    try:
        print("[phase:inference]", file=sys.stderr, flush=True)
        from sahi import AutoDetectionModel
        from sahi.predict import get_sliced_prediction
    except ImportError:
        print(
            json.dumps({
                "error": "sahi package is not installed. Run: pip install sahi"
            }),
            file=sys.stderr
        )
        sys.exit(1)

    try:
        if model_meta.get("model_type") == "mmdet":
            try:
                import mmcv  # noqa: F401
                import mmengine  # noqa: F401
                import mmdet  # noqa: F401
                import mmcv._ext  # noqa: F401
            except (ImportError, ModuleNotFoundError) as error:
                mmcv_lite_installed = False
                try:
                    from importlib.metadata import version
                    mmcv_lite_installed = version("mmcv-lite") is not None
                except Exception:
                    pass
                package_guidance = (
                    "mmcv-lite is installed, but it does not contain compiled operators. "
                    "Uninstall mmcv-lite and install full mmcv==2.1.0."
                    if mmcv_lite_installed
                    else
                    "Install full mmcv==2.1.0 (not mmcv-lite)."
                )
                raise RuntimeError(
                    "MMDetection runtime is incomplete. Install mmdet==3.3.0 and "
                    "mmengine==0.10.7. "
                    f"{package_guidance} "
                    "Full MMCV compiled operators require Python 3.11 on Windows (pre-built wheels with C++/CUDA ops are only provided for Python <= 3.11). "
                    f"Interpreter: {sys.executable}. Original error: {error}"
                ) from error

        import torch
        if args.device:
            device = args.device
        elif torch.cuda.is_available():
            device = "cuda"
        elif torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"

        config_path = model_meta.get("config_file")
        if model_meta.get("model_type") == "mmdet":
            if not config_path:
                raise RuntimeError(
                    f"MMDetection model '{model_meta.get('name', args.model_id)}' has no config file. "
                    "Upload one in the Model Registry."
                )
            config_path = str((base_dir / config_path).resolve())
            if not os.path.exists(config_path):
                raise RuntimeError(f"MMDetection config file not found: {config_path}")

        model = AutoDetectionModel.from_pretrained(
            model_type=model_meta.get("model_type", "ultralytics"),
            model_path=str(local_model_path),
            config_path=config_path,
            confidence_threshold=args.confidence,
            device=device,
        )

        result = get_sliced_prediction(
            args.image_path,
            model,
            slice_height=args.slice_height,
            slice_width=args.slice_width,
            overlap_height_ratio=args.overlap_height_ratio,
            overlap_width_ratio=args.overlap_width_ratio,
        )

        predictions = []
        for prediction in result.object_prediction_list:
            bbox = prediction.bbox
            width = bbox.maxx - bbox.minx
            height = bbox.maxy - bbox.miny
            predictions.append({
                "class": prediction.category.name,
                "classId": prediction.category.id,
                "confidence": float(prediction.score.value),
                "bbox": {
                    "x": bbox.minx + width / 2,
                    "y": bbox.miny + height / 2,
                    "width": width,
                    "height": height,
                },
            })
        #wrap prodections with a <predictions> tag
        
        print("<predictions>" + json.dumps({"predictions": predictions}) + "</predictions>")

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
