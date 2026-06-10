# Adding a YOLO detection model

This guide lets you add a new model to the in-browser runner **without touching
any runner code**. If your model satisfies the contract below, you only add a
backend catalog row + an `.onnx` file. The runner (Image / Video / Camera tabs),
`yoloEngine`, and the result-card components are model-agnostic and read
everything they need from the catalog API.

If you are a fresh developer (or a fresh AI chat) with no other context: read
this whole file first. You should not need to read the runner source to add a
model that fits the contract.

---

## 1. The model contract

The browser engine (`frontend/src/lib/inference/yoloEngine.js`) expects a very
specific kind of model. A model works **only if all of these hold**:

| Requirement | Detail |
|---|---|
| **Format** | ONNX, with an opset compatible with `onnxruntime-web` (we use **opset 12**). |
| **Architecture** | YOLO-style **detection** head. |
| **Output shape** | `(1, 4 + numClasses, 8400)` — the *transposed* YOLO head. See below. |
| **Input** | A single **square** RGB tensor `(1, 3, S, S)`, pixels normalised to `0..1`, channel-planar (NCHW). `S` is the input size (e.g. `320`, `640`). |
| **Labels** | An array of class names whose **order matches the model's class indices**: index `0` = first label, index `1` = second, … |

### What `(1, 4 + numClasses, 8400)` means

For each of the `8400` candidate boxes the model emits, the channel dimension
holds `4` box coordinates (`cx, cy, w, h`, in input-pixel space) followed by one
score per class (`numClasses` of them). So a 2-class model outputs
`(1, 6, 8400)`, an 80-class COCO model outputs `(1, 84, 8400)`.

`yoloEngine.postprocess()` transposes this on the fly, takes the argmax over the
class scores per box, scales boxes from the square input back to the original
frame, and runs per-class non-max suppression. **The number of classes is read
from `labels.length` — nothing is hardcoded.**

The square input size is whatever you record in the DB (`input_size`).
`preprocess()` simply stretch-resizes the source to `S×S`; `postprocess()` scales
detections back using the original width/height, so no letterbox bookkeeping is
needed.

### What is NOT supported

The current engine is a detection-only engine. These need **engine changes** and
will **not** work by just adding a catalog row:

- **Segmentation** models (mask prototypes / extra output tensors).
- **Classification** models (no boxes).
- **Pose / keypoint** models.
- Any **different output layout** — e.g. the older non-transposed
  `(1, 8400, 4 + numClasses)`, or models that emit `[x1,y1,x2,y2,score,class]`
  rows, or that bake objectness into a separate channel.

If your model is one of these, stop — adding a catalog row will produce garbage
boxes. Extend `yoloEngine.js` first (that is out of scope for this guide).

---

## 2. Step-by-step: add a model

### 2a. Export `.pt` → `.onnx`

Using Ultralytics (the exact settings used for the fire/smoke model):

```python
from ultralytics import YOLO

model = YOLO("your_model.pt")
model.export(
    format="onnx",
    imgsz=640,        # the square input size — record this as input_size in the DB
    opset=12,         # onnxruntime-web compatible
    simplify=True,    # fold/clean the graph
    dynamic=False,    # fixed input size (the engine feeds a fixed S×S tensor)
    half=False,       # full fp32 — webgl/wasm run fp32
)
```

This writes `your_model.onnx` next to the `.pt`.

### 2b. Verify the ONNX output shape matches the contract

```python
import onnxruntime as ort

sess = ort.InferenceSession("your_model.onnx")
out = sess.get_outputs()[0]
print(out.name, out.shape)   # expect [1, 4 + numClasses, 8400], e.g. [1, 6, 8400]
```

If the second dimension is not `4 + numClasses`, or the boxes are on the wrong
axis, the model does **not** fit the contract (see "What is NOT supported").

### 2c. Place the `.onnx`

Copy it into the backend's static models directory:

```
backend/src/statics/models/<name>.onnx
```

(The backend mounts `src/statics` at the URL prefix `/static`, so this file is
served at `/static/models/<name>.onnx`.)

### 2d. Add a catalog entry

Models live in the `models` table and are seeded by
`backend/src/seed_models.py`. Add a new row using the **exact same dict shape**
as the existing seed. `labels` is stored as a **JSON string** (the API parses it
back into an array), and `onnx_url` is built from `BASE_URL` so only one env var
changes between dev and prod:

```python
model = ModelTable(
    name="Your Model Name",
    description="One or two sentences on what it detects and where it's useful.",
    task_type="detection",
    industry="safety",                # free-form category
    accuracy=None,                    # measured mAP once you have it, else None
    onnx_url=f"{BASE_URL}/static/models/<name>.onnx",
    input_size=640,                   # MUST equal the imgsz you exported with
    labels='["class0", "class1"]',    # JSON string; order = model class indices
    license="unknown",                # confirm the base model's license
    is_free=True,                     # gating flag
)
```

> **Labels order is load-bearing.** `labels[0]` must be the class the model emits
> as index `0`. Getting this wrong swaps every label (e.g. "fire" boxes labelled
> "smoke"). Check your training `data.yaml` `names:` order.

The shipped seed script only inserts one specific model and skips if it exists.
To seed several, generalise it into a list, e.g.:

```python
SEED_MODELS = [
    { "name": "...", "description": "...", "task_type": "detection",
      "industry": "...", "onnx_url": f"{BASE_URL}/static/models/<name>.onnx",
      "input_size": 640, "labels": '["...","..."]', "license": "unknown",
      "is_free": True },
    # ...add more dicts here
]
```

…and loop, inserting each by `name` if it doesn't already exist (keep it
idempotent so re-running is safe).

### 2e. Run the seed script

From the `backend/` directory:

```bash
python -m src.seed_models
```

(Set `BASE_URL` in the environment / `.env` first if you're not on
`http://localhost:8000`.)

### 2f. Verify it's live

- `GET /api/v1/models` — your model appears, `labels` is a real JSON **array**.
- `GET /api/v1/models/{id}` — returns it with `onnx_url`, `input_size`, `labels`.
- Open `/model/{id}/run` in the app — the runner loads it. The "Detects" legend
  at the bottom should list your classes with distinct colors.

---

## 3. Verification checklist

Run the model on a known image **and** a known video:

- [ ] Boxes appear around the expected objects.
- [ ] Boxes are in the **right place** (not shifted/scaled — confirms
      `input_size` matches the export `imgsz`).
- [ ] Labels are **correct** (confirms `labels` order matches class indices).
- [ ] NMS is working: roughly **one box per object**, not stacks of overlapping
      duplicates.
- [ ] **Video tab**: dropping a clip starts processing automatically, the
      progress bar advances to 100%, and a result card appears below with an
      annotated, replayable video + a correct "Found N x, M y" summary.
- [ ] **Replaying** a result does **not** re-run the model (CPU/GPU stays idle in
      task manager during replay).
- [ ] Uploading a **second** video works and produces a second card.

If boxes are wrong everywhere, re-check the output shape (§2b) and `input_size`.
If labels are swapped, re-check `labels` order (§2d).

---

## 4. What NOT to touch

These are **model-agnostic** — you should **not** edit them to add a model. If
you find yourself editing one of these to make a model work, your model probably
doesn't fit the contract (§1), and the right fix is the model export, not the
runner:

- `frontend/src/pages/ModelRunnerPage/index.jsx` — the runner page.
- `frontend/src/components/runner/VideoRunner.jsx` — process-once video pipeline.
- `frontend/src/components/runner/ResultCard.jsx` — result "flash cards".
- `frontend/src/components/runner/DetectionCanvas.jsx` — box drawing + colors.
- `frontend/src/lib/inference/yoloEngine.js` — preprocess / inference / NMS math.
- `frontend/src/lib/inference/useOnnxModel.js` + `yoloWorker.js` — session loading
  + the inference Web Worker.
- `frontend/src/lib/videoResultsStore.js` — in-memory results store.

All model-specific values — `onnx_url`, `labels`, `input_size`, class count, and
the per-class colors (derived from `labels`) — come from the catalog API
(`GET /api/v1/models/{id}`). Adding a conforming model is **data, not code**.
