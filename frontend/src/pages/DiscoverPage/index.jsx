import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, Search, X } from "lucide-react";
import ModelCard from "../../components/ModelCard";
import { searchCapabilities } from "../../lib/searchCapabilities";

const tasks = ["Object Detection", "Image Classification", "Segmentation", "OCR", "Pose Estimation", "Image Processing", "Other"];
const domains = ["Safety", "Transportation", "Waste Management", "Agriculture", "Infrastructure", "Retail"];

export default function DiscoverPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category") || "";
    const [models, setModels] = useState([]);
    const [status, setStatus] = useState("loading");
    const [term, setTerm] = useState(q);
    const [filters, setFilters] = useState({ task: "", domain: "", runtime: "", device: "", optimization: "" });

    const apiFilters = useMemo(() => ({
        task: filters.task === "Object Detection" ? "detection" : "",
        domain: filters.domain.toLowerCase(),
        runtime: filters.runtime,
        device: filters.device.toLowerCase(),
        optimization: filters.optimization,
    }), [filters]);

    useEffect(() => {
        let cancelled = false;
        searchCapabilities(q, apiFilters)
            .then((data) => { if (!cancelled) { setModels(data); setStatus("success"); } })
            .catch(() => { if (!cancelled) setStatus("error"); });
        return () => { cancelled = true; };
    }, [q, apiFilters]);

    const filteredModels = useMemo(() => models.filter((model) => {
        const isDetection = model.task_type?.toLowerCase() === "detection";
        if (category === "computer-vision" && !isDetection) return false;
        return true;
    }), [models, category]);

    const availableTasks = new Set(models.map((model) => model.task_type?.toLowerCase()));
    const availableRuntimes = new Set(models.map((model) => model.runtime));
    const availableDevices = new Set(models.flatMap((model) => model.supported_devices || []).map((value) => value.toLowerCase()));
    const availableOptimizations = new Set(models.map((model) => model.optimization));

    const submitSearch = (event) => {
        event.preventDefault();
        const next = term.trim();
        setSearchParams(next ? { q: next } : category ? { category } : {});
    };
    const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: current[key] === value ? "" : value }));
    const clearFilters = () => setFilters({ task: "", domain: "", runtime: "", device: "", optimization: "" });
    const hasFilters = Object.values(filters).some(Boolean);

    return (
        <main className="flex-1 bg-canvas text-ink">
            <div className="container-page py-12 md:py-16">
                <div className="max-w-2xl">
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">Computer Vision</p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">AI Catalog</h1>
                    <p className="mt-3 text-muted">Explore lightweight AI capabilities and the models that power them.</p>
                </div>

                <form onSubmit={submitSearch} className="mt-8 max-w-2xl">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" />
                        <input type="search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="What do you want to do?" className="input py-3 pl-12 pr-28 shadow-soft" />
                        <button type="submit" className="btn btn-primary btn-sm absolute right-2 top-1/2 -translate-y-1/2">Search</button>
                    </div>
                </form>

                <div className="mt-10 grid gap-8 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
                    <aside className="card h-fit card-pad" aria-label="Catalog filters">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="flex items-center gap-2 font-bold"><Filter className="h-4 w-4 text-accent" /> Filters</h2>
                            {hasFilters && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-accent hover:text-accent-strong">Clear</button>}
                        </div>
                        <FilterGroup title="Capability / Task" options={tasks} selected={filters.task} onSelect={(value) => setFilter("task", value)} enabled={(value) => value === "Object Detection" && (availableTasks.has("detection") || filters.task === value)} hint="Only verified catalog capabilities are selectable." />
                        <FilterGroup title="Domain" options={domains} selected={filters.domain} onSelect={(value) => setFilter("domain", value)} />
                        <FilterGroup title="Runtime" options={["ONNX", "Other"]} selected={filters.runtime} onSelect={(value) => setFilter("runtime", value)} enabled={(value) => availableRuntimes.has(value) || filters.runtime === value} />
                        <FilterGroup title="Device" options={["Mobile", "Edge", "CPU", "GPU"]} selected={filters.device} onSelect={(value) => setFilter("device", value)} enabled={(value) => availableDevices.has(value.toLowerCase()) || filters.device === value} hint="Only verified deployment targets are selectable." />
                        <FilterGroup title="Optimization" options={["INT8", "FP16", "FP32"]} selected={filters.optimization} onSelect={(value) => setFilter("optimization", value)} enabled={(value) => availableOptimizations.has(value) || filters.optimization === value} hint="Only verified optimization data is selectable." />
                    </aside>

                    <section aria-live="polite">
                        {status === "loading" && <LoadingState />}
                        {status === "error" && <ErrorState />}
                        {status === "success" && filteredModels.length === 0 && <EmptyState q={q} clearFilters={clearFilters} hasFilters={hasFilters} />}
                        {status === "success" && filteredModels.length > 0 && <>
                            <p className="mb-5 text-sm text-muted">{filteredModels.length} {filteredModels.length === 1 ? "capability" : "capabilities"} found</p>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">{filteredModels.map((model) => <ModelCard key={model.id} model={model} />)}</div>
                        </>}
                    </section>
                </div>
            </div>
        </main>
    );
}

function FilterGroup({ title, options, selected, onSelect, enabled = () => true, hint }) {
    return <fieldset className="mt-6 border-t border-line pt-5"><legend className="text-sm font-semibold">{title}</legend><div className="mt-3 space-y-2">{options.map((option) => {
        const available = enabled(option);
        return <label key={option} className={`flex items-center gap-2 text-sm ${available ? "cursor-pointer text-muted hover:text-ink" : "cursor-not-allowed text-faint"}`}>
            <input type="checkbox" checked={selected === option} disabled={!available} onChange={() => onSelect(option)} className="accent-[var(--c-accent)]" /> {option}
        </label>;
    })}</div>{hint && <p className="mt-2 text-xs text-faint">{hint}</p>}</fieldset>;
}

function LoadingState() { return <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="card card-pad animate-pulse"><div className="h-5 w-2/3 rounded bg-surface-2" /><div className="mt-3 h-4 w-full rounded bg-surface-2" /><div className="mt-6 h-8 w-full rounded bg-surface-2" /></div>)}</div>; }
function EmptyState({ q, clearFilters, hasFilters }) { return <div className="card card-pad text-center"><X className="mx-auto h-7 w-7 text-faint" /><h2 className="mt-3 text-lg font-semibold">{q ? `No capabilities found for “${q}”` : "No capabilities match these filters"}</h2><p className="mt-2 text-sm text-muted">Try a broader task or clear a filter to see more results.</p>{hasFilters && <button type="button" onClick={clearFilters} className="btn btn-secondary mt-5">Clear filters</button>}</div>; }
function ErrorState() { return <div className="card card-pad text-center"><h2 className="text-lg font-semibold">We couldn&apos;t load the AI catalog</h2><p className="mt-2 text-sm text-muted">Check your connection and try again.</p></div>; }
