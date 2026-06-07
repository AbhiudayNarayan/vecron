import { createContext, useContext, useEffect, useState } from "react";
import { axiosClient } from "../utils/axiosClient";

export const MainContext = createContext(null);

export function MainProvider({ children }) {
    const [user, setUser]           = useState(null);
    const [token, setToken]         = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading]     = useState(true);

    // Boot-time check: validate any stored token against /me
    useEffect(() => {
        const stored = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!stored) {
            setLoading(false);
            return;
        }
        setToken(stored);
        axiosClient
            .get("/auth/me")
            .then((res) => {
                setUser(res.data);
                setIsLoggedIn(true);
            })
            .catch(() => {
                localStorage.removeItem("token");
                sessionStorage.removeItem("token");
            })
            .finally(() => setLoading(false));
    }, []);

    const login = (newToken, rememberMe) => {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem("token", newToken);
        setToken(newToken);
        setIsLoggedIn(true);
        axiosClient
            .get("/auth/me")
            .then((res) => setUser(res.data))
            .catch(() => logout());
    };

    const logout = () => {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        setUser(null);
        setToken(null);
        setIsLoggedIn(false);
    };

    return (
        <MainContext.Provider value={{ user, token, isLoggedIn, loading, login, logout }}>
            {children}
        </MainContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(MainContext);
    if (!ctx) throw new Error("useAuth must be used within <MainProvider>");
    return ctx;
}
