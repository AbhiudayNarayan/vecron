import { Link } from "react-router-dom";
import { Search, Boxes, Download, Gift, ArrowRight, ShieldCheck } from "lucide-react";
import hero from "../../assets/hero.png";

/**
 * HomePage — Kriya landing page.
 * Marketplace for specialised ML models. The free tier works without login,
 * so the primary CTA is "Browse models" (/discover); "Create free account"
 * (/register) is secondary.
 */
export default function HomePage() {
    return (
        <main className="bg-white text-gray-900">
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden bg-zinc-900 text-white">
                <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2 md:py-28">
                    <div>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/60 px-3 py-1 text-xs font-medium text-zinc-300">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Specialised ML models, ready to run
                        </span>
                        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
                            The marketplace for{" "}
                            <span className="text-blue-500">specialised ML models</span>
                        </h1>
                        <p className="mt-5 max-w-md text-lg text-zinc-400">
                            Discover production-ready computer-vision models, download the
                            ONNX, and ship. The free tier works without an account.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-4">
                            <Link
                                to="/discover"
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                            >
                                Browse models
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                to="/register"
                                className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                            >
                                Create free account
                            </Link>
                        </div>
                    </div>

                    <div className="hidden md:block">
                        <img
                            src={hero}
                            alt="Kriya — ML model marketplace"
                            className="mx-auto w-full max-w-md rounded-xl shadow-2xl ring-1 ring-white/10"
                        />
                    </div>
                </div>
            </section>

            {/* ── Value props ──────────────────────────────────────────────── */}
            <section className="mx-auto max-w-6xl px-6 py-20">
                <div className="grid gap-8 md:grid-cols-3">
                    <Feature
                        icon={<Search className="h-6 w-6" />}
                        title="Find by task & industry"
                        body="Search models by what they do and where they're used — detection, safety, agriculture, and more."
                    />
                    <Feature
                        icon={<Download className="h-6 w-6" />}
                        title="Ready-to-use ONNX"
                        body="Every model ships as a standard .onnx file you can download and run in your own stack."
                    />
                    <Feature
                        icon={<Gift className="h-6 w-6" />}
                        title="Free tier, no login"
                        body="Browse and use free-tier models without an account. Sign up only when you want more."
                    />
                </div>
            </section>

            {/* ── How it works ─────────────────────────────────────────────── */}
            <section className="bg-gray-50 py-20">
                <div className="mx-auto max-w-6xl px-6">
                    <h2 className="text-center text-3xl font-bold">How it works</h2>
                    <div className="mt-12 grid gap-8 md:grid-cols-3">
                        <Step n="1" title="Browse" body="Explore the catalog and search for the model that fits your task." />
                        <Step n="2" title="Download" body="Grab the .onnx file and any class labels straight from the model page." />
                        <Step n="3" title="Integrate" body="Drop it into your pipeline with onnxruntime — no vendor lock-in." />
                    </div>
                </div>
            </section>

            {/* ── Final CTA ────────────────────────────────────────────────── */}
            <section className="bg-zinc-900 text-white">
                <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center">
                    <Boxes className="h-10 w-10 text-blue-500" />
                    <h2 className="text-3xl font-bold">Start finding the right model</h2>
                    <p className="max-w-md text-zinc-400">
                        Jump straight into the catalog — no account required to start.
                    </p>
                    <Link
                        to="/discover"
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    >
                        Browse models
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </section>
        </main>
    );
}

function Feature({ icon, title, body }) {
    return (
        <div className="rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                {icon}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-gray-500">{body}</p>
        </div>
    );
}

function Step({ n, title, body }) {
    return (
        <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                {n}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-gray-500">{body}</p>
        </div>
    );
}
