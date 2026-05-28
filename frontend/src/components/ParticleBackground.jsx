import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

/**
 * ParticleBackground
 * A subtle, professional particle network for use behind auth cards.
 *
 * NOTE on the v3 API: the engine must be initialized ONCE via
 * initParticlesEngine() before <Particles> can render. The old
 * `init={particlesInit}` prop (react-tsparticles v2) no longer works.
 */
const ParticleBackground = () => {
  const [ready, setReady] = useState(false);

  // Initialize the engine a single time for the app's lifetime.
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine); // lightweight feature set
    }).then(() => setReady(true));
  }, []);

  // useMemo prevents rebuilding the options object on every render,
  // which would otherwise force the particle system to restart.
  const options = useMemo(
    () => ({
      // CRITICAL: disable fullScreen so the canvas stays inside its
      // container (position: absolute via className) instead of taking
      // over the whole viewport with position: fixed.
      fullScreen: { enable: false },
      background: { color: { value: "transparent" } },
      fpsLimit: 60,
      particles: {
        color: { value: "#2563eb" }, // blue-600
        links: {
          color: "#9ca3af", // gray-400
          distance: 150,
          enable: true,
          opacity: 0.3,
          width: 1,
        },
        move: {
          enable: true,
          speed: 1.5, // slow and calm
          direction: "none",
          outModes: { default: "bounce" },
        },
        number: {
          density: { enable: true, area: 800 },
          value: 50, // not too crowded
        },
        opacity: { value: 0.5 },
        size: { value: { min: 1, max: 3 } },
      },
      detectRetina: true,
    }),
    []
  );

  if (!ready) return null; // don't render until the engine is loaded

  return (
    <Particles
      id="tsparticles"
      options={options}
      // absolute inset-0 fills the parent; z-0 keeps it behind the card;
      // pointer-events-none lets clicks pass through to the form.
      className="absolute inset-0 z-0 pointer-events-none"
    />
  );
};

export default ParticleBackground;