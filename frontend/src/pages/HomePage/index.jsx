import { Link } from "react-router-dom";
import { Search, Boxes, Download, Gift, ArrowRight, ShieldCheck } from "lucide-react";
import HeroVisual from "../../components/HeroVisual";

/**
 * HomePage — Kriya landing page.
 * Marketplace for specialised ML models. The free tier works without login,
 * so the primary CTA is "Browse models" (/discover); "Create free account"
 * (/register) is secondary.
 */
export default function HomePage() {
    return (
        <div className="bg-canvas text-ink">
            {/* Hero */}
            <section className="relative overflow-hidden">
                <div
                    className="pointer-events-none absolute inset-0 -z-10"
                    style={{
                        background:
                            "radial-gradient(60rem 40rem at 80% -10%, var(--brand-100), transparent 60%), radial-gradient(50rem 40rem at 0% 10%, var(--brand-50), transparent 55%)",
                    }}
                />
                <div className="container-page grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
                    <div>
                        <span className="badge badge-brand">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Specialised ML models, ready to run
                        </span>
                        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
                            The marketplace for{" "}
                            <span className="text-accent">specialised ML models</span>
                        </h1>
                        <p className="mt-5 max-w-md text-lg text-muted">
                            Discover production-ready computer-vision models, download the
                            ONNX, and ship. The free tier works without an account.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link to="/discover" className="btn btn-primary btn-lg">
                                Browse models
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link to="/register" className="btn btn-secondary btn-lg">
                                Create free account
                            </Link>
                        </div>
                    </div>

                    {/* Right-side hero visual — animated ML detection preview.
                        Shows on mobile too (stacks below the text via the grid). */}
                    <div className="mt-4 md:mt-0">
                        <HeroVisual />
                    </div>
                </div>
            </section>

            {/* Value props */}
            <section className="container-page py-16 md:py-20">
                <div className="grid gap-6 md:grid-cols-3">
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

            {/* How it works */}
            <section className="bg-surface-2 py-16 md:py-20">
                <div className="container-page">
                    <h2 className="text-center text-3xl font-bold">How it works</h2>
                    <div className="mt-12 grid gap-8 md:grid-cols-3">
                        <Step n="1" title="Browse" body="Explore the catalog and search for the model that fits your task." />
                        <Step n="2" title="Download" body="Grab the .onnx file and any class labels straight from the model page." />
                        <Step n="3" title="Integrate" body="Drop it into your pipeline with onnxruntime — no vendor lock-in." />
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="container-page py-16 md:py-20">
                <div className="card overflow-hidden">
                    <div
                        className="flex flex-col items-center gap-5 px-6 py-14 text-center"
                        style={{
                            background:
                                "radial-gradient(40rem 24rem at 50% -20%, var(--brand-100), transparent 70%)",
                        }}
                    >
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-soft">
                            <Boxes className="h-7 w-7" />
                        </span>
                        <h2 className="text-3xl font-bold">Start finding the right model</h2>
                        <p className="max-w-md text-muted">
                            Jump straight into the catalog — no account required to start.
                        </p>
                        <Link to="/discover" className="btn btn-primary btn-lg">
                            Browse models
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

function Feature({ icon, title, body }) {
    return (
        <div className="card card-pad card-hover">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-accent">
                {icon}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted">{body}</p>
        </div>
    );
}

function Step({ n, title, body }) {
    return (
        <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-primary text-lg font-bold text-on-primary shadow-soft">
                {n}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted">{body}</p>
        </div>
    );
}
