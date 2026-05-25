"use client";

/**
 * AnimatedBackground
 * Slow-drifting gradient orbs on pure black — arkitekweb-inspired.
 * CSS-only (no JS frame loop), fixed position, pointer-events-none.
 */
export default function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Orb 1 — top-left, slow drift */}
      <div className="bg-orb bg-orb-1" />
      {/* Orb 2 — bottom-right, counter-drift */}
      <div className="bg-orb bg-orb-2" />
      {/* Orb 3 — center, slow pulse */}
      <div className="bg-orb bg-orb-3" />
      {/* Noise grain overlay */}
      <div className="bg-grain" />
    </div>
  );
}
