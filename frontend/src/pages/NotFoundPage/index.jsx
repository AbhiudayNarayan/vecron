import { Link } from "react-router-dom";

export default function NotFoundPage() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-4 py-20 text-center">
            <p className="text-6xl font-extrabold text-accent">404</p>
            <h1 className="mt-4 text-2xl font-bold text-ink">Page not found</h1>
            <p className="mt-2 text-sm text-muted">
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <Link to="/" className="btn btn-primary mt-8">
                Back to home
            </Link>
        </div>
    );
}
