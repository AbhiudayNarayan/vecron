"""
Verify an exported ONNX model is numerically faithful to the original .pt.

The authoritative test: feed the *exact same* preprocessed tensor to both the
raw PyTorch module and the ONNX Runtime session, then compare their pre-NMS
output tensors. This isolates export fidelity from the inference pipeline.

(Comparing post-NMS detections from `model.predict()` is misleading here:
ultralytics letterboxes .pt models rectangularly but pads ONNX models to a
fixed square, so the two pipelines see slightly different inputs and produce
slightly different boxes -- even though the exported graph is correct.)

Run inside the yolo env:
    conda run -p D:/yolo-env1 python verify_onnx.py
    # or after `conda activate yolo-env`:  python verify_onnx.py

Optional overrides:
    python verify_onnx.py --pt "file/best (1).pt" --onnx "file/best (1).onnx" \
        --image path/to.jpg --imgsz 640 --atol 1e-2
"""

import argparse
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
import torch
from ultralytics import YOLO
from ultralytics.data.augment import LetterBox


def default_image():
    """Fall back to ultralytics' bundled bus.jpg if no image is given."""
    import ultralytics
    return str(Path(ultralytics.__file__).parent / "assets" / "bus.jpg")


def preprocess(image_path, imgsz):
    """Letterbox to a fixed square (matching the ONNX fixed input), BGR->RGB,
    HWC->CHW, scale to [0,1]. Returns a (1,3,imgsz,imgsz) float32 tensor."""
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")
    im = LetterBox((imgsz, imgsz), auto=False)(image=img)
    im = im[:, :, ::-1].transpose(2, 0, 1)              # BGR->RGB, HWC->CHW
    im = np.ascontiguousarray(im, dtype=np.float32) / 255.0
    return torch.from_numpy(im)[None]


def main():
    parser = argparse.ArgumentParser(description="Verify ONNX export vs .pt")
    parser.add_argument("--pt", default="file/best (1).pt")
    parser.add_argument("--onnx", default="file/best (1).onnx")
    parser.add_argument("--image", default=None, help="Image to test (default: bus.jpg)")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--atol", type=float, default=1e-2,
                        help="Max allowed absolute diff between output tensors")
    parser.add_argument("--conf", type=float, default=0.25,
                        help="Confidence threshold for the readable detection dump")
    args = parser.parse_args()

    image = args.image or default_image()
    print(f"Test image : {image}")
    print(f"PT model   : {Path(args.pt).resolve()}")
    print(f"ONNX model : {Path(args.onnx).resolve()}\n")

    ten = preprocess(image, args.imgsz)

    # --- 1) Authoritative check: identical input, compare raw outputs ---
    model = YOLO(args.pt)
    model.model.eval()
    with torch.no_grad():
        pt_out = model.model(ten)[0].cpu().numpy()      # (1, 4+nc, anchors)

    sess = ort.InferenceSession(args.onnx, providers=["CPUExecutionProvider"])
    inp_name = sess.get_inputs()[0].name
    onnx_out = sess.run(None, {inp_name: ten.numpy()})[0]

    print("--- Raw output tensor comparison (identical input) ---")
    print(f"PT output shape   : {pt_out.shape}")
    print(f"ONNX output shape : {onnx_out.shape}")
    if pt_out.shape != onnx_out.shape:
        print("[FAIL] output shapes differ")
        raise SystemExit(1)

    max_diff = float(np.abs(pt_out - onnx_out).max())
    mean_diff = float(np.abs(pt_out - onnx_out).mean())
    print(f"Max abs diff      : {max_diff:.3e}  (tol {args.atol:.0e})")
    print(f"Mean abs diff     : {mean_diff:.3e}")
    ok = max_diff <= args.atol

    # --- 2) Human-readable: what the ONNX model actually detects ---
    print("\n--- ONNX detections via ultralytics predict ---")
    res = YOLO(args.onnx).predict(image, imgsz=args.imgsz, conf=args.conf,
                                  device="cpu", verbose=False)[0]
    names = res.names
    if res.boxes is None or len(res.boxes) == 0:
        print("(no detections above threshold on this image)")
    else:
        for b in res.boxes:
            cls = names[int(b.cls)]
            conf = float(b.conf)
            xyxy = b.xyxy[0].cpu().numpy().round(1)
            print(f"   {cls:<13} conf={conf:.3f}  box={xyxy}")

    print("\n[PASS] ONNX output matches PyTorch within tolerance." if ok
          else "\n[FAIL] ONNX output diverges beyond tolerance.")
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
