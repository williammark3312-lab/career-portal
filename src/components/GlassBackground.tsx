"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function GlassBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#F8F9FC]">
      {/* 1. Ambient Glow - Top-Left Violet/Indigo Blur */}
      <motion.div
        animate={{
          scale: [1, 1.15, 0.95, 1],
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-[15%] -left-[15%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-br from-indigo-500/12 via-blue-500/8 to-transparent blur-[80px] md:blur-[140px] opacity-80"
      />

      {/* 2. Ambient Glow - Bottom-Right Amber/Rose Blur */}
      <motion.div
        animate={{
          scale: [1, 1.2, 0.9, 1],
          x: [0, -50, 30, 0],
          y: [0, 40, -30, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -bottom-[20%] -right-[20%] w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full bg-gradient-to-tr from-amber-400/8 via-rose-400/5 to-transparent blur-[100px] md:blur-[160px] opacity-75"
      />

      {/* 3. Ambient Glow - Center-Right Cyan Accent */}
      <motion.div
        animate={{
          scale: [0.9, 1.1, 0.95, 0.9],
          x: [0, -20, 40, 0],
          y: [0, 30, -10, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[30%] -right-[10%] w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-l from-sky-400/8 to-transparent blur-[70px] md:blur-[120px] opacity-60"
      />

      {/* 4. Fine-Line Grid Mesh (Spotlight Radial Masking) */}
      <div 
        className="absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(99, 102, 241, 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(circle at 50% 50%, black 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 30%, transparent 85%)",
        }}
      />

      {/* 5. Modern Dots Grid Overlay (Fades elegantly toward the edges) */}
      <div 
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: "radial-gradient(rgba(37, 99, 235, 0.09) 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(circle at 50% 50%, black 45%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 45%, transparent 95%)",
        }}
      />

      {/* 6. Subtle glass surface gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F8F9FC]/20 via-transparent to-[#F8F9FC]/40" />
    </div>
  );
}
