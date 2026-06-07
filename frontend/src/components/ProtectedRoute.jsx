import { Navigate } from "react-router-dom";
import { useAuth } from "../context/MainContext";

export default function ProtectedRoute({ children }) {
    const { isLoggedIn, loading } = useAuth();
    if (loading) return null;
    if (!isLoggedIn) return <Navigate to="/login" replace />;
    return children;
}
