import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Loader2, Sparkles } from "lucide-react";
import { drawDetections } from "./DetectionCanvas";
import ResultCard from "./ResultCard";
import { videoResultsStore, useVideoResults } from "../../lib/videoResultsStore";

/**
 * VideoRunner — PROCESS-ONCE video pipeline.
 *
 * Drop a video and it is processed exactly one time: the clip plays through
 * once (muted), every frame is drawn to a canvas with the latest detection
 * boxes, and that canvas is recorded into a NEW annotated video via
 * canvas.captureStream() + MediaRecorder. When the clip ends we build the
 * annotated webm and append a result card below. Replaying a result just plays
 * the finished video — the model NEVER runs again. This is the whole point:
 * compute once, then it's a plain video file.
 *
 * Model-agnostic: labels / numClasses / inputSize / runDetection all arrive as
 * props from the catalog metadata. Nothing here is fire/smoke specific, so a new
 * YOLO model works with zero changes.
 *
 * Fallback: if MediaRecorder is unavailable or yields an empty blob, we fall
 * back to keeping the original video + the per-frame detections and redraw the
 * boxes on replay (see ResultCard's StoredReplay). Either way replay is
 * inference-free.
 */

// Record/playback frame rate for the annotated canvas stream.
const CAPTURE_FPS = 30;
// Min gap between manually-pushed capture frames (drives requestFrame at CAPTURE_FPS).
const CAPTURE_INTERVAL_MS = 1000 / CAPTURE_FPS;
// Cap actual inference at ~12 fps (drawing still happens every animation frame).
const INFER_INTERVAL_MS = 1000 / 12;
// Below this, treat the recorded blob as empty and use the stored-detections fallback.
const MIN_BLOB_BYTES = 1024;

// Pick the best webm codec MediaRecorder supports here, or null if none.
function pickMimeType() {
    if (typeof MediaRecorder === "undefined") return null;
    const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
    ];
    return candidates.find((m) => MediaRecorder.isTypeSupported?.(m)) || null;
}

// Build the detection summary from the peak simultaneous count per class.
function summarize(maxByClass, labels) {
    const parts = Object.keys(maxByClass)
        .map((k) => Number(k))
        .filter((classId) => maxByClass[classId] > 0)
        .sort((a, b) => maxByClass[b] - maxByClass[a])
        .map((classId) => ({
            classId,
            label: labels[classId] ?? `class ${classId}`,
            count: maxByClass[classId],
        }));
    const total = parts.reduce((sum, p) => sum + p.count, 0);
    return { parts, total, totalClasses: labels.length };
}

export default function VideoRunner({ ready, runDetection, modelId, labels, numClasses, inputSize }) {
    const results = useVideoResults();

    // idle (upload zone shown) | processing (one pass running)
    const [phase, setPhase] = useState("idle");
    const [progress, setProgress] = useState(0); // 0..1
    const [liveCount, setLiveCount] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const [processingLabel, setProcessingLabel] = useState("");

    // A file dropped before the model worker is ready waits here until it is.
    const [queuedFile, setQueuedFile] = useState(null);

    // ── refs: live values the RAF/recorder callbacks read without re-rendering ─
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);

    const runDetectionRef = useRef(runDetection);
    const phaseRef = useRef("idle");
    const rafRef = useRef(null);
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const captureTrackRef = useRef(null); // video track when manual requestFrame capture is active
    const lastCaptureAtRef = useRef(0);
    const chunksRef = useRef([]);
    const objectUrlRef = useRef(null); // current processing video's URL (original)
    const bakingOkRef = useRef(true); // did captureStream + MediaRecorder set up?

    const latestRef = useRef([]); // most recent detections (drawn every frame)
    const maxByClassRef = useRef({}); // peak simultaneous count per classId
    const framesRef = useRef([]); // [{ t, detections }] for the stored fallback
    const inferBusyRef = useRef(false);
    const lastInferAtRef = useRef(0);
    const lastPercentRef = useRef(-1);
    const labelRef = useRef(""); // filename of the clip being processed
    const dimsRef = useRef({ w: 0, h: 0 });
    const tickRef = useRef(null); // holds the latest `tick` for self-scheduling RAF

    // Keep the loop's view of runDetection current without restarting anything.
    useEffect(() => {
        runDetectionRef.current = runDetection;
    }, [runDetection]);

    const setPhaseBoth = useCallback((p) => {
        phaseRef.current = p;
        setPhase(p);
    }, []);

    /* ── teardown: kill EVERYTHING from the active pass (no leaks) ─────────── */

    const teardownActivePass = useCallback(() => {
        // RAF loop
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        // MediaRecorder — detach onstop first so an aborted stop can't build a result
        const recorder = recorderRef.current;
        if (recorder) {
            recorder.ondataavailable = null;
            recorder.onstop = null;
            if (recorder.state !== "inactive") {
                try {
                    recorder.stop();
                } catch {
                    /* already stopping */
                }
            }
            recorderRef.current = null;
        }
        // Stream tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        captureTrackRef.current = null;
        lastCaptureAtRef.current = 0;
        chunksRef.current = [];
        // Hidden processing video
        const video = videoRef.current;
        if (video) {
            try {
                video.pause();
            } catch {
                /* ignore */
            }
            video.removeAttribute("src");
            video.load();
        }
        // Object URL for the original clip (only if we still own it — once a
        // stored-fallback result adopts it, objectUrlRef is cleared first).
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        inferBusyRef.current = false;
        lastInferAtRef.current = 0;
        lastPercentRef.current = -1;
        latestRef.current = [];
    }, []);

    /* ── inference + paint loop ───────────────────────────────────────────── */

    const inferFrame = useCallback(
        (video, w, h) => {
            const detect = runDetectionRef.current;
            if (!detect) {
                inferBusyRef.current = false;
                return;
            }
            const t = video.currentTime;
            detect(video, {
                numClasses,
                inputSize,
                confThreshold: 0.4,
                iouThreshold: 0.45,
                originalWidth: w,
                originalHeight: h,
            })
                .then((dets) => {
                    // Ignore results that land after the pass was finalized/aborted.
                    if (phaseRef.current !== "processing") return;
                    latestRef.current = dets;
                    setLiveCount(dets.length);

                    // Peak simultaneous count per class (powers the summary).
                    const counts = {};
                    for (const d of dets) counts[d.classId] = (counts[d.classId] || 0) + 1;
                    const mx = maxByClassRef.current;
                    for (const k in counts) mx[k] = Math.max(mx[k] || 0, counts[k]);

                    // Always recorded so the stored fallback works even if baking fails.
                    framesRef.current.push({ t, detections: dets });
                })
                .catch((e) => console.error("Video inference failed:", e))
                .finally(() => {
                    inferBusyRef.current = false;
                });
        },
        [numClasses, inputSize]
    );

    const tick = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState >= 2) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
                if (canvas.width !== w) canvas.width = w;
                if (canvas.height !== h) canvas.height = h;

                // 2D context with DEFAULT options (no `desynchronized`) so the
                // captured backing store always reflects what we draw.
                const ctx = canvas.getContext("2d");
                ctx.drawImage(video, 0, 0, w, h);
                drawDetections(ctx, latestRef.current, labels, w);

                const now = performance.now();

                // Manual capture: hand the recorder THIS exact composited frame
                // (video + boxes), throttled to CAPTURE_FPS. Because this runs
                // after drawDetections, every recorded frame includes the overlay.
                const track = captureTrackRef.current;
                if (track && now - lastCaptureAtRef.current >= CAPTURE_INTERVAL_MS) {
                    lastCaptureAtRef.current = now;
                    track.requestFrame();
                }

                // Progress (throttled to whole-percent changes to limit renders).
                const d = video.duration;
                if (d && isFinite(d)) {
                    const pct = Math.min(100, Math.round((video.currentTime / d) * 100));
                    if (pct !== lastPercentRef.current) {
                        lastPercentRef.current = pct;
                        setProgress(video.currentTime / d);
                    }
                }

                // Throttle inference; never overlap an in-flight run.
                if (
                    !inferBusyRef.current &&
                    now - lastInferAtRef.current >= INFER_INTERVAL_MS
                ) {
                    inferBusyRef.current = true;
                    lastInferAtRef.current = now;
                    inferFrame(video, w, h);
                }
            }
        }
        rafRef.current = requestAnimationFrame(() => tickRef.current?.());
    }, [labels, inferFrame]);

    // Keep the self-scheduling RAF pointing at the freshest `tick`.
    useEffect(() => {
        tickRef.current = tick;
    }, [tick]);

    /* ── finish: build the annotated result, then reset the upload zone ───── */

    const finalize = useCallback(() => {
        // Stop painting/inferring immediately — the recorder already holds the
        // final frame; further ticks would just waste cycles on the ended clip.
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        const mime = pickMimeType();
        const dims = dimsRef.current;

        const buildResult = (bakedUrl) => {
            const summary = summarize(maxByClassRef.current, labels);
            const base = {
                id:
                    crypto?.randomUUID?.() ||
                    `r-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                modelId,
                label: labelRef.current,
                createdAt: Date.now(),
                summary,
                width: dims.w,
                height: dims.h,
            };
            const safeName = (labelRef.current || "video").replace(/\.[^.]+$/, "");

            if (bakedUrl) {
                // Annotated webm: boxes baked in. We no longer need the original
                // clip URL — free it here.
                if (objectUrlRef.current) {
                    URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = null;
                }
                videoResultsStore.add({
                    ...base,
                    approach: "baked",
                    url: bakedUrl,
                    downloadName: `${safeName}-annotated.webm`,
                });
            } else {
                // Fallback: hand the ORIGINAL clip URL + stored detections to the
                // result so replay redraws boxes (no re-inference). The result now
                // OWNS this URL — clear our ref so teardown won't revoke it.
                const url = objectUrlRef.current;
                objectUrlRef.current = null;
                videoResultsStore.add({
                    ...base,
                    approach: "stored",
                    url,
                    frames: framesRef.current,
                    labels,
                    downloadName: labelRef.current || `${safeName}.webm`,
                });
            }

            // Reset everything for the next upload.
            framesRef.current = [];
            maxByClassRef.current = {};
            teardownActivePass();
            if (fileInputRef.current) fileInputRef.current.value = "";
            setLiveCount(0);
            setProgress(0);
            setPhaseBoth("idle");
        };

        const recorder = recorderRef.current;
        if (bakingOkRef.current && recorder && recorder.state !== "inactive") {
            // Wait for the final chunks, then assemble the blob.
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
                chunksRef.current = [];
                if (blob.size > MIN_BLOB_BYTES) {
                    buildResult(URL.createObjectURL(blob));
                } else {
                    buildResult(null); // empty/short blob → stored fallback
                }
            };
            try {
                recorder.stop();
            } catch {
                buildResult(null);
            }
        } else {
            buildResult(null);
        }
    }, [labels, modelId, teardownActivePass, setPhaseBoth]);

    /* ── start one process-once pass ──────────────────────────────────────── */

    const startProcessing = useCallback(
        (file) => {
            // Always begin from a clean slate (fixes the second-upload bug).
            teardownActivePass();
            framesRef.current = [];
            maxByClassRef.current = {};
            latestRef.current = [];
            lastCaptureAtRef.current = 0;
            bakingOkRef.current = true;
            labelRef.current = file.name;
            setProcessingLabel(file.name);
            setLiveCount(0);
            setProgress(0);
            lastPercentRef.current = -1;
            setPhaseBoth("processing");

            const url = URL.createObjectURL(file);
            objectUrlRef.current = url;

            const video = videoRef.current;
            const canvas = canvasRef.current;

            const onMeta = () => {
                const w = video.videoWidth;
                const h = video.videoHeight;
                dimsRef.current = { w, h };
                if (canvas) {
                    canvas.width = w;
                    canvas.height = h;
                }

                // Set up canvas recording. Any failure flips to the fallback path.
                const mime = pickMimeType();
                if (canvas && typeof canvas.captureStream === "function" && mime) {
                    try {
                        // Manual-frame capture (the fix): capture with frameRate 0
                        // so the browser does NOT auto-sample, then push EXACTLY the
                        // composited frame (video + boxes) via videoTrack.requestFrame()
                        // after each tick's draw. Auto-sampling grabs the video layer
                        // without the freshly-drawn 2D overlay — that was the bug.
                        let stream = canvas.captureStream(0);
                        let videoTrack = stream.getVideoTracks()[0];
                        const manual = typeof videoTrack?.requestFrame === "function";

                        if (!manual) {
                            // No manual control here — fall back to auto-sampling at
                            // CAPTURE_FPS and flush with a timeslice so chunks (and the
                            // composite) are sampled regularly.
                            stream.getTracks().forEach((t) => t.stop());
                            stream = canvas.captureStream(CAPTURE_FPS);
                            videoTrack = stream.getVideoTracks()[0];
                        }

                        streamRef.current = stream;
                        captureTrackRef.current = manual ? videoTrack : null;
                        lastCaptureAtRef.current = 0;

                        const recorder = new MediaRecorder(stream, { mimeType: mime });
                        chunksRef.current = [];
                        recorder.ondataavailable = (e) => {
                            if (e.data && e.data.size) chunksRef.current.push(e.data);
                        };
                        // Manual mode delivers frames on demand → no timeslice needed.
                        // Auto fallback uses a timeslice so frames flush periodically.
                        if (manual) recorder.start();
                        else recorder.start(1000);
                        recorderRef.current = recorder;
                    } catch (e) {
                        console.warn("MediaRecorder unavailable, using stored fallback:", e);
                        bakingOkRef.current = false;
                    }
                } else {
                    bakingOkRef.current = false;
                }

                // Play through once (muted) and start the paint/infer loop.
                video.muted = true;
                video.currentTime = 0;
                const playPromise = video.play();
                if (playPromise?.catch) playPromise.catch(() => {});
                if (rafRef.current == null) {
                    rafRef.current = requestAnimationFrame(() => tickRef.current?.());
                }
            };

            video.addEventListener("loadedmetadata", onMeta, { once: true });
            video.addEventListener("ended", finalize, { once: true });
            video.src = url;
            video.load();
        },
        [teardownActivePass, finalize, setPhaseBoth]
    );

    /* ── file intake ──────────────────────────────────────────────────────── */

    const handleFile = (file) => {
        if (!file || !file.type.startsWith("video/")) return;
        if (phaseRef.current === "processing") return; // ignore while busy
        if (!ready) {
            setQueuedFile(file); // model worker still loading — start when ready
            return;
        }
        startProcessing(file);
    };

    // Start a queued file once the worker reports ready.
    useEffect(() => {
        if (queuedFile && ready && phaseRef.current === "idle") {
            const f = queuedFile;
            setQueuedFile(null);
            startProcessing(f);
        }
    }, [queuedFile, ready, startProcessing]);

    /* ── cleanup on unmount / tab switch ──────────────────────────────────── */

    useEffect(() => {
        // Leaving the Video tab unmounts this component. Abort any in-flight pass
        // and free its resources. Finished results live in the store and survive.
        return () => teardownActivePass();
    }, [teardownActivePass]);

    /* ── render ───────────────────────────────────────────────────────────── */

    const percent = Math.round(progress * 100);
    const processing = phase === "processing";

    return (
        <div>
            {/* Hidden processing video — the canvas is what the user sees. */}
            <video ref={videoRef} className="hidden" playsInline muted />

            {/* Upload zone — hidden while a pass runs, reset & shown again after. */}
            {!processing && (
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            handleFile(e.dataTransfer.files?.[0]);
                        }}
                        className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition ${
                            dragOver
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50"
                        }`}
                    >
                        <Upload className="h-8 w-8 text-blue-600" />
                        <span className="text-base font-semibold text-gray-900">
                            Drop a video here, or click to choose
                        </span>
                        <span className="text-sm text-gray-500">
                            Processing starts automatically — MP4 or WebM
                        </span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/*"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                    {queuedFile && !ready && (
                        <div className="mt-3 flex items-center gap-2 text-sm font-medium text-indigo-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading model… processing “{queuedFile.name}” will start automatically.
                        </div>
                    )}
                </div>
            )}

            {/* Processing view — live canvas + clear progress + detection counter. */}
            {processing && (
                <div className="mt-6">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                                <Sparkles className="h-4 w-4 animate-pulse" />
                                Processing… {percent}%
                            </div>
                            <span className="inline-flex items-center gap-2 rounded-lg border border-green-100 bg-white px-3 py-1 text-sm font-semibold text-green-700">
                                {liveCount} {liveCount === 1 ? "detection" : "detections"}
                            </span>
                        </div>
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                            <div
                                className="h-full rounded-full bg-indigo-600 transition-[width] duration-150"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <p className="mt-2 truncate text-xs text-indigo-700/80" title={processingLabel}>
                            {processingLabel}
                        </p>
                    </div>

                    <div className="mt-4">
                        <canvas
                            ref={canvasRef}
                            className="h-auto w-full rounded-lg border border-gray-200 bg-gray-100"
                        />
                    </div>
                </div>
            )}

            {/* Results list — "flash cards", newest first. In-memory for the
                session; structured so a backend swap needs no UI changes. */}
            {results.length > 0 && (
                <div className="mt-8">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-500">
                            Results ({results.length})
                        </h2>
                        <button
                            type="button"
                            onClick={() => videoResultsStore.clear()}
                            className="text-xs font-medium text-gray-400 transition hover:text-red-600"
                        >
                            Clear all
                        </button>
                    </div>
                    <div className="mt-3 space-y-4">
                        {results.map((r) => (
                            <ResultCard
                                key={r.id}
                                result={r}
                                onRemove={(id) => videoResultsStore.remove(id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
