import { useEffect, useRef } from "react";

/**
 * DetectionCanvas — draws a source image to a <canvas> and overlays the
 * bounding boxes returned by the engine's postprocess().
 *
 * Model-agnostic: colors are generated from the labels array (not hardcoded),
 * so a 2-class model and a 10-class model each get a distinct, stable palette.
 * Detections are expected in ORIGINAL image pixel coordinates — the canvas is
 * sized to the image's natural resolution and scaled down with CSS, so boxes
 * line up exactly regardless of display size.
 */

/**
 * Distinct color per class index, evenly spread around the hue wheel using the
 * golden-angle so adjacent class ids stay far apart visually.
 */
export function colorForClass(classId, total) {
    const hue = (classId * (360 / Math.max(total, 1)) + classId * 137.508) % 360;
    return `hsl(${Math.round(hue)}, 85%, 50%)`;
}

/**
 * Draw bounding boxes + labels onto an already-prepared 2d context. Pure drawing
 * — the caller is responsible for sizing the canvas and painting the underlying
 * frame first. Shared by the static image path (DetectionCanvas below) and the
 * per-frame video loop, so both render boxes identically.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x1,y1,x2,y2,score,classId}>} detections  ORIGINAL-pixel coords
 * @param {string[]} labels
 * @param {number} width  natural pixel width of the frame (scales stroke/font)
 */
export function drawDetections(ctx, detections, labels = [], width) {
    // Scale stroke/font with frame size so overlays read on big and small frames alike.
    const lineWidth = Math.max(2, Math.round(width / 320));
    const fontSize = Math.max(12, Math.round(width / 40));
    ctx.lineWidth = lineWidth;
    ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "top";

    for (const det of detections) {
        const { x1, y1, x2, y2, score, classId } = det;
        const color = colorForClass(classId, labels.length);
        const name = labels[classId] ?? `class ${classId}`;
        const text = `${name} ${(score * 100).toFixed(0)}%`;

        // Box.
        ctx.strokeStyle = color;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Label chip (clamped so it never disappears above the top edge).
        const padding = fontSize * 0.3;
        const textWidth = ctx.measureText(text).width;
        const chipH = fontSize + padding * 2;
        const chipY = Math.max(0, y1 - chipH);

        ctx.fillStyle = color;
        ctx.fillRect(x1, chipY, textWidth + padding * 2, chipH);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, x1 + padding, chipY + padding);
    }
}

export default function DetectionCanvas({ image, detections = [], labels = [] }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;

        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        drawDetections(ctx, detections, labels, width);
    }, [image, detections, labels]);

    return (
        <canvas
            ref={canvasRef}
            className="h-auto w-full rounded-lg border border-gray-200 bg-gray-100"
        />
    );
}
