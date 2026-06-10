import { useSyncExternalStore } from "react";

/**
 * videoResultsStore — in-memory list of processed-video results for the current
 * browser session. Each result is the OUTPUT of one process-once pass (an
 * annotated video + a detection summary), never the model itself.
 *
 * Why a module-level store (not React state): the runner unmounts the Video tab
 * when you switch tabs, so results held in component state would vanish. Living
 * here, they survive tab switches and only clear on a full page refresh — which
 * is exactly the requested behaviour.
 *
 * Swappable later: this is deliberately a tiny CRUD surface (getAll / add /
 * remove / clear + subscribe). To persist results for logged-in users, replace
 * the in-memory array with backend calls behind these same methods and the UI
 * won't need to change. Nothing here is model-specific.
 *
 * A result object looks like:
 *   {
 *     id, modelId, label, createdAt,
 *     approach: "baked" | "stored",
 *     url,                  // baked: annotated webm blob URL; stored: original video URL
 *     summary: { parts: [{ classId, label, count }], total },
 *     width, height,        // natural video resolution
 *     // stored-fallback only:
 *     frames,               // [{ t, detections }] for re-draw on replay (NO re-inference)
 *     labels,               // model labels, so replay can draw boxes
 *     downloadName,         // suggested filename for the Download button
 *   }
 */

let results = []; // newest first
const listeners = new Set();

function emit() {
    for (const listener of listeners) listener();
}

export const videoResultsStore = {
    getAll() {
        return results;
    },

    add(result) {
        results = [result, ...results];
        emit();
    },

    remove(id) {
        const target = results.find((r) => r.id === id);
        // Free the object URL this result owns (annotated blob or original video)
        // so removing a card doesn't leak memory.
        if (target?.url) URL.revokeObjectURL(target.url);
        results = results.filter((r) => r.id !== id);
        emit();
    },

    clear() {
        for (const r of results) {
            if (r.url) URL.revokeObjectURL(r.url);
        }
        results = [];
        emit();
    },

    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

/**
 * useVideoResults — subscribe a component to the results list. Re-renders on any
 * add/remove/clear. Returns the current array (newest first).
 */
export function useVideoResults() {
    return useSyncExternalStore(videoResultsStore.subscribe, videoResultsStore.getAll);
}
