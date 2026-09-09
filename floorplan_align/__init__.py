"""floorplan_align -- register architectural and structural floorplans.

Quick start (you already have landmark points, e.g. detected columns)::

    from floorplan_align import align_points
    a = align_points(source_columns, target_columns)   # (N, 2) arrays
    if a.ok:
        print(a.scale, a.rotation_deg, a.rmse)
        target_xy = a.transform(source_xy)

From raw images with a pluggable detector (pass your trained model for accuracy)::

    from floorplan_align import align_images
    from floorplan_align.viz import overlay
    a = align_images("structural.png", "architectural.png", detector=my_detector)
    overlay("architectural.png", "structural.png", a).save("check.png")

From existing labelme annotations::

    from floorplan_align import align_points, points_from_labelme
    src = points_from_labelme("st.json", "column")
    dst = points_from_labelme("ar.json", "column")
    a = align_points(src, dst)

The transform maps *source* pixels to *target* pixels; keep the target fixed (e.g.
the architectural plan) and warp the source (structural) onto it.
"""
from ._geometry import apply_transform, invert_affine
from .align import align_images
from .detect import heuristic_columns, ink_cloud, load_gray
from .labelme import cloud_from_labelme, points_from_labelme
from .mi import confidence, georeference_pose, mi_global_pose, nmi
from .register import Alignment, align_footprint, align_points, reconcile

__version__ = "0.3.0"

__all__ = [
    "align_points", "align_footprint", "align_images", "reconcile", "Alignment",
    "mi_global_pose", "georeference_pose", "confidence", "nmi",
    "heuristic_columns", "ink_cloud", "load_gray",
    "points_from_labelme", "cloud_from_labelme",
    "apply_transform", "invert_affine", "__version__",
]
