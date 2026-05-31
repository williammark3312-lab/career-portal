"use client";

import React, { useEffect, useState } from "react";

/**
 * AnimatedBackground — Google Antigravity / Material You
 * Soft iridescent light-mode blobs on a near-white canvas.
 * Google 4-color palette: blue, red, yellow, green.
 */
export default function AnimatedBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundColor: "#F8F9FF",
      }}
    >
      {/* Google Blue blob — top left */}
      <div
        className="bg-blob bg-blob-blue"
        style={{
          width: 700,
          height: 700,
          top: -200,
          left: -150,
        }}
      />

      {/* Google Red blob — top right */}
      <div
        className="bg-blob bg-blob-red"
        style={{
          width: 500,
          height: 500,
          top: 100,
          right: -100,
        }}
      />

      {/* Google Green blob — bottom left */}
      <div
        className="bg-blob bg-blob-green"
        style={{
          width: 600,
          height: 600,
          bottom: -150,
          left: -100,
        }}
      />

      {/* Google Yellow blob — bottom right */}
      <div
        className="bg-blob bg-blob-yel"
        style={{
          width: 400,
          height: 400,
          bottom: 100,
          right: -60,
        }}
      />

      {/* Very subtle dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.35,
          backgroundImage: "radial-gradient(rgba(26,115,232,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          pointerEvents: "none",
        }}
      />

      {/* Vignette — bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "200px",
          background: "linear-gradient(to top, rgba(248,249,255,0.6) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
