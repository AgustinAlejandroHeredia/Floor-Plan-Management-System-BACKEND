#!/usr/bin/env python3
"""
Detects scale (meters/pixel) and orientation (degrees north from image top, clockwise)
from a floor plan image.

Outputs: <scale_orientation>{"scale": <float|null>, "orientation": <float|null>}</scale_orientation>
"""
import sys
import json
import os
import math
import argparse
from pathlib import Path

import gdown

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_JSON = BASE_DIR / "models" / "models.json"
CACHE_DIR = BASE_DIR / "models" / "cache"
NORTH_MODEL_ID = "v1.2-yolo11mPodr-NorthDirectionDetector"


def get_model_meta(model_id):
    if not MODELS_JSON.exists():
        return None
    with open(MODELS_JSON) as f:
        data = json.load(f)
    for m in data.get("models", []):
        if m["id"] == model_id:
            return m
    return None


def download_model(drive_id, destination):
    if not os.path.exists(destination):
        print(f"[*] Downloading model to {destination}...", file=sys.stderr)
        url = f"https://drive.google.com/uc?id={drive_id}"
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        gdown.download(url, destination, quiet=False)
    else:
        print(f"[+] Model found in cache: {destination}", file=sys.stderr)


def detect_orientation(image_path, model_path):
    """
    Runs the North-South keypoints model via ultralytics.
    Returns orientation angle in degrees: 0° = north points up, clockwise positive.
    Returns None if no valid detection.
    """
    try:
        from ultralytics import YOLO
        model = YOLO(model_path)
        results = model.predict(source=image_path, imgsz=1024, conf=0.4, verbose=False)

        best_conf = -1.0
        best_angle = None

        for r in results:
            if r.keypoints is None or len(r.keypoints.xy) == 0:
                continue
            boxes = r.boxes
            for idx, kp in enumerate(r.keypoints):
                kp_xy = kp.xy[0].cpu().numpy()
                if len(kp_xy) < 2:
                    continue

                conf = float(boxes[idx].conf[0])
                p_north = kp_xy[0]  # keypoint 0: north tip
                p_south = kp_xy[1]  # keypoint 1: south tip

                if p_north[0] == 0 and p_north[1] == 0:
                    continue
                if p_south[0] == 0 and p_south[1] == 0:
                    continue

                dx = float(p_north[0] - p_south[0])
                dy = float(p_north[1] - p_south[1])

                # Angle from image-up (−Y axis), clockwise positive
                # 0° = north points up, 90° = north points right
                angle_rad = math.atan2(dx, -dy)
                angle_deg = math.degrees(angle_rad) % 360

                if conf > best_conf:
                    best_conf = conf
                    best_angle = round(angle_deg, 2)

        return best_angle

    except Exception as e:
        print(f"[!] Orientation detection error: {e}", file=sys.stderr)
        return None


def detect_scale(image_path):
    """
    Runs scale detection using unidad_a_pixeles logic.
    Returns meters-per-pixel (float) or None if unavailable.
    """
    try:
        scripts_dir = Path(__file__).resolve().parent
        sys.path.insert(0, str(scripts_dir))
        from unidad_a_pixeles import procesaImagen, calcular_mejor_unidad_px

        detections = procesaImagen(image_path)
        scale = calcular_mejor_unidad_px(detections, tau=0.3, k=3.0)
        return scale

    except Exception as e:
        print(f"[!] Scale detection error: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(
        description="Detect scale and orientation from a floor plan image"
    )
    parser.add_argument("image_path", help="Path to the input image")
    args = parser.parse_args()

    if not os.path.exists(args.image_path):
        print(json.dumps({"error": f"Image not found: {args.image_path}"}), file=sys.stderr)
        sys.exit(1)

    orientation = None
    model_meta = get_model_meta(NORTH_MODEL_ID)
    if model_meta:
        ext = ".pt"
        local_model_path = CACHE_DIR / f"{model_meta['id']}_v{model_meta['version']}{ext}"
        try:
            download_model(model_meta["drive_id"], str(local_model_path))
            orientation = detect_orientation(args.image_path, str(local_model_path))
        except Exception as e:
            print(f"[!] Orientation model setup error: {e}", file=sys.stderr)
    else:
        print(f"[!] Model '{NORTH_MODEL_ID}' not found in models.json", file=sys.stderr)

    scale = detect_scale(args.image_path)

    result = {
        "scale": float(scale) if scale is not None else None,
        "orientation": float(orientation) if orientation is not None else None,
    }
    print("<scale_orientation>" + json.dumps(result) + "</scale_orientation>")


if __name__ == "__main__":
    main()
