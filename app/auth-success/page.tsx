"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function AbstractShape() {
  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh rotation={[-0.5, 0.5, 0]}>
        <torusKnotGeometry args={[1, 0.3, 128, 32]} />
        <meshPhysicalMaterial 
          transmission={0.95} 
          opacity={1} 
          transparent 
          roughness={0.1} 
          thickness={1} 
          ior={1.5}
          color="#ffffff" 
          clearcoat={1} 
          clearcoatRoughness={0.1}
        />
      </mesh>
    </Float>
  );
}

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const app = searchParams.get("app") || "Antigravity";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--fg)] font-sans selection:bg-[#3279F9]/30">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: "high-performance" }} style={{ pointerEvents: "none" }}>
          <ambientLight intensity={1} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
          <directionalLight position={[-10, -10, -5]} intensity={1} color="#3279F9" />
          <Suspense fallback={null}>
            <AbstractShape />
            <Environment preset="city" />
            <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={10} blur={2} far={4} color="#B2BBC5" />
          </Suspense>
        </Canvas>
      </div>

      {/* Glassmorphism Card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.8,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative z-10 mx-4 flex w-full max-w-[480px] flex-col items-center overflow-hidden rounded-[24px] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-10 text-center shadow-[var(--shadow)] backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.2,
            type: "spring",
            stiffness: 200,
            damping: 20,
          }}
          className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#3279F9]/10 text-[#3279F9]"
        >
          <CheckCircle className="h-10 w-10" strokeWidth={2.5} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-3 text-[32px] font-medium leading-[1.1] tracking-[-0.02em] text-[var(--fg)]"
        >
          Authentication Successful
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mb-10 text-[17.5px] leading-[1.45] tracking-[0.01em] text-[var(--muted)]"
        >
          You have successfully signed in to{" "}
          <strong className="font-medium text-[var(--fg)]">{app}</strong>. You may
          now close this window or continue to the application.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="w-full"
        >
          <Link href="/" className="group flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--blue-500)] px-6 py-4 text-[16px] font-medium text-white transition-all duration-300 hover:bg-[var(--blue-600)] hover:shadow-[0_8px_16px_-4px_rgba(50,121,249,0.3)] active:scale-[0.98]">
            Continue to {app}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}>
      <AuthSuccessContent />
    </Suspense>
  );
}
