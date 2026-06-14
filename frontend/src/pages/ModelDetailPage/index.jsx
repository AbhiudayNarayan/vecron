import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Gauge, Tag, Layers, Sparkles } from "lucide-react";
import { axiosClient } from "../../utils/axiosClient";

/**
 * ModelDetailPage — public detail view for a single model.
 *
 * Reads the :id from the URL and fetches GET /api/v1/models/{id} on mount.
 * Copy is written for a non-technical reader (farmer, shop owner), so it
 * avoids ML jargon and explains things in plain language. Matches the warm
 * light theme + saffron accent + floating/hover feel of the Discover cards.
 */
export default function ModelDetailPage() {
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
                {/* Back link — present in every state */}
                <Link
                    to="/discover"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-accent"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to all models
                </Link>

                <div className="mt-8">
                    {status === "loading" && <LoadingState />}
                    {status === "error" && <ErrorState />}
                    {status === "notfound" && <NotFoundState />}
                    {status === "success" && model && <ModelDetail model={model} />}
                </div>
            </div>
        </main>
    );
}

/* ── Detail ───────────────────────────────────────────────────────────── */

function ModelDetail({ model }) {
    const {
        id,
        name,
        description,
        task_type,
        industry,
        accuracy,
        labels,
        is_free,
    } = model;

    return (
        <div className="card card-pad sm:p-8">
            {/* Heading + Free badge */}
            <div className="flex items-start justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                    {name}
                </h1>
                {is_free && (
                    <span className="badge badge-success mt-1 shrink-0 px-3 py-1 text-sm">
                        Free
                    </span>
                )}
            </div>

            {/* Description in plain language */}
            {description && (
                <p className="mt-4 text-lg text-muted">{description}</p>
            )}

            {/* What this does — friendly, jargon-free explainer */}
            <div className="mt-8 rounded-xl border border-brand-200 bg-primary-soft p-6">
                <div className="flex items-center gap-2 text-accent-strong">
                    <Sparkles className="h-5 w-5" />
                    <h2 className="text-base font-semibold">What this does</h2>
                </div>
                <p className="mt-2 text-ink">
                    {whatThisDoes(model)}
                </p>
            </div>

            {/* Details strip */}
            <div className="mt-8 flex flex-wrap gap-3">
                {industry && (
                    <span className="badge badge-brand px-3 py-1.5 text-sm">
                        <Tag className="h-4 w-4" />
                        {industry}
                    </span>
                )}
                {task_type && (
                    <span className="badge badge-info px-3 py-1.5 text-sm">
                        <Layers className="h-4 w-4" />
                        {task_type}
                    </span>
                )}
                <span className="badge px-3 py-1.5 text-sm">
                    <Gauge className="h-4 w-4" />
                    Accuracy: {accuracy != null ? accuracy : "—"}
                </span>
            </div>

            {/* What it detects */}
            {Array.isArray(labels) && labels.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-sm font-semibold text-muted">
                        What it spots
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {labels.map((label) => (
                            <span key={label} className="badge badge-info">
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Primary call to action */}
            <Link
                to={`/model/${id}/run`}
                className="btn btn-primary btn-lg btn-block mt-10 text-lg transition-transform hover:-translate-y-0.5"
            >
                Try it free
            </Link>
        </div>
    );
}

/**
 * Builds a one/two-sentence, plain-language explainer from the model's fields.
 * Falls back gracefully when labels are missing.
 */
function whatThisDoes(model) {
    const { labels, industry } = model;
    const things =
        Array.isArray(labels) && labels.length > 0
            ? labels.join(", ")
            : null;
    const audience = industry ? ` It's built for ${industry}.` : "";

    if (things) {
        return `Point your camera at what you're working with and this spots ${things} automatically — so you can catch problems early.${audience}`;
    }
    return `Point your camera at what you're working with and this does the checking for you automatically — so you can catch problems early.${audience}`;
}

/* ── States ───────────────────────────────────────────────────────────── */

function LoadingState() {
    return (
        <div className="card card-pad animate-pulse sm:p-8">
            <div className="h-8 w-2/3 rounded bg-surface-2" />
            <div className="mt-4 h-5 w-full rounded bg-surface-2" />
            <div className="mt-2 h-5 w-5/6 rounded bg-surface-2" />
            <div className="mt-8 h-24 w-full rounded-xl bg-surface-2" />
            <div className="mt-8 flex gap-3">
                <div className="h-8 w-24 rounded-md bg-surface-2" />
                <div className="h-8 w-24 rounded-md bg-surface-2" />
            </div>
            <div className="mt-10 h-14 w-full rounded-lg bg-surface-2" />
        </div>
    );
}

function NotFoundState() {
    return (
        <div className="mx-auto max-w-md text-center">
            <h2 className="text-lg font-semibold text-ink">
                We couldn&apos;t find that model
            </h2>
            <p className="mt-2 text-sm text-muted">
                It may have been moved or removed.
            </p>
            <Link to="/discover" className="btn btn-primary mt-6">
                Browse all models
            </Link>
        </div>
    );
}

function ErrorState() {
    return (
        <div className="mx-auto max-w-md text-center">
            <h2 className="text-lg font-semibold text-ink">
                Something went wrong
            </h2>
            <p className="mt-2 text-sm text-muted">
                We couldn&apos;t load this model. Please try again.
            </p>
        </div>
    );
}
