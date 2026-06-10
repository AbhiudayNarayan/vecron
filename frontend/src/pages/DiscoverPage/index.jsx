import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { axiosClient } from "../../utils/axiosClient";
import ModelCard from "../../components/ModelCard";

/**
 * DiscoverPage — public model catalog.
 *
 * Reads the `q` search param from the URL and fetches the matching models from
 * GET /api/v1/models (optionally ?q=). Submitting the search bar just updates
 * the URL, which re-triggers the fetch via the effect below. No auth required.
 */
export default function DiscoverPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const q = searchParams.get("q") || "";

    const [models, setModels] = useState([]);
    const [status, setStatus] = useState("loading"); // loading | success | error
    const [term, setTerm] = useState(q); // controlled value of the search input

    // Keep the input in sync if the URL changes (e.g. back button, homepage link)
    useEffect(() => {
        setTerm(q);
    }, [q]);

    // Fetch on mount and whenever `q` changes.
    useEffect(() => {
        let cancelled = false;

        const fetchModels = async () => {
            setStatus("loading");
            try {
                const response = await axiosClient.get("/models", {
                    params: q ? { q } : {},
                });
                if (cancelled) return;
                setModels(response.data);
                setStatus("success");
            } catch (error) {
                if (cancelled) return;
                setStatus("error");
            }
        };

        fetchModels();
        return () => {
            cancelled = true;
        };
    }, [q]);

    // Submitting the search bar writes `q` to the URL (or clears it when empty).
    const handleSearch = (e) => {
        e.preventDefault();
        const next = term.trim();
        setSearchParams(next ? { q: next } : {});
    };

    return (
        <main className="min-h-screen bg-gray-50 text-gray-900">
            <div className="mx-auto max-w-6xl px-6 py-12">
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                        Browse models
                    </h1>
                    <p className="mt-3 text-gray-600">
                        Find a production-ready ML model for your task — no account needed.
                    </p>
                </div>

                {/* ── Search bar ──────────────────────────────────────────── */}
                <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-xl">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="Search by name, task, or industry…"
                            className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-12 pr-28 text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Search
                        </button>
                    </div>
                </form>

                {/* ── Results ─────────────────────────────────────────────── */}
                <div className="mt-12">
                    {status === "loading" && <LoadingState />}
                    {status === "error" && <ErrorState />}
                    {status === "success" && models.length === 0 && <EmptyState q={q} />}
                    {status === "success" && models.length > 0 && (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {models.map((model) => (
                                <ModelCard key={model.id} model={model} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

/* ── States ───────────────────────────────────────────────────────────── */

function LoadingState() {
    // Simple skeleton grid that mirrors the card layout.
    return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div
                    key={i}
                    className="animate-pulse rounded-xl border border-gray-100 bg-white p-6 shadow-md"
                >
                    <div className="h-5 w-2/3 rounded bg-gray-200" />
                    <div className="mt-3 h-4 w-full rounded bg-gray-100" />
                    <div className="mt-2 h-4 w-5/6 rounded bg-gray-100" />
                    <div className="mt-4 flex gap-2">
                        <div className="h-6 w-20 rounded-md bg-gray-100" />
                        <div className="h-6 w-20 rounded-md bg-gray-100" />
                    </div>
                    <div className="mt-4 h-4 w-1/3 rounded bg-gray-100" />
                </div>
            ))}
        </div>
    );
}

function EmptyState({ q }) {
    return (
        <div className="mx-auto max-w-md text-center">
            <h2 className="text-lg font-semibold text-gray-900">
                {q ? `No models found for “${q}”` : "No models available yet"}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
                {q
                    ? "Try a broader term — for example a task like “detection” or an industry like “agriculture”."
                    : "Check back soon — new models are added regularly."}
            </p>
        </div>
    );
}

function ErrorState() {
    return (
        <div className="mx-auto max-w-md text-center">
            <h2 className="text-lg font-semibold text-gray-900">
                Something went wrong
            </h2>
            <p className="mt-2 text-sm text-gray-600">
                We couldn&apos;t load the models. Please try again.
            </p>
        </div>
    );
}
