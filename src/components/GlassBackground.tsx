"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function GlassBackground() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#F8F9FC]">

      {/* ── Orb 1 — large indigo/violet, top-left, slow drift ── */}
      <motion.div
        animate={{
          scale: [1, 1.18, 0.92, 1.06, 1],
          x:     [0, 60, -30, 20, 0],
          y:     [0, -40, 30, -15, 0],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-[20%] -left-[10%] w-[65vw] h-[65vw] max-w-[820px] max-h-[820px] rounded-full"
        style={{
          background: "radial-gradient(circle at 40% 40%, rgba(99,102,241,0.22), rgba(139,92,246,0.12) 45%, transparent 70%)",
          filter: "blur(70px)",
        }}
      />

      {/* ── Orb 2 — sky/cyan accent, top-right, medium speed ── */}
      <motion.div
        animate={{
          scale: [1, 1.25, 0.88, 1.1, 1],
          x:     [0, -70, 40, -20, 0],
          y:     [0, 50, -35, 20, 0],
        }}
        transition={{ duration: 17, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute -top-[10%] -right-[15%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full"
        style={{
          background: "radial-gradient(circle at 55% 35%, rgba(14,165,233,0.18), rgba(56,189,248,0.08) 45%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* ── Orb 3 — amber/orange, bottom-right, fast pulse ── */}
      <motion.div
        animate={{
          scale: [1, 1.3, 0.85, 1.15, 1],
          x:     [0, -60, 50, -10, 0],
          y:     [0, 60, -40, 25, 0],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute -bottom-[25%] -right-[10%] w-[60vw] h-[60vw] max-w-[760px] max-h-[760px] rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 55%, rgba(251,146,60,0.16), rgba(245,101,101,0.08) 45%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* ── Orb 4 — emerald/green, bottom-left, medium ── */}
      <motion.div
        animate={{
          scale: [0.9, 1.2, 0.95, 1.05, 0.9],
          x:     [0, 50, -40, 15, 0],
          y:     [0, -50, 30, -20, 0],
        }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 8 }}
        className="absolute -bottom-[15%] -left-[12%] w-[50vw] h-[50vw] max-w-[640px] max-h-[640px] rounded-full"
        style={{
          background: "radial-gradient(circle at 40% 60%, rgba(16,185,129,0.14), rgba(52,211,153,0.06) 45%, transparent 70%)",
          filter: "blur(65px)",
        }}
      />

      {/* ── Orb 5 — rose/pink, center, slow counter-pulse ── */}
      <motion.div
        animate={{
          scale: [1.1, 0.85, 1.2, 0.95, 1.1],
          x:     [20, -30, 40, -10, 20],
          y:     [-20, 35, -25, 40, -20],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute top-[35%] left-[30%] w-[45vw] h-[45vw] max-w-[560px] max-h-[560px] rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(236,72,153,0.09), rgba(168,85,247,0.06) 50%, transparent 75%)",
          filter: "blur(90px)",
        }}
      />

      {/* ── Shimmer sweep — diagonal light ray that moves slowly ── */}
      <motion.div
        animate={{ x: ["-120%", "120%"] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear", repeatDelay: 6 }}
        className="absolute inset-y-0 w-[30vw]"
        style={{
          background: "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.055) 50%, transparent 100%)",
          filter: "blur(8px)",
          left: 0,
        }}
      />

      {/* ── Fine-Line Grid Mesh ── */}
      <div
        className="absolute inset-0 opacity-[0.32]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(99, 102, 241, 0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, 0.07) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(circle at 50% 40%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 40%, black 20%, transparent 80%)",
        }}
      />

      {/* ── Dots Grid Overlay ── */}
      <div
        className="absolute inset-0 opacity-[0.2]"
        style={{
          backgroundImage: "radial-gradient(rgba(37, 99, 235, 0.12) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(circle at 50% 45%, black 35%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 45%, black 35%, transparent 90%)",
        }}
      />

      {/* ── Edge vignette to keep page edges clean ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F8F9FC]/30 via-transparent to-[#F8F9FC]/50" />
    </div>
  );
}
