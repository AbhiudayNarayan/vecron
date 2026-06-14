import { useEffect, useRef, useState } from "react";
import { Download, Trash2, Film, Loader2 } from "lucide-react";
import { drawDetections, colorForClass } from "./DetectionCanvas";
import { bakeAnnotatedVideo, canBakeAnnotatedVideo } from "../../lib/bakeAnnotatedVideo";

/**
 * ResultCard — one "flash card" for a finished process-once pass, rendered below
 * the upload zone. Model-agnostic: everything it shows comes from the result
 * object the runner produced (summary, labels, annotated video URL). It never
 * runs the model.
 *
 * Two playback shapes, picked by result.approach:
 *  - "baked":  boxes are burned into the webm by MediaRecorder. Replay is a
 *              plain <video> — literally just playing a file, zero inference.
 *  - "stored": MediaRecorder was unavailable/empty, so we kept the ORIGINAL
 *              video plus the per-frame detections and redraw boxes over the
 *              video on replay (StoredReplay below). Still zero inference.
 */
// Trigger a browser download for a given href + filename without leaving the page.
function triggerDownload(href, name) {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export default function ResultCard({ result, onRemove }) {
    const { approach, url, summary, label, createdAt, downloadName } = result;
    const [baking, setBaking] = useState(false);

    // Stored fallback: the saved file IS the raw original (boxes are only drawn on
    // replay). So bake the stored per-frame detections into a fresh annotated
    // video on demand, then download THAT. If baking isn't possible/ fails, fall
    // back to the raw original so the button always does something.
    const handleDownloadStored = async () => {
        if (baking) return;
        const safeBase = (label || "video").replace(/\.[^.]+$/, "");
        if (!canBakeAnnotatedVideo()) {
            triggerDownload(url, downloadName);
            return;
        }
        setBaking(true);
        try {
            const blob = await bakeAnnotatedVideo(result);
            const bakedUrl = URL.createObjectURL(blob);
            triggerDownload(bakedUrl, `${safeBase}-annotated.webm`);
            // Give the download a moment to start before freeing the blob URL.
            setTimeout(() => URL.revokeObjectURL(bakedUrl), 10000);
        } catch (e) {
            console.error("Annotated bake failed, downloading original instead:", e);
            triggerDownload(url, downloadName);
        } finally {
            setBaking(false);
        }
    };

    return (
        <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Film className="h-4 w-4 shrink-0 text-accent" />
                        <span className="truncate" title={label}>
                            {label}
                        </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                        {new Date(createdAt).toLocaleString()}
                        {approach === "stored" && (
                            <span className="badge badge-warning ml-2 px-1.5 py-0.5">
                                replay overlay
                            </span>
                        )}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => onRemove(result.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-faint transition hover:bg-surface-2 hover:text-danger"
                    title="Remove this result"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            {/* Player */}
            <div className="mt-3">
                {approach === "baked" ? (
                    <video
                        src={url}
                        controls
                        playsInline
                        className="h-auto w-full rounded-lg border border-line bg-surface-invert"
                    />
                ) : (
                    <StoredReplay result={result} />
                )}
            </div>

            {/* Summary */}
            <div className="mt-3">
                <DetectionSummary summary={summary} />
            </div>

            {/* Download — always delivers an annotated video. The baked path
                already has boxes burned in; the stored path bakes them on demand. */}
            <div className="mt-3">
                {approach === "baked" ? (
                    <a
                        href={url}
                        download={downloadName}
                        className="btn btn-secondary btn-sm"
                    >
                        <Download className="h-4 w-4" />
                        Download annotated video
                    </a>
                ) : (
                    <button
                        type="button"
                        onClick={handleDownloadStored}
                        disabled={baking}
                        className="btn btn-secondary btn-sm"
                    >
                        {baking ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Preparing annotated video...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                Download annotated video
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

/* ── Detection summary ────────────────────────────────────────────────── */

function DetectionSummary({ summary }) {
    if (!summary || summary.total === 0) {
        return (
            <div className="rounded-lg border border-line bg-surface-2 p-3 text-sm font-medium text-muted">
                No objects detected in this video.
            </div>
        );
    }
    return (
        <div className="rounded-lg border border-success-soft bg-success-soft p-3">
            <p className="text-sm font-semibold text-success">
                Found{" "}
                {summary.parts
                    .map((p) => `${p.count} ${p.label}`)
                    .join(", ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
                {summary.parts.map((p) => (
                    <span
                        key={p.classId}
                        className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-ink ring-1 ring-line"
                    >
                        <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: colorForClass(p.classId, summary.totalClasses) }}
                        />
                        {p.label}: {p.count}
                    </span>
                ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">
                Peak simultaneous detections per class across the clip.
            </p>
        </div>
    );
}

/* ── Stored-detections replay (MediaRecorder fallback) ────────────────── */

/**
 * Plays the ORIGINAL video and redraws the stored per-frame boxes over it as it
 * plays — no re-inference. Boxes are looked up by timestamp from result.frames
 * (recorded once, during the process-once pass).
 */
function StoredReplay({ result }) {
    const { url, frames, labels, width, height } = result;
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const rafRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // Boxes for the moment nearest `t` — frames are in ascending time order,
        // so a linear scan from the start is fine for these short clips.
        const detectionsAt = (t) => {
            let chosen = [];
            for (let i = 0; i < frames.length; i++) {
                if (frames[i].t <= t) chosen = frames[i].detections;
                else break;
            }
            return chosen;
        };

        const paint = () => {
            ctx.clearRect(0, 0, width, height);
            drawDetections(ctx, detectionsAt(video.currentTime), labels, width);
            rafRef.current = requestAnimationFrame(paint);
        };

        const start = () => {
            if (rafRef.current == null) rafRef.current = requestAnimationFrame(paint);
        };
        const stop = () => {
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            // Repaint the current (paused) frame's boxes once so they stay visible.
            ctx.clearRect(0, 0, width, height);
            drawDetections(ctx, detectionsAt(video.currentTime), labels, width);
        };

        video.addEventListener("play", start);
        video.addEventListener("pause", stop);
        video.addEventListener("ended", stop);
        video.addEventListener("seeked", stop);

        return () => {
            video.removeEventListener("play", start);
            video.removeEventListener("pause", stop);
            video.removeEventListener("ended", stop);
            video.removeEventListener("seeked", stop);
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    }, [url, frames, labels, width, height]);

    return (
        <div className="relative">
            <video
                ref={videoRef}
                src={url}
                controls
                playsInline
                className="h-auto w-full rounded-lg border border-line bg-surface-invert"
            />
            {/* Overlay: natural-res canvas scaled to the video's displayed width,
                so stored boxes line up exactly like the static image path. */}
            <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full rounded-lg"
            />
        </div>
    );
}
