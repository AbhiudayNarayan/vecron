import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    MapPin,
    ChevronDown,
    ChevronUp,
    FileText,
    Trash2,
    X,
    Loader2,
    Sparkles,
    LogOut,
    Search,
    Compass,
    Boxes,
    Globe,
    ArrowRight,
} from "lucide-react";
import { useAuth } from "../../context/MainContext";
import { axiosClient } from "../../utils/axiosClient";

// Report images are served from the backend's /static mount, which lives at the
// host root — not under the /api/v1 API base. Strip the API suffix to reach it.
const STATIC_BASE = (import.meta.env.VITE_APP_BACKEND_URI || "").replace(/\/api\/v1\/?$/, "");

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // loading | success | error  — lifted here so the header stats and the
    // "models you've used" strip can share the same /reports/mine fetch.
    const [status, setStatus] = useState("loading");
    const [reports, setReports] = useState([]);

    const fetchReports = useCallback(() => {
        return axiosClient
            .get("/reports/mine")
            .then((res) => {
                setReports(res.data);
                setStatus("success");
            })
            .catch(() => setStatus("error"));
    }, []);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const stats = useMemo(() => {
        const publicCount = reports.filter((r) => r.is_public).length;
        const modelsUsed = new Set(reports.map((r) => r.category).filter(Boolean)).size;
        return { total: reports.length, publicCount, modelsUsed };
    }, [reports]);

    // "Models you've used" — derived purely from the user's own reports (real
    // data, no fabrication). Distinct by category, most-recent first.
    const recentModels = useMemo(() => {
        const seen = new Map();
        [...reports]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .forEach((r) => {
                if (r.category && !seen.has(r.category)) {
                    seen.set(r.category, { category: r.category, modelId: r.model_id ?? null });
                }
            });
        return Array.from(seen.values()).slice(0, 4);
    }, [reports]);

    const initial = user?.name?.[0]?.toUpperCase() ?? "?";

    return (
        <main className="flex-1 bg-canvas">
            <div className="container-page py-10 md:py-12">
                {/* Header / profile */}
                <section className="card overflow-hidden">
                    <div
                        className="px-6 pt-8 pb-6 sm:px-8"
                        style={{
                            background:
                                "radial-gradient(36rem 18rem at 12% -40%, var(--brand-100), transparent 70%)",
                        }}
                    >
                        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-4">
                                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-on-primary shadow-soft">
                                    {initial}
                                </span>
                                <div>
                                    <p className="text-sm font-medium text-muted">Welcome back,</p>
                                    <h1 className="text-2xl font-bold tracking-tight text-ink">
                                        {user?.name ?? "there"}
                                    </h1>
                                    <p className="mt-0.5 text-sm text-muted">{user?.email ?? "—"}</p>
                                </div>
                            </div>
                            <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                                <LogOut className="h-4 w-4" />
                                Sign out
                            </button>
                        </div>
                    </div>

                    {/* Stat tiles */}
                    <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
                        <Stat icon={<FileText className="h-4 w-4" />} label="Reports" value={stats.total} />
                        <Stat icon={<Globe className="h-4 w-4" />} label="Public" value={stats.publicCount} />
                        <Stat icon={<Boxes className="h-4 w-4" />} label="Models used" value={stats.modelsUsed} />
                    </div>
                </section>

                {/* Quick actions */}
                <section className="mt-8">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                        Quick actions
                    </h2>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <ActionCard
                            to="/discover"
                            icon={<Search className="h-5 w-5" />}
                            title="Browse models"
                            body="Find a model for your next task."
                        />
                        <ActionCard
                            to="/feed"
                            icon={<Compass className="h-5 w-5" />}
                            title="Public feed"
                            body="See what the community is reporting."
                        />
                        <ActionCard
                            to="/discover"
                            icon={<Sparkles className="h-5 w-5" />}
                            title="Run a detection"
                            body="Spot an issue, then report it in a tap."
                        />
                    </div>
                </section>

                {/* Models you've used */}
                {recentModels.length > 0 && (
                    <section className="mt-8">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                            Models you&apos;ve used
                        </h2>
                        <div className="mt-3 flex flex-wrap gap-3">
                            {recentModels.map((m) => (
                                <Link
                                    key={m.category}
                                    to={m.modelId ? `/model/${m.modelId}` : "/discover"}
                                    className="card card-hover flex items-center gap-3 px-4 py-3"
                                >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-accent">
                                        <Boxes className="h-4 w-4" />
                                    </span>
                                    <span className="text-sm font-semibold text-ink">{m.category}</span>
                                    <ArrowRight className="h-4 w-4 text-faint" />
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* My reports */}
                <section className="mt-10">
                    <h2 className="mb-4 text-lg font-bold text-ink">My reports</h2>

                    {status === "loading" && <SkeletonList />}

                    {status === "error" && (
                        <p className="rounded-lg border border-danger-soft bg-danger-soft p-4 text-sm font-medium text-danger">
                            Couldn&apos;t load your reports. Please refresh and try again.
                        </p>
                    )}

                    {status === "success" && reports.length === 0 && <EmptyState />}

                    {status === "success" && reports.length > 0 && (
                        <div className="space-y-3">
                            {reports.map((report) => (
                                <ReportCard key={report.id} report={report} onChanged={fetchReports} />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

function Stat({ icon, label, value }) {
    return (
        <div className="flex flex-col items-center gap-1 px-4 py-5 text-center">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                {icon}
                {label}
            </span>
            <span className="text-2xl font-bold text-ink">{value}</span>
        </div>
    );
}

function ActionCard({ to, icon, title, body }) {
    return (
        <Link to={to} className="card card-pad card-hover group flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-accent">
                {icon}
            </span>
            <div>
                <h3 className="font-semibold text-ink transition group-hover:text-accent">{title}</h3>
                <p className="mt-0.5 text-sm text-muted">{body}</p>
            </div>
        </Link>
    );
}

/* ── Report card ──────────────────────────────────────────────────────── */

const STATUS_BADGE = {
    submitted: "badge",
    under_review: "badge badge-warning",
    in_progress: "badge badge-info",
    resolved: "badge badge-success",
};

function formatDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function ReportCard({ report, onChanged }) {
    const [expanded, setExpanded] = useState(false);
    const images = report.images || [];

    // null | "report" | image.id  — which delete is awaiting confirmation.
    const [confirming, setConfirming] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const deleteReport = async () => {
        setBusy(true);
        setError("");
        try {
            await axiosClient.delete(`/reports/${report.id}`);
            setConfirming(null);
            await onChanged(); // refetch /reports/mine — card disappears on its own
        } catch {
            setError("Couldn't delete report — try again.");
        } finally {
            setBusy(false);
        }
    };

    const deleteImage = async (imageId) => {
        setBusy(true);
        setError("");
        try {
            await axiosClient.delete(`/reports/${report.id}/images/${imageId}`);
            setConfirming(null);
            await onChanged();
        } catch {
            setError("Couldn't remove image — try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="card overflow-hidden">
            <div className="flex items-start gap-1">
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex flex-1 items-start justify-between gap-3 p-4 text-left"
                >
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink">
                                {report.title || "Untitled report"}
                            </span>
                            <span className="badge badge-brand">{report.category}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className={`${STATUS_BADGE[report.status] || STATUS_BADGE.submitted} capitalize`}>
                                {report.status.replace("_", " ")}
                            </span>
                            <span className="text-faint">{formatDate(report.created_at)}</span>
                            <span className={report.is_public ? "badge badge-success" : "badge"}>
                                {report.is_public ? "Public" : "Private"}
                            </span>
                        </div>
                    </div>
                    {expanded ? (
                        <ChevronUp className="h-5 w-5 shrink-0 text-faint" />
                    ) : (
                        <ChevronDown className="h-5 w-5 shrink-0 text-faint" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setConfirming("report")}
                    className="mr-2 mt-3 rounded-md p-2 text-faint transition hover:bg-danger-soft hover:text-danger"
                    aria-label="Delete report"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            </div>

            {expanded && (
                <div className="space-y-3 border-t border-line px-4 py-3">
                    <p className="text-sm text-muted">
                        {report.description || "No description provided."}
                    </p>
                    {report.location_text && (
                        <p className="flex items-center gap-1.5 text-sm text-muted">
                            <MapPin className="h-4 w-4 shrink-0" />
                            {report.location_text}
                        </p>
                    )}
                    {images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {images.map((img) => (
                                <div key={img.id} className="group relative h-20 w-20">
                                    <img
                                        src={`${STATIC_BASE}${img.image_url}`}
                                        alt={img.image_type}
                                        title={img.image_type}
                                        className="h-20 w-20 rounded-md border border-line object-cover"
                                    />
                                    {/* Proof the model ran — annotated detection frame. */}
                                    {img.is_annotated && (
                                        <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-on-primary shadow">
                                            <Sparkles className="h-2.5 w-2.5" />
                                            Detected
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setConfirming(img.id)}
                                        // Always visible on small/touch screens; hover-reveal on desktop.
                                        className="absolute -right-1.5 -top-1.5 rounded-full bg-danger p-0.5 text-white shadow-sm transition hover:brightness-90 sm:opacity-0 sm:group-hover:opacity-100"
                                        aria-label="Remove image"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {error && (
                <p className="border-t border-danger-soft bg-danger-soft px-4 py-2 text-sm font-medium text-danger">
                    {error}
                </p>
            )}

            {confirming === "report" && (
                <ConfirmDialog
                    title="Delete this report?"
                    body="This can't be undone."
                    confirmLabel="Delete"
                    busy={busy}
                    onCancel={() => setConfirming(null)}
                    onConfirm={deleteReport}
                />
            )}
            {confirming != null && confirming !== "report" && (
                <ConfirmDialog
                    title="Remove this image?"
                    body="This can't be undone."
                    confirmLabel="Remove"
                    busy={busy}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => deleteImage(confirming)}
                />
            )}
        </div>
    );
}

/* ── Confirm dialog ───────────────────────────────────────────────────── */

function ConfirmDialog({ title, body, confirmLabel, busy, onCancel, onConfirm }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={busy ? undefined : onCancel}
        >
            <div
                className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-float"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm text-muted">{body}</p>
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="btn btn-secondary btn-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className="btn btn-danger btn-sm"
                    >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-faint" />
            <p className="mt-3 text-sm text-muted">
                No reports yet. Run a detection and use &quot;Report this issue&quot; to flag
                something.
            </p>
            <Link to="/discover" className="btn btn-primary mt-4">
                Browse models
            </Link>
        </div>
    );
}

function SkeletonList() {
    return (
        <div className="space-y-3">
            {[0, 1, 2].map((i) => (
                <div key={i} className="card h-[92px] animate-pulse p-4">
                    <div className="h-4 w-1/2 rounded bg-surface-2" />
                    <div className="mt-3 h-3 w-1/3 rounded bg-surface-2" />
                </div>
            ))}
        </div>
    );
}
