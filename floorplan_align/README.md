# floorplan_align

Robust registration of **architectural (AR)** and **structural (ST)** floorplans into
one coordinate frame — extracted and hardened from the tooling behind *"Generating BIM
model from structural and architectural plans using AI"*
([doi:10.1016/j.jobe.2023.107672](https://doi.org/10.1016/j.jobe.2023.107672)).

The two drawings show the same building with different linework and each has elements
the other lacks, so the library anchors on the **landmarks they share** (columns) and
solves a similarity/affine transform that is robust to non-shared points.

## Install

```bash
pip install -e .            # core (numpy + Pillow)
pip install -e ".[image]"   # + scipy, for image detection / ink-cloud fallback
```

## The one thing to know about raw images

Precise registration from *raw images alone* needs the shared landmarks to be
**detected**, and AR vs ST columns look nothing alike (grey filled blocks vs hatched
squares) — that detection is what a trained model does (the paper's Mask R-CNN). So:

- **Most accurate / recommended:** give the library landmark **points** — from your
  detector, from labelme annotations, or from user clicks — via `align_points`.
- **Image in, detector plugged:** `align_images(src, tgt, detector=your_model)` — any
  `image -> (N, 2)` callable. This is the production path.
- **No detector:** `align_images(src, tgt, strategy="hybrid")` still runs — it sweeps
  candidate rotations through the landmark fit, adds a mutual-information global pose,
  and keeps whichever **overlays the images best**. Coarse, but robust: it recovered
  the correct 90°/4× on a real pair with zero annotations. Read `meta["confidence_nmi"]`
  and reject low scores (well-aligned ≈ 1.02+, failures ≈ 1.0).

Every `align_images` result carries a **confidence** (normalized-MI overlap) so your
app can rank, gate, or flag alignments — the same signal the hybrid uses internally to
avoid trusting either landmarks or MI blindly.

## Usage

### From landmark points (recommended)
```python
from floorplan_align import align_points
a = align_points(source_columns, target_columns)   # (N, 2) arrays, source -> target
if a.ok:
    print(a.scale, a.rotation_deg, a.rmse)
    target_xy = a.transform(source_xy)              # map any source points
    M = a.matrix                                     # 2x3, source_px -> target_px
```

### From raw images with your detector
```python
from floorplan_align import align_images, confidence
from floorplan_align.viz import overlay, checkerboard

def my_detector(image):        # -> (N, 2) column centroids in pixels
    ...                        # your Mask R-CNN, YOLO, click tool, ...

a = align_images("structural.png", "architectural.png", detector=my_detector)
print(a.status, a.rotation_deg, a.meta["confidence_nmi"])   # gate on confidence
overlay("architectural.png", "structural.png", a).save("overlay.png")
checkerboard("architectural.png", "structural.png", a).save("checkerboard.png")
```

### Annotation-free (no detector) and confidence
```python
from floorplan_align import align_images, mi_global_pose, confidence
a = align_images("st.png", "ar.png", strategy="hybrid")     # or strategy="mi" (coarse)
score = confidence(a, "st.png", "ar.png")                   # standalone overlap score
```

### From labelme annotations
```python
from floorplan_align import align_points, points_from_labelme
src = points_from_labelme("st.json", "column")
dst = points_from_labelme("ar.json", "column")
a = align_points(src, dst)
```

### Many sheets of one building (consensus)
```python
from floorplan_align import reconcile
reconcile(list_of_alignments)     # flags sheets whose transform disagrees as "outlier"
```

## API

| Function | Purpose |
|---|---|
| `align_points(source, target, model="auto", ...)` | Landmark registration (unknown correspondence). `model`: `auto`/`similarity`/`affine`. |
| `align_footprint(source, target)` | Coarse outline-cloud registration (fallback). |
| `align_images(source, target, detector=..., strategy="hybrid")` | Detect + register from images. `strategy`: `hybrid` (rotation-sweep + MI, confidence-selected), `landmark`, `mi`. |
| `mi_global_pose(source, target)` | Annotation-free coarse global pose via mutual information. |
| `confidence(alignment, source, target)` | Normalized-MI overlap score for any transform (modality-agnostic). |
| `reconcile(alignments)` | Flag disagreeing transforms in a group that shares a frame. |
| `points_from_labelme` / `cloud_from_labelme` | Adapters for labelme JSON. |
| `heuristic_columns` / `ink_cloud` | Built-in best-effort detectors. |
| `viz.overlay` / `viz.checkerboard` / `viz.warp_source` | Rendering. |

### `Alignment`
`matrix` (2x3, source→target), `scale`, `rotation_deg`, `translation`, `inliers`,
`rmse`, `status` (`ok`/`weak`/`failed`/`outlier`), `model`, `method`, `.ok`,
`.transform(points)`, `.inverse_matrix()`, `.as_dict()`.

The transform maps **source pixels → target pixels**; keep the architectural plan as
the fixed *target* and warp the structural plan onto it.

## CLI
```bash
floorplan-align structural.png architectural.png --overlay check.png --json
floorplan-align st.png ar.png --labelme st.json ar.json          # use annotations
```

## Notes
- Handles scale (seen 0.4×–5.8×), rotation incl. ±90°, and partial overlap.
- Pure `numpy`/`Pillow` core; `scipy` only for the image-detection path.
- `tests/` are synthetic and dataset-free (`pytest`).
