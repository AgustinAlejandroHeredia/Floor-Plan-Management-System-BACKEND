#!/usr/bin/env python3
import sys
import json
import os
import argparse


def main():
    parser = argparse.ArgumentParser(description="YOLO inference with SAHI slicing")
    parser.add_argument("image_path", help="Path to the input image")
    parser.add_argument("model_path", help="Path to the YOLO model (.pt)")
    parser.add_argument("--slice-height", type=int, default=1024, help="Slice height in pixels (default: 1024)")
    parser.add_argument("--slice-width", type=int, default=1024, help="Slice width in pixels (default: 1024)")
    parser.add_argument("--overlap-height-ratio", type=float, default=0.2, help="Vertical overlap ratio (default: 0.2)")
    parser.add_argument("--overlap-width-ratio", type=float, default=0.2, help="Horizontal overlap ratio (default: 0.2)")
    parser.add_argument("--confidence", type=float, default=0.3, help="Confidence threshold (default: 0.3)")
    parser.add_argument("--device", type=str, default=None, help="Device override: cpu, cuda, mps (default: auto-detect)")
    args = parser.parse_args()

    if not os.path.exists(args.image_path):
        print(json.dumps({"error": f"Image not found: {args.image_path}"}))
        sys.exit(1)

    if not os.path.exists(args.model_path):
        print(json.dumps({"error": f"Model not found: {args.model_path}"}))
        sys.exit(1)

    try:
        from sahi import AutoDetectionModel
        from sahi.predict import get_sliced_prediction
    except ImportError:
        print(json.dumps({"error": "sahi package is not installed. Run: pip install sahi"}))
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
            model_type="ultralytics",
            model_path=args.model_path,
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
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
