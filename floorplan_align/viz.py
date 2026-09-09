"""Rendering helpers: warp a source plan into the target frame and build overlays.

All functions take an :class:`~floorplan_align.register.Alignment` (or a raw 2x3
matrix) whose transform maps *source* pixels to *target* pixels.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from ._geometry import invert_affine
from .detect import load_gray

Image.MAX_IMAGE_PIXELS = None

__all__ = ["warp_source", "overlay", "checkerboard"]


def _matrix(alignment):
    M = alignment if isinstance(alignment, np.ndarray) else alignment.matrix
    if M is None:
        raise ValueError("alignment has no transform to render")
    return np.asarray(M, float)


def _gray_thumb(image, long_side):
    g, (W, H) = load_gray(image)
    s = long_side / max(W, H)
    im = Image.fromarray(g.astype(np.uint8)).resize((max(1, round(W * s)), max(1, round(H * s))))
    return im, s


def _view_matrix(M, s_src, s_tgt):
    """Compose native-pixel transform ``M`` into the down-scaled view frame:
    scale source input down (1/s_src), apply M, scale target output up (s_tgt)."""
    Stgt = np.array([[s_tgt, 0, 0], [0, s_tgt, 0], [0, 0, 1]])
    Ssrc = np.array([[1 / s_src, 0, 0], [0, 1 / s_src, 0], [0, 0, 1]])
    return (Stgt @ np.vstack([M, [0, 0, 1]]) @ Ssrc)[:2]


def warp_source(source_image, alignment, out_size, fill=255) -> Image.Image:
    """Warp ``source_image`` into the target frame at ``out_size`` (target ``(W, H)``
    in native pixels). Returns a grayscale image. ``M`` and ``out_size`` are both in
    native pixels, so no scale bookkeeping is needed."""
    M = _matrix(alignment)
    im = Image.fromarray(load_gray(source_image)[0].astype(np.uint8))
    return im.transform(tuple(out_size), Image.AFFINE,
                        data=invert_affine(M).flatten().tolist(),
                        resample=Image.BILINEAR, fillcolor=fill)


def overlay(target_image, source_image, alignment, *, long_side=1500) -> Image.Image:
    """Ink overlay: target in magenta, warped source in green, dark where they meet."""
    M = _matrix(alignment)
    tgt, s_tgt = _gray_thumb(target_image, long_side)
    src, s_src = _gray_thumb(source_image, long_side)
    W, H = tgt.size
    A = _view_matrix(M, s_src, s_tgt)
    warped = src.transform((W, H), Image.AFFINE, data=invert_affine(A).flatten().tolist(),
                           resample=Image.BILINEAR, fillcolor=255)
    t_ink = 255 - np.asarray(tgt, np.int16)
    s_ink = 255 - np.asarray(warped, np.int16)
    c = np.full((H, W, 3), 255, np.int16)
    c[..., 1] -= t_ink                                   # target -> magenta
    c[..., 0] = np.minimum(c[..., 0], 255 - s_ink)       # source -> green
    c[..., 2] = np.minimum(c[..., 2], 255 - s_ink)
    return Image.fromarray(c.clip(0, 255).astype(np.uint8))


def checkerboard(target_image, source_image, alignment, *, tiles=9, long_side=1200) -> Image.Image:
    """Checkerboard of the two aligned plans (target magenta, source green tiles);
    continuous linework across tile edges confirms the registration."""
    M = _matrix(alignment)
    tgt, s_tgt = _gray_thumb(target_image, long_side)
    src, s_src = _gray_thumb(source_image, long_side)
    W, H = tgt.size
    A = _view_matrix(M, s_src, s_tgt)
    warped = src.transform((W, H), Image.AFFINE, data=invert_affine(A).flatten().tolist(),
                           resample=Image.BILINEAR, fillcolor=255)
    t_ink = (255 - np.asarray(tgt, np.int16)).clip(0, 255)
    s_ink = (255 - np.asarray(warped, np.int16)).clip(0, 255)
    T = max(W, H) // tiles
    yy, xx = np.mgrid[0:H, 0:W]
    tgt_tile = ((xx // T + yy // T) % 2) == 0
    r = np.full((H, W), 255, np.int16); g = r.copy(); b = r.copy()
    g = np.where(tgt_tile, 255 - t_ink, g)               # target tiles -> magenta
    r = np.where(~tgt_tile, 255 - s_ink, r)              # source tiles -> green
    b = np.where(~tgt_tile, 255 - s_ink, b)
    grid = ((xx % T) == 0) | ((yy % T) == 0)
    for ch in (r, g, b):
        ch[grid] = np.minimum(ch[grid], 225)
    return Image.fromarray(np.stack([r, g, b], -1).clip(0, 255).astype(np.uint8))
