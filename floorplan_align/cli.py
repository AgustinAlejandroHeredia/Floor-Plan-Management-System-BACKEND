"""Command-line front-end: align two floorplans and optionally emit overlays.

    floorplan-align structural.png architectural.png --overlay check.png
    floorplan-align st.png ar.png --labelme st.json ar.json --json
"""
from __future__ import annotations

import argparse
import json

from . import align_images, align_points, points_from_labelme
from .viz import checkerboard, overlay


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="floorplan-align",
                                 description="Align a source floorplan onto a target one.")
    ap.add_argument("source", help="source image (moved onto target), e.g. structural plan")
    ap.add_argument("target", help="target image (kept fixed), e.g. architectural plan")
    ap.add_argument("--labelme", nargs=2, metavar=("SRC_JSON", "TGT_JSON"),
                    help="register labelme annotations instead of detecting from the images")
    ap.add_argument("--classes", nargs="+", default=["column"],
                    help="labelme labels to use as landmarks (with --labelme)")
    ap.add_argument("--model", choices=["auto", "similarity", "affine"], default="auto")
    ap.add_argument("--overlay", metavar="PNG", help="write an ink overlay image")
    ap.add_argument("--checkerboard", metavar="PNG", help="write a checkerboard proof image")
    ap.add_argument("--json", action="store_true", help="print the full transform as JSON")
    a = ap.parse_args(argv)

    if a.labelme:
        src = points_from_labelme(a.labelme[0], set(a.classes))
        dst = points_from_labelme(a.labelme[1], set(a.classes))
        al = align_points(src, dst, model=a.model)
    else:
        al = align_images(a.source, a.target, model=a.model)

    if a.json:
        print(json.dumps(al.as_dict(), indent=2))
    else:
        print(f"status={al.status}  model={al.model}  method={al.method}  "
              f"scale={al.scale:.3f}  rot={al.rotation_deg:+.1f}deg  "
              f"rmse={al.rmse:.1f}px  inliers={al.inliers}/{min(al.n_source, al.n_target)}")

    if al.ok and a.overlay:
        overlay(a.target, a.source, al).save(a.overlay); print("wrote", a.overlay)
    if al.ok and a.checkerboard:
        checkerboard(a.target, a.source, al).save(a.checkerboard); print("wrote", a.checkerboard)
    return 0 if al.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
