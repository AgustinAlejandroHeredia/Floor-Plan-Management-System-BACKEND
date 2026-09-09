"""Adapters for `labelme <https://github.com/wkentaro/labelme>`_ JSON annotations.

If your app (or the dataset) already has labelme polygons for columns/walls, use
these to feed :func:`floorplan_align.align_points` / :func:`align_footprint` directly
-- no image detection needed, and the most accurate path.
"""
from __future__ import annotations

import json

import numpy as np

__all__ = ["points_from_labelme", "cloud_from_labelme"]


def points_from_labelme(path, classes) -> np.ndarray:
    """Centroid of every shape whose ``label`` is in ``classes`` -> ``(N, 2)`` points.

    ``classes`` may be a single label string or an iterable of labels (e.g.
    ``"column"`` or ``{"column", "circ_column"}``)."""
    classes = {classes} if isinstance(classes, str) else set(classes)
    with open(path) as fh:
        d = json.load(fh)
    out = []
    for s in d.get("shapes", []):
        if s.get("label") in classes and s.get("points"):
            p = np.asarray(s["points"], float)
            out.append(p.mean(0))
    return np.asarray(out, float).reshape(-1, 2)


def cloud_from_labelme(path, classes, *, cap=600) -> np.ndarray:
    """All polygon vertices of the given ``classes`` -> an ``(N, 2)`` outline cloud
    (sub-sampled to at most ``cap`` points) for :func:`align_footprint`."""
    classes = {classes} if isinstance(classes, str) else set(classes)
    with open(path) as fh:
        d = json.load(fh)
    pts = [p for s in d.get("shapes", []) if s.get("label") in classes
           for p in s.get("points", [])]
    a = np.asarray(pts, float).reshape(-1, 2)
    if len(a) > cap:
        a = a[np.linspace(0, len(a) - 1, cap).astype(int)]
    return a
