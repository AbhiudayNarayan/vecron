import { Link } from "react-router-dom";

export default function NotFoundPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
            <p className="text-6xl font-extrabold text-indigo-600">404</p>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
            <p className="mt-2 text-sm text-gray-500">
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <Link
                to="/"
                className="mt-8 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                Back to home
            </Link>
        </div>
    );
}
