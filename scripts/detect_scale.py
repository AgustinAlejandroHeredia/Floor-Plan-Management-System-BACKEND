#!/usr/bin/env python3
import sys
import json
from pathlib import Path

# Ensure scripts/ is in path for unidad_a_pixeles / escala_lsd imports
scripts_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(scripts_dir))


def emitir(scale):
    result = {"scale": float(scale) if scale is not None else None, "orientation": None}
    print("<scale_orientation>" + json.dumps(result) + "</scale_orientation>")


def escala_yolo(image_path):
    """Pipeline YOLO-pose: detecta las cotas con el modelo y consensua la escala."""
    from unidad_a_pixeles import procesaImagen, calcular_mejor_unidad_px
    return calcular_mejor_unidad_px(procesaImagen(image_path), tau=0.3, k=3.0)


def escala_lsd_(image_path):
    """Pipeline Line Segment Detection: sin modelo, geometria + OCR."""
    from escala_lsd import procesar
    return procesar(image_path)["unidad_por_px"]


METODOS = {"yolo": escala_yolo, "lsd": escala_lsd_}


def main():
    if len(sys.argv) < 2:
        print("Usage: detect_scale.py <image_path> [yolo|lsd]", file=sys.stderr)
        sys.exit(1)

    image_path = sys.argv[1]
    metodo = sys.argv[2] if len(sys.argv) > 2 else "yolo"
    if metodo not in METODOS:
        print(f"[!] detect_scale: metodo desconocido '{metodo}'", file=sys.stderr)
        emitir(None)
        return

    try:
        emitir(METODOS[metodo](image_path))
    except Exception as e:
        print(f"[!] detect_scale ({metodo}) error: {e}", file=sys.stderr)
        emitir(None)


if __name__ == '__main__':
    main()
