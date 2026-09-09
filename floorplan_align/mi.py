"""Mutual-information tools for cross-modal floorplan alignment.

Architectural and structural plans are *different modalities* (their inks don't
correspond, but their structure does) -- exactly the setting normalized mutual
information (NMI) is built for. Two uses:

* :func:`mi_global_pose` -- an annotation-free coarse global fit (rotation + scale +
  translation) via a full-frame NMI search. It is robust where few-landmark RANSAC
  aliases (it reliably recovers rotation, incl. 90 deg), so it makes an excellent
  *initialiser* for the landmark fit (see ``strategy="hybrid"`` in
  :func:`floorplan_align.align_images`). It is coarse -- use it to seed, not as a
  final answer.
* :func:`confidence` -- score how well any transform actually overlays the two plans,
  regardless of modality. A single number the app can display or threshold.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from ._geometry import invert_affine, rotation_deg, scale_of
from .detect import load_gray
from .register import Alignment

Image.MAX_IMAGE_PIXELS = None

__all__ = ["nmi", "confidence", "mi_global_pose", "georeference_pose"]


def nmi(a: np.ndarray, b: np.ndarray, *, bins: int = 32) -> float:
    """Normalized mutual information ``(H(a)+H(b))/H(a,b)`` of two 0..255 arrays.

    1.0 means independent (no alignment information); larger means the two images
    explain each other better. Computed over the *whole* frame, so shrinking one image
    into a corner is penalised (it fills the rest with a constant)."""
    h, _, _ = np.histogram2d(a.ravel(), b.ravel(), bins=bins, range=[[0, 255], [0, 255]])
    p = h / h.sum()
    px, py = p.sum(1), p.sum(0)
    nz = p > 0
    hxy = -(p[nz] * np.log(p[nz])).sum()
    hx = -(px[px > 0] * np.log(px[px > 0])).sum()
    hy = -(py[py > 0] * np.log(py[py > 0])).sum()
    return float((hx + hy) / hxy) if hxy > 0 else 0.0


def _prep(image, long_side, edges):
    """Down-scaled 0..255 array (grayscale, or gradient magnitude if ``edges``)."""
    g, (W, H) = load_gray(image)
    s = long_side / max(W, H)
    a = np.asarray(Image.fromarray(g.astype(np.uint8)).resize(
        (max(1, round(W * s)), max(1, round(H * s)))), float)
    if edges:
        gy, gx = np.gradient(a)
        m = np.hypot(gx, gy)
        a = 255.0 * m / (m.max() + 1e-6)
    return a, s


def _warp(arr, M, out_hw, fill):
    im = Image.fromarray(arr.astype(np.uint8))
    return np.asarray(im.transform((out_hw[1], out_hw[0]), Image.AFFINE,
                                   data=invert_affine(M).flatten().tolist(),
                                   resample=Image.BILINEAR, fillcolor=fill), float)


def _compose(M, s_src, s_tgt):
    """Native-pixel transform M (src->tgt) into the view frame (src_ds -> tgt_ds)."""
    Stgt = np.array([[s_tgt, 0, 0], [0, s_tgt, 0], [0, 0, 1]])
    Ssrc = np.array([[1 / s_src, 0, 0], [0, 1 / s_src, 0], [0, 0, 1]])
    return (Stgt @ np.vstack([M, [0, 0, 1]]) @ Ssrc)[:2]


def confidence(alignment, source_image, target_image, *, long_side=220, edges=False,
               bins=32) -> float:
    """Normalized-MI overlap score for ``alignment`` on this image pair.

    Modality-agnostic: warps the source into the target frame and measures how much
    structure the two share there. Higher is better; on this dataset well-aligned
    pairs score ~1.02+ and failures ~1.0. Use it to rank or reject alignments."""
    M = alignment if isinstance(alignment, np.ndarray) else alignment.matrix
    if M is None:
        return 0.0
    tgt, s_tgt = _prep(target_image, long_side, edges)
    src, s_src = _prep(source_image, long_side, edges)
    A = _compose(np.asarray(M, float), s_src, s_tgt)
    warped = _warp(src, A, tgt.shape, fill=0 if edges else 255)
    return nmi(tgt, warped, bins=bins)


def mi_global_pose(source_image, target_image, *, long_side=180, scale_range=(0.4, 2.0),
                   n_scale=9, rotations=(0, 90, 180, 270), n_trans=5, edges=False,
                   refine=True) -> Alignment:
    """Coarse annotation-free global alignment of ``source`` onto ``target`` by
    maximising full-frame NMI over rotation x scale x translation.

    Returns an :class:`Alignment` (``model="mi"``) whose matrix maps source pixels to
    target pixels, with the achieved NMI in ``.meta["nmi"]``. Coarse by design -- best
    used to seed/disambiguate a landmark fit, not as the final transform."""
    tgt, ft = _prep(target_image, long_side, edges)
    src, fs = _prep(source_image, long_side, edges)
    Ha, Wa = tgt.shape
    ac = np.array([Wa / 2.0, Ha / 2.0])
    sc = np.array([src.shape[1] / 2.0, src.shape[0] / 2.0])
    fill = 0 if edges else 255

    def evaluate(rot, k, tx, ty):
        th = math.radians(rot)
        c, s = k * math.cos(th), k * math.sin(th)
        R = np.array([[c, -s], [s, c]])
        t = (ac + [tx, ty]) - R @ sc
        return nmi(tgt, _warp(src, np.hstack([R, t[:, None]]), (Ha, Wa), fill)), R, t

    best = (-1.0, 0, 1.0, 0.0, 0.0)                      # nmi, rot, k, tx, ty
    for rot in rotations:
        for k in np.linspace(*scale_range, n_scale):
            for tx in np.linspace(-0.25 * Wa, 0.25 * Wa, n_trans):
                for ty in np.linspace(-0.25 * Ha, 0.25 * Ha, n_trans):
                    v = evaluate(rot, k, tx, ty)[0]
                    if v > best[0]:
                        best = (v, rot, k, tx, ty)
    if refine:                                           # local scale + translation
        _, rot, k0, tx0, ty0 = best
        for k in np.linspace(k0 * 0.85, k0 * 1.15, 9):
            for tx in np.linspace(tx0 - 0.06 * Wa, tx0 + 0.06 * Wa, 9):
                for ty in np.linspace(ty0 - 0.06 * Ha, ty0 + 0.06 * Ha, 9):
                    v = evaluate(rot, k, tx, ty)[0]
                    if v > best[0]:
                        best = (v, rot, k, tx, ty)

    nmi_val, rot, k, tx, ty = best
    _, R, t = evaluate(rot, k, tx, ty)
    M_ds = np.hstack([R, t[:, None]])                    # src_ds -> tgt_ds
    M = np.hstack([(fs / ft) * M_ds[:, :2], (M_ds[:, 2] / ft)[:, None]])  # src -> tgt
    status = "ok" if nmi_val >= 1.01 else "weak"
    return Alignment(M, "mi", status, 0, float("inf"), 0, 0, method="image-mi",
                     meta={"nmi": nmi_val, "rotation_candidate": int(rot)})


def georeference_pose(source_image, target_image, scale, rotation_deg, *,
                      long_side=200, grid=15, span_frac=0.35, refine=True) -> Alignment:
    """Fix scale + rotation from external georeference (e.g. detected drawing scale and
    north orientation) and solve ONLY the translation by maximising full-frame NMI.

    With scale and rotation pinned, MI has just 2 DOF left, which it recovers far more
    reliably than a full pose search -- ideal when no shared landmarks are detectable.
    ``scale`` is the native source->target pixel ratio; ``rotation_deg`` the native
    rotation. Returns a coarse native src->target transform."""
    tgt, ft = _prep(target_image, long_side, False)
    src, fs = _prep(source_image, long_side, False)
    Ht, Wt = tgt.shape
    src_nat = np.array([src.shape[1] / fs, src.shape[0] / fs])
    tgt_nat = np.array([Wt / ft, Ht / ft])
    th = math.radians(rotation_deg)
    c, s = scale * math.cos(th), scale * math.sin(th)
    R = np.array([[c, -s], [s, c]])
    t0 = tgt_nat / 2.0 - R @ (src_nat / 2.0)             # center-align initial guess

    def score(tx, ty):
        A = _compose(np.hstack([R, np.array([[tx], [ty]])]), fs, ft)
        return nmi(tgt, _warp(src, A, (Ht, Wt), 255))

    span = span_frac * float(max(tgt_nat))
    best = (-1.0, float(t0[0]), float(t0[1]))
    for tx in np.linspace(t0[0] - span, t0[0] + span, grid):
        for ty in np.linspace(t0[1] - span, t0[1] + span, grid):
            v = score(tx, ty)
            if v > best[0]:
                best = (v, tx, ty)
    if refine:
        step = 2 * span / grid
        _, tx0, ty0 = best
        for tx in np.linspace(tx0 - step, tx0 + step, 9):
            for ty in np.linspace(ty0 - step, ty0 + step, 9):
                v = score(tx, ty)
                if v > best[0]:
                    best = (v, tx, ty)

    nmi_val, tx, ty = best
    M = np.hstack([R, np.array([[tx], [ty]])])
    status = "ok" if nmi_val >= 1.01 else "weak"
    return Alignment(M, "georeference", status, 0, float("inf"), 0, 0,
                     method="georeference", meta={"nmi": nmi_val})
