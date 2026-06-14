import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { drawDetections } from "./DetectionCanvas";

// Match the throttle from VideoRunner — inference capped at ~12 fps.
const INFER_INTERVAL_MS = 1000 / 12;

/**
 * CameraRunner — live detection loop over the device camera.
 *
 * Reuses the same RAF + inferBusyRef + throttle pattern as VideoRunner and the
 * same runDetection / drawDetections pipeline. Nothing here knows about
 * fire/smoke — labels, numClasses, inputSize, and runDetection all come from
 * props (the catalog metadata), exactly like the other tabs.
 *
 * No recording. Live view only — the canvas is what the user sees.
 */
export default function CameraRunner({ ready, runDetection, labels, numClasses, inputSize }) {
    // idle | requesting | live | denied | notfound | error
    const [phase, setPhase] = useState("idle");
    const [liveCount, setLiveCount] = useState(0);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);
    const runDetectionRef = useRef(runDetection);
    const latestRef = useRef([]);
    const inferBusyRef = useRef(false);
    const lastInferAtRef = useRef(0);
    const tickRef = useRef(null);
    const phaseRef = useRef("idle");

    // Keep the loop's view of runDetection current without restarting anything.
    useEffect(() => {
        runDetectionRef.current = runDetection;
    }, [runDetection]);

    const setPhaseSync = useCallback((p) => {
        phaseRef.current = p;
        setPhase(p);
    }, []);

    // Stop stream + cancel RAF — called on Stop button, tab switch, and unmount.
    const stopCamera = useCallback(() => {
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        const video = videoRef.current;
        if (video) {
            video.srcObject = null;
        }
        inferBusyRef.current = false;
        lastInferAtRef.current = 0;
        latestRef.current = [];
    }, []);

    // Camera light MUST go off on unmount (tab switch or page leave).
    useEffect(() => {
        return () => stopCamera();
    }, [stopCamera]);

    // Inference call — identical pattern to VideoRunner.inferFrame.
    const inferFrame = useCallback(
        (video, w, h) => {
            const detect = runDetectionRef.current;
            if (!detect) {
                inferBusyRef.current = false;
                return;
            }
            detect(video, {
                numClasses,
                inputSize,
                confThreshold: 0.4,
                iouThreshold: 0.45,
                originalWidth: w,
                originalHeight: h,
            })
                .then((dets) => {
                    if (phaseRef.current !== "live") return;
                    latestRef.current = dets;
                    setLiveCount(dets.length);
                })
                .catch((e) => console.error("Camera inference failed:", e))
                .finally(() => {
                    inferBusyRef.current = false;
                });
        },
        [numClasses, inputSize]
    );

    // RAF tick — draw current video frame + latest boxes, then throttle inference.
    // Pattern mirrors VideoRunner.tick exactly; only the capture/recording parts
    // are absent (no baking for live camera).
    const tick = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState >= 2) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
                if (canvas.width !== w) canvas.width = w;
                if (canvas.height !== h) canvas.height = h;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(video, 0, 0, w, h);
                drawDetections(ctx, latestRef.current, labels, w);

                const now = performance.now();
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

    // Keep the self-scheduling RAF pointing at the freshest tick closure.
    useEffect(() => {
        tickRef.current = tick;
    }, [tick]);

    const startCamera = useCallback(async () => {
        setPhaseSync("requesting");
        try {
            let stream;
            try {
                // Prefer rear camera — field workers point the phone at things.
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" },
                });
            } catch (envErr) {
                // Fall back to any available camera if rear is unavailable.
                if (
                    envErr.name === "OverconstrainedError" ||
                    envErr.name === "ConstraintNotSatisfiedError"
                ) {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true });
                } else {
                    throw envErr;
                }
            }

            streamRef.current = stream;
            const video = videoRef.current;
            video.srcObject = stream;
            await video.play();

            inferBusyRef.current = false;
            lastInferAtRef.current = 0;
            latestRef.current = [];
            setLiveCount(0);
            setPhaseSync("live");

            if (rafRef.current == null) {
                rafRef.current = requestAnimationFrame(() => tickRef.current?.());
            }
        } catch (err) {
            if (
                err.name === "NotAllowedError" ||
                err.name === "PermissionDeniedError" ||
                err.name === "SecurityError"
            ) {
                setPhaseSync("denied");
            } else if (
                err.name === "NotFoundError" ||
                err.name === "DevicesNotFoundError"
            ) {
                setPhaseSync("notfound");
            } else {
                console.error("Camera start error:", err);
                setPhaseSync("error");
            }
        }
    }, [setPhaseSync]);

    const handleStop = useCallback(() => {
        stopCamera();
        setPhaseSync("idle");
        setLiveCount(0);
    }, [stopCamera, setPhaseSync]);

    return (
        <div className="mt-6">
            {/* Hidden video — streams into the canvas, never shown directly. */}
            <video ref={videoRef} className="hidden" autoPlay muted playsInline />

            {/* Permission prompt */}
            {phase === "idle" && (
                <div className="card card-pad text-center">
                    <Camera className="mx-auto h-10 w-10 text-accent" />
                    <p className="mt-4 text-sm leading-relaxed text-muted">
                        We need camera access to run live detection. Nothing is recorded
                        or sent anywhere — everything runs on your device.
                    </p>
                    <button
                        type="button"
                        onClick={startCamera}
                        disabled={!ready}
                        className="btn btn-primary btn-lg mt-5"
                    >
                        <Camera className="h-4 w-4" />
                        {ready ? "Start camera" : "Loading model..."}
                    </button>
                </div>
            )}

            {/* Requesting spinner */}
            {phase === "requesting" && (
                <div className="flex items-center justify-center gap-3 rounded-xl border border-brand-200 bg-primary-soft p-6 text-accent-strong">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Requesting camera access...</span>
                </div>
            )}

            {/* Error states */}
            {phase === "denied" && (
                <ErrorState
                    message="Camera access was denied. Please allow camera access in your browser settings and try again."
                    onRetry={() => setPhaseSync("idle")}
                    hint="Click the camera icon in your browser's address bar and choose Allow, then tap Try again."
                />
            )}
            {phase === "notfound" && (
                <ErrorState
                    message="No camera found on this device."
                    onRetry={() => setPhaseSync("idle")}
                />
            )}
            {phase === "error" && (
                <ErrorState
                    message="Couldn't start the camera. Please try again."
                    onRetry={() => setPhaseSync("idle")}
                />
            )}

            {/* Live view */}
            {phase === "live" && (
                <div>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-soft bg-success-soft px-4 py-3">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                            </span>
                            <span className="text-sm font-semibold text-success">Live</span>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-lg border border-success-soft bg-surface px-3 py-1 text-sm font-semibold text-success">
                            {liveCount} {liveCount === 1 ? "detection" : "detections"}
                        </span>
                        <button
                            type="button"
                            onClick={handleStop}
                            className="inline-flex items-center gap-2 rounded-lg border border-danger-soft bg-surface px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-soft"
                        >
                            <CameraOff className="h-4 w-4" />
                            Stop camera
                        </button>
                    </div>
                    <div className="mt-4">
                        <canvas
                            ref={canvasRef}
                            className="h-auto w-full rounded-lg border border-line bg-surface-2"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function ErrorState({ message, onRetry, hint }) {
    const [hintOpen, setHintOpen] = useState(false);
    return (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-6 text-center">
            <CameraOff className="mx-auto h-8 w-8 text-danger" />
            <p className="mt-3 text-sm font-medium text-danger">{message}</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-danger-soft bg-surface px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-soft"
            >
                Try again
            </button>
            {hint && (
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={() => setHintOpen((o) => !o)}
                        className="text-xs font-medium text-danger underline-offset-2 hover:underline focus:outline-none"
                    >
                        {hintOpen ? "Hide help ▲" : "How do I enable camera access? ▼"}
                    </button>
                    {hintOpen && (
                        <p className="mt-2 text-xs leading-relaxed text-danger">
                            {hint}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
