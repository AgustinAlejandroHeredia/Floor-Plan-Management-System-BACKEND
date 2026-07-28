#!/usr/bin/env python3
import sys
import json
import math
from pathlib import Path

scripts_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(scripts_dir))

import os
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
    try:
        from ultralytics import YOLO
        import math
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
                p_north = kp_xy[0]
                p_south = kp_xy[1]

                if p_north[0] == 0 and p_north[1] == 0:
                    continue
                if p_south[0] == 0 and p_south[1] == 0:
                    continue

                dx = float(p_north[0] - p_south[0])
                dy = float(p_north[1] - p_south[1])

                angle_rad = math.atan2(dx, -dy)
                angle_deg = math.degrees(angle_rad) % 360

                if conf > best_conf:
                    best_conf = conf
                    best_angle = round(angle_deg, 2)

        return best_angle

    except Exception as e:
        print(f"[!] Orientation detection error: {e}", file=sys.stderr)
        return None


def main():
    parser = None
    if len(sys.argv) < 2:
        print("Usage: detect_orientation.py <image_path>", file=sys.stderr)
        sys.exit(1)

    image_path = sys.argv[1]

    orientation = None
    model_meta = get_model_meta(NORTH_MODEL_ID)
    if model_meta:
        ext = ".pt"
        local_model_path = CACHE_DIR / f"{model_meta['id']}_v{model_meta['version']}{ext}"
        try:
            download_model(model_meta["drive_id"], str(local_model_path))
            orientation = detect_orientation(image_path, str(local_model_path))
        except Exception as e:
            print(f"[!] Orientation model setup error: {e}", file=sys.stderr)
    else:
        print(f"[!] Model '{NORTH_MODEL_ID}' not found in models.json", file=sys.stderr)

    result = {"scale": None, "orientation": float(orientation) if orientation is not None else None}
    print("<scale_orientation>" + json.dumps(result) + "</scale_orientation>")


if __name__ == '__main__':
    main()
