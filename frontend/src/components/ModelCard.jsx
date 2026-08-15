import { Link } from "react-router-dom";
import { ArrowRight, Gauge, Layers, Tag } from "lucide-react";

export default function ModelCard({ model }) {
    const { id, name, description, task_type, industry, accuracy, is_free, runtime, model_size_mb, latency_ms, optimization, supported_devices = [] } = model;
    const technicalSummary = [model_size_mb != null && `${model_size_mb} MB`, optimization, runtime].filter(Boolean);
    const performance = [latency_ms != null && `~${latency_ms} ms`, accuracy != null && `${formatAccuracy(accuracy)} accuracy`].filter(Boolean);

    return (
        <article className="card card-pad card-hover flex flex-col">
            <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-ink">{plainName(name)}</h2>
                {is_free && <span className="badge badge-success shrink-0">Free</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                {task_type && <span className="badge badge-info"><Layers className="h-3 w-3" /> {humanizeTask(task_type)}</span>}
                {industry && <span className="badge badge-brand"><Tag className="h-3 w-3" /> {titleCase(industry)}</span>}
            </div>
            {description && <p className="mt-4 line-clamp-3 text-sm text-muted">{description}</p>}
            {technicalSummary.length > 0 && <p className="mt-5 border-t border-line pt-4 text-sm font-medium text-muted">{technicalSummary.join(" · ")}</p>}
            {supported_devices.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{supported_devices.map((device) => <span key={device} className="badge">{titleCase(device)}</span>)}</div>}
            {performance.length > 0 && <div className="mt-4 flex items-center gap-1.5 text-sm text-muted"><Gauge className="h-4 w-4 text-faint" /> <span>{performance.join(" · ")}</span></div>}
            <Link to={`/catalog/${id}`} className="btn btn-primary mt-6 w-full">Try this model <ArrowRight className="h-4 w-4" /></Link>
        </article>
    );
}

function plainName(name = "") { return name.replace(/\bDetection\b/i, "Detector"); }
function humanizeTask(task) { return task.toLowerCase() === "detection" ? "Object Detection" : titleCase(task); }
function titleCase(value) { return value.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatAccuracy(value) { const percentage = Number(value) * 100; return `${percentage.toFixed(percentage % 1 ? 1 : 0)}%`; }
