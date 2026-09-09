"""High-level entry point: align two floorplan *images*.

Strategies:

* ``"hybrid"`` (default) -- detect landmarks, fit them once freely and once per
  candidate rotation ``{0,90,180,270}``, and keep whichever **overlays the two images
  best** (highest normalized-MI confidence, ties broken by inliers). The rotation
  sweep kills the few-landmark *aliasing* that a single RANSAC pass falls into, and
  confidence-selection makes it **non-regressive** -- a good free fit is never
  discarded for a worse constrained one. Falls back to a mutual-information global
  pose when landmarks are too few.
* ``"landmark"`` -- one free landmark fit, with an outline (ink) fallback.
* ``"mi"`` -- annotation-free mutual-information global pose only (coarse).

The detector is pluggable (``image -> (N, 2)``); pass a trained model for accuracy.
Every returned :class:`Alignment` carries ``meta["confidence_nmi"]``.
"""
from __future__ import annotations

from .detect import heuristic_columns, ink_cloud
from .mi import confidence, mi_global_pose
from .register import Alignment, align_footprint, align_points

__all__ = ["align_images"]

_ROTATIONS = (0, 90, 180, 270)


def _select_by_confidence(candidates, source, target):
    """Pick the alignment whose transform best overlays the two images (rounded NMI,
    ties -> more inliers). Records the score in ``meta["confidence_nmi"]``."""
    scored = []
    for c in candidates:
        if c is not None and c.matrix is not None:
            scored.append((round(confidence(c, source, target), 3), c.inliers, c))
    if not scored:
        return None
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    conf, _, best = scored[0]
    best.meta["confidence_nmi"] = conf
    return best


def align_images(source, target, *, detector=heuristic_columns, model="auto",
                 strategy="hybrid", min_points=4, fallback="ink",
                 rotation_tol=30.0, mi_kwargs=None, add_confidence=True, **kwargs) -> Alignment:
    """Align ``source`` onto ``target`` (paths, PIL images, or arrays). See the module
    docstring for ``strategy``. Returns an :class:`Alignment`; check ``.ok`` and
    ``meta["confidence_nmi"]``."""
    mi_kwargs = mi_kwargs or {}

    if strategy == "mi":
        return _finish(mi_global_pose(source, target, **mi_kwargs), source, target, add_confidence)

    src_pts, dst_pts = detector(source), detector(target)
    have_landmarks = len(src_pts) >= min_points and len(dst_pts) >= min_points

    if strategy == "hybrid" and have_landmarks:
        cands = [align_points(src_pts, dst_pts, model=model, method="image", **kwargs)]
        for rot in _ROTATIONS:                              # sweep rotations to beat aliasing
            cands.append(align_points(src_pts, dst_pts, model=model, method="image",
                                      rotation_prior=rot, rotation_tol=rotation_tol, **kwargs))
        cands.append(mi_global_pose(source, target, **mi_kwargs))   # wins if landmarks are noisy
        best = _select_by_confidence(cands, source, target)
        if best is not None:
            return best

    elif strategy == "landmark" and have_landmarks:
        a = align_points(src_pts, dst_pts, model=model, method="image", **kwargs)
        if a.ok:
            return _finish(a, source, target, add_confidence)

    # too few landmarks (or all failed): pick the better of outline-ink vs MI by overlap
    cands = []
    if fallback == "ink":
        cands.append(align_footprint(ink_cloud(source), ink_cloud(target), method="image-ink"))
    cands.append(mi_global_pose(source, target, **mi_kwargs))
    best = _select_by_confidence(cands, source, target)
    return best if best is not None else _finish(cands[-1], source, target, add_confidence)


def _finish(a: Alignment, source, target, add_confidence) -> Alignment:
    if add_confidence and a is not None and a.matrix is not None and "confidence_nmi" not in a.meta:
        try:
            a.meta["confidence_nmi"] = round(confidence(a, source, target), 3)
        except Exception:                       # scoring must never sink an alignment
            pass
    return a
