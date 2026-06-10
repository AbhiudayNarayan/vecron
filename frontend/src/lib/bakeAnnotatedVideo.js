import { drawDetections } from "../components/runner/DetectionCanvas";

/**
 * bakeAnnotatedVideo — build an annotated video file from a stored-fallback
 * result. The stored path keeps the ORIGINAL clip plus the per-frame detections
 * (recorded once, during the process-once pass) and only redraws boxes on the
 * screen during replay — so its download link is the raw original. This bakes
 * those same stored boxes into a NEW video so the download matches what the user
 * saw on screen. No inference: it replays the clip and draws the saved frames.
 *
 * Mirrors the live recording in VideoRunner: a 2D canvas (default options, so
 * the captured backing store reflects what we draw) is fed to MediaRecorder via
 * manual videoTrack.requestFrame() after each composited frame, falling back to
 * auto-sampling when requestFrame isn't available.
 *
 * @param {object} result  a "stored" videoResultsStore entry
 * @returns {Promise<Blob>} the annotated video blob (webm)
 */

const CAPTURE_FPS = 30;
const CAPTURE_INTERVAL_MS = 1000 / CAPTURE_FPS;
const MIN_BLOB_BYTES = 1024;

function pickMimeType() {
    if (typeof MediaRecorder === "undefined") return null;
    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    return candidates.find((m) => MediaRecorder.isTypeSupported?.(m)) || null;
}

export function canBakeAnnotatedVideo() {
    return (
        typeof document !== "undefined" &&
        typeof document.createElement("canvas").captureStream === "function" &&
        pickMimeType() != null
    );
}

export function bakeAnnotatedVideo(result) {
    const { url, frames = [], labels = [], width, height } = result;

    return new Promise((resolve, reject) => {
        const mime = pickMimeType();
        if (!mime) {
            reject(new Error("MediaRecorder/webm not supported in this browser"));
            return;
        }

        const w = width || 0;
        const h = height || 0;

        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        let stream = null;
        let recorder = null;
        let captureTrack = null;
        let rafId = null;
        let lastCaptureAt = 0;
        let settled = false;
        const chunks = [];

        // Boxes for the moment nearest `t` — frames are ascending, linear scan.
        const detectionsAt = (t) => {
            let chosen = [];
            for (let i = 0; i < frames.length; i++) {
                if (frames[i].t <= t) chosen = frames[i].detections;
                else break;
            }
            return chosen;
        };

        const cleanup = () => {
            if (rafId != null) cancelAnimationFrame(rafId);
            rafId = null;
            if (stream) stream.getTracks().forEach((tr) => tr.stop());
            stream = null;
            captureTrack = null;
            try {
                video.pause();
            } catch {
                /* ignore */
            }
            video.removeAttribute("src");
            video.load();
        };

        const fail = (err) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(err instanceof Error ? err : new Error(String(err)));
        };

        const paint = () => {
            if (video.readyState >= 2 && canvas.width && canvas.height) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                drawDetections(ctx, detectionsAt(video.currentTime), labels, canvas.width);

                const now = performance.now();
                if (captureTrack && now - lastCaptureAt >= CAPTURE_INTERVAL_MS) {
                    lastCaptureAt = now;
                    captureTrack.requestFrame();
                }
            }
            rafId = requestAnimationFrame(paint);
        };

        const onMeta = () => {
            const vw = video.videoWidth || w;
            const vh = video.videoHeight || h;
            if (!vw || !vh) {
                fail(new Error("video has no dimensions"));
                return;
            }
            canvas.width = vw;
            canvas.height = vh;

            try {
                stream = canvas.captureStream(0);
                let videoTrack = stream.getVideoTracks()[0];
                const manual = typeof videoTrack?.requestFrame === "function";
                if (!manual) {
                    stream.getTracks().forEach((tr) => tr.stop());
                    stream = canvas.captureStream(CAPTURE_FPS);
                    videoTrack = stream.getVideoTracks()[0];
                }
                captureTrack = manual ? videoTrack : null;

                recorder = new MediaRecorder(stream, { mimeType: mime });
                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size) chunks.push(e.data);
                };
                recorder.onstop = () => {
                    if (settled) return;
                    settled = true;
                    const blob = new Blob(chunks, { type: mime });
                    cleanup();
                    if (blob.size > MIN_BLOB_BYTES) resolve(blob);
                    else reject(new Error("recorded blob was empty"));
                };
                if (manual) recorder.start();
                else recorder.start(1000);
            } catch (e) {
                fail(e);
                return;
            }

            video.currentTime = 0;
            const p = video.play();
            if (p?.catch) p.catch(fail);
            rafId = requestAnimationFrame(paint);
        };

        const onEnded = () => {
            if (rafId != null) cancelAnimationFrame(rafId);
            rafId = null;
            try {
                if (recorder && recorder.state !== "inactive") recorder.stop();
                else fail(new Error("recorder never started"));
            } catch (e) {
                fail(e);
            }
        };

        video.addEventListener("loadedmetadata", onMeta, { once: true });
        video.addEventListener("ended", onEnded, { once: true });
        video.addEventListener("error", () => fail(new Error("failed to load video")), {
            once: true,
        });
        video.src = url;
        video.load();
    });
}
