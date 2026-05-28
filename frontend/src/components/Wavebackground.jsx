/**
 * WaveBackground
 * Two layered SVG waves flowing horizontally at the bottom of the container.
 * Pure CSS/SVG — no dependencies. Place as the first child of a `relative`
 * parent; the card above it needs `relative z-10`.
 */
const WaveBackground = () => {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Keyframes scoped to this component via styled tag */}
      <style>{`
        @keyframes vmWaveMove { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .vm-wave-1 { animation: vmWaveMove 9s linear infinite; }
        .vm-wave-2 { animation: vmWaveMove 6s linear infinite reverse; }
        @media (prefers-reduced-motion: reduce) {
          .vm-wave-1, .vm-wave-2 { animation: none; }
        }
      `}</style>

      <div className="absolute bottom-0 left-0 right-0 h-[45vh] min-h-[260px] overflow-hidden">
        {/* Back wave (slower) */}
        <svg
          className="vm-wave-1 absolute bottom-0 h-full w-[200%]"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,60 C150,100 350,20 600,60 C850,100 1050,20 1200,60 L1200,120 L0,120 Z"
            fill="rgba(37,99,235,0.14)"
          />
          <path
            d="M0,60 C150,100 350,20 600,60 C850,100 1050,20 1200,60 L1200,120 L0,120 Z"
            transform="translate(600,0)"
            fill="rgba(37,99,235,0.14)"
          />
        </svg>

        {/* Front wave (faster, reversed) */}
        <svg
          className="vm-wave-2 absolute bottom-0 h-full w-[200%] opacity-70"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,70 C200,30 400,110 600,70 C800,30 1000,110 1200,70 L1200,120 L0,120 Z"
            fill="rgba(99,102,241,0.12)"
          />
          <path
            d="M0,70 C200,30 400,110 600,70 C800,30 1000,110 1200,70 L1200,120 L0,120 Z"
            transform="translate(600,0)"
            fill="rgba(99,102,241,0.12)"
          />
        </svg>
      </div>
    </div>
  );
};

export default WaveBackground;