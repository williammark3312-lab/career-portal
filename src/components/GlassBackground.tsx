"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
}

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
    let particles: Particle[] = [];
    const maxParticles = 55;
    const connectionDist = 110;
    const mouseConnectionDist = 160;

    // Handle Resize
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    // Initialize particles
    const initParticles = () => {
      particles = [];
      const w = canvas.width;
      const h = canvas.height;
      for (let i = 0; i < maxParticles; i++) {
        const baseAlpha = Math.random() * 0.4 + 0.15;
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          radius: Math.random() * 2 + 1,
          alpha: baseAlpha,
          baseAlpha: baseAlpha,
        });
      }
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

    // Animation Loop
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const mouse = mouseRef.current;

      // Update and Draw Particles
      particles.forEach((p) => {
        // Move particle
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        // Mouse Attraction
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouseConnectionDist) {
            // Apply a gentle pull towards mouse
            const force = (mouseConnectionDist - dist) / mouseConnectionDist;
            p.x += (dx / dist) * force * 0.45;
            p.y += (dy / dist) * force * 0.45;
            // Flare brightness slightly
            p.alpha = Math.min(1.0, p.baseAlpha + force * 0.4);
          } else {
            // Smoothly ease back to base alpha
            p.alpha += (p.baseAlpha - p.alpha) * 0.05;
          }
        } else {
          p.alpha += (p.baseAlpha - p.alpha) * 0.05;
        }

        // Draw individual particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.shadowBlur = p.radius * 2;
        ctx.shadowColor = "#60a5fa";
        ctx.fill();
        ctx.shadowBlur = 0; // reset shadow
      });

      // Draw Connection Lines between neighboring particles
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.09;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        // Draw connections to mouse
        if (mouse.active) {
          const dx = mouse.x - p1.x;
          const dy = mouse.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouseConnectionDist) {
            const alpha = (1 - dist / mouseConnectionDist) * 0.16;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
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
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ background: "#09090b" }}>
      {/* Dynamic Nebula Aurora Blobs in background layer */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen">
        {/* Nebula 1 — Indigo/Purple orb */}
        <motion.div
          animate={{
            scale: [1, 1.25, 0.95, 1.12, 1],
            x: [0, 80, -40, 30, 0],
            y: [0, -60, 45, -20, 0],
            rotate: [0, 90, 180, 270, 360],
          }}
          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-15%] w-[70vw] h-[70vw] max-w-[850px] max-h-[850px] rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.22), rgba(139,92,246,0.1) 40%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />

        {/* Nebula 2 — Blue/Cyan orb */}
        <motion.div
          animate={{
            scale: [1.1, 0.9, 1.15, 1.0, 1.1],
            x: [0, -90, 50, -30, 0],
            y: [0, 70, -50, 40, 0],
            rotate: [360, 270, 180, 90, 0],
          }}
          transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-15%] right-[-10%] w-[65vw] h-[65vw] max-w-[780px] max-h-[780px] rounded-full"
          style={{
            background: "radial-gradient(circle at 45% 55%, rgba(59,130,246,0.18), rgba(20,184,166,0.08) 45%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />

        {/* Nebula 3 — Violet/Rose center shift */}
        <motion.div
          animate={{
            scale: [0.9, 1.15, 0.88, 1.05, 0.9],
            x: [30, -40, 25, -15, 30],
            y: [-30, 45, -20, 35, -30],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[25%] left-[25%] w-[45vw] h-[45vw] max-w-[550px] max-h-[550px] rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(168,85,247,0.15), rgba(236,72,153,0.06) 50%, transparent 80%)",
            filter: "blur(100px)",
          }}
        />
      </div>

      {/* Constellation Canvas Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 z-10 w-full h-full" />

      {/* Fine-Line Grid Mesh Overlay */}
      <div
        className="absolute inset-0 z-20 opacity-[0.14]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(circle at 50% 40%, black 15%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 40%, black 15%, transparent 85%)",
        }}
      />
    </div>
  );
}
