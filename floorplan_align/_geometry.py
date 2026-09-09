"""Low-level 2-D geometry: similarity/affine estimation, point matching, scoring.

Everything here is pure numpy and side-effect free. Points are ``(N, 2)`` float
arrays in ``(x, y)`` pixel order; transforms are ``2x3`` matrices ``M`` such that
``dst = M[:, :2] @ src.T + M[:, 2]`` (i.e. they map *source* pixels to *target*).
"""
from __future__ import annotations

import math

import numpy as np

__all__ = [
    "apply_transform", "similarity_from_two", "similarity_lstsq", "affine_lstsq",
    "invert_affine", "scale_of", "rotation_deg", "median_nn", "mutual_matches",
    "score", "chamfer", "pca_angle",
]


def apply_transform(M: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Apply a 2x3 transform to an ``(N, 2)`` array of points."""
    pts = np.asarray(pts, float)
    if pts.size == 0:
        return pts
    return pts @ M[:, :2].T + M[:, 2]


def similarity_from_two(a: np.ndarray, b: np.ndarray) -> np.ndarray | None:
    """Closed-form similarity (scale+rotation+translation, no reflection) mapping the
    two points ``a[0], a[1]`` onto ``b[0], b[1]``. Returns None if ``a`` is degenerate."""
    az, bz = complex(*a[0]), complex(*b[0])
    da, db = complex(*a[1]) - az, complex(*b[1]) - bz
    if abs(da) < 1e-9:
        return None
    w = db / da                                # w = scale * e^{i*theta}
    t = bz - w * az
    return np.array([[w.real, -w.imag, t.real],
                     [w.imag,  w.real, t.imag]])


def similarity_lstsq(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    """Least-squares similarity (Umeyama, no reflection) via complex algebra."""
    a = src[:, 0] + 1j * src[:, 1]
    b = dst[:, 0] + 1j * dst[:, 1]
    ac, bc = a - a.mean(), b - b.mean()
    denom = np.vdot(ac, ac).real
    w = (np.vdot(ac, bc) / denom) if denom > 1e-12 else 1 + 0j   # vdot conjugates arg 1
    t = b.mean() - w * a.mean()
    return np.array([[w.real, -w.imag, t.real],
                     [w.imag,  w.real, t.imag]])


def affine_lstsq(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    """Least-squares full affine (6-DOF) mapping src onto dst."""
    A = np.hstack([src, np.ones((len(src), 1))])
    sol, *_ = np.linalg.lstsq(A, dst, rcond=None)     # (3, 2)
    return np.vstack([sol[:, 0], sol[:, 1]])          # (2, 3)


def invert_affine(M: np.ndarray) -> np.ndarray:
    """Inverse of a 2x3 affine transform."""
    R, t = M[:, :2], M[:, 2]
    Ri = np.linalg.inv(R)
    return np.hstack([Ri, (-Ri @ t)[:, None]])


def scale_of(M: np.ndarray) -> float:
    """Geometric-mean scale factor of a 2x3 transform."""
    return float(math.sqrt(abs(np.linalg.det(M[:, :2]))))


def rotation_deg(M: np.ndarray) -> float:
    """Rotation of a 2x3 transform in degrees."""
    return math.degrees(math.atan2(M[1, 0], M[0, 0]))


def median_nn(pts: np.ndarray) -> float:
    """Median nearest-neighbour distance within a point set (0 if < 2 points)."""
    if len(pts) < 2:
        return 0.0
    D = np.linalg.norm(pts[:, None, :] - pts[None, :, :], axis=2)
    np.fill_diagonal(D, np.inf)
    return float(np.median(D.min(axis=1)))


def mutual_matches(tp: np.ndarray, dst: np.ndarray, tol: float):
    """One-to-one matches: ``i`` and ``j`` pair only if each is the other's nearest
    neighbour and within ``tol``. Prevents a collapsed transform from piling many
    source points onto few target points. Returns ``(idx, rmse)`` where ``idx`` is a
    ``(K, 2)`` int array of ``(src_i, dst_j)`` pairs."""
    if len(tp) == 0 or len(dst) == 0:
        return np.empty((0, 2), int), float("inf")
    D = np.linalg.norm(tp[:, None, :] - dst[None, :, :], axis=2)
    s2d, d2s = D.argmin(axis=1), D.argmin(axis=0)
    pairs = [(i, j) for i, j in enumerate(s2d) if d2s[j] == i and D[i, j] < tol]
    if not pairs:
        return np.empty((0, 2), int), float("inf")
    idx = np.asarray(pairs)
    d = D[idx[:, 0], idx[:, 1]]
    return idx, float(np.sqrt((d ** 2).mean()))


def score(M: np.ndarray, src: np.ndarray, dst: np.ndarray, tol: float):
    """Return ``(n_inliers, rmse, idx)`` for transform ``M`` under mutual matching."""
    idx, rmse = mutual_matches(apply_transform(M, src), dst, tol)
    return len(idx), rmse, idx


def chamfer(a: np.ndarray, b: np.ndarray) -> float:
    """Symmetric mean nearest-neighbour (Chamfer) distance between two clouds."""
    D = np.linalg.norm(a[:, None, :] - b[None, :, :], axis=2)
    return float(0.5 * (D.min(1).mean() + D.min(0).mean()))


def pca_angle(cloud: np.ndarray) -> float:
    """Angle (radians) of a cloud's principal axis."""
    c = cloud - cloud.mean(0)
    w, V = np.linalg.eigh(c.T @ c)
    v = V[:, int(w.argmax())]
    return math.atan2(v[1], v[0])
