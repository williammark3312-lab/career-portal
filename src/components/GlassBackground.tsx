"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
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

    // Initialize Particles
    const particles: Particle[] = [];
    const particleCount = Math.min(Math.floor((window.innerWidth * window.innerHeight) / 13000), 90);
    const colors = [
      "rgba(99, 102, 241, 0.6)", // Indigo
      "rgba(168, 85, 247, 0.6)", // Purple
      "rgba(6, 182, 212, 0.6)",  // Cyan
      "rgba(251, 191, 36, 0.4)"  // Amber
    ];

    for (let i = 0; i < particleCount; i++) {
      const radius = Math.random() * 1.8 + 0.8;
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: radius,
        baseRadius: radius,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    // Animation Loop
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const mouse = mouseRef.current;

      // Update and Draw Particles
      particles.forEach((p) => {
        // Apply velocity
        p.x += p.vx;
        p.y += p.vy;

        // Mouse Proximity Interaction (Repulsion gravity well)
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 160;

          if (dist < maxDist) {
            const force = (maxDist - dist) / maxDist;
            const angle = Math.atan2(dy, dx);
            
            // Push particle away gently
            p.x += Math.cos(angle) * force * 1.5;
            p.y += Math.sin(angle) * force * 1.5;
            
            // Pulse particle radius on hover
            p.radius = p.baseRadius * (1 + force * 0.8);
          } else {
            p.radius = p.baseRadius;
          }
        } else {
          p.radius = p.baseRadius;
        }

        // Screen boundary collisions (wrap or bounce)
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > w) { p.x = w; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > h) { p.y = h; p.vy *= -1; }

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Node aura glow
        if (p.radius > p.baseRadius) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#60a5fa";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        }
      });

      // Draw Proximity Connections (Constellation lines)
      ctx.lineWidth = 0.5;
      const connectionLimit = 110;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionLimit) {
            // Compute opacity based on distance
            const alpha = (1 - dist / connectionLimit) * 0.16;

            // Highlight connections near cursor
            let isNearMouse = false;
            if (mouse.active) {
              const mx1 = p1.x - mouse.x;
              const my1 = p1.y - mouse.y;
              const md1 = Math.sqrt(mx1 * mx1 + my1 * my1);
              if (md1 < 120) {
                isNearMouse = true;
              }
            }

            // Create gradient line between nodes
            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            const baseOpacity = isNearMouse ? alpha * 2.2 : alpha;
            grad.addColorStop(0, p1.color.replace("0.6", baseOpacity.toString()));
            grad.addColorStop(1, p2.color.replace("0.6", baseOpacity.toString()));

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = isNearMouse ? 0.75 : 0.45;
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
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ background: "#050507" }}>
      {/* Background Ambient Cosmic Nebulas */}
      <div className="absolute inset-0 z-0 opacity-25 mix-blend-screen">
        {/* Nebula 1 — Deep purple/indigo blob */}
        <motion.div
          animate={{
            scale: [1, 1.15, 0.95, 1.08, 1],
            x: [0, 30, -20, 15, 0],
            y: [0, -30, 20, -10, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-5%] w-[80vw] h-[80vw] max-w-[900px] max-h-[900px] rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.18), rgba(168,85,247,0.06) 45%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />

        {/* Nebula 2 — Emerald/Cyan ambient bloom */}
        <motion.div
          animate={{
            scale: [1.1, 0.95, 1.12, 1.0, 1.1],
            x: [0, -40, 30, -15, 0],
            y: [0, 40, -30, 20, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-15%] right-[-10%] w-[75vw] h-[75vw] max-w-[850px] max-h-[850px] rounded-full"
          style={{
            background: "radial-gradient(circle at 45% 55%, rgba(6,182,212,0.14), rgba(99,102,241,0.05) 50%, transparent 75%)",
            filter: "blur(95px)",
          }}
        />
      </div>

      {/* Grid Canvas Rendered Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 z-10 w-full h-full" />

      {/* Subtle vignettes overlay */}
      <div className="absolute inset-0 z-20" style={{
        background: "radial-gradient(circle at 50% 50%, transparent 30%, rgba(5,5,7,0.85) 100%)"
      }} />
    </div>
  );
}
