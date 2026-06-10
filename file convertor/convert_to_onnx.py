"""
Convert a YOLO .pt model (waste-classification detector, 6 classes:
BIODEGRADABLE, CARDBOARD, GLASS, METAL, PAPER, PLASTIC) to ONNX.

Run inside the yolo env:
    conda run -p D:/yolo-env1 python convert_to_onnx.py
    # or after `conda activate yolo-env`:  python convert_to_onnx.py

Optional overrides:
    python convert_to_onnx.py --weights "file/best (1).pt" --imgsz 640 --opset 12
"""

import argparse
from pathlib import Path

from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser(description="Export a YOLO .pt model to ONNX")
    parser.add_argument(
        "--weights",
        default="file/best (1).pt",
        help="Path to the .pt weights file",
    )
    parser.add_argument("--imgsz", type=int, default=640, help="Inference image size")
    parser.add_argument("--opset", type=int, default=12, help="ONNX opset version")
    parser.add_argument(
        "--dynamic",
        action="store_true",
        help="Export with dynamic batch/spatial axes",
    )
    parser.add_argument(
        "--simplify",
        action="store_true",
        default=True,
        help="Simplify the ONNX graph (onnxslim)",
    )
    parser.add_argument(
        "--half",
        action="store_true",
        help="Export in FP16 (GPU only)",
    )
    args = parser.parse_args()

    weights = Path(args.weights)
    if not weights.exists():
        raise FileNotFoundError(f"Weights not found: {weights.resolve()}")

    print(f"Loading model: {weights.resolve()}")
    model = YOLO(str(weights))

    # Show what the model knows about itself
    print(f"Task        : {model.task}")
    print(f"Class names : {model.names}")

    print("\nExporting to ONNX ...")
    onnx_path = model.export(
        format="onnx",
        imgsz=args.imgsz,
        opset=args.opset,
        dynamic=args.dynamic,
        simplify=args.simplify,
        half=args.half,
    )

    print(f"\n✅ Done. ONNX model saved at:\n   {Path(onnx_path).resolve()}")


if __name__ == "__main__":
    main()
