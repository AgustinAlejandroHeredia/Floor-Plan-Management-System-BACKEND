"""Turn a raw floorplan image into landmark points for registration.

Two built-ins are provided:

* :func:`heuristic_columns` -- a **best-effort, unsupervised** column finder (filled
  or grey solid blocks). It is deliberately simple and will miss hatched/outlined
  columns; treat it as a starting point, not a production detector.
* :func:`ink_cloud` -- samples outline/edge pixels for :func:`align_footprint`.

For real accuracy on architectural-vs-structural plans, plug in a trained element
detector (e.g. the Mask R-CNN from the paper) as the ``detector`` of
:func:`floorplan_align.align_images`; any ``image -> (N, 2)`` callable works.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

try:
    from scipy import ndimage as _ndi
except ImportError:                       # scipy is optional; only the image path needs it
    _ndi = None

Image.MAX_IMAGE_PIXELS = None

__all__ = ["load_gray", "heuristic_columns", "ink_cloud"]

ImageLike = "str | Image.Image | np.ndarray"


def load_gray(image) -> tuple[np.ndarray, tuple[int, int]]:
    """Load ``image`` (path, PIL image, or array) as a float grayscale array and its
    native ``(width, height)``."""
    if isinstance(image, np.ndarray):
        arr = image if image.ndim == 2 else np.asarray(Image.fromarray(image).convert("L"))
        return arr.astype(float), (arr.shape[1], arr.shape[0])
    im = image if isinstance(image, Image.Image) else Image.open(image)
    im = im.convert("L")
    return np.asarray(im, float), im.size


def _downscale(gray: np.ndarray, native, work_long: int):
    W, H = native
    s = work_long / max(W, H) if max(W, H) > work_long else 1.0
    if s < 1.0:
        g = np.asarray(Image.fromarray(gray.astype(np.uint8)).resize(
            (round(W * s), round(H * s))), float)
    else:
        g = gray
    return g, s


def heuristic_columns(image, *, work_long=1600, fill_thresh=245,
                      min_side=5, max_side=42, aspect_max=2.6, min_solidity=0.45):
    """Best-effort column detection: small *solid* (dark or grey) rectangular blocks.

    Works by closing hatch/holes, opening away thin wall lines, then keeping connected
    components whose size, aspect ratio and fill (solidity) look column-like. Returns
    an ``(N, 2)`` array of centroids in **native** image pixels.

    This is heuristic and modality-dependent -- validate it on your data or replace it
    with a trained detector via :func:`floorplan_align.align_images`."""
    if _ndi is None:
        raise ImportError("heuristic_columns requires scipy (pip install scipy)")
    gray, native = load_gray(image)
    g, s = _downscale(gray, native, work_long)
    mask = g < fill_thresh                          # any non-white ink (dark or grey)
    k = max(2, round(min_side * 0.6))
    solid = _ndi.binary_closing(mask, iterations=k)         # merge hatch strokes -> blob
    solid = _ndi.binary_opening(solid, iterations=max(2, k // 2))  # drop thin lines/text
    lab, n = _ndi.label(solid)
    if n == 0:
        return np.empty((0, 2))
    objs = _ndi.find_objects(lab)
    cents = _ndi.center_of_mass(solid, lab, range(1, n + 1))
    out = []
    for i, sl in enumerate(objs):
        bh, bw = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if not (min_side <= bw <= max_side and min_side <= bh <= max_side):
            continue
        if max(bw, bh) / max(min(bw, bh), 1) > aspect_max:
            continue
        area = (lab[sl] == i + 1).sum()
        if area / (bw * bh) < min_solidity:
            continue
        cy, cx = cents[i]
        out.append((cx / s, cy / s))                # back to native px
    return np.asarray(out, float).reshape(-1, 2)


def ink_cloud(image, *, work_long=1200, thresh=170, cap=1500, edge=True):
    """Sample outline/edge ink pixels as an ``(N, 2)`` cloud in native pixels, for
    :func:`floorplan_align.align_footprint`."""
    gray, native = load_gray(image)
    g, s = _downscale(gray, native, work_long)
    ink = g < thresh
    if edge and _ndi is not None:
        ink = ink & ~_ndi.binary_erosion(ink, iterations=1)
    ys, xs = np.where(ink)
    if len(xs) == 0:
        return np.empty((0, 2))
    pts = np.stack([xs / s, ys / s], 1)
    if len(pts) > cap:
        pts = pts[np.linspace(0, len(pts) - 1, cap).astype(int)]
    return pts
