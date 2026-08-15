import { axiosClient } from "../utils/axiosClient";

/**
 * Search the capability catalog. This boundary can later be swapped for a
 * semantic or recommendation service without changing catalog consumers.
 */
export async function searchCapabilities(query = "", filters = {}) {
    const response = await axiosClient.get("/models", {
        params: {
            ...(query.trim() ? { q: query.trim() } : {}),
            ...Object.fromEntries(
                Object.entries(filters).filter(([, value]) => Boolean(value)),
            ),
        },
    });
    return response.data;
}
