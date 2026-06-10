/**
 * yoloWorker — runs the heavy part of the pipeline (runInference → postprocess)
 * off the main thread so a slow forward pass can never stall the RAF paint loop
 * that drives smooth video playback.
 *
 * The main thread does preprocess() (it needs the DOM canvas to read pixels),
 * then transfers the resulting tensor here. We own the InferenceSession in this
 * worker context — sessions aren't transferable, so the model is loaded here
 * once via an { type: "init" } message and reused for every detect request.
 *
 * Message protocol (main -> worker):
 *   { type: "init",   url }                      load the model
 *   { type: "detect", id, tensor, config }       run one frame
 * Replies (worker -> main):
 *   { type: "ready" } | { type: "error", error }
 *   { type: "result", id, detections } | { type: "detect-error", id, error }
 */
import * as ort from "onnxruntime-web";
import { runInference, postprocess } from "./yoloEngine";

// onnxruntime-web's .wasm artifacts aren't bundled into the worker, so point ort
// at the CDN (matching the installed version) and keep it single-threaded to
// avoid the COOP/COEP cross-origin-isolation headers multi-threaded wasm needs.
ort.env.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/";
ort.env.wasm.numThreads = 1;

let sessionPromise = null;

function loadSession(url) {
    if (!sessionPromise) {
        // GPU (webgl) with wasm as automatic fallback if webgl can't init here.
        sessionPromise = ort.InferenceSession.create(url, {
            executionProviders: ["webgl", "wasm"],
            graphOptimizationLevel: "all",
        });
        sessionPromise.catch(() => {
            sessionPromise = null; // allow a later init to retry
        });
    }
    return sessionPromise;
}

self.onmessage = async (e) => {
    const msg = e.data;

    if (msg.type === "init") {
        try {
            await loadSession(msg.url);
            self.postMessage({ type: "ready" });
        } catch (err) {
            self.postMessage({ type: "error", error: String(err) });
        }
        return;
    }

    if (msg.type === "detect") {
        const { id, tensor, config } = msg;
        try {
            if (!sessionPromise) throw new Error("model not initialised");
            const session = await sessionPromise;
            const output = await runInference(session, tensor, config.inputSize);
            const detections = postprocess(output, config);
            self.postMessage({ type: "result", id, detections });
        } catch (err) {
            self.postMessage({ type: "detect-error", id, error: String(err) });
        }
    }
};
