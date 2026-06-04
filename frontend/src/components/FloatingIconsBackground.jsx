import { useEffect, useRef } from "react";

/**
 * FloatingIconsBackground — Physics-driven interactive version
 *
 * Behaviour
 * ---------
 *   • Icons drift gently when idle (ambient sine-wave force per icon).
 *   • Moving the cursor near an icon repels it.
 *   • Icons bounce off each other (elastic circle collision).
 *   • After being pushed, each icon springs back toward its home position.
 *   • Works through pointer-events:none via document-level mouse tracking.
 *
 * Tune these five constants to change the feel ↓
 */
const REPEL_RADIUS = 150;   // px — how close cursor must be to start pushing
const REPEL_STRENGTH = 14;    // higher = stronger push
const HOME_SPRING = 0.018; // how eagerly icons drift back home (0.005 = lazy, 0.04 = snappy)
const DAMPING = 0.87;  // velocity decay per frame (lower = slides to a stop faster)
const COLLISION_BOUNCE = 0.65;  // bounciness on icon-icon hit (0 = sticky, 1 = perfectly elastic)

// ─── Icon definitions ────────────────────────────────────────────────────────
// x / y  = starting position as % of container width / height
// size   = tile width & height in px
// bg     = tile background colour
// color  = icon stroke / fill colour
const ICONS = [
    {
        id: 1, x: "5%", y: "6%", size: 68, bg: "#fef2f2", color: "#dc2626",
        icon: <svg viewBox="0 0 24 24" fill="currentColor" width="52%" height="52%"><path d="M12 2S7 7.5 7 12.5C7 15.5 9.24 18 12 18s5-2.5 5-5.5c0-3-2-5-3-6 0 2-1 3-2 3 0 0 0-8 0-8z" /><path d="M12 10c-1 1.5-2 2.5-2 4a2 2 0 0 0 4 0c0-1.5-1-2.5-2-4z" opacity=".5" /></svg>,
    },
    {
        id: 2, x: "23%", y: "3%", size: 56, bg: "#f0fdf4", color: "#16a34a",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="52%" height="52%"><path d="M2 22L22 2" /><path d="M22 2C22 2 16 2 10 8C4 14 2 22 2 22c0 0 6 0 12-6 6-6 8-14 8-14z" /></svg>,
    },
    {
        id: 3, x: "80%", y: "4%", size: 64, bg: "#eff6ff", color: "#2563eb",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="52%" height="52%"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
    },
    {
        id: 4, x: "88%", y: "25%", size: 72, bg: "#faf5ff", color: "#9333ea",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="52%" height="52%"><rect x="7" y="7" width="10" height="10" rx="1" /><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>,
    },
    {
        id: 5, x: "85%", y: "52%", size: 60, bg: "#f5f3ff", color: "#7c3aed",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="52%" height="52%"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>,
    },
    {
        id: 6, x: "81%", y: "74%", size: 56, bg: "#ecfdf5", color: "#059669",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="52%" height="52%"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>,
    },
    {
        id: 7, x: "52%", y: "85%", size: 64, bg: "#fff7ed", color: "#ea580c",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="52%" height="52%"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
    },
    {
        id: 8, x: "3%", y: "54%", size: 68, bg: "#eff6ff", color: "#3b82f6",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="52%" height="52%"><circle cx="12" cy="12" r="2" /><line x1="12" y1="10" x2="7" y2="6" /><circle cx="6" cy="5" r="2" /><line x1="12" y1="10" x2="17" y2="6" /><circle cx="18" cy="5" r="2" /><line x1="12" y1="14" x2="7" y2="18" /><circle cx="6" cy="19" r="2" /><line x1="12" y1="14" x2="17" y2="18" /><circle cx="18" cy="19" r="2" /></svg>,
    },
    {
        id: 9, x: "8%", y: "78%", size: 52, bg: "#fff1f2", color: "#e11d48",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="52%" height="52%"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>,
    },
    {
        id: 10, x: "6%", y: "24%", size: 60, bg: "#fefce8", color: "#ca8a04",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="52%" height="52%"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
    },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function FloatingIconsBackground() {
    const containerRef = useRef(null);
    const tilesRef = useRef([]);   // DOM elements, one per icon
    const physicsRef = useRef(null); // live physics state (avoids React re-renders)
    const mouseRef = useRef({ x: -9999, y: -9999 });
    const rafRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const init = () => {
            const { width: W, height: H } = container.getBoundingClientRect();
            if (W === 0) { requestAnimationFrame(init); return; } // not laid out yet

            // Build physics state from declarative ICONS config
            physicsRef.current = ICONS.map((icon, i) => {
                const hx = (parseFloat(icon.x) / 100) * W + icon.size / 2;
                const hy = (parseFloat(icon.y) / 100) * H + icon.size / 2;
                return {
                    i,
                    size: icon.size,
                    radius: icon.size * 0.45,          // collision circle, slightly inside the tile
                    cx: hx, cy: hy,                    // current centre
                    homeX: hx, homeY: hy,              // resting position (spring target)
                    vx: (Math.random() - 0.5) * 0.4,  // tiny initial nudge so no two start together
                    vy: (Math.random() - 0.5) * 0.4,
                    phase: Math.random() * Math.PI * 2, // unique offset for ambient drift wave
                };
            });

            // Teleport tiles to correct positions immediately (no visible flash)
            physicsRef.current.forEach((p) => {
                const el = tilesRef.current[p.i];
                if (!el) return;
                el.style.left = "0px";
                el.style.top = "0px";
                el.style.transform = `translate(${p.cx - p.size / 2}px, ${p.cy - p.size / 2}px)`;
            });

            rafRef.current = requestAnimationFrame(tick);
        };

        const tick = () => {
            const items = physicsRef.current;
            if (!items) return;

            const { width: W, height: H } = container.getBoundingClientRect();
            const { x: mx, y: my } = mouseRef.current;
            const t = Date.now() / 1000;

            // ── 1. Per-icon forces ──────────────────────────────────────────────────
            items.forEach((p) => {
                // Cursor repulsion (inverse-square feel via squared falloff)
                const dx = p.cx - mx;
                const dy = p.cy - my;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
                if (dist < REPEL_RADIUS) {
                    const strength = ((REPEL_RADIUS - dist) / REPEL_RADIUS) ** 2 * REPEL_STRENGTH;
                    p.vx += (dx / dist) * strength;
                    p.vy += (dy / dist) * strength;
                }

                // Spring back toward home position
                p.vx += (p.homeX - p.cx) * HOME_SPRING;
                p.vy += (p.homeY - p.cy) * HOME_SPRING;

                // Gentle idle drift (unique sine wave per icon)
                p.vx += Math.sin(t * 0.38 + p.phase) * 0.025;
                p.vy += Math.cos(t * 0.29 + p.phase * 1.4) * 0.025;

                // Velocity decay
                p.vx *= DAMPING;
                p.vy *= DAMPING;

                // Integrate
                p.cx += p.vx;
                p.cy += p.vy;

                // Boundary bounce — keep centre inside container
                const r = p.radius;
                if (p.cx < r) { p.cx = r; p.vx = Math.abs(p.vx) * 0.4; }
                if (p.cx > W - r) { p.cx = W - r; p.vx = -Math.abs(p.vx) * 0.4; }
                if (p.cy < r) { p.cy = r; p.vy = Math.abs(p.vy) * 0.4; }
                if (p.cy > H - r) { p.cy = H - r; p.vy = -Math.abs(p.vy) * 0.4; }
            });

            // ── 2. Icon-icon elastic collisions (O(n²), fine for n ≈ 10) ───────────
            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const a = items[i], b = items[j];
                    const dx = b.cx - a.cx;
                    const dy = b.cy - a.cy;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
                    const minDist = a.radius + b.radius;

                    if (dist < minDist) {
                        // Push overlapping icons apart by half the overlap each
                        const overlap = (minDist - dist) * 0.5;
                        const nx = dx / dist, ny = dy / dist;
                        a.cx -= nx * overlap; a.cy -= ny * overlap;
                        b.cx += nx * overlap; b.cy += ny * overlap;

                        // Exchange velocity along the collision normal
                        const dvx = a.vx - b.vx;
                        const dvy = a.vy - b.vy;
                        const dot = dvx * nx + dvy * ny;
                        if (dot > 0) {
                            const impulse = dot * COLLISION_BOUNCE;
                            a.vx -= nx * impulse; a.vy -= ny * impulse;
                            b.vx += nx * impulse; b.vy += ny * impulse;
                        }
                    }
                }
            }

            // ── 3. Flush to DOM via transform (GPU-composited, no layout thrash) ───
            items.forEach((p) => {
                const el = tilesRef.current[p.i];
                if (el) {
                    el.style.transform =
                        `translate(${(p.cx - p.size / 2).toFixed(1)}px, ${(p.cy - p.size / 2).toFixed(1)}px)`;
                }
            });

            rafRef.current = requestAnimationFrame(tick);
        };

        // Track cursor relative to the container via document (works through pointer-events:none)
        const onMouseMove = (e) => {
            const r = container.getBoundingClientRect();
            mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        const onMouseLeave = () => { mouseRef.current = { x: -9999, y: -9999 }; };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseleave", onMouseLeave);
        init();

        return () => {
            cancelAnimationFrame(rafRef.current);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseleave", onMouseLeave);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
            {ICONS.map((icon, i) => (
                <div
                    key={icon.id}
                    ref={(el) => { tilesRef.current[i] = el; }}
                    style={{
                        position: "absolute",
                        left: icon.x,   // CSS fallback — physics overrides on first frame
                        top: icon.y,
                        width: icon.size,
                        height: icon.size,
                        borderRadius: "22%",
                        background: icon.bg,
                        color: icon.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 18px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)",
                        willChange: "transform",   // promote to GPU layer
                    }}
                >
                    {icon.icon}
                </div>
            ))}
        </div>
    );
}