import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Boxes, Camera, FileText, ScanSearch, Search, Volume2 } from "lucide-react";
import HeroVisual from "../../components/HeroVisual";

const examples = ["Detect fire", "Read a bill", "Count products", "Read a barcode"];

export default function HomePage() {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");

    const submitSearch = (event) => {
        event.preventDefault();
        const term = query.trim();
        navigate(term ? `/catalog?q=${encodeURIComponent(term)}` : "/catalog");
    };

    return (
        <div className="bg-canvas text-ink">
            <section className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(60rem 40rem at 80% -10%, var(--brand-100), transparent 60%), radial-gradient(50rem 40rem at 0% 10%, var(--brand-50), transparent 55%)" }} />
                <div className="container-page grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
                    <div>
                        <span className="badge badge-brand"><Boxes className="h-3.5 w-3.5" /> AI capabilities, ready when you are</span>
                        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
                            Lightweight AI for <span className="text-accent">real-world tasks.</span>
                        </h1>
                        <p className="mt-5 max-w-xl text-lg text-muted">
                            Find the right AI capability, run lightweight models efficiently, and turn images, documents, and other data into useful insights and actions.
                        </p>

                        <form className="mt-8 max-w-xl" onSubmit={submitSearch}>
                            <label className="sr-only" htmlFor="capability-search">What do you want to do?</label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" />
                                <input id="capability-search" className="input py-3.5 pl-12 pr-28 shadow-soft" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What do you want to do?" />
                                <button type="submit" className="btn btn-primary btn-sm absolute right-2 top-1/2 -translate-y-1/2">Search</button>
                            </div>
                        </form>
                        <div className="mt-3 flex flex-wrap gap-2" aria-label="Search examples">
                            {examples.map((example) => (
                                <button key={example} type="button" onClick={() => { setQuery(example); navigate(`/catalog?q=${encodeURIComponent(example)}`); }} className="badge border border-line bg-surface transition hover:border-brand-300 hover:text-accent">
                                    {example}
                                </button>
                            ))}
                        </div>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link to="/catalog" className="btn btn-primary btn-lg">Explore AI Catalog <ArrowRight className="h-4 w-4" /></Link>
                            <a href="#capabilities" className="btn btn-secondary btn-lg">See how it works</a>
                        </div>
                    </div>
                    <div className="mt-4 md:mt-0"><HeroVisual /></div>
                </div>
            </section>

            <section id="capabilities" className="container-page scroll-mt-20 py-16 md:py-20">
                <div className="max-w-xl">
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">Capabilities</p>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight">Explore AI capabilities</h2>
                    <p className="mt-3 text-muted">Start with computer vision today, with more ways to turn everyday data into action on the way.</p>
                </div>
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
                    <Capability icon={Camera} title="Computer Vision" body="Detection, classification, segmentation, OCR" to="/catalog?category=computer-vision" />
                    <Capability icon={FileText} title="Documents" body="OCR, extraction, invoices, receipts" />
                    <Capability icon={Volume2} title="Audio" body="Speech-to-text, sound classification" />
                    <Capability icon={ScanSearch} title="Text" body="Classification, extraction, summarization" />
                    <Capability icon={Boxes} title="Data" body="Anomaly detection, forecasting" />
                </div>
            </section>
        </div>
    );
}

function Capability({ icon: Icon, title, body, to }) {
    const content = <><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-accent"><Icon className="h-5 w-5" /></span><h3 className="mt-5 font-bold">{title}</h3><p className="mt-2 text-sm text-muted">{body}</p>{!to && <span className="badge badge-warning mt-4">Coming soon</span>}</>;
    return to ? <Link to={to} className="card card-pad card-hover block">{content}</Link> : <div className="card card-pad opacity-85">{content}</div>;
}
