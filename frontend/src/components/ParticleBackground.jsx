import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

const ParticleBackground = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  const options = useMemo(
    () => ({
      fullScreen: { enable: false },
      background: { color: { value: "transparent" } },
      fpsLimit: 60,
      particles: {
        color: { value: "#0400fd" },
        links: {
          color: "#60a5fa",   // blue-400, not gray — gray-400 @ 0.3 over white = invisible
          distance: 150,
          enable: true,
          opacity: 0.45,      // was 0.3 → bumped so the web is actually visible
          width: 1.2,
        },
        move: {
          enable: true,
          speed: 1.2,
          direction: "none",
          outModes: { default: "bounce" },
        },
        number: {
          // v3 API: density takes width/height as a REFERENCE area, not `area`.
          // Smaller reference (1200x800) than the default 1920x1080 = denser web
          // on a typical laptop, which is what you want for links to actually form.
          density: { enable: true, width: 1200, height: 800 },
          value: 80,          // was 50 — too sparse to web up at distance 150
        },
        opacity: { value: 0.6 },  // was 0.5 → contrast against the light bg
        size: { value: { min: 1, max: 3 } },
      },
      detectRetina: true,
    }),
    []
  );

  if (!ready) return null;

  return (
    <Particles
      id="tsparticles"
      options={options}
      className="absolute inset-0 z-0 pointer-events-none"
    />
  );
};

export default ParticleBackground;