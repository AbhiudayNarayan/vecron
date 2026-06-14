import { useEffect, useRef } from "react";

/**
 * HeroVisual — dynamic, animated hero graphic for the Kriya landing page.
 *
 * Shows what Kriya does (ML object detection) as a polished, lightweight
 * composition built with pure React + CSS:
 *   1. A central "detection preview" card with a placeholder scene and
 *      bounding boxes that draw in (clip-path + opacity) and loop subtly,
 *      each with a saffron-accented confidence chip.
 *   2. Floating labelled pill tags that gently drift around the card.
 *   3. Layered depth — two faint stacked cards offset behind the main one.
 *   4. A soft saffron/amber radial glow behind the whole composition.
 *   5. Gentle mouse parallax (a few px), skipped under reduced-motion.
 *
 * All colors come from the design-system CSS variables, so it stays on-theme
 * and dark-ready. Respects prefers-reduced-motion: motion is disabled and the
 * boxes/tags render in their final, fully-visible state.
 *
 * ── Swapping the placeholder for a real image ───────────────────────────────
 * Drop your asset in `src/assets/` (e.g. hero-scene.jpg), import it, and pass
 * it in:  <HeroVisual imageSrc={heroScene} />  (see HomePage). When `imageSrc`
 * is set it renders as the card image; otherwise the gradient "street scene"
 * placeholder below is shown. A landscape ~16:10 photo of a road/street works
 * best.
 */

// Detection boxes — positions are % of the preview image area.
// tone is a design-system brand var used for the border + confidence chip.
const BOXES = [
    { id: "car", label: "car 0.88", top: 44, left: 9, w: 33, h: 27, delay: 0.2, tone: "var(--brand-500)" },
    { id: "person", label: "person 0.95", top: 36, left: 70, w: 13, h: 38, delay: 1.1, tone: "var(--brand-600)" },
    { id: "pothole", label: "pothole 0.92", top: 71, left: 38, w: 28, h: 17, delay: 1.9, tone: "var(--brand-400)" },
    { id: "sign", label: "sign 0.79", top: 14, left: 73, w: 17, h: 16, delay: 2.7, tone: "var(--brand-500)" },
];

// Floating capability tags — positioned around the card.
const TAGS = [
    { id: "obj", label: "Object Detection", style: { top: "3%", left: "0%" }, anim: "khFloatA 7s" },
    { id: "fire", label: "Fire & Smoke", style: { top: "26%", right: "-2%" }, anim: "khFloatB 8.5s" },
    { id: "garbage", label: "Garbage", style: { bottom: "9%", left: "2%" }, anim: "khFloatB 7.8s" },
    { id: "pothole", label: "Pothole", style: { bottom: "20%", right: "1%" }, anim: "khFloatA 9s" },
];

export default function HeroVisual({ imageSrc }) {
    const backRef = useRef(null);
    const frontRef = useRef(null);
    const rafRef = useRef(null);

    // Gentle mouse parallax — shifts the composition a few px. The back layer
    // (card + glow) moves less than the front layer (tags) for a sense of depth.
    // Disabled entirely when the user prefers reduced motion.
    useEffect(() => {
        const reduce =
            typeof window !== "undefined" &&
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) return;

        const root = backRef.current && backRef.current.parentElement;
        if (!root) return;

        const onMove = (e) => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                const r = root.getBoundingClientRect();
                const nx = (e.clientX - r.left) / r.width - 0.5; // -0.5 .. 0.5
                const ny = (e.clientY - r.top) / r.height - 0.5;
                if (backRef.current)
                    backRef.current.style.transform = `translate(${nx * 6}px, ${ny * 6}px)`;
                if (frontRef.current)
                    frontRef.current.style.transform = `translate(${nx * 14}px, ${ny * 14}px)`;
            });
        };
        const onLeave = () => {
            if (backRef.current) backRef.current.style.transform = "";
            if (frontRef.current) frontRef.current.style.transform = "";
        };

        root.addEventListener("mousemove", onMove);
        root.addEventListener("mouseleave", onLeave);
        return () => {
            root.removeEventListener("mousemove", onMove);
            root.removeEventListener("mouseleave", onLeave);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <div className="relative mx-auto w-full max-w-[30rem] select-none">
            <style>{`
                /* Boxes draw in (left to right), hold, then fade + redraw — a
                   subtle continuous "live detection" loop. Base (un-animated)
                   state is fully visible so reduced-motion shows a static frame. */
                @keyframes khDraw {
                    0%   { opacity: 0; clip-path: inset(0 100% 0 0); }
                    12%  { opacity: 1; clip-path: inset(0 0 0 0); }
                    86%  { opacity: 1; clip-path: inset(0 0 0 0); }
                    100% { opacity: 0; clip-path: inset(0 100% 0 0); }
                }
                @keyframes khChip {
                    0%, 8%   { opacity: 0; transform: translateY(3px); }
                    16%, 86% { opacity: 1; transform: translateY(0); }
                    100%     { opacity: 0; transform: translateY(3px); }
                }
                @keyframes khFloatA {
                    0%, 100% { transform: translate(0, 0); }
                    50%      { transform: translate(4px, -10px); }
                }
                @keyframes khFloatB {
                    0%, 100% { transform: translate(0, 0); }
                    50%      { transform: translate(-5px, 8px); }
                }
                @keyframes khGlow {
                    0%, 100% { opacity: 0.85; transform: scale(1); }
                    50%      { opacity: 1; transform: scale(1.05); }
                }
                @keyframes khPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%      { opacity: 0.35; transform: scale(0.8); }
                }
                .kh-box  { opacity: 1; clip-path: inset(0 0 0 0); animation: khDraw 8s ease-in-out infinite; }
                .kh-chip { animation: khChip 8s ease-in-out infinite; }
                .kh-tag  { animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
                .kh-glow { animation: khGlow 9s ease-in-out infinite; }
                .kh-dot  { animation: khPulse 1.8s ease-in-out infinite; }

                @media (prefers-reduced-motion: reduce) {
                    .kh-box, .kh-chip, .kh-tag, .kh-glow, .kh-dot { animation: none; }
                    .kh-box  { opacity: 1; clip-path: inset(0 0 0 0); }
                    .kh-chip { opacity: 1; transform: none; }
                }
            `}</style>

            {/* Soft saffron/amber radial glow behind everything */}
            <div
                aria-hidden="true"
                className="kh-glow pointer-events-none absolute inset-0 -z-10"
                style={{
                    background:
                        "radial-gradient(45% 45% at 50% 45%, var(--brand-200), transparent 70%)",
                    filter: "blur(18px)",
                }}
            />

            {/* Square stage so absolutely-positioned children have a box */}
            <div className="relative aspect-square w-full">
                {/* Back layer: stacked depth cards + the main preview card */}
                <div ref={backRef} className="absolute inset-0 transition-transform duration-300 ease-out">
                    {/* Layered depth — two faint cards offset behind the main one */}
                    <div
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 h-[64%] w-[80%] rounded-2xl border border-line bg-surface"
                        style={{ transform: "translate(-50%,-50%) translate(26px, 30px) rotate(5deg)", opacity: 0.5, boxShadow: "var(--sh-md)" }}
                    />
                    <div
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 h-[66%] w-[82%] rounded-2xl border border-line bg-surface"
                        style={{ transform: "translate(-50%,-50%) translate(-22px, 16px) rotate(-4deg)", opacity: 0.7, boxShadow: "var(--sh-md)" }}
                    />

                    {/* Main detection preview card */}
                    <div
                        className="absolute left-1/2 top-1/2 w-[84%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-line bg-surface"
                        style={{ boxShadow: "var(--sh-lg)" }}
                    >
                        {/* Preview image area (16:10). Real image OR gradient scene. */}
                        <div className="relative w-full" style={{ aspectRatio: "16 / 10" }}>
                            {imageSrc ? (
                                <img
                                    src={imageSrc}
                                    alt=""
                                    aria-hidden="true"
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            ) : (
                                /* Gradient "street scene" placeholder — swap via imageSrc */
                                <div
                                    aria-hidden="true"
                                    className="absolute inset-0"
                                    style={{
                                        background:
                                            "linear-gradient(180deg, var(--brand-50) 0%, var(--stone-100) 40%, var(--stone-300) 62%, var(--stone-500) 100%)",
                                    }}
                                >
                                    {/* road trapezoid */}
                                    <div
                                        className="absolute inset-0"
                                        style={{
                                            background:
                                                "linear-gradient(180deg, var(--stone-500), var(--stone-700))",
                                            clipPath: "polygon(43% 40%, 57% 40%, 100% 100%, 0% 100%)",
                                        }}
                                    />
                                    {/* center lane dashes */}
                                    <div
                                        className="absolute left-1/2 bottom-0 -translate-x-1/2"
                                        style={{
                                            width: "3%",
                                            height: "60%",
                                            background:
                                                "repeating-linear-gradient(to bottom, var(--brand-200) 0 8%, transparent 8% 18%)",
                                            clipPath: "polygon(35% 0, 65% 0, 100% 100%, 0% 100%)",
                                            opacity: 0.8,
                                        }}
                                    />
                                </div>
                            )}

                            {/* "Live detection" status chip */}
                            <div
                                className="absolute left-2 top-2 flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[0.625rem] font-semibold"
                                style={{
                                    background: "rgba(28, 25, 22, 0.55)",
                                    color: "var(--c-on-dark)",
                                    backdropFilter: "blur(4px)",
                                }}
                            >
                                <span
                                    className="kh-dot inline-block h-1.5 w-1.5 rounded-pill"
                                    style={{ background: "var(--brand-400)" }}
                                />
                                Live detection
                            </div>

                            {/* Animated bounding boxes */}
                            {BOXES.map((b) => (
                                <div
                                    key={b.id}
                                    className="kh-box absolute"
                                    style={{
                                        top: `${b.top}%`,
                                        left: `${b.left}%`,
                                        width: `${b.w}%`,
                                        height: `${b.h}%`,
                                        border: `2px solid ${b.tone}`,
                                        borderRadius: "4px",
                                        boxShadow: `0 0 0 1px rgba(255,255,255,0.25), 0 0 12px ${b.tone}`,
                                        animationDelay: `${b.delay}s`,
                                    }}
                                >
                                    <span
                                        className="kh-chip absolute -top-[1.15rem] left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[0.625rem] font-bold leading-none"
                                        style={{
                                            background: b.tone,
                                            color: "var(--c-surface)",
                                            animationDelay: `${b.delay}s`,
                                        }}
                                    >
                                        {b.label}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Card footer — reinforces the product story */}
                        <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-[0.6875rem] font-semibold text-ink">
                                road-defects-v2.onnx
                            </span>
                            <span className="badge badge-brand text-[0.625rem]">4 objects</span>
                        </div>
                    </div>
                </div>

                {/* Front layer: floating capability tags */}
                <div ref={frontRef} className="absolute inset-0 transition-transform duration-300 ease-out">
                    {TAGS.map((t, i) => (
                        <span
                            key={t.id}
                            className="kh-tag absolute inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink"
                            style={{
                                ...t.style,
                                boxShadow: "var(--sh-md)",
                                animationName: t.anim.split(" ")[0],
                                animationDuration: t.anim.split(" ")[1],
                                animationDelay: `${i * 0.4}s`,
                            }}
                        >
                            <span
                                className="inline-block h-2 w-2 rounded-pill"
                                style={{ background: "var(--brand-500)" }}
                            />
                            {t.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
