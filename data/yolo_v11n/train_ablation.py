from ultralytics import YOLO

def main():
    print("Initializing YOLOv11n — Dataset Ablation Study (Benchmarking vs YOLOv8n & YOLO26n)...")

    model = YOLO('yolo11n.pt')

    results = model.train(
        # ── Data ──────────────────────────────────────────────────
        data=r'D:\yolo_foreset_fire_detection\unified_data_set\unified_dataset_02\dataset.yaml',

        # ── Duration & Scheduling ─────────────────────────────────
        epochs=250,
        patience=30,               # Stop early if no improvement
        cos_lr=True,               # Smoother convergence

        # ── Resolution & Batch ────────────────────────────────────
        imgsz=1280,
        batch=12,                   # Sweet spot: ~7GB VRAM, faster than 16 (memory-bound)

        # ── Hardware ──────────────────────────────────────────────
        workers=8,                  # 8 workers: safe RAM + NVMe keeps up at 1.6 GB/s
        device=0,
        amp=True,

        # ── Optimizer ─────────────────────────────────────────────
        optimizer='SGD',           # Best for YOLO
        lr0=0.01,
        lrf=0.1,                   # Final LR = 0.001
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=5,           # Longer warmup for 32k dataset — stabilizes early gradients
        warmup_momentum=0.8,

        # ── Augmentation ──────────────────────────────────────────
        mosaic=1.0,
        close_mosaic=15,
        mixup=0.1,                 # Increased: forces fire vs lamp texture discrimination
        copy_paste=0.1,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=5.0,
        scale=0.5,
        translate=0.1,
        fliplr=0.5,
        flipud=0.0,                # Fire doesn't appear upside down
        erasing=0.1,               # Random erasing — forces model to detect fire from partial cues

        # ── Loss Weights (KEY for 80+ fire mAP) ──────────────────
        box=7.5,                   # Default box loss weight (keep stable)
        cls=1.0,                   # DOUBLED from default 0.5 — forces model to care MORE about fire vs background classification
        dfl=1.5,                   # Default distribution focal loss

        # ── Regularization ────────────────────────────────────────
        label_smoothing=0.01,      # Fire/smoke edge case handling
        nbs=64,                    # Nominal batch size for loss normalization (stable gradients)

        # ── Output ────────────────────────────────────────────────
        project=r'D:\yolo_foreset_fire_detection\train\yolo_v11n',
        name='unified_02_ablation',
        exist_ok=True,
        cache=False,               # NVMe handles I/O, preserve 128GB RAM
        save=True,
        save_period=25,
        plots=True,
        seed=42,
        verbose=True,
    )

    print("Training finished!")
    print(f"Best weights: {results.save_dir}/weights/best.pt")

if __name__ == '__main__':
    main()
