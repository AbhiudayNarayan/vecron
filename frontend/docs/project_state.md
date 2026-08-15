# Edgenix — Project State & Context Handoff

## What it is
Platform where non-technical users find and run specialised AI capabilities in
the browser (free local execution) with a planned paid cloud-GPU tier.
Thesis: narrow single-task models beat general LLMs for continuous tasks.
(Product name: Edgenix.)

## Stack
- Backend: FastAPI (async), async SQLAlchemy, MySQL (db: vecron), JWT auth
  (python-jose, bcrypt+SHA256 prehash). backend/src/ with routes/, models/,
  schemas/, config/, utils/. ONNX files served from src/statics/models/.
- Frontend: React + Vite + Tailwind, pnpm. pages/, components/runner/,
  lib/inference/ (yoloEngine, useOnnxModel, worker). axiosClient with JWT
  interceptors. MainContext for auth.
- Models run client-side via onnxruntime-web (pinned exact version).

## Core architecture (the important part)
- Model-agnostic runner: adding a YOLO detection model = ONE db row + the .onnx
  file, ZERO frontend code. Contract: output shape (1, 4+numClasses, 8400),
  labels in class-index order, square input_size. Documented in
  docs/ADDING_A_MODEL.md.
- Runner supports image, video (with annotated WebM download), and live camera.
  All reuse one engine.

## What's built & working
- Auth (register/login/logout, protected routes), security-hardened
  (SECRET_KEY enforced, CORS fixed, ORT pinned).
- Models catalog + public API + static serving.
- Discover → model detail → runner (image/video/camera) flow.
- 3 models live: fire/smoke, garbage (6-class, AGPL — free-tier only,
  cloud_eligible=false), pothole.
- cloud_eligible flag on models for the AGPL/paid-tier distinction.

## Civic Reporting feature (current focus)
Logged-in users report civic issues (pothole/garbage/...) with photo + GPS +
timestamp. Makes authorities AWARE (no fines/accusations). Login prevents spam;
reporter identity is PROTECTED publicly (structural: PublicReportOut schema has
no user_id). Reporter chooses public/private per report. Category-agnostic
(reproducible across issue types). Before/after images via image_type field.

Build order:
  [DONE — verified] Backend: reports + report_images tables, schemas
        (ReportOut vs PublicReportOut), submit/list/status endpoints (auth-gated).
        Privacy verified by tests: public feed has zero user_id; a different
        user gets 404 on a private report (existence not revealed); public
        cross-user view is identity-stripped. All 8 tests pass.
  [NEXT]  Image upload + persistence (statics/reports/ for dev, R2 later).
          MUST ALSO FIX: MissingGreenlet risk — the status update path calls
          db.refresh(report) but does not eager-load the images relationship;
          accessing report.images during model_validate under async SQLAlchemy
          can raise MissingGreenlet once reports have images. Fix when wiring
          image upload (eager-load images, e.g. selectinload, on the relevant
          queries).
  [NEXT]  Frontend report flow: "Report this issue" + GPS (GPS + manual address
          edit) + image attach (multiple images, before/after).
  [NEXT]  Reports dashboard (also makes the currently-empty dashboard real).
  [LATER] Public feed/map (identity-stripped). Third-party resolution
          confirmation (to prevent gaming self-reported "fixed"). Authorities/
          routing + notifications.

### Reports data model (already built)
- reports: id, user_id (FK user, PRIVATE), category, title, description,
  detection_data (JSON), model_id (FK models), latitude, longitude,
  location_text, status (submitted→under_review→in_progress→resolved),
  is_public, created_at, updated_at. One-to-many → report_images.
- report_images: id, report_id (FK), image_url, image_type (before/after),
  is_annotated, created_at.
- Endpoints (under /api/v1):
  POST /reports [auth], GET /reports/mine [auth], GET /reports/{id} [auth;
  owner→full, non-owner→public-only-as-PublicReportOut else 404],
  GET /reports/public [no auth, is_public only, identity-stripped],
  PATCH /reports/{id}/status [auth; owner-only for now, TODO expand to authorities].

## Known open items / weaknesses
- MissingGreenlet on images relationship (see [NEXT] above) — fix with image upload.
- Dashboard currently only shows user email (no real content yet).
- Paid tier not built; model URLs are publicly downloadable.
- No pagination on /models. Static serving via uvicorn won't scale to ~1000 users.
- Search is MySQL FULLTEXT/LIKE; semantic search (pgvector, needs Postgres) is future.
- MediaPipe / non-YOLO models = future "multi-runtime" expansion, not yet supported.
- Video processing is real-time (clip's own duration) — inherent to in-browser
  captureStream; long-video/fast processing is the future paid cloud-tier story.

## How I work
Second-year B.Tech student, learn by reverse-engineering working examples,
want direct honest feedback not optimism. I build via Claude Code prompts —
always "read existing files first, match conventions, smallest diff, don't break
working features." I use Sonnet for routine work, Fable 5 for hard/multi-file/
security-sensitive tasks. One feature at a time, test before moving on.

## Immediate next step
Image upload + persistence for reports, AND fix the MissingGreenlet images
eager-loading issue in the same pass. Use Fable 5 (touches DB + storage +
the privacy-sensitive reports layer).
