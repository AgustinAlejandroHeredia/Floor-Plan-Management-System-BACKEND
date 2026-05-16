#!/usr/bin/env python3
import sys
import json
import os
import argparse
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
    """Downloads model from Google Drive if it doesn't exist."""
    if not os.path.exists(destination):
        # We use stderr for logs so stdout remains clean for the JSON result
        print(f"[*] Downloading model to {destination}...", file=sys.stderr)
        url = f'https://drive.google.com/uc?id={drive_id}'
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        gdown.download(url, destination, quiet=False)
    else:
        print(f"[+] Model found in cache: {destination}", file=sys.stderr)
        

def main():
    parser = argparse.ArgumentParser(description="YOLO inference with SAHI slicing")
    parser.add_argument("image_path", help="Path to the input image")
    parser.add_argument("model_path", help="Path to the YOLO model (.pt)")
    parser.add_argument("model_type", help="'ultralytics', 'mmdet', 'detectron2'")
    parser.add_argument("--slice-height", type=int, default=1024, help="Slice height in pixels (default: 1024)")
    parser.add_argument("--slice-width", type=int, default=1024, help="Slice width in pixels (default: 1024)")
    parser.add_argument("--overlap-height-ratio", type=float, default=0.2, help="Vertical overlap ratio (default: 0.2)")
    parser.add_argument("--overlap-width-ratio", type=float, default=0.2, help="Horizontal overlap ratio (default: 0.2)")
    parser.add_argument("--confidence", type=float, default=0.3, help="Confidence threshold (default: 0.3)")
    parser.add_argument("--device", type=str, default=None, help="Device override: cpu, cuda, mps (default: auto-detect)")
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    default_manifest = base_dir / "models" / "models.json"
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
    ext = ".pt" if model_meta.get("library") == "ultralytics" else ".pth"
    local_model_path = cache_dir / f"{model_meta['id']}_v{model_meta['version']}{ext}"
    
    try:
        download_model(model_meta['drive_id'], str(local_model_path))
    except Exception as e:
        print(json.dumps({"error": f"Download failed: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

    # INFERENCE

    try:
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
        import torch
        if args.device:
            device = args.device
        elif torch.cuda.is_available():
            device = "cuda"
        elif torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"

        model = AutoDetectionModel.from_pretrained(
            model_type=model_meta.get("model_type", "ultralytics"),
            model_path=str(local_model_path),
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
