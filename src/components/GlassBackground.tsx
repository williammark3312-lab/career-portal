"use client";

import React, { useState, useEffect } from "react";

export default function GlassBackground() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[#050505]">
      {/* Extremely faint top-center radial gradient to simulate high-end display depth */}
      <div 
        className="absolute inset-0 opacity-40" 
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,255,255,0.015) 0%, transparent 100%)"
        }} 
      />
      {/* Subtle vignette screen shading */}
      <div 
        className="absolute inset-0" 
        style={{
          background: "radial-gradient(circle at 50% 50%, transparent 70%, rgba(0,0,0,0.5) 100%)"
        }} 
      />
    </div>
  );
}
