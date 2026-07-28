#!/usr/bin/env python3
import sys
import json
from pathlib import Path

# Ensure scripts/ is in path for unidad_a_pixeles import
scripts_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(scripts_dir))

try:
    from unidad_a_pixeles import procesaImagen, calcular_mejor_unidad_px
except Exception as e:
    print(f"[!] detect_scale import error: {e}", file=sys.stderr)
    print("<scale_orientation>" + json.dumps({"scale": None, "orientation": None}) + "</scale_orientation>")
    sys.exit(0)


def main():
    if len(sys.argv) < 2:
        print("Usage: detect_scale.py <image_path>", file=sys.stderr)
        sys.exit(1)

    image_path = sys.argv[1]
    

    try:
        detections = procesaImagen(image_path)
        scale = calcular_mejor_unidad_px(detections, tau=0.3, k=3.0)
        result = {"scale": float(scale) if scale is not None else None, "orientation": None}
        print("<scale_orientation>" + json.dumps(result) + "</scale_orientation>")
    except Exception as e:
        print(f"[!] detect_scale error: {e}", file=sys.stderr)
        result = {"scale": None, "orientation": None}
        print("<scale_orientation>" + json.dumps(result) + "</scale_orientation>")


if __name__ == '__main__':
    main()
