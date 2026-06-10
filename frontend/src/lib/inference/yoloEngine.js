import * as ort from "onnxruntime-web";

/**
 * yoloEngine — pure, UI-agnostic helpers for running ANY YOLO-style detection
 * model in the browser. Nothing here is specific to a particular model: the
 * number of classes, input size and thresholds all come in as arguments, so the
 * exact same functions drive a 2-class fire/smoke model and a 80-class COCO one.
 *
 * No React, no DOM-state — just data in, data out. This is the reusable core
 * that image (stage 1), video (stage 2) and live camera (stage 3) all share.
 */

/**
 * Resize a source image/canvas into the square tensor a YOLO model expects.
 *
 * Returns a Float32Array in NCHW layout (1×3×size×size, channel-planar RGB,
 * normalised to 0..1). We do a plain stretch-resize to size×size — postprocess
 * scales detections back using the original width/height, so the two stay
 * consistent without letterbox padding bookkeeping.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} source
 * @param {number} inputSize  e.g. 640
 * @returns {Float32Array} length 3 * inputSize * inputSize
 */
export function preprocess(source, inputSize) {
    const canvas = document.createElement("canvas");
    canvas.width = inputSize;
    canvas.height = inputSize;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, inputSize, inputSize);

    const { data } = ctx.getImageData(0, 0, inputSize, inputSize); // RGBA, 0..255
    const pixels = inputSize * inputSize;
    const tensor = new Float32Array(pixels * 3);

    // RGBA interleaved -> RGB channel-planar (NCHW), normalised /255.
    const rOffset = 0;
    const gOffset = pixels;
    const bOffset = pixels * 2;
    for (let i = 0; i < pixels; i++) {
        const j = i * 4;
        tensor[rOffset + i] = data[j] / 255;
        tensor[gOffset + i] = data[j + 1] / 255;
        tensor[bOffset + i] = data[j + 2] / 255;
    }
    return tensor;
}

/**
 * Run a single forward pass. Uses the session's declared input/output names so
 * it works regardless of how the model was exported.
 *
 * @param {ort.InferenceSession} session
 * @param {Float32Array} tensor  output of preprocess()
 * @param {number} inputSize
 * @returns {Promise<ort.Tensor>} the raw output tensor (data + dims)
 */
export async function runInference(session, tensor, inputSize) {
    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];

    const input = new ort.Tensor("float32", tensor, [1, 3, inputSize, inputSize]);
    const results = await session.run({ [inputName]: input });
    return results[outputName];
}

/**
 * Decode a transposed YOLO detection head into clean boxes in ORIGINAL image
 * coordinates, with non-max suppression applied.
 *
 * Expected output layout: (1, 4 + numClasses, numBoxes) — e.g. (1, 6, 8400) for
 * a 2-class model. That's the transposed form: for each of the numBoxes
 * candidates there are 4 box coords (cx, cy, w, h, in input-pixel space)
 * followed by one score per class. We transpose on the fly via index math and
 * take the argmax over the class scores.
 *
 * @param {ort.Tensor} output
 * @param {object} opts
 * @param {number} opts.numClasses     usually labels.length — NOT hardcoded
 * @param {number} opts.inputSize       the size the model was fed (e.g. 640)
 * @param {number} [opts.confThreshold=0.4]
 * @param {number} [opts.iouThreshold=0.45]
 * @param {number} opts.originalWidth   natural width of the source image
 * @param {number} opts.originalHeight  natural height of the source image
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number,score:number,classId:number}>}
 */
export function postprocess(output, {
    numClasses,
    inputSize,
    confThreshold = 0.4,
    iouThreshold = 0.45,
    originalWidth,
    originalHeight,
}) {
    const data = output.data;
    // dims: [1, channels, numBoxes] where channels === 4 + numClasses.
    const channels = output.dims[1];
    const numBoxes = output.dims[2];

    // Scale factors from the square model space back to the original image.
    const scaleX = originalWidth / inputSize;
    const scaleY = originalHeight / inputSize;

    const candidates = [];

    for (let i = 0; i < numBoxes; i++) {
        // Transposed access: value for channel c of box i lives at c*numBoxes + i.
        // Find the best class for this candidate.
        let bestClass = 0;
        let bestScore = 0;
        for (let c = 0; c < numClasses; c++) {
            const score = data[(4 + c) * numBoxes + i];
            if (score > bestScore) {
                bestScore = score;
                bestClass = c;
            }
        }
        if (bestScore < confThreshold) continue;

        const cx = data[0 * numBoxes + i];
        const cy = data[1 * numBoxes + i];
        const w = data[2 * numBoxes + i];
        const h = data[3 * numBoxes + i];

        // Center/size (input space) -> corners, then scale to original pixels.
        let x1 = (cx - w / 2) * scaleX;
        let y1 = (cy - h / 2) * scaleY;
        let x2 = (cx + w / 2) * scaleX;
        let y2 = (cy + h / 2) * scaleY;

        // Clamp to image bounds.
        x1 = Math.max(0, Math.min(originalWidth, x1));
        y1 = Math.max(0, Math.min(originalHeight, y1));
        x2 = Math.max(0, Math.min(originalWidth, x2));
        y2 = Math.max(0, Math.min(originalHeight, y2));

        candidates.push({ x1, y1, x2, y2, score: bestScore, classId: bestClass });
    }

    return nms(candidates, iouThreshold);
}

/**
 * Per-class non-max suppression. Boxes of different classes never suppress each
 * other; within a class the highest-scoring box wins and overlapping (IoU >
 * threshold) lower-scoring boxes are dropped.
 */
function nms(boxes, iouThreshold) {
    const sorted = [...boxes].sort((a, b) => b.score - a.score);
    const keep = [];

    while (sorted.length) {
        const best = sorted.shift();
        keep.push(best);
        for (let i = sorted.length - 1; i >= 0; i--) {
            if (sorted[i].classId !== best.classId) continue;
            if (iou(best, sorted[i]) > iouThreshold) {
                sorted.splice(i, 1);
            }
        }
    }
    return keep;
}

/** Intersection-over-union of two corner boxes. */
function iou(a, b) {
    const interX1 = Math.max(a.x1, b.x1);
    const interY1 = Math.max(a.y1, b.y1);
    const interX2 = Math.min(a.x2, b.x2);
    const interY2 = Math.min(a.y2, b.y2);

    const interW = Math.max(0, interX2 - interX1);
    const interH = Math.max(0, interY2 - interY1);
    const interArea = interW * interH;

    const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
    const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
    const union = areaA + areaB - interArea;

    return union <= 0 ? 0 : interArea / union;
}
