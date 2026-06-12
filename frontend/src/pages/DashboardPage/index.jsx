import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, ChevronDown, ChevronUp, FileText, Trash2, X, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "../../context/MainContext";
import { axiosClient } from "../../utils/axiosClient";

// Report images are served from the backend's /static mount, which lives at the
// host root — not under the /api/v1 API base. Strip the API suffix to reach it.
const STATIC_BASE = (import.meta.env.VITE_APP_BACKEND_URI || "").replace(/\/api\/v1\/?$/, "");

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-10">
            <div className="mx-auto w-full max-w-2xl space-y-8">
                {/* Profile */}
                <div className="rounded-xl bg-white p-8 shadow-lg text-center space-y-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mx-auto">
                        <span className="text-2xl font-bold text-blue-600">
                            {user?.name?.[0]?.toUpperCase() ?? "?"}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                        <p className="mt-1 text-sm text-gray-500">You&apos;re signed in</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-4 py-3 text-left space-y-2">
                        <Row label="Name" value={user?.name} />
                        <Row label="Email" value={user?.email} />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                        Sign Out
                    </button>
                </div>

                {/* My Reports */}
                <MyReports />
            </div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-900">{value ?? "—"}</span>
        </div>
    );
}

/* ── My Reports ───────────────────────────────────────────────────────── */

function MyReports() {
    // loading | success | error
    const [status, setStatus] = useState("loading");
    const [reports, setReports] = useState([]);

    // Returns a promise so callers (e.g. after a delete) can await the refetch.
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

    return (
        <section>
            <h2 className="mb-4 text-lg font-bold text-gray-900">My Reports</h2>

            {status === "loading" && <SkeletonList />}

            {status === "error" && (
                <p className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
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
    );
}

const STATUS_STYLES = {
    submitted: "bg-gray-100 text-gray-700",
    under_review: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-blue-100 text-blue-700",
    resolved: "bg-green-100 text-green-700",
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
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-start gap-1">
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex flex-1 items-start justify-between gap-3 p-4 text-left"
                >
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900">
                                {report.title || "Untitled report"}
                            </span>
                            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                                {report.category}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span
                                className={`rounded-full px-2 py-0.5 font-semibold capitalize ${
                                    STATUS_STYLES[report.status] || STATUS_STYLES.submitted
                                }`}
                            >
                                {report.status.replace("_", " ")}
                            </span>
                            <span className="text-gray-400">{formatDate(report.created_at)}</span>
                            <span
                                className={`rounded-full px-2 py-0.5 font-medium ${
                                    report.is_public
                                        ? "bg-green-50 text-green-700"
                                        : "bg-gray-100 text-gray-500"
                                }`}
                            >
                                {report.is_public ? "Public" : "Private"}
                            </span>
                        </div>
                    </div>
                    {expanded ? (
                        <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" />
                    ) : (
                        <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setConfirming("report")}
                    className="mr-2 mt-3 rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete report"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            </div>

            {expanded && (
                <div className="space-y-3 border-t border-gray-100 px-4 py-3">
                    <p className="text-sm text-gray-600">
                        {report.description || "No description provided."}
                    </p>
                    {report.location_text && (
                        <p className="flex items-center gap-1.5 text-sm text-gray-500">
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
                                        className="h-20 w-20 rounded-md border border-gray-200 object-cover"
                                    />
                                    {/* Proof the model ran — annotated detection frame. */}
                                    {img.is_annotated && (
                                        <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow">
                                            <Sparkles className="h-2.5 w-2.5" />
                                            Detected
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setConfirming(img.id)}
                                        // Always visible on small/touch screens; hover-reveal on desktop.
                                        className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white shadow-sm transition hover:bg-red-700 sm:opacity-0 sm:group-hover:opacity-100"
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
                <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
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
                className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{body}</p>
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm text-gray-600">
                No reports yet. Run a detection and use &quot;Report this issue&quot; to flag
                something.
            </p>
            <Link
                to="/discover"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
                Browse models
            </Link>
        </div>
    );
}

function SkeletonList() {
    return (
        <div className="space-y-3">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="h-[92px] animate-pulse rounded-xl border border-gray-200 bg-white p-4"
                >
                    <div className="h-4 w-1/2 rounded bg-gray-200" />
                    <div className="mt-3 h-3 w-1/3 rounded bg-gray-100" />
                </div>
            ))}
        </div>
    );
}
