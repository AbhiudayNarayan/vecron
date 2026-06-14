import { useEffect, useState } from "react";
import {
    X,
    MapPin,
    Loader2,
    ImagePlus,
    Trash2,
    CheckCircle2,
    Tag,
    Sparkles,
} from "lucide-react";
import { axiosClient } from "../../utils/axiosClient";

/**
 * ReportModal — multi-step form (details → location → photos) for flagging a
 * civic issue the model just detected. Controlled via isOpen/onClose.
 *
 * The category is fixed to the model that found the issue (read-only badge),
 * never a free-text user input. On submit it creates the report, then uploads
 * each photo sequentially (the upload endpoint creates the per-report dir on
 * first write, so parallel uploads could race on that mkdir).
 *
 * If annotatedImage is provided, it's the snapshot of the detection canvas
 * (boxes + labels). It's pre-attached as the first, locked image (is_annotated)
 * so every report carries proof the model actually ran. Manual photos are an
 * optional extra, up to MAX_IMAGES total including the locked one.
 */
const MAX_IMAGES = 5;

export default function ReportModal({ modelId, modelName, isOpen, onClose, annotatedImage }) {
    const [step, setStep] = useState(1);

    // Step 1 — details
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(false);

    // Step 2 — location
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [locationText, setLocationText] = useState("");
    const [geoError, setGeoError] = useState("");
    const [locating, setLocating] = useState(false);

    // Step 3 — photos: [{ file, type, is_annotated, previewUrl }]
    const [images, setImages] = useState([]);

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [done, setDone] = useState(false);

    // When the modal opens with an annotated detection frame, seed it as the
    // first, locked image. Its object URL is revoked on close/unmount (cleanup
    // here) and also by resetAndClose — revoking twice is a harmless no-op.
    useEffect(() => {
        if (!isOpen || !annotatedImage) return;
        const previewUrl = URL.createObjectURL(annotatedImage);
        setImages([
            { file: annotatedImage, type: "before", is_annotated: true, previewUrl },
        ]);
        return () => URL.revokeObjectURL(previewUrl);
    }, [isOpen, annotatedImage]);

    if (!isOpen) return null;

    const resetAndClose = () => {
        // Free the object URLs we created for thumbnails.
        images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
        setStep(1);
        setTitle("");
        setDescription("");
        setIsPublic(false);
        setLatitude(null);
        setLongitude(null);
        setLocationText("");
        setGeoError("");
        setImages([]);
        setSubmitError("");
        setDone(false);
        onClose();
    };

    const useMyLocation = () => {
        setGeoError("");
        if (!navigator.geolocation) {
            setGeoError("Location unavailable — enter address manually");
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLatitude(pos.coords.latitude);
                setLongitude(pos.coords.longitude);
                setLocating(false);
            },
            () => {
                setGeoError("Location unavailable — enter address manually");
                setLocating(false);
            }
        );
    };

    const addFiles = (fileList) => {
        const incoming = Array.from(fileList || []);
        setImages((prev) => {
            // The locked annotated frame counts toward the cap, so manual photos
            // are limited to the remaining room (up to 4 alongside it).
            const room = MAX_IMAGES - prev.length;
            if (room <= 0) {
                setSubmitError(`You can attach up to ${MAX_IMAGES} photos in total.`);
                return prev;
            }
            setSubmitError("");
            const next = incoming.slice(0, room).map((file) => ({
                file,
                type: "before",
                is_annotated: false,
                previewUrl: URL.createObjectURL(file),
            }));
            return [...prev, ...next];
        });
    };

    const setImageType = (idx, type) =>
        setImages((prev) => prev.map((img, i) => (i === idx ? { ...img, type } : img)));

    const removeImage = (idx) =>
        setImages((prev) => {
            URL.revokeObjectURL(prev[idx].previewUrl);
            return prev.filter((_, i) => i !== idx);
        });

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError("");
        try {
            // 1. Create the report.
            const { data: report } = await axiosClient.post("/reports", {
                title,
                description: description || null,
                category: modelName,
                latitude,
                longitude,
                location_text: locationText || null,
                is_public: isPublic,
                model_id: modelId,
            });

            // 2. Upload photos sequentially (avoid racing on per-report dir creation).
            for (const img of images) {
                const form = new FormData();
                form.append("file", img.file);
                form.append("image_type", img.type);
                // FastAPI's bool Form coerces these "true"/"false" strings.
                form.append("is_annotated", img.is_annotated ? "true" : "false");
                await axiosClient.post(`/reports/${report.id}/images`, form);
            }

            setDone(true);
            // Briefly show the success state, then close.
            setTimeout(resetAndClose, 1500);
        } catch (err) {
            setSubmitError(
                err?.response?.data?.detail ||
                    "Something went wrong submitting your report. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={resetAndClose}
        >
            <div
                className="relative w-full max-w-lg rounded-2xl bg-surface p-6 shadow-float"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close */}
                <button
                    type="button"
                    onClick={resetAndClose}
                    className="absolute right-4 top-4 rounded-md p-1 text-faint transition hover:bg-surface-2 hover:text-ink"
                    aria-label="Close"
                >
                    <X className="h-5 w-5" />
                </button>

                {done ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <CheckCircle2 className="h-12 w-12 text-success" />
                        <p className="text-lg font-semibold text-ink">
                            Report submitted — thank you!
                        </p>
                    </div>
                ) : (
                    <>
                        <h2 className="text-xl font-bold tracking-tight text-ink">
                            Report this issue
                        </h2>
                        <Stepper step={step} />

                        {step === 1 && (
                            <StepDetails
                                title={title}
                                setTitle={setTitle}
                                description={description}
                                setDescription={setDescription}
                                isPublic={isPublic}
                                setIsPublic={setIsPublic}
                                modelName={modelName}
                                onContinue={() => setStep(2)}
                            />
                        )}

                        {step === 2 && (
                            <StepLocation
                                latitude={latitude}
                                longitude={longitude}
                                locationText={locationText}
                                setLocationText={setLocationText}
                                geoError={geoError}
                                locating={locating}
                                useMyLocation={useMyLocation}
                                onBack={() => setStep(1)}
                                onContinue={() => setStep(3)}
                            />
                        )}

                        {step === 3 && (
                            <StepPhotos
                                images={images}
                                addFiles={addFiles}
                                setImageType={setImageType}
                                removeImage={removeImage}
                                submitting={submitting}
                                submitError={submitError}
                                onBack={() => setStep(2)}
                                onSubmit={handleSubmit}
                            />
                        )}

                        {submitError && step !== 3 && (
                            <p className="mt-3 text-sm font-medium text-danger">{submitError}</p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/* ── Stepper ──────────────────────────────────────────────────────────── */

function Stepper({ step }) {
    const labels = ["Details", "Location", "Photos"];
    return (
        <div className="mt-3 flex items-center gap-2">
            {labels.map((label, i) => {
                const n = i + 1;
                const active = n === step;
                const complete = n < step;
                return (
                    <div key={label} className="flex items-center gap-2">
                        <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                                active
                                    ? "bg-primary text-on-primary"
                                    : complete
                                    ? "bg-success-soft text-success"
                                    : "bg-surface-2 text-muted"
                            }`}
                        >
                            {n}
                        </span>
                        <span
                            className={`text-xs font-medium ${
                                active ? "text-ink" : "text-faint"
                            }`}
                        >
                            {label}
                        </span>
                        {i < labels.length - 1 && <span className="h-px w-4 bg-line" />}
                    </div>
                );
            })}
        </div>
    );
}

/* ── Step 1 ───────────────────────────────────────────────────────────── */

function StepDetails({
    title,
    setTitle,
    description,
    setDescription,
    isPublic,
    setIsPublic,
    modelName,
    onContinue,
}) {
    return (
        <div className="mt-5 space-y-4">
            <div>
                <label className="label">
                    Title <span className="text-danger">*</span>
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Large pothole near the bus stop"
                    className="input"
                />
            </div>

            <div>
                <label className="label">Description</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Add any detail that helps someone find or fix it (optional)"
                    className="textarea"
                />
            </div>

            <div>
                <label className="label">Category</label>
                <span className="badge badge-brand">
                    <Tag className="h-3 w-3" />
                    {modelName}
                </span>
            </div>

            <button
                type="button"
                onClick={() => setIsPublic((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2.5 text-left text-sm transition hover:border-line-strong"
            >
                <span className="font-medium text-ink">
                    {isPublic ? "Public — anyone can see this report" : "Private"}
                </span>
                <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                        isPublic ? "bg-primary" : "bg-line-strong"
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-surface transition ${
                            isPublic ? "translate-x-4" : "translate-x-0.5"
                        }`}
                    />
                </span>
            </button>

            <button
                type="button"
                disabled={!title.trim()}
                onClick={onContinue}
                className="btn btn-primary btn-block"
            >
                Continue
            </button>
        </div>
    );
}

/* ── Step 2 ───────────────────────────────────────────────────────────── */

function formatCoord(value, posLabel, negLabel) {
    if (value == null) return null;
    const dir = value >= 0 ? posLabel : negLabel;
    return `${Math.abs(value).toFixed(4)}° ${dir}`;
}

function StepLocation({
    latitude,
    longitude,
    locationText,
    setLocationText,
    geoError,
    locating,
    useMyLocation,
    onBack,
    onContinue,
}) {
    const hasCoords = latitude != null && longitude != null;
    return (
        <div className="mt-5 space-y-4">
            <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="btn btn-secondary btn-sm"
            >
                {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <MapPin className="h-4 w-4" />
                )}
                Use my location
            </button>

            {hasCoords && (
                <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-ink">
                    {formatCoord(latitude, "N", "S")}, {formatCoord(longitude, "E", "W")}
                </p>
            )}
            {geoError && <p className="text-sm font-medium text-danger">{geoError}</p>}

            <div>
                <label className="label">
                    Address / landmark (optional)
                </label>
                <input
                    type="text"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    placeholder="e.g. Opposite City Mall, MG Road"
                    className="input"
                />
            </div>

            <div className="flex gap-2">
                <button type="button" onClick={onBack} className="btn btn-secondary">
                    Back
                </button>
                <button
                    type="button"
                    onClick={onContinue}
                    className="btn btn-primary flex-1"
                >
                    Continue
                </button>
            </div>
        </div>
    );
}

/* ── Step 3 ───────────────────────────────────────────────────────────── */

function StepPhotos({
    images,
    addFiles,
    setImageType,
    removeImage,
    submitting,
    submitError,
    onBack,
    onSubmit,
}) {
    return (
        <div className="mt-5 space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong p-6 text-center transition hover:border-brand-300 hover:bg-surface-2">
                <ImagePlus className="h-7 w-7 text-accent" />
                <span className="text-sm font-semibold text-ink">
                    Add photos (up to {MAX_IMAGES})
                </span>
                <span className="text-xs text-muted">JPG, PNG or WebP</span>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    disabled={submitting}
                    onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
            </label>

            {images.length > 0 && (
                <ul className="space-y-3">
                    {images.map((img, idx) => (
                        <li
                            key={img.previewUrl}
                            className="flex items-center gap-3 rounded-lg border border-line p-2"
                        >
                            <div className="relative h-14 w-14 shrink-0">
                                <img
                                    src={img.previewUrl}
                                    alt=""
                                    className="h-14 w-14 rounded-md object-cover"
                                />
                                {img.is_annotated && (
                                    <span className="absolute -left-1 -top-1 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-on-primary shadow">
                                        <Sparkles className="h-2.5 w-2.5" />
                                        Detected
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="inline-flex rounded-md border border-line p-0.5 text-xs font-medium">
                                    {["before", "after"].map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => setImageType(idx, t)}
                                            className={`rounded px-2.5 py-1 capitalize transition ${
                                                img.type === t
                                                    ? "bg-primary text-on-primary"
                                                    : "text-muted hover:bg-surface-2"
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* The auto-attached detection frame is locked (it's the proof
                                image); only manual uploads are removable. */}
                            {!img.is_annotated && (
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => removeImage(idx)}
                                    className="rounded-md p-1.5 text-faint transition hover:bg-surface-2 hover:text-danger"
                                    aria-label="Remove photo"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {submitError && <p className="text-sm font-medium text-danger">{submitError}</p>}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={submitting}
                    className="btn btn-secondary"
                >
                    Back
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={submitting}
                    className="btn btn-primary flex-1"
                >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? "Submitting..." : "Submit report"}
                </button>
            </div>
        </div>
    );
}
