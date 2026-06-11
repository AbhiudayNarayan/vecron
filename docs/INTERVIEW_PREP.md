# Kriya — Interview Preparation Document

> Private study doc. Everything in here is pulled from the actual code as of 2026-06-11
> (branch `main`, HEAD `89f2a18`). Things marked **[BUILT]** exist and work; things marked
> **[PLANNED]** do not exist yet — never claim a planned thing as built in an interview.

---

## 1. ELEVATOR PITCH

### 30-second version

> "Kriya is a marketplace where non-technical users — a farmer, a warehouse manager, a
> waste-sorting facility — can find a specialised ML detection model and run it on their
> own images, videos, or live camera, entirely in the browser, for free, with no account.
> The thesis is that for a continuous, single, well-defined visual task — 'is there fire in
> this frame?' — a small specialised model beats a general-purpose LLM on cost, latency,
> and reliability. The free tier costs me almost nothing to serve because inference runs
> client-side with onnxruntime-web; the planned paid tier moves heavy workloads to cloud
> GPUs. The architecture's core trick: adding a new model to the platform is one database
> row — zero frontend code changes."

### 2-minute version

> "Kriya is a marketplace for specialised computer-vision models, aimed at people who have
> a real recurring detection problem but no ML skills — fire and smoke monitoring at an
> industrial site, sorting waste types at a recycling facility. Today if those people want
> ML they either hire a developer or pipe video frames through a general multimodal LLM API,
> which is expensive, slow, and overkill for a single fixed task running continuously.
> A 10 MB YOLO model fine-tuned on that one task is faster, cheaper, and more consistent.
>
> The product loop: you land on the site, search the catalog by task or industry — no
> login required — open a model's detail page written in plain language, and hit 'Try it
> free'. The runner page loads the model's ONNX file into your browser via onnxruntime-web
> and you can run it three ways: upload an image, drop a video (which gets processed once
> into a downloadable annotated clip), or point your live camera at the scene. Nothing you
> upload ever leaves your device — inference is 100% client-side, which is both a privacy
> story and an economics story: my server serves JSON and static files, it does no compute.
>
> Architecturally, the piece I'm proudest of is the model-agnostic runner. There is a
> 'model contract' — ONNX format, opset 12, a YOLO detection head with output shape
> `(1, 4 + numClasses, 8400)`, a square normalised input — and everything model-specific
> (the file URL, the input size, the ordered class labels) lives in a database row served
> by the catalog API. The inference engine reads all of it as arguments. So onboarding a
> new model is: export to ONNX, drop the file in static storage, run an idempotent seed
> script. Zero frontend changes. I validated that by adding a second model — a 6-class
> garbage classifier — after the runner was built, and it worked without touching runner code.
>
> The backend is async FastAPI with MySQL; auth is JWT but deliberately optional — the
> free tier needs no account, auth exists for personalisation and the future paid tier.
> The paid tier — cloud-GPU inference for heavy workloads — is planned but not built, and
> I've already done the groundwork that matters: every model row carries a `cloud_eligible`
> flag because one of my models is AGPL-3.0 licensed, which is fine to hand to a user's
> browser but legally radioactive to serve as a paid network service."

---

## 2. SYSTEM ARCHITECTURE

### High-level diagram

```
┌─────────────────────────  USER'S BROWSER  ─────────────────────────┐
│                                                                    │
│  React 19 + Vite SPA                                               │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────────────┐    │
│  │ Discover  │  │ Model     │  │ ModelRunnerPage              │    │
│  │ (search)  │  │ Detail    │  │  ├─ Image tab (main thread)  │    │
│  └────┬─────┘  └────┬──────┘  │  ├─ Video tab  (Web Worker)  │    │
│       │             │         │  └─ Camera tab (Web Worker)  │    │
│       │   axios     │         └──────────┬───────────────────┘    │
│       │ (JWT header │                    │                        │
│       │  if logged  │         ┌──────────▼───────────────────┐    │
│       │  in)        │         │ lib/inference                │    │
│       │             │         │  yoloEngine.js (pure fns)    │    │
│       │             │         │  useOnnxModel.js (hook/cache)│    │
│       │             │         │  yoloWorker.js (off-thread)  │    │
│       │             │         │  → onnxruntime-web 1.26.0    │    │
│       │             │         │    webgl EP → wasm fallback  │    │
│       │             │         └──────────────────────────────┘    │
│       │             │  ALL INFERENCE HAPPENS HERE — never server  │
└───────┼─────────────┼─────────────────────┬───────────────────────┘
        │             │                     │ one-time GET .onnx
        ▼             ▼                     ▼
┌────────────────────────────  FastAPI (uvicorn)  ───────────────────┐
│  /api/v1/health        /api/v1/models[?q=]   /api/v1/models/{id}   │
│  /api/v1/auth/register /api/v1/auth/login    /api/v1/auth/me (JWT) │
│  /static/models/*.onnx   ← StaticFiles mount (src/statics)         │
└──────────┬─────────────────────────────────────────────────────────┘
           │ SQLAlchemy async (aiomysql)
           ▼
   MySQL (`vecron`):  users │ models  (FULLTEXT idx ft_models_search)
```

### The core loop, end to end

1. **Land** — `HomePage` (`/`). On app mount, `App.jsx` pings `GET /api/v1/health/` once.
2. **Search/Discover** — `/discover` reads `?q=` from the URL, calls
   `GET /api/v1/models?q=<term>`. The route (`ModelRoute.py`) checks
   `information_schema.STATISTICS` for a FULLTEXT index; if present it runs
   `MATCH(name, description, industry) AGAINST (:q IN NATURAL LANGUAGE MODE)`, else falls
   back to `ILIKE '%q%'` across the same three columns. Response is a list of `ModelOut`
   Pydantic objects — `labels` is stored as a JSON string in the DB and a `field_validator`
   parses it into a real array at the API boundary.
3. **Model detail** — `/model/:id` → `GET /api/v1/models/{id}` (404 with a friendly state
   if missing). Plain-language copy generated from the row's own fields. CTA: "Try it free".
4. **Run** — `/model/:id/run` (`ModelRunnerPage`). Fetches the same row, derives
   `labels`, `numClasses = labels.length`, `inputSize`, `onnx_url`. `useOnnxModel(onnx_url)`
   downloads the ONNX file (the only large transfer — served from `/static`), creates an
   `InferenceSession` (cached by URL app-wide), and spins up a Web Worker with its own session.
   - **Image tab**: preprocess → main-thread inference → postprocess → boxes drawn on a canvas.
   - **Video tab**: process-once — hidden `<video>` plays muted, a rAF loop draws frame +
     latest boxes to a canvas, inference throttled to ~12 fps in the worker, the canvas is
     recorded by MediaRecorder into an annotated WebM. Result card with replay + download.
   - **Camera tab**: `getUserMedia` (rear camera preferred), same rAF + throttle loop, live only.
5. **Results** — video results live in `videoResultsStore.js` (module-level, in-memory,
   `useSyncExternalStore`); they survive tab switches but not refresh. Image results are
   ephemeral component state.

### Why client-side inference is the architecturally significant decision

- **The server does no compute on the free tier.** It serves a few KB of JSON and (once
  per user per model, then browser-cached) a 10–45 MB static file. Free-tier marginal
  cost ≈ bandwidth. That's what makes "free, no login" sustainable for a solo project.
- **Privacy by construction** — user images/video/camera frames never leave the device.
  For a camera-pointing product used in homes and workplaces, that's a feature I can
  state absolutely, not a policy promise.
- **It defines the paid tier** — the paid offering isn't "remove a paywall", it's a
  genuinely different capability: server GPUs for workloads a browser can't handle
  (long videos, batch jobs, RTSP streams, bigger models).
- **The tradeoff** — I gave up control of the execution environment: performance varies
  by device, WebGL availability varies, and the model file is necessarily public (you
  cannot hide a file you hand to the client — which is why paid models will need
  server-side inference, not "secret" URLs).

---

## 3. TECH STACK + WHY EACH CHOICE

| Tech | What/version | Why I chose it | The alternative & why not |
|---|---|---|---|
| **FastAPI** | async Python web framework | Async-native (pairs with async SQLAlchemy), Pydantic validation built in, auto OpenAPI docs at `/docs`, minimal boilerplate for a small API surface | **Flask**: sync-first, validation bolted on. **Django**: way too heavy for 6 endpoints + static files; I don't need its ORM/admin/templates. **Node/Express**: viable, but my ML tooling (Ultralytics export, ONNX verification) is Python — one language across backend + model pipeline |
| **Async SQLAlchemy + aiomysql** | `create_async_engine`, `AsyncSession` | The API is I/O-bound (DB reads + static files); async means one process handles concurrent requests without thread pools. SQLAlchemy gives me an ORM now and raw `text()` when I need it (the FULLTEXT `MATCH...AGAINST` query) | Raw aiomysql: no models/migrations path. Sync SQLAlchemy: blocks the event loop under FastAPI |
| **MySQL** (db `vecron`) | relational store, 2 tables | Relational fits the data (users, a model catalog with fixed columns), FULLTEXT indexes give me decent keyword search for free, and it's what I had operational | **PostgreSQL**: honestly the better long-term choice (pgvector for semantic search is on the roadmap and *requires* it). I'll say this plainly: MySQL was pragmatic, Postgres is the destination. **MongoDB**: I actually started there (commit `a2f3e50`) and migrated away — the catalog is structured/relational, and document flexibility bought me nothing |
| **JWT (python-jose, HS256, 24 h)** | stateless auth tokens | No session store needed; the SPA holds the token and `axiosClient` injects `Authorization: Bearer` automatically; one secret, symmetric signing is fine for a single-service backend | Server sessions: needs sticky state/Redis. OAuth-only: planned later, but email/password had zero external dependencies to ship |
| **bcrypt + SHA-256 prehash** | `bcrypt(sha256(password))` | bcrypt truncates input at 72 bytes; prehashing to a 64-char hex digest sidesteps that silently-truncated-password failure mode entirely | Plain bcrypt: 72-byte trap. Argon2: arguably better, but bcrypt is battle-tested and the prehash pattern is well-understood |
| **React 19 + Vite 8** | SPA frontend | The runner is a highly interactive, stateful client app (rAF loops, workers, MediaRecorder) — exactly what a SPA is for. Vite: instant dev server, and crucially first-class Web Worker support via `new Worker(new URL(...), import.meta.url)` | **Next.js**: SSR buys nothing when the core feature is client-side compute; would complicate worker/wasm setup. **Plain JS**: the runner's state machine (phases, tabs, results store) genuinely needs a component model |
| **Tailwind CSS v4** | utility-first styling | Fast iteration for a solo dev, consistent design tokens, no CSS-file sprawl; v4's Vite plugin is zero-config | CSS modules / styled-components: more ceremony, no benefit at this scale |
| **onnxruntime-web 1.26.0** | browser inference runtime | The de-facto standard for running ONNX in-browser; gives me a WebGL execution provider with automatic WASM fallback; pinned **exactly** (not `^`) because the wasm binaries are fetched from a CDN path containing the version — a routine `npm update` would desync JS from wasm and break all inference | **TensorFlow.js**: would force model conversion to TF format — my training world is PyTorch/Ultralytics, and ONNX is one `model.export()` away. **WebLLM/transformers.js**: wrong tool, those target LLMs |
| **ONNX format (opset 12)** | the model interchange format | Framework-neutral: PyTorch trains, browser runs, and a future cloud GPU tier can run the *same artifact* with onnxruntime-gpu or TensorRT. Opset 12 is the compatibility sweet spot for onnxruntime-web. Export settings: `imgsz=640, opset=12, simplify=True, dynamic=False, half=False` (fixed input, fp32 — webgl/wasm run fp32) | Shipping `.pt`: PyTorch-only, no browser story. TorchScript: same problem |
| **Web Worker for video/camera** | `yoloWorker.js` | A slow forward pass on the main thread freezes the rAF paint loop → janky video. The worker owns its own InferenceSession (sessions aren't transferable); the main thread does `preprocess()` (needs DOM canvas) and **transfers** the Float32Array (zero-copy) with an id-correlated request/response protocol | Main-thread everything: fine for Image (one-shot, I deliberately kept it there), unacceptable for 12 fps loops |

---

## 4. KEY ENGINEERING DECISIONS & TRADEOFFS

### 4.1 The model-agnostic runner — "adding a model = one DB row, zero frontend code"

**Decision.** Every model-specific value lives in the `models` table; the runner and engine
read all of it from `GET /api/v1/models/{id}` at runtime. The engine (`yoloEngine.js`) is
three pure functions — `preprocess(source, inputSize)`, `runInference(session, tensor, inputSize)`,
`postprocess(output, { numClasses, inputSize, confThreshold, iouThreshold, originalWidth, originalHeight })` —
with zero hardcoded model values. `numClasses` is literally `labels.length`. Even the box
colors are generated from the labels array (golden-angle hue spacing in `colorForClass`).

**The model contract** (documented in `frontend/docs/ADDING_A_MODEL.md`):
- ONNX, opset 12 (onnxruntime-web compatible)
- YOLO-style detection head, output shape **`(1, 4 + numClasses, 8400)`** — the transposed
  form: per candidate box, 4 coords (`cx, cy, w, h` in input-pixel space) then one score per class
- Input: single square RGB tensor `(1, 3, S, S)`, NCHW channel-planar, normalised 0..1
- `labels` array order **must** match the model's class indices — index 0 = first label.
  This is load-bearing: get it wrong and every "fire" box says "smoke"
- `input_size` in the DB must equal the export `imgsz` (models export with `dynamic=False`)

**Options considered.** (a) Hardcode per-model components (`FireSmokeRunner.jsx`,
`GarbageRunner.jsx`) — fastest first ship, linear cost per model, marketplace-fatal.
(b) Per-model config files in the frontend bundle — still a frontend deploy per model.
(c) The contract + catalog row — chosen.

**Tradeoff.** The contract is narrow: detection-only. Segmentation, classification, pose,
or a non-transposed output layout need engine changes (the doc says so explicitly — "adding
a catalog row will produce garbage boxes"). I accepted a narrow-but-real contract over a
speculative universal one.

**Outcome — verified.** The second model (Garbage, 6 classes, output `(1, 10, 8400)`) was
added after the runner existed, via seed row + static file only. The audit traced the claim
end to end and confirmed it holds.

**How I describe adding a model (memorise this flow):**
1. `model.export(format="onnx", imgsz=640, opset=12, simplify=True, dynamic=False, half=False)`
2. Verify shape with onnxruntime: expect `[1, 4+nc, 8400]` (I also wrote `verify_onnx.py`,
   which feeds the *identical* preprocessed tensor to the raw PyTorch module and the ONNX
   session and compares raw pre-NMS outputs — max abs diff under 1e-2 — because comparing
   post-NMS `predict()` results is misleading: ultralytics letterboxes .pt and ONNX differently)
3. Copy to `backend/src/statics/models/<name>.onnx`
4. Add a dict to `SEED_MODELS` in `seed_models.py` (labels as a JSON string, order = class
   indices from training `data.yaml`; `onnx_url` composed from `BASE_URL` env)
5. `python -m src.seed_models` (idempotent upsert — descriptive fields sync on every run,
   `onnx_url` only overwritten with `--force`)
6. Verify on a known image and video: boxes in the right place (confirms `input_size`),
   correct labels (confirms ordering), one box per object (confirms NMS)

### 4.2 ONNX files in static storage; DB holds only a URL

**Decision.** `ModelTable.onnx_url` is a `String(255)` URL; the binary lives in
`backend/src/statics/models/`, mounted by FastAPI's `StaticFiles` at `/static`.

**Why not blobs in the DB:** the files are 10–45 MB; serving them through MySQL means every
download is a DB query holding a connection, backups balloon, and you can never put a CDN
in front. Files in static storage stream efficiently and are CDN-ready.

**The detail that makes it production-friendly:** the seed script composes `onnx_url` from
the `BASE_URL` env var, so moving environments changes one env var, not data. (Honest
caveat: the URL is still baked into the *row* at seed time — the audit suggested storing a
relative path and composing the absolute URL in `ModelOut`; that's a known improvement.)

**The known limit:** binaries are in the git repo (repo bloat) and served by uvicorn itself
with no Cache-Control/ETag tuning. The roadmap is object storage (Cloudflare R2) + CDN —
and for paid models, signed URLs, because `StaticFiles` can't do entitlement checks.

### 4.3 Free tier client-side vs paid tier server-side — the boundary

**Decision.** Free = in-browser inference, no account, no metering, marginal cost ≈ static
bandwidth. Paid **[PLANNED]** = cloud GPU inference for what the browser can't do.

**Why the boundary sits there:** it tracks *capability*, not artificial scarcity. A browser
handles one 640×640 frame at a time at ~12 fps on decent hardware. It can't do hour-long
videos, batch jobs, always-on RTSP camera feeds, or 100 MB models. Those are worth paying for.

**Honest status:** the paid tier is currently **a database column** (`is_free` renders a
green badge; `cloud_eligible` tracks license eligibility). There is no payment integration,
no entitlements table, no gated delivery, no GPU service, no metering. Every `onnx_url` is
publicly downloadable today. I know exactly what's missing and the order: payments →
entitlements → signed/gated model delivery → GPU inference service (Modal/RunPod) + job
queue → quotas.

### 4.4 The video pipeline — process-once + bake the annotations

**Decision.** A dropped video is processed exactly once: it plays through muted (hidden
`<video>`), a rAF loop composites frame + latest boxes onto a canvas, and that canvas is
recorded via `canvas.captureStream()` + MediaRecorder into a **new annotated WebM**. Replay
plays the finished file — the model never runs again.

**Options considered.** (a) Re-infer on every replay — simple, but burns compute every
replay and downloads can't include boxes. (b) Server-side ffmpeg burn-in — needs upload
(privacy gone) and server compute (free-tier economics gone). (c) Client-side bake — chosen.

**The fallback chain** (this impresses interviewers — it's defensive design):
- If MediaRecorder is unavailable, or the recorded blob is suspiciously small
  (`MIN_BLOB_BYTES = 1024`), the result switches to a **"stored"** approach: keep the
  original clip + the per-frame detections array (`frames: [{ t, detections }]`, recorded
  during the pass regardless), and **redraw** boxes over the video on replay
  (`StoredReplay` in `ResultCard.jsx`). Still zero re-inference.
- Download from a stored result bakes on demand: `bakeAnnotatedVideo.js` replays the clip
  off-screen drawing the *saved* detections (no inference) and records that. If even that
  fails, it downloads the original — the button always does something.

**Throttling design:** drawing happens every animation frame (smooth), inference is capped
at ~12 fps (`INFER_INTERVAL_MS`), capture at 30 fps, and an `inferBusyRef` flag prevents
overlapping forward passes. Detection boxes "stick" between inference results — drawn from
`latestRef` every frame.

**Tradeoff accepted:** processing time ≈ clip duration (the video plays in real time), and
output is WebM (re-encoded, no audio), not the original container. Known UX gap: no cancel
button, no upfront duration warning.

### 4.5 Auth decoupled from the free tier

**Decision.** Every catalog and inference feature works logged-out. Auth (JWT
register/login/`/me`) exists only for the dashboard today and personalisation/paid later.
The only guarded route is `/dashboard` (via `ProtectedRoute`); no model route has an auth
dependency — `ModelRoute.py` literally has comments saying "PUBLIC — no auth dependency."

**Why this is good architecture:** (1) Zero-friction adoption — the audience is
non-technical users; a signup wall before value kills them. (2) Honest security posture —
the free tier exposes only read-only public endpoints, so there's nothing user-specific to
leak. (3) Clean upgrade path — when paid arrives, auth slots in as the entitlement carrier
without refactoring the free path.

**Auth flow specifics worth knowing cold:** login returns
`{access_token, token_type: "bearer"}`; the token payload is `{sub: str(user.id), email, exp}`;
`MainContext` stores it in localStorage ("keep me signed in") or sessionStorage, validates
it on boot against `/auth/me`, and logs out on failure; `axiosClient` injects the header via
a request interceptor. Register returns 409 on duplicate email via `IntegrityError` catch.

### 4.6 MySQL FULLTEXT now, Postgres + pgvector later

**Decision.** Search today is MySQL FULLTEXT (`MATCH ... AGAINST ... IN NATURAL LANGUAGE MODE`
over `name, description, industry`, index `ft_models_search`) with a runtime-detected
ILIKE fallback so dev environments without the index still work.

**Why this is right for now:** with a catalog measured in tens of models, keyword search is
sufficient and free. Known FULLTEXT gotchas I can recite: words under 3 chars are ignored,
and terms appearing in >50% of rows return nothing in natural-language mode (the fix is
BOOLEAN MODE) — invisible on a small table, real at scale.

**Why semantic search needs Postgres:** the roadmap query is "something that finds rust on
pipes" matching a corrosion-detection model with no keyword overlap. That needs embeddings +
nearest-neighbour search. pgvector gives vector columns, distance operators, and ANN indexes
(HNSW/IVFFlat) inside the relational DB — one store, embeddings next to rows, no separate
vector DB to operate. MySQL had no real equivalent when I chose (9.x vector functions are
immature). So: embed descriptions with a sentence-transformer, store in a `vector` column,
query by cosine distance, likely hybrid with keyword. **[PLANNED]** — no embeddings exist
today, and I deliberately deferred it: paying a DB migration for semantic search before the
catalog has even 100 models is backwards.

---

## 5. HARD PROBLEMS I SOLVED (war stories)

### 5.1 The video-annotation-not-baking bug (commit `f0a0758`)

**Problem.** Boxes rendered perfectly on the live processing canvas, but the downloaded
annotated WebM had no boxes. The worst kind of bug: every individual piece looked correct.

**Investigation.** I ruled out recorder flushing (the `ondataavailable`/`onstop` wiring was
right — `onstop` attached *before* calling `stop()`, blob assembled from all chunks) and
draw order (frame + boxes are drawn synchronously in one rAF task, so the visible canvas
never shows a boxless state — which is exactly why the live view always looked right and
made the bug so confusing).

**Root cause.** `canvas.captureStream(fps)` **auto-samples the canvas on the browser's own
schedule, not synchronised with my rAF composite**. The compositor can latch the canvas
surface after `drawImage(video)` invalidates it but in a state that doesn't include the same
task's overlay strokes. The on-screen element always shows the final composite; the recorder
samples something else. There was also a silent-degradation problem: no telemetry showed
which capture path actually ran.

**Fix.** Manual frame capture: `canvas.captureStream(0)` — frameRate 0 means the browser
*never* auto-samples — then after each tick's composite (`drawImage(video)` →
`drawDetections(...)`), explicitly call `videoTrack.requestFrame()`, throttled to 30 fps.
Every frame handed to the recorder is, by construction, the finished composite. Where
`requestFrame` isn't supported, it falls back to auto-sampling at `CAPTURE_FPS` with a
1-second timeslice. I also use a 2D context with **default options** — no `desynchronized:
true` — so the captured backing store reflects exactly what was drawn. And a blob-validity
check (`blob.size > MIN_BLOB_BYTES`) flips to the stored-detections fallback rather than
shipping a corrupt download. The same mechanism is mirrored in `bakeAnnotatedVideo.js`.

**What I'd say I learned:** browser media APIs have implicit timing contracts that aren't in
the happy-path docs. The live preview and the recording are *different consumers* of the
same canvas, and only one of them was synchronised with my draws.

### 5.2 The AGPL-3.0 license trap

**Problem.** Both shipped models derive from Ultralytics YOLO, which is **AGPL-3.0** (the
Garbage model's own ONNX metadata reports AGPL-3.0 — noted in `seed_models.py`). AGPL's
distinguishing clause: **network use counts as distribution**. Running AGPL-derived software
as a service obliges you to offer the service's source under AGPL.

**Why the current free tier is the safe side of the line:** I distribute model *weights*
to the user's browser and they run them locally — closer to distributing a file than
operating the software as a network service, and the weights' provenance is what matters.
But a **paid cloud-GPU tier where my server runs the AGPL-derived model and sells the
outputs over the network is squarely the AGPL service scenario** — that's where it becomes
a commercial/legal blocker. (I'd add honestly: I'm not a lawyer, weights-licensing is
legally murky everywhere, so my policy is conservative.)

**The engineering response:** a `cloud_eligible` boolean on every model row, default
`False`, with the rule encoded in a comment on the column: *"AGPL/unknown-license models
must stay False (free, in-browser tier only)."* Both seeded models are `cloud_eligible:
False`. The paid tier, when built, simply never serves a model whose flag is false. The
longer-term options: Ultralytics Enterprise License, architectures with permissive licenses
(many YOLO variants are Apache-2.0), or training from scratch.

**Why this is a strong story:** most candidates have never thought about model licensing.
Catching a legal landmine *before* monetisation, and encoding the constraint in the schema
so it can't be forgotten, is exactly the judgment interviews probe for.

### 5.3 Security fixes from the audit (all three are **[BUILT]** — verified in current code)

**SECRET_KEY hardcoded fallback → forgeable JWTs.** Original code:
`SECRET_KEY = os.getenv("SECRET_KEY", "change-this-before-production")`. If the env var was
ever missing, the app started silently with a *publicly known* signing key — anyone reading
the repo could mint a valid JWT for any user id and walk through `get_current_user`.
Worse than no auth, because it looks like auth. Fix (`hashing.py`): no fallback —
`RuntimeError` at import time with instructions to generate a key
(`secrets.token_urlsafe(32)`). Fail-fast over fail-open: a config mistake is now a crash at
boot, not a silent vulnerability in prod.

**Malformed CORS.** Original: `allow_origins=["http://localhost", "*"]` with
`allow_credentials=True` — `*` + credentials is an invalid combination browsers reject, and
`*` in production is wrong regardless. Fix (`app.py`): explicit origins from a
comma-separated `ALLOWED_ORIGINS` env var, defaulting to the Vite dev server
(`http://localhost:5173`). Production adds its domain via env, never code.

**ONNX runtime version pinning.** `package.json` allowed `^1.26.0` while both
`useOnnxModel.js` and `yoloWorker.js` hardcode the CDN wasm path
`.../onnxruntime-web@1.26.0/dist/`. A routine `npm update` would bump the JS to 1.27 while
still fetching 1.26 wasm binaries — desynced artifacts, all inference breaks, and nothing
in CI would catch it. Fix: pinned exactly `"onnxruntime-web": "1.26.0"`.

### 5.4 YOLO output postprocessing — getting raw tensors to correct boxes

**Problem.** onnxruntime-web hands back one flat `Float32Array` with dims `[1, 6, 8400]`
(fire/smoke) — 50,400 floats. Everything else is index math I had to get exactly right,
with no library help (no ultralytics postprocessing in the browser).

**The pipeline in `yoloEngine.postprocess()`:**
1. **Layout** — `(1, 4+nc, 8400)` is *channel-major*: all 8400 cx values, then all cy, then
   w, h, then 8400 scores for class 0, etc. So channel `c` of box `i` lives at
   `data[c * numBoxes + i]` — I "transpose" via index arithmetic instead of materialising a
   transposed copy (no 50k-element allocation per frame, which matters at 12 fps).
2. **Argmax over class scores** per box: loop `c` in `0..numClasses`, read
   `data[(4 + c) * numBoxes + i]`, keep best score + class. Below `confThreshold` (0.4) → skip.
   Note: modern YOLO heads have no separate objectness channel — class scores are it.
3. **Decode** — `cx, cy, w, h` (center format, input-pixel space) → corners:
   `x1 = (cx - w/2) * scaleX` etc., with `scaleX = originalWidth / inputSize`. Because
   `preprocess` does a plain stretch-resize to S×S (no letterboxing), scaling back by
   width/height independently is exactly correct — I traded a tiny accuracy edge for zero
   padding bookkeeping, on both ends.
4. **Clamp** to image bounds.
5. **Per-class NMS** — sort by score descending; greedily keep the best, drop same-class
   boxes with IoU > 0.45. Different classes never suppress each other (overlapping fire and
   smoke boxes are both real). 8400 candidates collapse to a handful of clean boxes.

**How I'd debug it on a whiteboard:** wrong-everywhere boxes → output layout or input_size
mismatch; boxes offset/scaled → scale-back math; swapped names → labels ordering; stacks of
duplicate boxes → NMS. Each failure mode has a distinct signature — that's also the
verification checklist in `ADDING_A_MODEL.md`.

### 5.5 (Bonus, if asked about the ML side) Training the fire/smoke model

I trained YOLOv11n myself (`data/yolo_v11n/train_ablation.py`) on a unified ~32k-image
dataset: 250 epochs (patience 30), imgsz 1280, batch 12 on a ~7 GB VRAM budget, SGD with
cosine LR (0.01 → 0.001), 5 warmup epochs. Deliberate choices: doubled the classification
loss weight (`cls=1.0` vs default 0.5) because fire-vs-background discrimination was the
failure mode; `mixup=0.1` to force fire-vs-lamp texture discrimination; `flipud=0.0` because
fire doesn't appear upside down; random erasing 0.1 so partial occlusion still detects. The
run was an ablation benchmark against YOLOv8n/YOLO26n. (Note: deployed `fire_smoke_v1.onnx`
is exported at 640 even though training used 1280.)

---

## 6. LIKELY INTERVIEW QUESTIONS + STRONG ANSWERS

### Architecture

**Q1. Why client-side inference instead of server-side?**
> Three reasons, in order: economics, privacy, and product clarity. A free tier with
> server-side GPU inference bleeds money on every request; client-side, my marginal cost is
> static-file bandwidth, so "free, no login" is actually sustainable. Privacy: user images
> and camera frames never leave the device — that's a guarantee by construction. And it
> makes the paid tier a real capability difference — cloud GPUs for what a browser can't
> do — rather than an artificial paywall. The cost I accepted: I don't control the
> execution environment, so performance varies by device, and model files are inherently
> public — which is exactly why paid models must be server-side, not "hidden" URLs.

**Q2. Walk me through what happens when a user runs a model on an image.**
> The runner page fetches the model row — `onnx_url`, `input_size`, `labels`. The
> `useOnnxModel` hook downloads the ONNX file and creates an InferenceSession, cached by
> URL so remounts don't re-fetch or re-compile; it tries the WebGL execution provider and
> falls back to WASM. On upload, `preprocess` draws the image to a 640×640 canvas, reads
> RGBA pixels, repacks to channel-planar NCHW Float32 normalised 0–1. `runInference` wraps
> it in an `ort.Tensor` and runs the session using its declared input/output names — so the
> engine doesn't care how the model was exported. `postprocess` decodes the
> `(1, 4+nc, 8400)` output: argmax over class scores, confidence filter at 0.4, center→
> corner conversion, scale back to original pixels, clamp, per-class NMS at IoU 0.45. The
> boxes render on a canvas sized to the image's natural resolution, scaled with CSS so they
> line up at any display size.

**Q3. How does adding a new model work?**
> *(Recite the 6-step flow from §4.1 — export with exact settings, verify shape, copy file,
> seed row, run seed, verify with the checklist. Then the punchline:)* The runner never
> changes because every model-specific value — URL, input size, labels, class count, even
> box colors — is derived from the catalog row at runtime. I proved it by adding the
> 6-class garbage model after the runner was built: data, not code. And the contract's
> limits are documented — a segmentation or pose model does *not* fit, and the doc says
> "stop, extend the engine first" rather than letting someone ship garbage boxes.

**Q4. Why a Web Worker for video but main-thread for images?**
> Cost-benefit per case. The Image tab infers once per upload — a brief main-thread block
> on a one-shot action is imperceptible, so I kept it simple. Video runs a rAF paint loop
> at display rate with inference up to 12 fps; a 100–300 ms forward pass on the main thread
> would visibly stutter the canvas. The worker owns its own session because sessions aren't
> transferable; the main thread still does `preprocess` because it needs a DOM canvas, and
> transfers the tensor's ArrayBuffer — moved, not copied — with id-correlated
> request/response and pending-promise rejection if the worker is terminated mid-flight.

**Q5. Why is replay of a processed video "free"?**
> Process-once architecture. During the single pass I produce an annotated WebM with boxes
> baked into the pixels — replay is literally playing a file. If MediaRecorder fails, the
> fallback stores per-frame detections and redraws them by timestamp on replay. Either
> path: zero re-inference. The principle: never recompute what you can store.

**Q6. How do frontend and backend stay decoupled?**
> The frontend's only knowledge of the backend is `VITE_APP_BACKEND_URI` plus a small JSON
> API. The API never leaks ORM objects — everything goes through `ModelOut`, which also
> normalises `labels` from a stored JSON string to a real array at the boundary. The
> contract is small enough that I could move the backend to a different framework and the
> frontend wouldn't notice.

### ML / inference

**Q7. Explain the output shape `(1, 6, 8400)`.**
> Batch of 1; 6 channels = 4 box coordinates (cx, cy, w, h) + 2 class scores (smoke, fire);
> 8400 candidate boxes — that's the YOLO anchor-free grid at 640 input: 80×80 + 40×40 +
> 20×20 = 8400 locations across three strides. It's transposed (channel-major), so I index
> as `data[c * 8400 + i]` rather than physically transposing. For the 6-class garbage
> model it's `(1, 10, 8400)` — the engine derives the class count from `labels.length`.

**Q8. Why no letterboxing in preprocess? Doesn't stretch-resize hurt accuracy?**
> Slightly, on extreme aspect ratios — and I accepted that deliberately. Letterboxing
> preserves aspect ratio but requires the exact pad/scale bookkeeping to be inverted in
> postprocess; any mismatch shifts every box. Stretch-resize means postprocess scales back
> with two independent factors and is correct by construction. For the v1 of a product
> whose users judge "is the box on the fire?", correctness and simplicity beat a marginal
> mAP gain. If accuracy complaints came in on wide CCTV footage, letterboxing is a
> contained change inside two engine functions.

**Q9. Where do the conf/IoU thresholds come from? Why aren't they per-model?**
> 0.4 confidence and 0.45 IoU — standard YOLO defaults, validated by eye on both models.
> Honest answer: they're currently hardcoded at the call sites in the runner, duplicated
> across the three tabs. They *should* be columns on the model row — a safety-critical fire
> model might want high recall at 0.25 while a noisy model wants 0.6 — and that's a
> one-migration change thanks to the contract design. It's on my list.

**Q10. How do you know the ONNX export didn't change the model's behaviour?**
> I wrote `verify_onnx.py` for exactly this. The trap is comparing `predict()` outputs —
> ultralytics letterboxes .pt models rectangularly but pads ONNX to a fixed square, so
> post-NMS boxes differ slightly even when the export is perfect. The authoritative test
> feeds the *identical* preprocessed tensor to the raw PyTorch module and the ONNX session
> and compares raw pre-NMS tensors — I require max absolute difference within 1e-2. That
> isolates export fidelity from pipeline differences.

**Q11. WebGL vs WASM — what actually runs?**
> I request `["webgl", "wasm"]` in order; ORT falls back automatically if WebGL can't
> initialise. WASM is pinned single-threaded because multi-threaded wasm needs
> cross-origin isolation (COOP/COEP headers), which would complicate hosting for a
> performance gain I didn't need at 12 fps. The wasm artifacts load from a jsdelivr CDN
> pinned to the exact installed version. Honest gap: I don't currently *telemeter* which
> provider actually ran on a given device — I'd add that before optimising further.

**Q12. Why ~12 fps inference for video/camera?**
> Empirical envelope: a 640 forward pass in-browser takes roughly 80–200 ms on typical
> hardware, so 12 fps is near the ceiling anyway, and fire/smoke/garbage scenes don't
> change meaningfully in 80 ms. Drawing still happens every animation frame, with the
> latest boxes persisted between inference results, so the *perceived* output is smooth.
> An `inferBusy` flag ensures a slow device degrades to lower effective fps instead of
> queueing up a backlog of stale frames.

### Security

**Q13. Where are JWTs stored, and what's the risk?**
> localStorage (or sessionStorage without "remember me") — which is XSS-readable, and I'll
> name that tradeoff before you do. Mitigations: 24-hour expiry, no refresh token to steal,
> and React's default escaping plus no dangerouslySetInnerHTML anywhere. The hardening path
> is httpOnly cookies + CSRF protection, or at minimum a refresh-token rotation scheme.
> For the current threat model — the token only gates a profile page — it's proportionate;
> before payments it gets upgraded.

**Q14. What was the worst security issue you found in your own code?**
> The SECRET_KEY fallback. `os.getenv("SECRET_KEY", "change-this-before-production")` —
> a missing env var meant every JWT was signed with a key sitting in a public repo, so
> anyone could forge a token for any user. The fix is fail-fast: the app refuses to start
> without a real key. The lesson I took: defaults for secrets are never convenience,
> they're vulnerabilities — config errors should crash loudly at boot, not degrade silently.

**Q15. What security work remains? (Be ready to volunteer this.)**
> No rate limiting — `/auth/login` is brute-forceable at line speed, and register's 409
> leaks account existence. Password policy is client-side only — the API accepts "a".
> `get_current_user` does an unguarded `int(user_id)`, so a non-numeric `sub` 500s instead
> of 401s. `echo=True` on the SQLAlchemy engine logs every query — a perf drag and a
> data-leak vector in prod logs. And there's no HTTPS story until deployment fronts it.
> None are redesigns; they're hardening — slowapi on auth routes, server-side validators,
> a try/except, an env flag.

### Scalability

**Q16. What breaks at 1,000 users?**
> The first thing to fall over is model-file delivery: every first visit to a runner pulls
> 10–45 MB through a single uvicorn process's StaticFiles mount, with no Cache-Control or
> ETag tuning, competing with API requests. At 100 users it's noticeable; at 1,000 it's the
> outage. The fix is staged: cache headers now (the files are immutable-by-name), then
> object storage + CDN. Second: `GET /models` has no pagination — fine at 2 models, a
> growing payload at 200. Third: the search endpoint runs an information_schema query on
> *every* request to detect the FULLTEXT index — should be detected once at startup.
> Fourth: `echo=True` and a single uvicorn worker. What *doesn't* break is the part that
> matters: inference scales with the users' own devices. My server's job stays "serve JSON
> and files" — that's the architecture doing its job.

**Q17. Your runner only handles YOLO detection — how would you support classification or pose?**
> The seam is already there: the engine is three pure functions behind a uniform call
> shape, and the catalog has a `task_type` column. I'd formalise a runtime registry — map
> `task_type` to an engine module: `detection` → current yoloEngine; `classification` →
> trivial (argmax over logits, no boxes — render label chips instead of a canvas overlay);
> `pose` → decode the keypoints layout `(1, 4 + nc + K*3, 8400)` and draw skeletons.
> MediaPipe pose/hands is on the roadmap as a second *runtime*, not just a second model —
> which proves out the registry pattern. The UI tabs and the result-card system stay; what
> varies per task is the postprocess + the overlay renderer. The honest part: today the
> contract is detection-only and the docs say so explicitly — I'd rather have one runtime
> that demonstrably works than three half-tested ones.

**Q18. How would you build the paid GPU tier concretely?**
> Serverless GPU — Modal or RunPod — because a queue-based, scale-to-zero service matches
> bursty workloads and a solo budget; no idle GPU bill. Flow: authenticated upload to
> object storage → enqueue a job (model id, params) → GPU worker runs onnxruntime-gpu with
> the *same ONNX artifact* the browser uses (that's the payoff of standardising on ONNX) →
> annotated output + detections JSON back to storage → frontend polls or gets a webhook.
> Before any of it: payments + entitlements table, signed URLs for gated models, quotas.
> And the gate the schema already enforces: only `cloud_eligible = True` models — which
> today is neither model, because of AGPL. Resolving licensing is genuinely the first task
> of the paid tier, and I knew that early enough to encode it in the schema.

**Q19. Why no pagination / migrations / tests yet? (the "engineering maturity" probe)**
> Sequencing, not ignorance — and I can show the list. Pagination is queued in the audit
> (W2) for when the catalog grows beyond a screenful; building it for 2 models would have
> been procrastination-by-engineering. Migrations: the schema is `create_all` only, and
> Alembic is queued before the next schema change, not after it hurts. Tests are the
> weakest point, full stop: the highest-value targets are `yoloEngine.postprocess` and NMS
> — pure functions, trivially testable with a fixed tensor fixture, and they protect the
> most fragile math in the system. That's the first test file I'd write, and I can describe
> it precisely: feed a hand-built `(1, 6, 8400)` array with known boxes, assert decoded
> coordinates, class assignment, and suppression behaviour.

### Product

**Q20. Who is the user, really? Would a farmer actually use this?**
> The honest version: the near-term user is a small operation with a recurring visual
> monitoring task and a person who can point a phone — waste sorting lines, warehouse
> safety checks, site inspections. The detail pages are deliberately written in plain
> language ("Point your camera at what you're working with and this spots smoke, fire…")
> and the free-no-login tier exists precisely because this audience won't create an
> account to evaluate a tool. Is the current two-model catalog a business? No — it's a
> platform thesis with a working core loop. The catalog is the moat to build.

**Q21. Why would someone pay if the free tier runs the same models?**
> They pay for scale and integration, not access: hour-long footage, batch jobs, always-on
> RTSP feeds, an API their own system can call, persisted run history. The browser tier is
> simultaneously the demo and the trust-builder — you've *seen* the model work on your own
> data before paying. And some future models will be paid-only (`is_free` exists for that),
> served exclusively server-side where they can't be downloaded.

**Q22. What's the weakest part of the system?**
> Two candidates, depending on the lens. Technically: test coverage — zero automated tests
> around the inference math, which is exactly the code where a subtle index bug produces
> plausible-looking-but-wrong boxes. Product-wise: the paid tier is a flag in a database —
> the gap between "marketplace with a paid tier" as a pitch and what's built is the biggest
> honesty gap in the project, which is why I'm careful to present it as free-tier-built,
> paid-tier-designed. I'd rather name both before an interviewer finds them.

**Q23. What would you do differently if starting over?**
> Postgres from day one — MySQL was operationally convenient, but pgvector is on the
> roadmap, so I've signed up for a migration I could have avoided. Alembic from the first
> table. Tests alongside `yoloEngine` while the math was fresh. And I'd resolve model
> licensing *before* training and shipping — I caught AGPL before monetisation, but the
> right time was before the catalog had entries at all. What I'd keep: client-side
> inference, the model contract, and process-once video — those three decisions carried
> the project.

### Curveballs

**Q24. What happens if two people upload the same video at once?**
> Nothing interesting — and that's the point. Each user's inference runs in their own
> browser; there is no shared compute, no queue, no contention. The only shared resource
> is static-file serving. Client-side inference makes the free tier embarrassingly parallel.

**Q25. Why is `labels` a JSON string in a TEXT column instead of a join table?**
> Labels are an ordered list whose *position* encodes the model's class index — order is
> the data. A normalised table needs an index column to preserve that, plus a join on every
> catalog read, for a list that's never queried by element. The Pydantic schema parses the
> string into a real array at the API boundary with a defensive validator, so clients never
> see the storage detail. If I ever need "find all models that detect fire", I'd revisit —
> or use a JSON column type with a generated index.

**Q26. The model file is public. Couldn't someone just take it?**
> Yes — and for free models that's accepted, even embraced; the homepage tells developers
> to download the ONNX. You fundamentally cannot hide a file you hand to a browser to
> execute. The real conclusion is the inverse: any model that must be protected can never
> ship to the free tier — that's a second, independent reason (beyond capability) why paid
> models are server-side only.

**Q27. How do you know your in-browser results match what the model "should" produce?**
> Chain of custody: `verify_onnx.py` proves export fidelity (identical tensor → raw outputs
> within 1e-2 of PyTorch). In the browser, the same opset-12 graph runs on ORT; my
> preprocess matches the export contract (640 square, RGB, 0–1, NCHW); and the visual
> checklist — box placement, label correctness, NMS behaviour — catches integration error
> classes, each with a distinct signature. What I don't have is an automated end-to-end
> browser test asserting detections on a golden image; that's on the test backlog.

**Q28. Why a monorepo?**
> Solo developer, tightly coupled API contract, one history. When the frontend's `ModelOut`
> shape changes, the commit shows both sides. The cost — repo bloat from `.onnx` and
> training artifacts — is real (the repo carries ~100 MB of binaries) and the fix is git-LFS
> or object storage, queued with the R2 move.

**Q29. What does `cloud_eligible` do today, functionally?**
> Nothing at runtime — and that's deliberate and worth saying precisely: it's a constraint
> recorded in the schema *ahead of* the feature that will enforce it, so the paid tier
> can't be built forgetfully. It's documentation that lives where the enforcement point
> will be. Both rows are `False` today because one model's ONNX metadata reports AGPL-3.0
> and the other's base-model license is unconfirmed.

**Q30. How is the paid tier actually gated right now?**
> It isn't — candidly. `is_free` renders a badge; every model is downloadable; there's no
> payment, entitlement, or metering code. What exists is the *architecture* for the
> boundary: client-side free tier with near-zero serving cost, ONNX as the artifact both
> tiers share, the `cloud_eligible` licensing gate, and a swappable results store designed
> for server persistence. I'd rather present a real free tier and a designed paid tier than
> a half-built paywall.

---

## 7. SCALABILITY & WHAT'S NEXT

Frame as: *"I keep a prioritised audit (docs/AUDIT.md) — quick wins, worth-its, and
deliberately-deferred items. Here's the honest map."*

### Current limits (know these cold — volunteering them builds credibility)
- **Static serving through uvicorn** — no cache headers; first bottleneck under load.
- **No pagination** on `GET /models` — returns every row.
- **In-memory results** — video results vanish on refresh; nothing warns the user. The
  store was deliberately built as a tiny CRUD surface so a backend swap needs no UI changes.
- **Per-request FULLTEXT-index detection** — an extra information_schema round trip per search.
- **`echo=True`** on the engine — SQL logging always on.
- ~~`input_size || 416` fallback~~ — **fixed 2026-06-11**: fallback is now 640, matching
  the fixed-size exports and the DB default. Good interview beat: "the audit caught a
  latent crash (a null `input_size` would feed a 416 tensor to a fixed-640 graph and
  throw), one-line fix."
- **Image-tab object URLs never revoked** — slow leak across many uploads.
- **No cancel** for video processing (which takes ≈ clip duration), no "results lost on
  refresh" warning, no annotated-image download on the Image tab.
- **No DB migrations, no automated tests, single uvicorn worker, no rate limiting.**
- **Accuracy column is null** for both models — cards show "—" (mAP measurement TODO).

### Roadmap (all **[PLANNED]** — ordered, with reasons)
1. **Quick wins from the audit** — cache headers, pagination, startup-cached index check,
   echo flag, 416→640 fallback, rate limiting on auth.
2. **Object storage (Cloudflare R2) + CDN for ONNX files** — removes the main bottleneck
   and the repo bloat; prerequisite for signed URLs.
3. **Paid GPU tier** — Modal/RunPod serverless GPU, job queue, payments + entitlements,
   signed model delivery, quotas. **Blocked first by license resolution (AGPL).**
4. **Semantic search** — Postgres migration + pgvector, description embeddings, hybrid
   keyword+vector. Deferred until the catalog scale justifies the migration.
5. **Multi-runtime support** — task_type → engine registry; MediaPipe pose/hands as the
   second runtime; classification as the cheapest first expansion.
6. **OAuth (Google/GitHub)** — buttons exist as stubs; needs the backend flow.
7. **Server-persisted run history** — gives the dashboard a purpose; the results store was
   shaped for exactly this swap.

---

## 8. METRICS / FACTS TO MEMORISE

### Catalog & models
| Fact | Value |
|---|---|
| Models in catalog | **2** — Fire & Smoke Detection (id 1), Garbage Classification |
| Fire/smoke ONNX size | **10,604,939 bytes ≈ 10.6 MB** (`fire_smoke_v1.onnx`) |
| Garbage ONNX size | **44,754,277 bytes ≈ 44.8 MB** (`Garbage_classification.onnx`) |
| Fire/smoke labels (order matters) | `["smoke", "fire"]` → output `(1, 6, 8400)` |
| Garbage labels | `["BIODEGRADABLE","CARDBOARD","GLASS","METAL","PAPER","PLASTIC"]` → output `(1, 10, 8400)` |
| Input size (both) | **640** (square, fixed — `dynamic=False`) |
| Why 8400 | 80² + 40² + 20² grid cells at strides 8/16/32 on a 640 input |
| Export settings | `imgsz=640, opset=12, simplify=True, dynamic=False, half=False` (fp32) |
| Licenses | Garbage: **AGPL-3.0** (per ONNX metadata); fire/smoke: unknown/unconfirmed. Both `cloud_eligible=False`, both `is_free=True` |
| Accuracy column | **null for both** (mAP not yet measured — say so if asked) |

### Inference engine numbers
| Fact | Value |
|---|---|
| Confidence threshold | **0.4** · IoU threshold (NMS): **0.45** |
| Video/camera inference cap | **~12 fps** (`INFER_INTERVAL_MS = 1000/12`) |
| Capture/record rate | **30 fps** (`CAPTURE_FPS`), manual `requestFrame()` via `captureStream(0)` |
| Min valid blob | **1024 bytes** (`MIN_BLOB_BYTES`) else stored fallback |
| Execution providers | `["webgl", "wasm"]`, wasm single-threaded (avoids COOP/COEP) |
| WebM codecs tried | vp9 → vp8 → plain `video/webm` |
| Tensor size fed | `1×3×640×640` Float32 = **4,915,200 bytes ≈ 4.9 MB** per frame |

### Stack versions
| Piece | Version |
|---|---|
| React | 19.2 · Vite 8 · Tailwind v4 · react-router-dom v7 · axios 1.16 |
| onnxruntime-web | **1.26.0 — pinned exact**, wasm from jsdelivr CDN at matching version |
| Backend | FastAPI (async) · SQLAlchemy async + aiomysql 0.3.2 · Python 3.13 venv |
| DB | MySQL, database **`vecron`**, FULLTEXT index `ft_models_search (name, description, industry)` |
| JWT | python-jose, **HS256**, **24 h** expiry, payload `{sub: user_id, email, exp}` |
| Hashing | bcrypt over SHA-256 hex prehash (sidesteps bcrypt's 72-byte limit) |

### API surface (6 routes + static)
`GET /api/v1/health/` · `POST /api/v1/auth/register` (409 on dup) · `POST /api/v1/auth/login`
· `GET /api/v1/auth/me` (the only JWT-protected route) · `GET /api/v1/models[?q=]` ·
`GET /api/v1/models/{id}` (404) · `GET /static/models/*.onnx`

### DB schema (two tables)
- **users**: id, name(100), email(255, unique, indexed), password(255), created_at, address, mobile
- **models**: id, name(120), description(Text), task_type(50), industry(80), accuracy(Float, null),
  onnx_url(255), input_size(default 640), labels(Text, JSON string), license(default "unknown"),
  is_free(default True), **cloud_eligible(default False)**

### Training run (fire/smoke, if the ML conversation goes deep)
YOLOv11n · ~32k images · 250 epochs (patience 30) · imgsz **1280** train / **640** export ·
batch 12 (~7 GB VRAM) · SGD, lr 0.01→0.001 cosine, 5 warmup epochs · `cls` loss weight
doubled to 1.0 · mixup 0.1 (fire-vs-lamp) · `flipud=0.0` (fire isn't upside down) ·
seed 42 · ablation vs YOLOv8n/YOLO26n

### Timeline (from git)
initial → MongoDB version → MySQL migration → registration → auth complete (`4241a54`) →
catalog + runner + video fix (`f0a0758`, the big commit: engine, video pipeline, audit,
docs, security fixes) → live camera + 404 page + branding (`89f2a18`, 2026-06-11)

---

*Generated 2026-06-11 from a full read of the codebase. Companion docs:
`docs/AUDIT.md` (the prioritised findings) and `frontend/docs/ADDING_A_MODEL.md` (the model contract).*
