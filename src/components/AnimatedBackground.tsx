"use client";

import React, { useEffect, useState } from "react";

/**
 * AnimatedBackground
 * Slow-drifting gradient orbs, panning dot grid, and floating micro-particles.
 * Pure CSS animations for top-tier performance.
 */
export default function AnimatedBackground() {
  const [particles, setParticles] = useState<
    Array<{ id: number; left: string; delay: string; duration: string; scale: number }>
  >([]);

  useEffect(() => {
    // Generate random values on mount to prevent SSR mismatch warnings
    const tempParticles = Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * -18}s`,
      duration: `${14 + Math.random() * 10}s`,
      scale: 0.5 + Math.random() * 0.8,
    }));
    setParticles(tempParticles);
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundColor: "#000000",
      }}
    >
      {/* 1. Slowly panning coordinate dot-grid */}
      <div className="bg-grid-pan" />

      {/* 2. Deep luxury gradient orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      {/* 3. Floating micro-particles / star dust */}
      <div className="particle-container">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
              transform: `scale(${p.scale})`,
            }}
          />
        ))}
      </div>

      {/* 4. Film grain overlay */}
      <div className="bg-grain" />
    </div>
  );
}

