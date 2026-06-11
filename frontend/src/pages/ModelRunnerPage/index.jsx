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
} from "lucide-react";
import { axiosClient } from "../../utils/axiosClient";
import { useOnnxModel } from "../../lib/inference/useOnnxModel";
import { preprocess, runInference, postprocess } from "../../lib/inference/yoloEngine";
import DetectionCanvas, { colorForClass } from "../../components/runner/DetectionCanvas";
import VideoRunner from "../../components/runner/VideoRunner";
import CameraRunner from "../../components/runner/CameraRunner";

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
        <main className="min-h-screen bg-gray-50 text-gray-900">
            <div className="mx-auto max-w-3xl px-6 py-12">
                <Link
                    to={`/model/${id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition hover:text-blue-600"
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
    // Smaller default input → fewer pixels to crunch per frame. Keeps the model's
    // own input_size if the API returns it explicitly; only the fallback drops.
    const inputSize = model.input_size || 416;

    const { session, loading: modelLoading, error: modelError, ready, runDetection } =
        useOnnxModel(model.onnx_url);

    const [tab, setTab] = useState("image");

    const detected = labels.length > 0 ? labels.join(", ") : "objects";

    const tabDescription = {
        image: `Upload an image and this spots ${detected} for you — right here in your browser.`,
        video: `Drop a video and this processes it once for ${detected}, then gives you an annotated clip to replay — right here in your browser.`,
        camera: `Point the camera at a scene and this spots ${detected} live — everything runs on your device.`,
    };

    return (
        <div>
            {/* Title */}
            <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                    Run {model.name}
                </h1>
            </div>
            <p className="mt-2 text-gray-600">{tabDescription[tab]}</p>

            <InputTabs tab={tab} setTab={setTab} />

            {/* Model loading / error banners (shared across tabs) */}
            {modelLoading && (
                <div className="mt-6 flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-indigo-700">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Loading the model…</span>
                </div>
            )}
            {modelError && (
                <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
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

            {/* Legend of classes (generated from labels, not hardcoded) */}
            {labels.length > 0 && (
                <div className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-500">Detects</h2>
                    <div className="mt-3 flex flex-wrap gap-3">
                        {labels.map((label, i) => (
                            <span
                                key={label}
                                className="inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-100"
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

function ImageRunner({ session, labels, numClasses, inputSize }) {
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
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50"
                    }`}
                >
                    <Upload className="h-8 w-8 text-blue-600" />
                    <span className="text-base font-semibold text-gray-900">
                        Drop an image here, or click to choose
                    </span>
                    <span className="text-sm text-gray-500">PNG or JPG</span>
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                />
                {fileError && (
                    <p className="mt-2 text-sm font-medium text-red-600">{fileError}</p>
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
            <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-700">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Running detection…</span>
            </div>
        );
    }
    if (runState === "error") {
        return (
            <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
                Something went wrong running the model on this image.
            </div>
        );
    }
    if (runState === "done" && detections) {
        if (detections.length === 0) {
            return (
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-medium text-gray-600">
                    No objects detected — try a clearer or closer image.
                </div>
            );
        }
        return (
            <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-700">
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
        <div className="mt-8 flex flex-wrap gap-2 border-b border-gray-200">
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
                className="-mb-px inline-flex cursor-not-allowed items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-400"
                title="Coming soon"
            >
                <Icon className="h-4 w-4" />
                {label}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
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
                    ? "border-b-2 border-blue-600 font-semibold text-blue-600"
                    : "font-medium text-gray-500 hover:text-blue-600"
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
            <div className="h-8 w-2/3 rounded bg-gray-200" />
            <div className="mt-4 h-5 w-full rounded bg-gray-100" />
            <div className="mt-8 h-10 w-1/2 rounded bg-gray-100" />
            <div className="mt-6 h-40 w-full rounded-xl bg-gray-100" />
        </div>
    );
}

function SimpleState({ title, body }) {
    return (
        <div className="mx-auto max-w-md text-center">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="mt-2 text-sm text-gray-600">{body}</p>
            <Link
                to="/discover"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                Browse all models
            </Link>
        </div>
    );
}
