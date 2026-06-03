"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

export default function GlassBackground() {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    // Handle Resize
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Mouse Listeners
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const onMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    // Grid Parameters
    const cols = 26;
    const rows = 18;
    const focalLength = 350;

    // Animation Loop
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const mouse = mouseRef.current;

      time += 0.012;

      // 3D Grid coordinates calculation
      const points: { sx: number; sy: number; scale: number; alpha: number }[][] = [];

      // Grid boundaries in 3D space
      const gridWidth = w * 1.2;
      const gridDepth = 600;
      const centerY = h * 0.55;

      for (let r = 0; r < rows; r++) {
        points[r] = [];
        const z3d = 100 + (r / (rows - 1)) * gridDepth; // Depth from 100 to 700

        for (let c = 0; c < cols; c++) {
          const x3d = -gridWidth / 2 + (c / (cols - 1)) * gridWidth; // X centered around 0

          // Calculate wave height (Y)
          let waveY = 
            Math.sin(c * 0.25 + time) * 15 + 
            Math.cos(r * 0.35 - time * 0.7) * 15;

          // Projected point coordinates prior to mouse displacement (to calculate distance to cursor)
          const tempScale = focalLength / (focalLength + z3d);
          const tempSx = w / 2 + x3d * tempScale;
          const tempSy = centerY + waveY * tempScale + (z3d - 300) * 0.35; // Tilt the grid slightly downwards

          // Mouse Gravitational Distortion (Gravity Well)
          if (mouse.active) {
            const dx = mouse.x - tempSx;
            const dy = mouse.y - tempSy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxInfluence = 180;
            if (dist < maxInfluence) {
              const force = (maxInfluence - dist) / maxInfluence;
              // Push the grid points downwards at the cursor location (making a well)
              waveY += force * force * 70;
            }
          }

          // Recompute final projection with displacement
          const scale = focalLength / (focalLength + z3d);
          const sx = w / 2 + x3d * scale;
          const sy = centerY + waveY * scale + (z3d - 300) * 0.35;

          // Compute opacity based on depth (closer points are brighter)
          const depthProgress = (z3d - 100) / gridDepth; // 0 (closest) to 1 (furthest)
          const alpha = (1 - depthProgress) * 0.25 + 0.05;

          points[r][c] = { sx, sy, scale, alpha };
        }
      }

      // Draw Grid Lines (connecting rows and columns)
      ctx.lineWidth = 1;
      
      // Horizontal Lines (connecting cols in each row)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const p1 = points[r][c];
          const p2 = points[r][c + 1];

          // Skip drawing if coordinates are invalid/offscreen
          if (Math.abs(p1.sx - p2.sx) > w * 0.5) continue;

          const grad = ctx.createLinearGradient(p1.sx, p1.sy, p2.sx, p2.sy);
          const avgAlpha = (p1.alpha + p2.alpha) / 2;
          grad.addColorStop(0, `rgba(99, 102, 241, ${p1.alpha * 0.8})`); // indigo
          grad.addColorStop(0.5, `rgba(96, 165, 250, ${avgAlpha * 0.9})`); // blue
          grad.addColorStop(1, `rgba(168, 85, 247, ${p2.alpha * 0.8})`); // purple

          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.strokeStyle = grad;
          ctx.lineWidth = (p1.scale + p2.scale) * 0.4;
          ctx.stroke();
        }
      }

      // Vertical Lines (connecting rows in each col)
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows - 1; r++) {
          const p1 = points[r][c];
          const p2 = points[r + 1][c];

          const grad = ctx.createLinearGradient(p1.sx, p1.sy, p2.sx, p2.sy);
          const avgAlpha = (p1.alpha + p2.alpha) / 2;
          grad.addColorStop(0, `rgba(99, 102, 241, ${p1.alpha * 0.8})`);
          grad.addColorStop(1, `rgba(168, 85, 247, ${p2.alpha * 0.8})`);

          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.strokeStyle = grad;
          ctx.lineWidth = (p1.scale + p2.scale) * 0.4;
          ctx.stroke();
        }
      }

      // Draw Grid Nodes (dots)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const p = points[r][c];
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, p.scale * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 1.8})`;
          
          // Add a subtle glow to dots closer to cursor
          if (mouse.active) {
            const dx = mouse.x - p.sx;
            const dy = mouse.y - p.sy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 100) {
              ctx.shadowBlur = (100 - dist) * 0.1;
              ctx.shadowColor = "#60a5fa";
            }
          }

          ctx.fill();
          ctx.shadowBlur = 0; // reset
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    // Clean up
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ background: "#060608" }}>
      {/* Background Ambient Cosmic Nebulas */}
      <div className="absolute inset-0 z-0 opacity-30 mix-blend-screen">
        {/* Nebula 1 — Deep purple blob */}
        <motion.div
          animate={{
            scale: [1, 1.2, 0.95, 1.1, 1],
            x: [0, 50, -30, 20, 0],
            y: [0, -40, 30, -10, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-15%] left-[-10%] w-[75vw] h-[75vw] max-w-[900px] max-h-[900px] rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.22), rgba(124,58,237,0.08) 45%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />

        {/* Nebula 2 — Emerald / Cyan ambient bloom */}
        <motion.div
          animate={{
            scale: [1.1, 0.95, 1.15, 1.0, 1.1],
            x: [0, -60, 40, -20, 0],
            y: [0, 50, -40, 30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-15%] w-[70vw] h-[70vw] max-w-[850px] max-h-[850px] rounded-full"
          style={{
            background: "radial-gradient(circle at 45% 55%, rgba(6,182,212,0.16), rgba(99,102,241,0.06) 50%, transparent 75%)",
            filter: "blur(95px)",
          }}
        />
      </div>

      {/* Grid Canvas Rendered Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 z-10 w-full h-full" />

      {/* Subtle vignettes overlay */}
      <div className="absolute inset-0 z-20 bg-radial-vignette" style={{
        background: "radial-gradient(circle at 50% 50%, transparent 20%, rgba(6,6,8,0.7) 100%)"
      }} />
    </div>
  );
}
