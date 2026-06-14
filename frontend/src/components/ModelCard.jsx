import { Link } from "react-router-dom";
import { Gauge, Tag, Layers } from "lucide-react";

/**
 * ModelCard — a single model in the Discover grid.
 *
 * The whole card is a Link to /model/:id. On hover it "floats": lifts up and
 * deepens its shadow (.card-hover). Colors come from the design tokens.
 */
export default function ModelCard({ model }) {
    const { id, name, description, task_type, industry, accuracy, is_free } = model;

    return (
        <Link
            to={`/model/${id}`}
            className="card card-pad card-hover group flex flex-col"
        >
            {/* Heading + Free badge */}
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-ink transition group-hover:text-accent">
                    {name}
                </h3>
                {is_free && <span className="badge badge-success shrink-0">Free</span>}
            </div>

            {/* Description — clamped to ~2 lines */}
            <p className="mt-2 line-clamp-2 text-sm text-muted">{description}</p>

            {/* Tags */}
            <div className="mt-4 flex flex-wrap gap-2">
                {industry && (
                    <span className="badge badge-brand">
                        <Tag className="h-3 w-3" />
                        {industry}
                    </span>
                )}
                {task_type && (
                    <span className="badge badge-info">
                        <Layers className="h-3 w-3" />
                        {task_type}
                    </span>
                )}
            </div>

            {/* Footer — accuracy */}
            <div className="mt-4 flex items-center gap-1.5 border-t border-line pt-4 text-sm text-muted">
                <Gauge className="h-4 w-4 text-faint" />
                <span>
                    Accuracy:{" "}
                    <span className="font-medium text-ink">
                        {accuracy != null ? accuracy : "—"}
                    </span>
                </span>
            </div>
        </Link>
    );
}
