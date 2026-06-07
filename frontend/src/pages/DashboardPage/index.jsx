import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/MainContext";

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg text-center space-y-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mx-auto">
                    <span className="text-2xl font-bold text-blue-600">
                        {user?.name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-500">You&apos;re signed in</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3 text-left space-y-2">
                    <Row label="Name"  value={user?.name} />
                    <Row label="Email" value={user?.email} />
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-900">{value ?? "—"}</span>
        </div>
    );
}
