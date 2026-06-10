import { Link } from "react-router-dom";
import { Gauge, Tag, Layers } from "lucide-react";

/**
 * ModelCard — a single model in the Discover grid.
 *
 * The whole card is a Link to /model/:id. On hover it "floats": lifts up,
 * scales slightly, and deepens its shadow (transition-all duration-300).
 */
export default function ModelCard({ model }) {
    const { id, name, description, task_type, industry, accuracy, is_free } = model;

    return (
        <Link
            to={`/model/${id}`}
            className="group flex flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-md transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
            {/* Heading + Free badge */}
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-900 transition group-hover:text-blue-600">
                    {name}
                </h3>
                {is_free && (
                    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        Free
                    </span>
                )}
            </div>

            {/* Description — clamped to ~2 lines */}
            <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                {description}
            </p>

            {/* Tags */}
            <div className="mt-4 flex flex-wrap gap-2">
                {industry && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
                        <Tag className="h-3 w-3" />
                        {industry}
                    </span>
                )}
                {task_type && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                        <Layers className="h-3 w-3" />
                        {task_type}
                    </span>
                )}
            </div>

            {/* Footer — accuracy */}
            <div className="mt-4 flex items-center gap-1.5 border-t border-gray-100 pt-4 text-sm text-gray-500">
                <Gauge className="h-4 w-4 text-gray-400" />
                <span>
                    Accuracy:{" "}
                    <span className="font-medium text-gray-700">
                        {accuracy != null ? accuracy : "—"}
                    </span>
                </span>
            </div>
        </Link>
    );
}
