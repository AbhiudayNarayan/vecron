"""
Convert a YOLO .pt model to ONNX format.

Supports any YOLO detection model — originally used for garbage classification
(6 classes), now also used for pothole detection.

HOW TO RUN
----------
Option A — use the yolo conda env directly:
    conda run -p D:/yolo-env1 python convert_to_onnx.py --weights "file/pot_hole_detection.pt"

Option B — activate env first, then run:
    conda activate yolo-env
    python convert_to_onnx.py --weights "file/pot_hole_detection.pt"

COMMON OVERRIDES
----------------
# Change input image size (default 640x640)
    python convert_to_onnx.py --weights "file/pot_hole_detection.pt" --imgsz 416

# Use a different ONNX opset (default 12; use 11 for max compatibility)
    python convert_to_onnx.py --weights "file/pot_hole_detection.pt" --opset 11

# Export with dynamic batch size (needed for serving multiple images at once)
    python convert_to_onnx.py --weights "file/pot_hole_detection.pt" --dynamic

# Export in FP16 for faster GPU inference (GPU must support fp16)
    python convert_to_onnx.py --weights "file/pot_hole_detection.pt" --half

OUTPUT
------
The .onnx file is saved next to the .pt file with the same stem name.
e.g.  file/pot_hole_detection.pt  →  file/pot_hole_detection.onnx

NEXT STEPS (after conversion)
------------------------------
1. Verify the ONNX output matches the .pt model:
       python verify_onnx.py --pt "file/pot_hole_detection.pt" \
                              --onnx "file/pot_hole_detection.onnx" \
                              --image <path-to-a-test-image.jpg>

2. If you want to run inference in-browser (WebAssembly / ONNX Runtime Web),
   you may need opset 11 or 12 and --simplify (already on by default).

3. If you want TensorRT or OpenVINO instead of ONNX, change --format:
       format="engine"    → TensorRT (.engine) — needs NVIDIA GPU + TRT
       format="openvino"  → OpenVINO (.xml/.bin) — Intel accelerators
       format="tflite"    → TFLite (.tflite) — mobile / edge
"""

import argparse
from pathlib import Path

# ultralytics ships the YOLO class that wraps YOLOv5/v8/v9/v10 weights.
# It handles loading, task inference, and export in one call.
from ultralytics import YOLO


def main():
    # ------------------------------------------------------------------ #
    # 1. PARSE COMMAND-LINE ARGUMENTS
    #    Each argument has a sensible default so you can run with zero flags.
    # ------------------------------------------------------------------ #
    parser = argparse.ArgumentParser(description="Export a YOLO .pt model to ONNX")

    parser.add_argument(
        "--weights",
        default=r"D:\myStart\monorepo\file convertor\file\pot_hole_better.pt",   # ← changed default to pothole model
        help="Path to the .pt weights file (relative or absolute)",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Square input size the model was trained at (640 is standard YOLOv8)",
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=12,
        help="ONNX opset version. 12 works with most runtimes; use 11 for max compat",
    )
    parser.add_argument(
        "--dynamic",
        action="store_true",
        help="Add dynamic axes to the ONNX graph (batch, height, width). "
             "Required for variable-batch serving. Off by default so the graph "
             "is fully static (faster on single-image inference).",
    )
    parser.add_argument(
        "--simplify",
        action="store_true",
        default=True,
        help="Run onnxslim after export to fold constants and remove dead nodes. "
             "Makes the graph smaller and faster. On by default.",
    )
    parser.add_argument(
        "--half",
        action="store_true",
        help="Export weights as FP16 instead of FP32. "
             "Halves model size and speeds up GPU inference. "
             "Requires an NVIDIA GPU that supports float16.",
    )

    args = parser.parse_args()

    # ------------------------------------------------------------------ #
    # 2. VALIDATE THE INPUT PATH
    #    Fail early with a clear message rather than a cryptic YOLO error.
    # ------------------------------------------------------------------ #
    weights = Path(args.weights)
    if not weights.exists():
        raise FileNotFoundError(
            f"Weights not found: {weights.resolve()}\n"
            f"  → Check that the path is correct and the file exists."
        )

    # ------------------------------------------------------------------ #
    # 3. LOAD THE MODEL
    #    YOLO() auto-detects whether the file is a YOLOv5 or YOLOv8 checkpoint.
    #    It also reads the embedded class-name list and task type.
    # ------------------------------------------------------------------ #
    print(f"Loading model : {weights.resolve()}")
    model = YOLO(str(weights))

    # Print what the model knows about itself — useful sanity check
    print(f"Task          : {model.task}")        # 'detect', 'segment', 'classify' …
    print(f"Class names   : {model.names}")       # e.g. {0: 'pothole'} or {0: 'car', 1: 'truck'}

    # ------------------------------------------------------------------ #
    # 4. EXPORT TO ONNX
    #    model.export() wraps torch.onnx.export + optional post-processing.
    #    It returns the path where the .onnx file was written.
    #
    #    WHAT EACH PARAM DOES:
    #    format   → output format; "onnx" writes a standard .onnx protobuf
    #    imgsz    → bakes input H×W into the graph (unless --dynamic is set)
    #    opset    → ONNX operator-set version; higher = newer ops, lower = wider compat
    #    dynamic  → adds symbolic batch/spatial dims so the graph accepts any size
    #    simplify → runs onnxslim to clean up the graph
    #    half     → cast weights to float16 before export
    # ------------------------------------------------------------------ #
    print(f"\nExporting to ONNX …")
    print(f"  imgsz    = {args.imgsz}")
    print(f"  opset    = {args.opset}")
    print(f"  dynamic  = {args.dynamic}")
    print(f"  simplify = {args.simplify}")
    print(f"  half     = {args.half}")

    onnx_path = model.export(
        format="onnx",
        imgsz=args.imgsz,
        opset=args.opset,
        dynamic=args.dynamic,
        simplify=args.simplify,
        half=args.half,
    )

    # ------------------------------------------------------------------ #
    # 5. DONE — report the output path
    #    The file is placed next to the .pt file by ultralytics convention.
    # ------------------------------------------------------------------ #
    print(f"\n✅  Done. ONNX model saved at:\n   {Path(onnx_path).resolve()}")
    print(
        f"\nNext: verify the export matches the original .pt:\n"
        f"   conda run -p D:/yolo-env1 python verify_onnx.py "
        f"--pt \"{weights}\" --onnx \"{Path(onnx_path)}\""
    )


if __name__ == "__main__":
    main()
