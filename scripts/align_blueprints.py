#!/usr/bin/env python3
"""Align one blueprint image onto another and print the transform for the NestJS side.

Invoked like the other detectors:

    python scripts/align_blueprints.py <source_image> <target_image> \
        [--source-points FILE] [--target-points FILE] [--model auto]

``source`` is moved onto ``target`` (keep the architectural plan as the fixed target
and warp the structural one onto it, or vice versa -- the caller decides). When column
points are supplied (centroids the backend extracts from each blueprint's detected
elements / ``sectionViews``) the precise landmark fit is used; otherwise it falls back
to an annotation-free mutual-information alignment (coarse).

Emits a single line to stdout:

    <alignment>{...json...}</alignment>

with keys: status, model, method, matrix_2x3, scale, rotation_deg, translation,
confidence, inliers, rmse, n_source, n_target.  On error, status="failed" + error.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

# make the repo-root `floorplan_align` package importable when run as scripts/<file>
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _load_points(path):
    if not path:
        return None
    with open(path) as fh:
        data = json.load(fh)
    pts = data.get("points", data) if isinstance(data, dict) else data
    return [[float(p[0]), float(p[1])] for p in pts] if pts else None


def main() -> int:
    ap = argparse.ArgumentParser(description="Align a source blueprint onto a target one.")
    ap.add_argument("source_image")
    ap.add_argument("target_image")
    ap.add_argument("--source-points", help="JSON file of [[x,y],...] landmark centroids (source)")
    ap.add_argument("--target-points", help="JSON file of [[x,y],...] landmark centroids (target)")
    ap.add_argument("--model", choices=["auto", "similarity", "affine"], default="auto")
    ap.add_argument("--scale-ratio", type=float, default=None,
                    help="source->target pixel scale ratio from detected drawing scales")
    ap.add_argument("--rotation-prior", type=float, default=None,
                    help="source->target rotation (deg) from detected orientations")
    args = ap.parse_args()

    try:
        from floorplan_align import (
            align_points, align_images, confidence, georeference_pose,
        )

        src_pts = _load_points(args.source_points)
        dst_pts = _load_points(args.target_points)
        has_points = bool(src_pts and dst_pts and len(src_pts) >= 2 and len(dst_pts) >= 2)
        has_geo = args.scale_ratio is not None and args.rotation_prior is not None

        if has_points:
            # shared landmarks (e.g. detected columns) -> precise fit, priors optional
            kw = {}
            if args.rotation_prior is not None:
                kw["rotation_prior"] = args.rotation_prior
            if args.scale_ratio:
                kw["scale_band"] = (0.8 * args.scale_ratio, 1.25 * args.scale_ratio)
            a = align_points(src_pts, dst_pts, model=args.model, **kw)
        elif has_geo:
            # no landmarks -> georeference: pin scale+rotation, MI-search translation
            a = georeference_pose(args.source_image, args.target_image,
                                  args.scale_ratio, args.rotation_prior)
        else:
            # last resort: annotation-free coarse alignment from the images
            a = align_images(args.source_image, args.target_image, strategy="hybrid")

        if "confidence_nmi" not in a.meta:
            try:
                a.meta["confidence_nmi"] = round(confidence(a, args.source_image, args.target_image), 3)
            except Exception:
                a.meta["confidence_nmi"] = a.meta.get("nmi")

        out = a.as_dict()
        out["confidence"] = a.meta.get("confidence_nmi")
        out["method"] = a.method
        # Only a precise landmark fit is trusted automatically; every coarse
        # (georeference / image) result is flagged for manual review.
        if a.method == "points":
            out["needs_review"] = (not a.ok) or (a.meta.get("confidence_nmi") or 0) < 1.02
        else:
            out["needs_review"] = True
        print("<alignment>" + json.dumps(out) + "</alignment>")
        return 0
    except Exception as exc:  # never crash silently; hand a structured error to Nest
        print("<alignment>" + json.dumps({"status": "failed", "error": str(exc)}) + "</alignment>")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
