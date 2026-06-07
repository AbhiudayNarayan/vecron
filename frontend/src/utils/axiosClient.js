import axios from "axios";

export const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_APP_BACKEND_URI,
});

axiosClient.interceptors.request.use((config) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});