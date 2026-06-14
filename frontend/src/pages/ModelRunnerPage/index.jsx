import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Upload,
    Image as ImageIcon,
    Video,
    Camera,
    Loader2,
    Sparkles,
    Flag,
} from "lucide-react";
import { axiosClient } from "../../utils/axiosClient";
import { useAuth } from "../../context/MainContext";
import { useOnnxModel } from "../../lib/inference/useOnnxModel";
import { preprocess, runInference, postprocess } from "../../lib/inference/yoloEngine";
import DetectionCanvas, { colorForClass } from "../../components/runner/DetectionCanvas";
import VideoRunner from "../../components/runner/VideoRunner";
import CameraRunner from "../../components/runner/CameraRunner";
import ReportModal from "../../components/reports/ReportModal";

/**
 * ModelRunnerPage — reusable in-browser runner for ANY YOLO detection model
 * (route /model/:id/run). Everything model-specific (input size, class labels,
 * onnx url) is read from the catalog API — nothing here knows about fire/smoke.
 *
 * Stage 1 wires up the Image tab only; the inference pipeline lives entirely in
 * lib/inference, so Video (stage 2) and Live Camera (stage 3) just feed frames
 * into the same preprocess → runInference → postprocess engine.
 */
export default function ModelRunnerPage() {
    const { id } = useParams();

    const [model, setModel] = useState(null);
    // loading | success | notfound | error
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let cancelled = false;

        const fetchModel = async () => {
            setStatus("loading");
            try {
                const response = await axiosClient.get(`/models/${id}`);
                if (cancelled) return;
                setModel(response.data);
                setStatus("success");
            } catch (error) {
                if (cancelled) return;
                setStatus(error?.response?.status === 404 ? "notfound" : "error");
            }
        };

        fetchModel();
        return () => {
            cancelled = true;
        };
    }, [id]);

    return (
        <main className="flex-1 bg-canvas text-ink">
            <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
                <Link
                    to={`/model/${id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-accent"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to model
                </Link>

                <div className="mt-8">
                    {status === "loading" && <MetaLoadingState />}
                    {status === "error" && <SimpleState
                        title="Something went wrong"
                        body="We couldn't load this model. Please try again."
                    />}
                    {status === "notfound" && <SimpleState
                        title="We couldn't find that model"
                        body="It may have been moved or removed."
                    />}
                    {status === "success" && model && <Runner model={model} />}
                </div>
            </div>
        </main>
    );
}

/* ── Runner ───────────────────────────────────────────────────────────── */

function Runner({ model }) {
    const labels = Array.isArray(model.labels) ? model.labels : [];
    const numClasses = labels.length;
    // Fallback must match the export size: models are exported with dynamic=False
    // at 640, so feeding a smaller tensor would throw, not degrade (640 is also
    // the DB default for input_size).
    const inputSize = model.input_size || 640;

    const { session, loading: modelLoading, error: modelError, ready, runDetection } =
        useOnnxModel(model.onnx_url);
    const { isLoggedIn } = useAuth();

    const [tab, setTab] = useState("image");
    // Lifted from ImageRunner so the page-level "Report this issue" button can
    // tell whether the last image pass actually found something.
    const [imageDetections, setImageDetections] = useState(null);
    const [reportOpen, setReportOpen] = useState(false);
    // The annotated canvas (boxes + labels) drawn by ImageRunner's DetectionCanvas.
    // Snapshotted into a File when the report modal opens, so every report carries
    // proof the model ran.
    const canvasRef = useRef(null);
    const [annotatedImage, setAnnotatedImage] = useState(null);

    // Open the report modal, attaching a snapshot of the annotated frame.
    // toBlob is async — open the modal from inside the callback. If the canvas is
    // missing/empty we still open (just without an auto-attached image).
    const openReport = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
            setAnnotatedImage(null);
            setReportOpen(true);
            return;
        }
        canvas.toBlob(
            (blob) => {
                setAnnotatedImage(
                    blob
                        ? new File([blob], `annotated_${Date.now()}.jpg`, {
                              type: "image/jpeg",
                          })
                        : null
                );
                setReportOpen(true);
            },
            "image/jpeg",
            0.9
        );
    };

    const detected = labels.length > 0 ? labels.join(", ") : "objects";

    // Only offer reporting from the image tab, and only once a detection landed.
    const canReport =
        isLoggedIn && tab === "image" && Array.isArray(imageDetections) && imageDetections.length > 0;

    const tabDescription = {
        image: `Upload an image and this spots ${detected} for you — right here in your browser.`,
        video: `Drop a video and this processes it once for ${detected}, then gives you an annotated clip to replay — right here in your browser.`,
        camera: `Point the camera at a scene and this spots ${detected} live — everything runs on your device.`,
    };

    return (
        <div>
            {/* Title */}
            <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                    Run {model.name}
                </h1>
            </div>
            <p className="mt-2 text-muted">{tabDescription[tab]}</p>

            <InputTabs tab={tab} setTab={setTab} />

            {/* Model loading / error banners (shared across tabs) */}
            {modelLoading && (
                <div className="mt-6 flex items-center gap-3 rounded-lg border border-brand-200 bg-primary-soft p-4 text-accent-strong">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Loading the model...</span>
                </div>
            )}
            {modelError && (
                <div className="mt-6 rounded-lg border border-danger-soft bg-danger-soft p-4 text-sm font-medium text-danger">
                    Couldn't load the model file. Check your connection and try again.
                </div>
            )}

            {/* Active input — inactive tab unmounts, so stream/RAF cleanup runs. */}
            {tab === "image" && (
                <ImageRunner
                    session={session}
                    labels={labels}
                    numClasses={numClasses}
                    inputSize={inputSize}
                    onDetections={setImageDetections}
                    canvasRef={canvasRef}
                />
            )}
            {tab === "video" && (
                <VideoRunner
                    ready={ready}
                    runDetection={runDetection}
                    modelId={model.id}
                    labels={labels}
                    numClasses={numClasses}
                    inputSize={inputSize}
                />
            )}
            {tab === "camera" && (
                <CameraRunner
                    ready={ready}
                    runDetection={runDetection}
                    labels={labels}
                    numClasses={numClasses}
                    inputSize={inputSize}
                />
            )}

            {/* Report trigger — secondary action; inference itself is the primary one.
                Shown below the result area once a logged-in user has a detection. */}
            {canReport && (
                <div className="mt-6">
                    <button type="button" onClick={openReport} className="btn btn-secondary">
                        <Flag className="h-4 w-4" />
                        Report this issue
                    </button>
                </div>
            )}

            <ReportModal
                modelId={model.id}
                modelName={model.name}
                isOpen={reportOpen}
                onClose={() => setReportOpen(false)}
                annotatedImage={annotatedImage}
            />

            {/* Legend of classes (generated from labels, not hardcoded) */}
            {labels.length > 0 && (
                <div className="mt-6">
                    <h2 className="text-sm font-semibold text-muted">Detects</h2>
                    <div className="mt-3 flex flex-wrap gap-3">
                        {labels.map((label, i) => (
                            <span
                                key={label}
                                className="inline-flex items-center gap-2 rounded-md bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-soft ring-1 ring-line"
                            >
                                <span
                                    className="h-3 w-3 rounded-sm"
                                    style={{ backgroundColor: colorForClass(i, labels.length) }}
                                />
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Image tab ────────────────────────────────────────────────────────── */

function ImageRunner({ session, labels, numClasses, inputSize, onDetections, canvasRef }) {
    // The currently loaded <img> element (source for both inference + canvas).
    const [image, setImage] = useState(null);
    const [detections, setDetections] = useState(null); // null = not run yet
    // idle | running | done | error
    const [runState, setRunState] = useState("idle");
    const [dragOver, setDragOver] = useState(false);
    const [fileError, setFileError] = useState("");
    const fileInputRef = useRef(null);

    // Load a picked/dropped file into an HTMLImageElement.
    const handleFile = (file) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setFileError("Unsupported file. Please upload an image (JPG, PNG, or WebP).");
            setTimeout(() => setFileError(""), 4000);
            return;
        }
        setFileError("");
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            setDetections(null);
            setRunState("idle");
            setImage(img);
        };
        img.src = url;
    };

    // Run inference whenever we have both a loaded image and a ready session.
    useEffect(() => {
        if (!image || !session) return;
        let cancelled = false;

        const run = async () => {
            setRunState("running");
            try {
                const tensor = preprocess(image, inputSize);
                const output = await runInference(session, tensor, inputSize);
                const results = postprocess(output, {
                    numClasses,
                    inputSize,
                    confThreshold: 0.4,
                    iouThreshold: 0.45,
                    originalWidth: image.naturalWidth,
                    originalHeight: image.naturalHeight,
                });
                if (cancelled) return;
                setDetections(results);
                setRunState("done");
            } catch (e) {
                if (cancelled) return;
                console.error("Inference failed:", e);
                setRunState("error");
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [image, session, inputSize, numClasses]);

    // Surface the latest detections to the page so it can offer "Report this issue".
    useEffect(() => {
        onDetections?.(detections);
    }, [detections, onDetections]);

    return (
        <div>
            {/* Upload area */}
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
                            ? "border-primary bg-primary-soft"
                            : "border-line-strong bg-surface hover:border-brand-300 hover:bg-surface-2"
                    }`}
                >
                    <Upload className="h-8 w-8 text-accent" />
                    <span className="text-base font-semibold text-ink">
                        Drop an image here, or click to choose
                    </span>
                    <span className="text-sm text-muted">PNG or JPG</span>
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                />
                {fileError && (
                    <p className="mt-2 text-sm font-medium text-danger">{fileError}</p>
                )}
            </div>

            {/* Result status line */}
            {image && (
                <div className="mt-6">
                    <ResultStatus runState={runState} detections={detections} />
                </div>
            )}

            {/* Canvas with overlays */}
            {image && (
                <div className="mt-4">
                    <DetectionCanvas
                        ref={canvasRef}
                        image={image}
                        detections={detections || []}
                        labels={labels}
                    />
                </div>
            )}
        </div>
    );
}

/* ── Result status ────────────────────────────────────────────────────── */

function ResultStatus({ runState, detections }) {
    if (runState === "running") {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-primary-soft p-4 text-accent-strong">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Running detection...</span>
            </div>
        );
    }
    if (runState === "error") {
        return (
            <div className="rounded-lg border border-danger-soft bg-danger-soft p-4 text-sm font-medium text-danger">
                Something went wrong running the model on this image.
            </div>
        );
    }
    if (runState === "done" && detections) {
        if (detections.length === 0) {
            return (
                <div className="rounded-lg border border-line bg-surface p-4 text-sm font-medium text-muted">
                    No objects detected — try a clearer or closer image.
                </div>
            );
        }
        return (
            <div className="rounded-lg border border-success-soft bg-success-soft p-4 text-sm font-semibold text-success">
                Found {detections.length}{" "}
                {detections.length === 1 ? "detection" : "detections"}
            </div>
        );
    }
    return null;
}

/* ── Input tabs ──────────────────────────────────────────────────────── */

function InputTabs({ tab, setTab }) {
    return (
        <div className="mt-8 flex flex-wrap gap-2 border-b border-line">
            <TabButton
                icon={ImageIcon}
                label="Image"
                active={tab === "image"}
                onClick={() => setTab("image")}
            />
            <TabButton
                icon={Video}
                label="Video"
                active={tab === "video"}
                onClick={() => setTab("video")}
            />
            <TabButton
                icon={Camera}
                label="Live Camera"
                active={tab === "camera"}
                onClick={() => setTab("camera")}
            />
        </div>
    );
}

function TabButton({ icon: Icon, label, active, comingSoon, onClick }) {
    // Disabled / "coming soon" tab.
    if (comingSoon) {
        return (
            <span
                className="-mb-px inline-flex cursor-not-allowed items-center gap-2 px-4 py-2.5 text-sm font-medium text-faint"
                title="Coming soon"
            >
                <Icon className="h-4 w-4" />
                {label}
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Soon
                </span>
            </span>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={`-mb-px inline-flex items-center gap-2 px-4 py-2.5 text-sm transition ${
                active
                    ? "border-b-2 border-primary font-semibold text-accent"
                    : "font-medium text-muted hover:text-accent"
            }`}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    );
}

/* ── States ───────────────────────────────────────────────────────────── */

function MetaLoadingState() {
    return (
        <div className="animate-pulse">
            <div className="h-8 w-2/3 rounded bg-surface-2" />
            <div className="mt-4 h-5 w-full rounded bg-surface-2" />
            <div className="mt-8 h-10 w-1/2 rounded bg-surface-2" />
            <div className="mt-6 h-40 w-full rounded-xl bg-surface-2" />
        </div>
    );
}

function SimpleState({ title, body }) {
    return (
        <div className="mx-auto max-w-md text-center">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <p className="mt-2 text-sm text-muted">{body}</p>
            <Link to="/discover" className="btn btn-primary mt-6">
                Browse all models
            </Link>
        </div>
    );
}
