import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronDown, Cloud, Download, Gauge, Laptop, Layers, Lock, Tag } from "lucide-react";
import { axiosClient } from "../../utils/axiosClient";
import { useAuth } from "../../context/MainContext";

export default function ModelDetailPage() {
    const { id } = useParams();
    const [model, setModel] = useState(null);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let cancelled = false;
        axiosClient.get(`/models/${id}`)
            .then((response) => { if (!cancelled) { setModel(response.data); setStatus("success"); } })
            .catch((error) => { if (!cancelled) setStatus(error?.response?.status === 404 ? "notfound" : "error"); });
        return () => { cancelled = true; };
    }, [id]);

    return <main className="flex-1 bg-canvas text-ink"><div className="mx-auto max-w-4xl px-5 py-12 md:py-16">
        <Link to="/catalog" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-accent"><ArrowLeft className="h-4 w-4" /> Back to AI Catalog</Link>
        <div className="mt-8">{status === "loading" && <LoadingState />}{status === "error" && <SimpleState title="We couldn’t load this capability" body="Check your connection and try again." />}{status === "notfound" && <SimpleState title="We couldn’t find this capability" body="It may have been moved or removed." />}{status === "success" && model && <ModelDetail model={model} />}</div>
    </div></main>;
}

function ModelDetail({ model }) {
    const { isLoggedIn } = useAuth();
    const [mode, setMode] = useState("local");
    const runtime = model.runtime || (model.onnx_url?.toLowerCase().endsWith(".onnx") ? "ONNX" : null);

    return <div>
        <section className="card card-pad sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">Computer Vision</p><h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{plainName(model.name)}</h1></div>
                {model.is_free && <span className="badge badge-success px-3 py-1 text-sm">Free local use</span>}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
                {model.task_type && <span className="badge badge-info"><Layers className="h-3.5 w-3.5" /> {humanizeTask(model.task_type)}</span>}
                {model.industry && <span className="badge badge-brand"><Tag className="h-3.5 w-3.5" /> {titleCase(model.industry)}</span>}
            </div>
        </section>

        <Section title="Overview"><p className="text-muted">{model.description}</p>{model.labels?.length > 0 && <div className="mt-5"><p className="text-sm font-semibold">What it can identify</p><div className="mt-2 flex flex-wrap gap-2">{model.labels.map((label) => <span key={label} className="badge badge-info">{label}</span>)}</div></div>}</Section>

        <Section title="Try this model" description="Run this capability on an image, video, or camera feed.">
            <div className="flex flex-col gap-4 rounded-xl border border-brand-200 bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Try it on your device</p><p className="mt-1 text-sm text-muted">Your selected file stays in your browser while it is processed.</p></div><Link to={`/model/${model.id}/run`} className="btn btn-primary shrink-0">Open local runner <ArrowRight className="h-4 w-4" /></Link></div>
        </Section>

        <Section title="Choose where to run it">
            <div className="rounded-xl border border-line bg-surface p-2"><div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Execution mode"><ModeButton active={mode === "local"} onClick={() => setMode("local")} icon={Laptop} label="Local" sublabel="Free on your device" /><ModeButton active={mode === "cloud"} onClick={() => setMode("cloud")} icon={Cloud} label="Cloud" sublabel="Premium" /></div><div className="px-3 pb-3 pt-5">{mode === "local" ? <div><h3 className="font-semibold">Run free on your device</h3><p className="mt-1 text-sm text-muted">The local runner works in your browser and is available without an account.</p><Link to={`/model/${model.id}/run`} className="btn btn-secondary mt-4">Use local runner</Link></div> : <CloudState isLoggedIn={isLoggedIn} cloudEligible={model.cloud_eligible} />}</div></div>
        </Section>

        <Section title="Technical details"><details className="group rounded-xl border border-line bg-surface"><summary className="flex cursor-pointer list-none items-center justify-between p-5 font-semibold">Show technical details <ChevronDown className="h-5 w-5 transition group-open:rotate-180" /></summary><dl className="grid border-t border-line text-sm sm:grid-cols-2">{runtime && <Detail label="Runtime" value={runtime} />}{model.model_size_mb != null && <Detail label="Model size" value={`${model.model_size_mb} MB`} />}{model.optimization && <Detail label="Optimization" value={model.optimization} />}{model.input_size && <Detail label="Input format" value={`${model.input_size} × ${model.input_size} RGB image`} />}{model.labels?.length > 0 && <Detail label="Output" value={`${model.labels.length} detection categories`} />}{model.supported_devices?.length > 0 && <Detail label="Supported devices" value={model.supported_devices.map(titleCase).join(", ")} />}</dl>{model.onnx_url && <a href={model.onnx_url} className="m-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-strong"><Download className="h-4 w-4" /> Download model file</a>}</details></Section>

        {(model.accuracy != null || model.latency_ms != null) && <Section title="Performance"><div className="card card-pad flex items-center gap-3"><Gauge className="h-6 w-6 text-accent" /><div>{model.accuracy != null && <p className="font-semibold">{formatAccuracy(model.accuracy)} accuracy</p>}{model.latency_ms != null && <p className="font-semibold">~{model.latency_ms} ms latency</p>}<p className="text-sm text-muted">Reported by the model provider.</p></div></div></Section>}
        {model.license && <Section title="License"><p className="text-muted">{model.license}</p></Section>}
        <button type="button" disabled title="Workflows coming soon" className="btn btn-secondary w-full"><Lock className="h-4 w-4" /> Use in workflow — coming soon</button>
    </div>;
}

function CloudState({ isLoggedIn, cloudEligible }) { if (!cloudEligible) return <div><h3 className="font-semibold">This model is available locally only</h3><p className="mt-1 text-sm text-muted">Cloud execution is unavailable for this model. You can still run it free on your device.</p></div>; return isLoggedIn ? <div><h3 className="font-semibold">Cloud execution is not configured yet</h3><p className="mt-1 text-sm text-muted">This model can run locally today. Cloud execution needs a connected premium service before it can be offered here.</p></div> : <div><h3 className="font-semibold">Sign in to use cloud inference</h3><p className="mt-1 text-sm text-muted">Local use remains free and available without an account.</p><Link to="/login" className="btn btn-primary mt-4">Sign in</Link></div>; }
function ModeButton({ active, onClick, icon: Icon, label, sublabel }) { return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`rounded-lg p-3 text-left transition ${active ? "bg-primary-soft text-ink" : "text-muted hover:bg-surface-2"}`}><span className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-accent" />{label}</span><span className="mt-1 block text-xs">{sublabel}</span></button>; }
function Section({ title, description, children }) { return <section className="mt-8"><h2 className="text-xl font-bold">{title}</h2>{description && <p className="mt-1 text-sm text-muted">{description}</p>}<div className="mt-4">{children}</div></section>; }
function Detail({ label, value }) { return <div className="border-b border-line p-4 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0 sm:[&:nth-child(odd)]:border-r"><dt className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }
function LoadingState() { return <div className="card card-pad animate-pulse sm:p-8"><div className="h-8 w-2/3 rounded bg-surface-2" /><div className="mt-4 h-5 w-full rounded bg-surface-2" /><div className="mt-8 h-40 w-full rounded-xl bg-surface-2" /></div>; }
function SimpleState({ title, body }) { return <div className="card card-pad text-center"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm text-muted">{body}</p><Link to="/catalog" className="btn btn-primary mt-6">Back to AI Catalog</Link></div>; }
function plainName(name = "") { return name.replace(/\bDetection\b/i, "Detector"); }
function humanizeTask(task) { return task.toLowerCase() === "detection" ? "Object Detection" : titleCase(task); }
function titleCase(value) { return value.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatAccuracy(value) { const percentage = Number(value) * 100; return `${percentage.toFixed(percentage % 1 ? 1 : 0)}%`; }
