# Kriya — Codebase Audit (Phase 1)

Date: 2026-06-10 · Scope: full read of `backend/src`, `frontend/src`, `frontend/docs`, seed/config files. No code was changed.

---

## 1. Architecture map

### Backend — FastAPI (async) + SQLAlchemy + MySQL (`vecron`)

| Piece | File | Notes |
|---|---|---|
| App entry | `backend/src/app.py` | CORS, `create_all` on startup, mounts `src/statics` at `/static`, registers 3 routers |
| DB engine | `backend/src/config/db.py` | async `aiomysql`, creds from `.env`, `echo=True` (always on) |
| Users | `backend/src/models/User.py` | `users` table + Pydantic register schema in one file |
| Catalog | `backend/src/models/Model.py` | `models` table: name, description, task_type, industry, accuracy, onnx_url, input_size, labels (JSON string), license, is_free |
| Auth | `backend/src/routes/AuthRoute.py` | `/api/v1/auth` — register (409 on dup email), login (JWT), `/me` (protected) |
| Catalog API | `backend/src/routes/ModelRoute.py` | `/api/v1/models` — public list + `?q=` search (FULLTEXT with LIKE fallback), `/{id}` with 404 |
| Health | `backend/src/routes/PublicRoute.py` | `/api/v1/health/` |
| Deps | `backend/src/utils/deps.py` | `get_db`, `get_current_user` (JWT decode → DB lookup) |
| Hashing/JWT | `backend/src/utils/hashing.py` | bcrypt over a SHA-256 prehash; HS256 JWT, 24h expiry |
| Response schema | `backend/src/schemas/model_schema.py` | `ModelOut`, parses `labels` JSON string → list |
| Seed | `backend/src/seed_models.py` | Idempotent upsert of 2 models; `onnx_url` built from `BASE_URL` env |
| Static models | `backend/src/statics/models/*.onnx` | fire_smoke_v1, Garbage_classification |

### Frontend — React 19 + Vite 8 + Tailwind v4

- **Shell**: `main.jsx` → `BrowserRouter` → `MainProvider` (auth context) → `App.jsx` (Navbar / Routes / Footer). Routes: `/`, `/discover`, `/model/:id`, `/model/:id/run`, `/login`, `/register`, `/dashboard` (the only guarded route, via `ProtectedRoute`). **No catch-all 404 route.**
- **Auth**: `context/MainContext.jsx` — boot-time token validation against `/auth/me`; `login(token, rememberMe)` picks localStorage vs sessionStorage; `utils/axiosClient.js` injects `Bearer` header from storage. Base URL from `VITE_APP_BACKEND_URI`.
- **Inference engine** (`lib/inference/`):
  - `yoloEngine.js` — pure functions: `preprocess` (stretch-resize → NCHW float32), `runInference` (uses session's declared IO names), `postprocess` (transposed `(1, 4+C, 8400)` decode, argmax, scale-back, clamp, per-class NMS). Zero model-specific values.
  - `useOnnxModel.js` — session cache keyed by URL (in-flight promise dedupe, eviction on failure), main-thread session for the Image tab, plus a Web Worker (`yoloWorker.js`) for the Video tab with id-correlated request/response protocol and transferable tensors. ORT wasm artifacts from a jsdelivr CDN pinned to 1.26.0, single-threaded (avoids COOP/COEP).
- **Runner** (`pages/ModelRunnerPage` + `components/runner/`):
  - Page fetches `/models/{id}`, derives `labels`, `numClasses = labels.length`, `inputSize`, `onnx_url`. Tabs: Image (main-thread), Video (worker), Camera (disabled "Soon").
  - `VideoRunner.jsx` — process-once pipeline: hidden `<video>` plays once muted, rAF tick draws frame + latest boxes to a visible canvas, inference throttled to ~12 fps in the worker, canvas recorded via `captureStream(0)` + manual `track.requestFrame()` (auto-sampling fallback) into a WebM via MediaRecorder. On `ended` → blob → result card. Fallback "stored" path keeps the original clip + per-frame detections and redraws on replay.
  - `ResultCard.jsx` / `DetectionCanvas.jsx` — playback cards (baked vs stored-replay), shared `drawDetections`, golden-angle per-class colors.
  - `lib/videoResultsStore.js` — module-level store + `useSyncExternalStore`, survives tab switches, revokes object URLs on remove/clear.
  - `lib/bakeAnnotatedVideo.js` — on-demand bake for stored-fallback downloads (same captureStream mechanism).

### The "add a model = one catalog row, zero frontend code" promise — **VERIFIED, it holds**

Traced end to end: the runner reads `onnx_url`, `labels`, `input_size` from the API; `numClasses` is `labels.length`; colors derive from labels; the engine takes all of these as arguments; VideoRunner/ResultCard receive them as props. Nothing in the runner mentions fire/smoke. `frontend/docs/ADDING_A_MODEL.md` documents the contract precisely (ONNX opset 12, transposed `(1, 4+C, 8400)` head, square NCHW input). Two caveats:

1. **Latent bug**: `ModelRunnerPage` falls back to `inputSize = model.input_size || 416` (`pages/ModelRunnerPage/index.jsx:91`). Models are exported with `dynamic=False` at 640 — if the API ever returns a null `input_size`, feeding a 416×416 tensor to a fixed-640 model **throws**, it doesn't degrade. Fallback should be 640 (the DB default).
2. The promise only holds for models matching the contract — the doc says so explicitly, which is correct and honest.

---

## 2. What's solid — do not touch

- **`yoloEngine.js`** — the math is correct: NCHW packing, transposed-head index arithmetic, argmax-over-classes, center→corner conversion, bounds clamping, per-class NMS with correct IoU. Genuinely model-agnostic.
- **The worker pipeline** (`useOnnxModel.js` + `yoloWorker.js`) — session caching with in-flight dedupe and failure eviction, transferable tensor handoff, request-id correlation, pending-promise rejection on terminate. Well built.
- **The model-agnostic runner contract** + `ADDING_A_MODEL.md` — the doc is excellent (contract, export settings, verification checklist, "what NOT to touch").
- **Auth core** — bcrypt with SHA-256 prehash (correctly sidesteps the 72-byte limit), JWT with expiry, `/me` boot validation, IntegrityError → 409, remember-me storage split. The *flow* is sound (gaps listed in §5 are hardening, not redesign).
- **`videoResultsStore.js`** — minimal CRUD + `useSyncExternalStore`, object-URL hygiene, deliberately swappable for a backend.
- **Seed script** — idempotent upsert, descriptive-fields sync, `BASE_URL`-driven URLs, `--force` guard on `onnx_url`.
- **Discover / ModelDetail / ModelRunner state handling** — consistent loading-skeleton / empty / error / notfound states with friendly copy. This is the house pattern; new pages should copy it.
- **`ModelOut` schema** — defensive `labels` JSON parsing; API never leaks raw ORM objects.

---

## 3. UI / UX gaps (concrete)

### Broken or misleading (a real user hits these)

1. **Three different brand names.** Navbar/Footer say **Kriya**, LoginPage says **VECRON** (`LoginPage/index.jsx:94`), RegisterPage says **Something** (`RegisterPage/index.jsx:121`). A non-technical user landing on register will think they left the site.
2. **Dead links render a blank page.** "Forgot password?" → `/forgot-password`, Terms → `/terms`, Privacy → `/privacy` — none of these routes exist, and there's **no catch-all 404**, so the user gets an empty area between navbar and footer with no way to understand what happened.
3. **Stub social buttons.** "Continue with Google/GitHub" on both auth pages do `console.log` only. Presented as the primary option (top of the card) — non-technical users will click them first and nothing happens.
4. **Register success goes nowhere.** On success the form clears and shows a green message; the user is not redirected to login or logged in. Many will re-submit (and now get 409 "Email already registered").
5. **Silent rejection of wrong files.** Both Image and Video upload zones silently `return` for non-matching MIME types (`ModelRunnerPage/index.jsx:189`, `VideoRunner.jsx:448`). A farmer dropping a `.heic` photo or a WhatsApp `.3gp` gets zero feedback.
6. **No way to cancel a video pass.** Processing runs in real time (the clip plays through once) — a 10-minute clip means a 10-minute wait with no cancel button and no upfront warning that processing time ≈ clip length.
7. **Results are session-only with no warning.** Video result cards (and their annotated files) vanish on refresh; nothing tells the user to download before leaving.

### Inconsistencies / polish

8. **Visual language splits in three**: dark zinc hero homepage, light-gray catalog/runner pages, and particle/wave/floating-icon backgrounds on auth pages (Register stacks *three* animated backgrounds). Auth pages also hide the shared Navbar context (they render under it but look like a different product).
9. **Audience mismatch in copy.** Homepage sells to developers ("download the ONNX", "drop it into your pipeline with onnxruntime — no vendor lock-in") while Detail/Runner pages correctly target non-technical users ("Point your camera… catch problems early", "Try it free"). Pick one audience per page.
10. **"Accuracy: —" everywhere.** Both seeded models have `accuracy: null`, so every card and the detail page show a dash — looks broken to a buyer. Hide the row when null (or fill the value).
11. **Image tab has no download**, while Video does ("Download annotated video"). Users will expect to save the annotated image.
12. **"replay overlay" badge** on stored-fallback cards is internal jargon shown to end users.
13. **Navbar/Footer dead anchors**: the logo `<a>` has no `href` (not clickable, not keyboard-focusable); footer social icons are `<a>` tags with no `href`.
14. **Logout from the navbar always redirects to `/login`** even if the user was browsing a public page — losing their place.
15. **Dashboard is a stub** (avatar initial + name/email + sign out). Fine for now, but it's the destination after login, and it offers nothing — not even a link back to Discover.
16. **Dead/duplicated components**: `AuthLoaderButton.jsx` exists but Login/Register hand-roll their own spinner buttons; Eye/Google/GitHub icons are duplicated across both auth pages.
17. **Object URL leak** in the Image runner — `URL.createObjectURL(file)` per upload, never revoked (`ModelRunnerPage/index.jsx:190`).
18. **Accessibility basics**: detection results are conveyed by color only (canvas + color chips); no `aria-live` on the "Found N detections" status; tab buttons are small touch targets; `App.jsx` mixes `Component={...}` and `element={...}` route styles (works, but inconsistent).
19. **Health-check `console.log` on every page load** (`App.jsx:21`) — dev noise shipped to prod.

---

## 4. Video WebM bug — diagnosis (no fix applied)

**Symptom**: boxes render live on the processing canvas, but the downloaded annotated `.webm` has no boxes.

**What I ruled out by reading the pipeline:**

- **Recorder flush** — not the cause. `ondataavailable` wiring is correct, `finalize()` attaches `onstop` *before* calling `recorder.stop()`, the blob is assembled from all chunks, and teardown runs inside `onstop` after assembly (`VideoRunner.jsx:329-347`). In manual mode `start()` without a timeslice delivers everything at stop — fine.
- **Draw order within a tick** — not the cause by itself. `drawImage(video)` then `drawDetections(...)` run synchronously in one rAF task (`VideoRunner.jsx:219-220`); the canvas never *commits* a boxless state to the display, which is exactly why the live view always looks right.

**Most likely root cause: captureStream sampling — the recorder samples the canvas on a schedule that isn't tied to your composite draw.**

The code already contains an attempted fix (manual capture: `canvas.captureStream(0)` + `track.requestFrame()` after each composite, `VideoRunner.jsx:385-417`), with comments saying auto-sampling "grabs the video layer without the freshly-drawn 2D overlay — that was the bug." Since the bug is still reported, the two remaining live failure modes, in order of likelihood:

1. **The auto-sampling fallback path still runs (or the manual path silently fails).** If `requestFrame` is unavailable — or the manual track delivers nothing — the code falls back to `captureStream(CAPTURE_FPS)` (`VideoRunner.jsx:396-403`), where the browser decides *when* to snapshot the canvas's compositor surface. That snapshot is not synchronized with your rAF composite: it can be triggered by the `drawImage(video)` invalidation and latch a surface state without the same task's overlay strokes. The live element always shows the final state; the recorder doesn't. **There is currently zero telemetry showing which path actually ran** — so a "fixed" manual path can silently degrade to the racy auto path and nobody knows.
2. **Manual-mode warm-up + Chromium timestamp quirks.** With `captureStream(0)` + `requestFrame()`, Chromium has long-standing timestamp issues (frames stamped at/near zero). If timestamps collapse, the playable part of the file is effectively the earliest frames — which are *guaranteed boxless*, because the first ~0.5–1 s of frames are recorded before the first inference result lands (`latestRef` is `[]` until the worker returns; inference is capped at 12 fps and the first run includes model warm-up).

**The fix I'd apply (Phase 2, pending your approval):**

- **Atomic double-buffer composite** — draw video frame + boxes onto an *offscreen* canvas, then blit the finished composite to the recorded canvas in a single `drawImage(offscreen, 0, 0)`. The recorded canvas then never holds a boxless intermediate state, so it's correct **by construction in both manual and auto modes**. Small, contained change in `VideoRunner.jsx`'s `tick()` (and mirrored in `bakeAnnotatedVideo.js`).
- **Instrument the capture mode** — log (and store on the result, e.g. `captureMode: "manual" | "auto"`) which path ran, so the failure is diagnosable instead of silent.
- **Don't start the recorder until the first composite blit** (or first detection result), so leading frames aren't blank/boxless filler.
- **Validate the baked blob** before preferring it — load it into a probe `<video>`, check `duration > 0` and dimensions, else fall back to the stored path (today the only check is `blob.size > 1024`, which passes for a box-less but otherwise valid recording — the exact failure being reported).

Diagnostic step to confirm before fixing: run a clip in Chrome, log `manual` at `VideoRunner.jsx:394`, and inspect the downloaded file's frame timestamps (e.g. `chrome://media-internals` or ffprobe).

---

## 5. Scalability & production-readiness assessment

### What breaks at 100 users — honestly, not much, because inference is client-side (this is the architecture's biggest strength)

- **Model file downloads are the first bottleneck.** Each user's first visit to a runner pulls a multi-MB `.onnx` through FastAPI/uvicorn's `StaticFiles` — no `Cache-Control`, no ETag tuning, competing with API requests in the same workers. 100 users × ~12 MB through a single uvicorn process is noticeable; at 1,000 it's the outage. Fix path: cache headers now; nginx/CDN/object storage later.
- **`echo=True` on the engine** (`config/db.py:18`) — every SQL statement logged in production: performance drag + leaks query contents to logs.
- **`_has_fulltext_index()` runs an `information_schema` query on every search request** (`ModelRoute.py:12-25`) — an extra DB round trip per keystroke-search. Should be detected once at startup and cached.

### At 1,000 users / a real catalog

- **No pagination on `GET /models`** — returns every row. At 200+ models the Discover payload and grid both degrade. Needs `limit/offset` (or cursor) + frontend load-more.
- **No DB migrations** — schema is `create_all` only; the first column change in production requires hand-written SQL. Alembic is the standard answer.
- **Single uvicorn process, no rate limiting anywhere** — `/auth/login` is brute-forceable at full line speed.

### Search: MySQL FULLTEXT vs semantic

Current state: FULLTEXT index exists (`ft_models_search`, per DEVLOG) and the route auto-detects it with a LIKE fallback — solid for a keyword catalog of hundreds of models. Known FULLTEXT gotchas (words < 3 chars ignored; > 50%-frequency terms return nothing) are documented in the DEVLOG but not mitigated (BOOLEAN MODE switch). **Semantic/pgvector search does not exist in any form** — no embeddings, no vector column, and it would imply a Postgres migration or MySQL 9 vectors. Honest take: with < 500 models, keyword search is fine; semantic search is a [LATER] that should wait for catalog scale, not precede it.

### Free-tier vs paid-tier boundary

- The boundary today is **one boolean** (`is_free`) that renders a green badge. Nothing is gated: every `onnx_url` is publicly downloadable whether or not `is_free` is true, there's no entitlement check, no payment integration, no cloud inference endpoint, no usage metering. The free tier (in-browser, no login) is real and well-executed; **the paid tier is currently a database column.**
- Missing to make paid real: payments, an entitlements table, gated model delivery (signed URLs or an authenticated proxy — `StaticFiles` can't do this), a server-side GPU inference service + job queue, and quotas.
- ⚠️ **License blocker**: the seed notes the Garbage model's ONNX metadata reports **AGPL-3.0** (`seed_models.py:60`) and both models ship `license="unknown"`. Selling or even hosting AGPL-derived weights commercially is a legal problem to resolve **before** any paid work. (Flagging per your constraints — this is a money/legal item needing your explicit decision.)

### Auth / security gaps

- **CORS is wide open and self-contradictory**: `allow_origins=["http://localhost", "*"]` with `allow_credentials=True` (`app.py:18-28`). `*` + credentials is an invalid combo browsers reject, and `*` in production is wrong anyway. Origins should come from an env var.
- **`SECRET_KEY` silently falls back to `"change-this-before-production"`** (`hashing.py:20`) — a forgotten env var means forgeable JWTs with no error. Should fail fast at startup.
- **JWT in localStorage** — XSS-readable. Acceptable trade-off for this stage, but worth noting; there's no refresh token, so the only mitigations are the 24 h expiry and XSS hygiene.
- **No server-side password policy** — the 8-char minimum lives only in React; the API accepts `"a"`.
- **No rate limiting on login/register** (brute force, account enumeration via 409).
- `get_current_user` does `int(user_id)` unguarded (`deps.py:36`) — a non-numeric `sub` produces a 500 instead of 401. Minor.
- `created_at` uses local-time `datetime.now` and JWT uses deprecated `datetime.utcnow` — cosmetic today, timezone bugs later.
- The no-registration free tier is genuinely safe as built: catalog + static models are read-only public endpoints, nothing user-specific leaks.

### Hardcoded things that break in production

| What | Where | Risk |
|---|---|---|
| ORT CDN path pinned to `1.26.0` while package.json allows `^1.26.0` | `useOnnxModel.js:27`, `yoloWorker.js:24` | a routine `npm update` desyncs the wasm binaries from the JS and the runner breaks; pin the dep exactly or derive the URL from the installed version (or serve the artifacts locally) |
| `BASE_URL` baked into `onnx_url` **rows at seed time** | `seed_models.py` | changing domains requires re-seeding with `--force`; consider storing a relative path and composing the URL in `ModelOut` |
| CORS origins, `SECRET_KEY` fallback | `app.py`, `hashing.py` | above |
| `confThreshold 0.4` duplicated in ImageRunner and VideoRunner | `ModelRunnerPage/index.jsx:213`, `VideoRunner.jsx:178` | not per-model tunable; a sensitive safety model and a noisy one get the same threshold |
| `input_size \|\| 416` fallback | `ModelRunnerPage/index.jsx:91` | wrong fallback for fixed-640 exports (see §1) |
| `.onnx` binaries in the git repo | `backend/src/statics/models/` | repo bloat as the catalog grows; object storage or LFS eventually |

---

## 6. Prioritised recommendations

### [QUICK WIN] — low effort, high impact

| # | What | Why | Effort | Files |
|---|---|---|---|---|
| Q1 | Unify branding to **Kriya** on Login/Register | First thing a registering user sees; currently three different product names | ~15 min | `LoginPage/index.jsx`, `RegisterPage/index.jsx` |
| Q2 | Add a 404 catch-all route; remove or stub dead links (forgot-password / terms / privacy); hide the stub social buttons | Blank pages and dead primary buttons are trust-killers for non-technical users | ~1 h | `App.jsx`, both auth pages |
| Q3 | Redirect to `/login` (with a success notice) after registration | Stops the re-submit → 409 confusion | ~20 min | `RegisterPage/index.jsx` |
| Q4 | Fix `input_size` fallback 416 → 640 | Latent hard-crash for any catalog row with null input_size | 1 line | `ModelRunnerPage/index.jsx:91` |
| Q5 | Show an error message when a dropped file isn't a usable image/video | Silent rejection is the #1 "it's broken" report you'll get | ~30 min | `ModelRunnerPage/index.jsx`, `VideoRunner.jsx` |
| Q6 | Cache the FULLTEXT-index check at startup; gate `echo=True` behind an env flag | Removes a per-request DB query and prod log spam | ~30 min | `ModelRoute.py`, `config/db.py` |
| Q7 | CORS origins from env (drop `*`); fail fast on missing `SECRET_KEY` | Two known prod foot-guns, both one-liners | ~30 min | `app.py`, `utils/hashing.py`, `.env.example` |
| Q8 | Pin `onnxruntime-web` exactly and derive the wasm CDN path from the installed version | Prevents a routine dependency bump from breaking all inference | ~30 min | `package.json`, `useOnnxModel.js`, `yoloWorker.js` |
| Q9 | Hide "Accuracy" when null; remove the "replay overlay" jargon badge | Polish that reads as "broken" today | ~20 min | `ModelCard.jsx`, `ModelDetailPage/index.jsx`, `ResultCard.jsx` |

### [WORTH IT] — medium effort, clear payoff

| # | What | Why | Effort | Files |
|---|---|---|---|---|
| W1 | **Video WebM fix** (atomic double-buffer composite + capture-mode telemetry + baked-blob validation; mirror in the baker) | The known unresolved bug; the diagnosis is §4 | ~half day incl. testing | `VideoRunner.jsx`, `bakeAnnotatedVideo.js` |
| W2 | Pagination on `GET /models` + frontend load-more | Required before the catalog grows; cheap now, painful later | ~half day | `ModelRoute.py`, `model_schema.py`, `DiscoverPage/index.jsx` |
| W3 | Cache headers (`Cache-Control`/ETag) for `/static` model files | Biggest server-side scalability lever; ONNX files are immutable-by-name | ~2 h | `app.py` (custom StaticFiles or middleware) |
| W4 | Cancel button + duration warning for video processing; "results are lost on refresh" notice + download nudge | The two worst runner UX traps for real users | ~half day | `VideoRunner.jsx` |
| W5 | "Download annotated image" on the Image tab; revoke image object URLs | Parity with video; fixes a leak | ~2 h | `ModelRunnerPage/index.jsx` |
| W6 | Login rate limiting (e.g. slowapi) + server-side password min-length | Auth hardening before any real users | ~half day | `AuthRoute.py`, `models/User.py` ⚠️ security — will confirm approach first |
| W7 | Alembic migrations | Unblocks every future schema change | ~half day | new `backend/alembic/` |
| W8 | Visual-consistency pass: one background treatment for auth pages, navbar logo → Link, footer hrefs, homepage copy aligned to non-technical audience | The "built incrementally" mismatches, batched | ~1 day | `Navbar.jsx`, `Footer.jsx`, auth pages, `HomePage/index.jsx` |

### [LATER] — big, defer deliberately

| # | What | Why defer |
|---|---|---|
| L1 | **Paid tier** (payments, entitlements, gated/signed model delivery, cloud GPU inference service, metering) | Multi-week; blocked anyway on the **AGPL/unknown license question** — resolve that first ⚠️ money/legal, needs your call |
| L2 | Semantic search (embeddings + pgvector → implies Postgres, or MySQL 9 vectors) | Keyword search is adequate below ~500 models; don't pay the migration cost yet |
| L3 | Live Camera tab (runner Stage 3) | Planned stage; engine is ready for it, but it's net-new surface |
| L4 | Real OAuth (Google/GitHub) | Backend flow + provider setup; stubs should be hidden (Q2) until then |
| L5 | CDN/object storage for model files + git-LFS or external hosting for `.onnx` | Becomes necessary with catalog growth; W3 buys time |
| L6 | Dashboard with real content (run history requires persisting results server-side) | Depends on a results backend — `videoResultsStore` was built to be swappable for exactly this |

---

*Constraints honored: no code changed; items touching security (W6, Q7), money/licensing (L1), or anything destructive are flagged for explicit confirmation before implementation.*
