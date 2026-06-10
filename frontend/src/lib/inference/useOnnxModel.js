import { useCallback, useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";
import { preprocess } from "./yoloEngine";

/**
 * useOnnxModel — lazily load + cache an ONNX InferenceSession for a given URL,
 * AND spin up a Web Worker that runs inference off the main thread.
 *
 * UI-agnostic: hand it any `onnx_url` from the model catalog and it returns
 * { session, loading, error, ready, runDetection }. Sessions are cached by URL
 * across the whole app, so re-mounting the runner won't re-fetch or re-compile.
 *
 * Two execution paths:
 *  - `session` runs inference on the MAIN thread (used by the Image tab, which
 *    only infers once per upload — blocking briefly there is fine).
 *  - `runDetection()` posts work to a Web Worker (used by the Video tab's RAF
 *    loop) so a slow forward pass never stalls frame painting. The worker owns
 *    its own session because InferenceSessions aren't transferable.
 *
 * Backend choice: webgl (GPU) with wasm as fallback — the highest-impact win for
 * inference latency. We point ort at a CDN for its .wasm artifacts so Vite
 * doesn't need to bundle/serve them, and pin a single thread to avoid the
 * cross-origin-isolation (COOP/COEP) headers multi-threaded wasm would require.
 */

// Match the installed onnxruntime-web version so the CDN files line up.
ort.env.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/";
ort.env.wasm.numThreads = 1;

// url -> Promise<InferenceSession>. Sharing the in-flight promise dedupes
// concurrent loads of the same model too.
const sessionCache = new Map();

function loadSession(url) {
    if (!sessionCache.has(url)) {
        const promise = ort.InferenceSession.create(url, {
            executionProviders: ["webgl", "wasm"],
            graphOptimizationLevel: "all",
        });
        // Drop the cache entry if the load fails so a later mount can retry.
        promise.catch(() => sessionCache.delete(url));
        sessionCache.set(url, promise);
    }
    return sessionCache.get(url);
}

export function useOnnxModel(onnxUrl) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Worker readiness — separate from the main-thread `session` above.
    const [ready, setReady] = useState(false);

    const workerRef = useRef(null);
    const readyRef = useRef(false);
    const pendingRef = useRef(new Map()); // request id -> { resolve, reject }
    const reqIdRef = useRef(0);

    // Main-thread session (Image tab).
    useEffect(() => {
        if (!onnxUrl) {
            setSession(null);
            setLoading(false);
            setError(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        setSession(null);

        loadSession(onnxUrl)
            .then((s) => {
                if (cancelled) return;
                setSession(s);
                setLoading(false);
            })
            .catch((e) => {
                if (cancelled) return;
                setError(e);
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [onnxUrl]);

    // Inference Web Worker (Video tab). Vite resolves the worker via the
    // new Worker(new URL(...), import.meta.url) form; `type: "module"` lets the
    // worker use ESM imports (onnxruntime-web + yoloEngine).
    useEffect(() => {
        if (!onnxUrl) return;

        const worker = new Worker(
            new URL("./yoloWorker.js", import.meta.url),
            { type: "module" }
        );
        workerRef.current = worker;
        const pending = pendingRef.current;
        setReady(false);
        readyRef.current = false;

        worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === "ready") {
                readyRef.current = true;
                setReady(true);
            } else if (msg.type === "error") {
                console.error("Model worker init failed:", msg.error);
            } else if (msg.type === "result") {
                const p = pending.get(msg.id);
                if (p) {
                    pending.delete(msg.id);
                    p.resolve(msg.detections);
                }
            } else if (msg.type === "detect-error") {
                const p = pending.get(msg.id);
                if (p) {
                    pending.delete(msg.id);
                    p.reject(new Error(msg.error));
                }
            }
        };

        worker.postMessage({ type: "init", url: onnxUrl });

        return () => {
            worker.terminate();
            workerRef.current = null;
            readyRef.current = false;
            pending.forEach(({ reject }) => reject(new Error("worker terminated")));
            pending.clear();
        };
    }, [onnxUrl]);

    // Run one detection on the worker. preprocess() happens here on the main
    // thread (it needs a DOM canvas); only the tensor crosses to the worker,
    // transferred (not copied) for speed. Returns a Promise<detections>.
    const runDetection = useCallback((source, config) => {
        const worker = workerRef.current;
        if (!worker || !readyRef.current) {
            return Promise.reject(new Error("model not ready"));
        }
        let tensor;
        try {
            tensor = preprocess(source, config.inputSize);
        } catch (e) {
            return Promise.reject(e);
        }
        const id = ++reqIdRef.current;
        return new Promise((resolve, reject) => {
            pendingRef.current.set(id, { resolve, reject });
            worker.postMessage({ type: "detect", id, tensor, config }, [tensor.buffer]);
        });
    }, []);

    return { session, loading, error, ready, runDetection };
}
