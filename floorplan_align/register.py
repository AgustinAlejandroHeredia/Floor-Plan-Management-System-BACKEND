"""Robust point-set registration for floorplan landmarks.

The public entry points are :func:`align_points` (landmark clouds with unknown
correspondence, e.g. detected columns) and :func:`align_footprint` (dense outline
clouds). Both return an :class:`Alignment`. :func:`reconcile` cross-checks a group of
alignments that should share a coordinate frame (e.g. all sheets of one building).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from ._geometry import (
    affine_lstsq, apply_transform, chamfer, invert_affine, median_nn,
    mutual_matches, pca_angle, rotation_deg, scale_of, score,
    similarity_from_two, similarity_lstsq,
)

__all__ = ["Alignment", "align_points", "align_footprint", "reconcile"]


# --------------------------------------------------------------------------- result

@dataclass
class Alignment:
    """The transform that maps *source* pixels onto *target* pixels, plus quality.

    ``matrix`` is a ``2x3`` array (or None if registration failed). Read ``scale``,
    ``rotation_deg`` and ``ok`` for a quick verdict; call :meth:`transform` to warp
    your own points, or hand the matrix to :mod:`floorplan_align.viz`.
    """
    matrix: np.ndarray | None
    model: str                       # "similarity" | "affine" | "footprint"
    status: str                      # "ok" | "weak" | "failed" | "outlier"
    inliers: int
    rmse: float
    n_source: int
    n_target: int
    method: str = "points"           # how the landmarks were obtained
    meta: dict = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.matrix is not None and self.status in ("ok", "footprint")

    @property
    def scale(self) -> float:
        return scale_of(self.matrix) if self.matrix is not None else 0.0

    @property
    def rotation_deg(self) -> float:
        return rotation_deg(self.matrix) if self.matrix is not None else 0.0

    @property
    def translation(self) -> tuple[float, float]:
        return (0.0, 0.0) if self.matrix is None else (float(self.matrix[0, 2]),
                                                        float(self.matrix[1, 2]))

    def transform(self, points) -> np.ndarray:
        """Map ``(N, 2)`` source points into the target frame."""
        if self.matrix is None:
            raise ValueError("alignment failed; no transform available")
        return apply_transform(self.matrix, np.asarray(points, float))

    def inverse_matrix(self) -> np.ndarray:
        """2x3 transform mapping target pixels back to source pixels."""
        if self.matrix is None:
            raise ValueError("alignment failed; no transform available")
        return invert_affine(self.matrix)

    def as_dict(self) -> dict:
        return {
            "maps": "source_pixel -> target_pixel",
            "model": self.model, "method": self.method, "status": self.status,
            "matrix_2x3": None if self.matrix is None else self.matrix.tolist(),
            "scale": self.scale, "rotation_deg": self.rotation_deg,
            "translation": self.translation, "inliers": self.inliers,
            "rmse": None if not math.isfinite(self.rmse) else self.rmse,
            "n_source": self.n_source, "n_target": self.n_target, **self.meta,
        }


# ----------------------------------------------------------------- solvers (private)

def _ransac_similarity(src, dst, tol, scale_band, iters, seed,
                       rotation_prior=None, rotation_tol=25.0):
    rng = np.random.default_rng(seed)
    ns, nd = len(src), len(dst)
    best = (0, float("inf"), None)
    lo, hi = scale_band
    tries, good, max_tries = 0, 0, iters * 6
    while good < iters and tries < max_tries:
        tries += 1
        i, j = rng.choice(ns, 2, replace=False)
        k, l = rng.choice(nd, 2, replace=False)
        seg_s = np.linalg.norm(src[i] - src[j])
        if seg_s < 1e-6:
            continue
        s = np.linalg.norm(dst[k] - dst[l]) / seg_s
        if not (lo <= s <= hi):
            continue                              # scale-band prune (cheap, big win)
        good += 1
        M = similarity_from_two(src[[i, j]], dst[[k, l]])
        if M is None:
            continue
        if rotation_prior is not None and \
                abs((rotation_deg(M) - rotation_prior + 180) % 360 - 180) > rotation_tol:
            continue                              # reject hypotheses off the prior
        inl, rmse, _ = score(M, src, dst, tol)
        if inl > best[0] or (inl == best[0] and rmse < best[1]):
            best = (inl, rmse, M)
    return best


def _icp(M, src, dst, tol, model="similarity", iters=15):
    need = 3 if model == "affine" else 2
    for _ in range(iters):
        idx, _ = mutual_matches(apply_transform(M, src), dst, tol)
        if len(idx) < need:
            break
        s_in, d_in = src[idx[:, 0]], dst[idx[:, 1]]
        M_new = affine_lstsq(s_in, d_in) if model == "affine" else similarity_lstsq(s_in, d_in)
        if np.allclose(M_new, M, atol=1e-6):
            return M_new
        M = M_new
    return M


def _footprint_fit(src, dst, icp_iters=40):
    """Coarse moment/PCA similarity + 90deg-flip disambiguation + best-tracked ICP."""
    c_s, c_d = src.mean(0), dst.mean(0)
    rms_s = math.sqrt(((src - c_s) ** 2).sum(1).mean())
    rms_d = math.sqrt(((dst - c_d) ** 2).sum(1).mean())
    if rms_s < 1e-6:
        return None, float("inf")
    scale = rms_d / rms_s
    base = pca_angle(dst) - pca_angle(src)

    def sim(sc, rot, cs, cd):
        cos, sin = sc * math.cos(rot), sc * math.sin(rot)
        R = np.array([[cos, -sin], [sin, cos]])
        return np.hstack([R, (cd - R @ cs)[:, None]])

    best = (float("inf"), None)
    for k in range(4):                            # 180deg + possible 90deg ambiguity
        M = sim(scale, base + k * math.pi / 2, c_s, c_d)
        ch = chamfer(apply_transform(M, src), dst)
        if ch < best[0]:
            best = (ch, M)

    def run(M0, trim):
        M, best_ch, best_M = M0, chamfer(apply_transform(M0, src), dst), M0
        for _ in range(icp_iters):
            D = np.linalg.norm(apply_transform(M, src)[:, None] - dst[None], axis=2)
            j = D.argmin(1)
            dmin = D[np.arange(len(src)), j]
            keep = (dmin <= np.quantile(dmin, 0.75)) if trim else (dmin < 2.5 * np.median(dmin) + 1e-6)
            if keep.sum() < 3:
                break
            Mn = similarity_lstsq(src[keep], dst[j[keep]])
            ch = chamfer(apply_transform(Mn, src), dst)
            if ch < best_ch:
                best_ch, best_M = ch, Mn
            if np.allclose(Mn, M, atol=1e-7):
                break
            M = Mn
        return best_M, best_ch

    (Ma, ca), (Mb, cb) = run(best[1], False), run(best[1], True)
    return (Ma, ca) if ca <= cb else (Mb, cb)


# --------------------------------------------------------------------- public API

def align_points(source, target, *, model="auto", tol=None, tol_frac=0.6,
                 min_inliers=5, scale_band=None, rotation_prior=None, rotation_tol=25.0,
                 max_iterations=4000, seed=0, method="points") -> Alignment:
    """Register two landmark clouds with *unknown* correspondence.

    Robust to points present in only one cloud (they gather no inliers). Solves a
    similarity transform via RANSAC, then optionally upgrades to a near-rigid affine
    only when it lowers the error.

    Parameters
    ----------
    source, target : (N, 2) array-like
        Landmark pixel coordinates (e.g. detected column centroids). ``source`` is
        moved onto ``target``.
    model : {"auto", "similarity", "affine"}
        ``auto`` = similarity plus a guarded affine polish (default).
    tol : float, optional
        Inlier distance in target pixels. Defaults to ``tol_frac x`` the median
        nearest-neighbour spacing of ``target``.
    scale_band : (lo, hi), optional
        Allowed scale range. Defaults to a band around the clouds' extent ratio.
    rotation_prior : float, optional
        If given (degrees), RANSAC rejects hypotheses whose rotation is more than
        ``rotation_tol`` from it -- use it to inject a robust global pose (e.g. from
        :func:`floorplan_align.mi.mi_global_pose`) and kill few-landmark aliasing.
    """
    src = np.asarray(source, float).reshape(-1, 2)
    dst = np.asarray(target, float).reshape(-1, 2)
    need = 3 if model == "affine" else 2
    if len(src) < need or len(dst) < need:
        return Alignment(None, model, "failed", 0, float("inf"), len(src), len(dst), method)

    if tol is None:
        d = median_nn(dst)
        diag = float(np.linalg.norm(dst.max(0) - dst.min(0))) or 1.0
        tol = tol_frac * d if d > 0 else 0.05 * diag
    if scale_band is None:
        exp = (np.linalg.norm(dst.max(0) - dst.min(0)) /
               max(np.linalg.norm(src.max(0) - src.min(0)), 1e-6))
        scale_band = (0.5 * exp, 2.0 * exp)

    inl, rmse, M = _ransac_similarity(src, dst, tol, scale_band, max_iterations, seed,
                                      rotation_prior, rotation_tol)
    if M is None or inl < 2:
        return Alignment(None, model, "failed", inl, float("inf"), len(src), len(dst), method)

    M = _icp(M, src, dst, tol, "similarity")
    best_M, best_rmse, used = M, score(M, src, dst, tol)[1], "similarity"
    for f in (0.6, 0.4):                          # tighter refits, kept only if better
        Mt = _icp(best_M, src, dst, f * tol, "similarity")
        rt = score(Mt, src, dst, tol)[1]
        if rt < best_rmse:
            best_M, best_rmse = Mt, rt
    if model in ("auto", "affine"):               # guarded near-rigid affine polish
        idx, _ = mutual_matches(apply_transform(best_M, src), dst, tol)
        if len(idx) >= 6:
            Ma = affine_lstsq(src[idx[:, 0]], dst[idx[:, 1]])
            ra = score(Ma, src, dst, tol)[1]
            if ra < best_rmse and np.linalg.cond(Ma[:, :2]) < 1.35:
                best_M, best_rmse, used = Ma, ra, "affine"

    inl, rmse, _ = score(best_M, src, dst, tol)
    status = "ok" if inl >= min_inliers else "weak"
    return Alignment(best_M, used, status, inl, rmse, len(src), len(dst), method,
                     meta={"tolerance_px": float(tol)})


def align_footprint(source, target, *, chamfer_frac=0.15, method="footprint") -> Alignment:
    """Register two dense outline clouds (building/wall/slab boundaries).

    A coarse fallback for when no discrete landmarks are available. Far less precise
    than :func:`align_points`; use it only when the two clouds have a genuinely
    shared, dominant shape (e.g. a common footprint)."""
    src = np.asarray(source, float).reshape(-1, 2)
    dst = np.asarray(target, float).reshape(-1, 2)
    if len(src) < 6 or len(dst) < 6:
        return Alignment(None, "footprint", "failed", 0, float("inf"), len(src), len(dst), method)
    M, ch = _footprint_fit(src, dst)
    if M is None:
        return Alignment(None, "footprint", "failed", 0, float("inf"), len(src), len(dst), method)
    diag = float(np.linalg.norm(dst.max(0) - dst.min(0))) or 1.0
    status = "footprint" if ch < chamfer_frac * diag else "weak"
    return Alignment(M, "footprint", status, 0, ch, len(src), len(dst), method,
                     meta={"chamfer_px": ch})


def reconcile(alignments, *, rot_tol=20.0, scale_ratio=1.5) -> list[Alignment]:
    """Flag alignments that disagree with the group's median scale/rotation.

    Use when several sheets share one drawing coordinate system (e.g. all floors of a
    building): a transform that deviates is almost certainly a mis-registration
    (few-landmark aliasing or a 90deg/180deg flip). Mutates and returns the list."""
    good = [a for a in alignments if a.matrix is not None and a.status in ("ok", "weak", "footprint")]
    if len(good) < 3:
        return alignments
    med_rot = float(np.median([a.rotation_deg for a in good]))
    med_scale = float(np.median([a.scale for a in good]))
    for a in good:
        drot = abs((a.rotation_deg - med_rot + 180) % 360 - 180)
        dscale = max(a.scale, med_scale) / max(min(a.scale, med_scale), 1e-9)
        if drot > rot_tol or dscale > scale_ratio:
            a.status = "outlier"
    return alignments
