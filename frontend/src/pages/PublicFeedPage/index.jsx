import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ImageOff, Sparkles } from "lucide-react";
import { axiosClient } from "../../utils/axiosClient";

// Report images are served from the backend's /static mount, which lives at the
// host root — not under the /api/v1 API base. Strip the API suffix to reach it.
const STATIC_BASE = (import.meta.env.VITE_APP_BACKEND_URI || "").replace(/\/api\/v1\/?$/, "");

// Same status palette as the dashboard report card.
const STATUS_STYLES = {
    submitted: "bg-surface-2 text-muted",
    under_review: "bg-warning-soft text-warning",
    in_progress: "bg-info-soft text-info",
    resolved: "bg-success-soft text-success",
};

function formatDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

/* Small "Detected" badge for images the model annotated (is_annotated) — visual
   proof the model ran. Overlaid on a relatively-positioned thumbnail. */
function DetectedBadge() {
    return (
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-on-primary shadow">
            <Sparkles className="h-2.5 w-2.5" />
            Detected
        </span>
    );
}

/**
 * PublicFeedPage — the anonymous, no-login view of public reports. It renders
 * PublicReportOut payloads, which carry NO reporter identity (no user_id, here
 * or in nested images). Never add anything identity-related to these cards.
 */
export default function PublicFeedPage() {
    // loading | success | error
    const [status, setStatus] = useState("loading");
    const [reports, setReports] = useState([]);

    useEffect(() => {
        // Works unauthenticated — /reports/public has no auth dependency.
        axiosClient
            .get("/reports/public")
            .then((res) => {
                setReports(res.data);
                setStatus("success");
            })
            .catch(() => setStatus("error"));
    }, []);

    return (
        <div className="flex-1 bg-canvas px-4 py-10 md:py-12">
            <div className="mx-auto w-full max-w-5xl">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">Public Feed</h1>
                    <p className="mt-1 text-sm text-muted">
                        Civic issues reported by the community — newest first.
                    </p>
                </header>

                {status === "loading" && <SkeletonGrid />}

                {status === "error" && (
                    <p className="rounded-lg border border-danger-soft bg-danger-soft p-4 text-sm font-medium text-danger">
                        Couldn&apos;t load the feed. Refresh to try again.
                    </p>
                )}

                {status === "success" && reports.length === 0 && <EmptyState />}

                {status === "success" && reports.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {reports.map((report) => (
                            <PublicReportCard key={report.id} report={report} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Public report card ───────────────────────────────────────────────────
   Read-only. Shows ONLY: thumbnail, title, category, status, location, date.
   No delete / edit / private chip / status-change, and nothing identity-related. */

function PublicReportCard({ report }) {
    const [expanded, setExpanded] = useState(false);
    const images = report.images || [];
    const primary = images[0];

    return (
        <div className="card card-hover flex flex-col overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex flex-1 flex-col text-left"
            >
                {/* Primary image thumbnail (placeholder block if none) */}
                {primary ? (
                    <div className="relative">
                        <img
                            src={`${STATIC_BASE}${primary.image_url}`}
                            alt={report.title || "Report image"}
                            className="h-40 w-full object-cover"
                        />
                        {primary.is_annotated && <DetectedBadge />}
                    </div>
                ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-surface-2">
                        <ImageOff className="h-8 w-8 text-faint" />
                    </div>
                )}

                <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">
                            {report.title || "Untitled report"}
                        </span>
                        <span className="badge badge-brand">
                            {report.category}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                            className={`rounded-full px-2 py-0.5 font-semibold capitalize ${
                                STATUS_STYLES[report.status] || STATUS_STYLES.submitted
                            }`}
                        >
                            {report.status.replace("_", " ")}
                        </span>
                        <span className="text-faint">{formatDate(report.created_at)}</span>
                    </div>

                    <p className="flex items-center gap-1.5 text-sm text-muted">
                        <MapPin className="h-4 w-4 shrink-0" />
                        {report.location_text || "Location not specified"}
                    </p>
                </div>
            </button>

            {expanded && (
                <div className="space-y-3 border-t border-line px-4 py-3">
                    <p className="text-sm text-muted">
                        {report.description || "No description provided."}
                    </p>
                    {images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {images.map((img) => (
                                <div key={img.id} className="flex flex-col items-center gap-1">
                                    <div className="relative h-20 w-20">
                                        <img
                                            src={`${STATIC_BASE}${img.image_url}`}
                                            alt={img.image_type}
                                            className="h-20 w-20 rounded-md border border-line object-cover"
                                        />
                                        {img.is_annotated && <DetectedBadge />}
                                    </div>
                                    {img.image_type && (
                                        <span className="text-[10px] font-medium uppercase tracking-wide text-faint">
                                            {img.image_type}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface p-8 text-center">
            <p className="text-sm text-muted">
                No public reports yet. Be the first — run a detection and report an issue.
            </p>
            <Link to="/discover" className="btn btn-primary mt-4">
                Browse models
            </Link>
        </div>
    );
}

function SkeletonGrid() {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card animate-pulse overflow-hidden">
                    <div className="h-40 w-full bg-surface-2" />
                    <div className="space-y-3 p-4">
                        <div className="h-4 w-1/2 rounded bg-surface-2" />
                        <div className="h-3 w-1/3 rounded bg-surface-2" />
                        <div className="h-3 w-2/3 rounded bg-surface-2" />
                    </div>
                </div>
            ))}
        </div>
    );
}
