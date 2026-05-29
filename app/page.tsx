"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, ContactShadows, MeshTransmissionMaterial } from "@react-three/drei";
import { Briefcase } from "lucide-react";
import Header from "../src/components/Header";
import Footer from "../src/components/Footer";
import { supabase } from "../src/lib/supabase";

/* —— Same ring as jobs/admin pages —— */
function FloatingRing() {
  return (
    <Float speed={1.8} rotationIntensity={0.9} floatIntensity={1.2}>
      <mesh rotation={[0.5, -0.5, 0]}>
        <torusGeometry args={[2, 0.45, 64, 128]} />
        <MeshTransmissionMaterial
          backside samples={6} thickness={0.6}
          chromaticAberration={0.08} anisotropy={0.5}
          distortion={0.12} distortionScale={0.2}
          temporalDistortion={0.03} clearcoat={1}
          clearcoatRoughness={0.05} color="#1a3bbd"
          transmission={0.55} roughness={0.05}
          resolution={1024}
        />
      </mesh>
    </Float>
  );
}

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<{ jobsCount: number; deptsCount: number } | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase.from("jobs").select("id, department");
        if (!error && data) {
          const depts = new Set(data.map((j) => j.department).filter(Boolean));
          setStats({
            jobsCount: data.length,
            deptsCount: depts.size,
          });
        }
      } catch (err) {
        console.error("Error fetching homepage stats:", err);
      }
    }
    fetchStats();
  }, []);

  return (
    <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] text-[#121317]">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-55">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
          <directionalLight position={[-8, -8, -4]} intensity={1.2} color="#3279F9" />
          <Suspense fallback={null}>
            <FloatingRing />
            <Environment preset="city" />
            <ContactShadows position={[0, -2.5, 0]} opacity={0.2} scale={16} blur={3} color="#737A87" />
          </Suspense>
        </Canvas>
      </div>

      {/* Header */}
      <Header />

      {/* Hero */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-44 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="glass w-full max-w-3xl rounded-[36px] px-12 py-16 mx-auto"
        >
          {/* We're Hiring pill */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-8 px-5 py-2 rounded-full border border-[rgba(50,121,249,0.2)] bg-[rgba(50,121,249,0.08)] text-[#3279F9] text-[13px] font-semibold"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-[#3279F9] animate-ping opacity-70" />
              <span className="relative h-2 w-2 rounded-full bg-[#3279F9]" />
            </span>
            We&apos;re Hiring
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="text-[48px] md:text-[68px] font-medium tracking-[-0.03em] leading-[1.04] mb-8 text-gradient"
          >
            Build the Future<br />
            With Us
          </motion.h1>

          {/* Dynamic Stats Dashboard Card */}
          {stats && stats.jobsCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.38, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row items-center justify-center gap-8 md:gap-12 py-4 px-8 mb-10 rounded-2xl bg-white/40 border border-[#E1E6EC] backdrop-blur-md w-fit mx-auto shadow-[0_4px_20px_-4px_rgba(18,19,23,0.04)]"
            >
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-bold tracking-widest text-[#737A87] uppercase">Active Openings</span>
                <span className="text-[26px] font-bold text-[#1a3bbd] tracking-tight flex items-baseline gap-1.5 leading-none mt-1">
                  {stats.jobsCount}
                  <span className="relative flex h-2 w-2 mb-1">
                    <span className="absolute inset-0 rounded-full bg-[#10B981] animate-ping opacity-75" />
                    <span className="relative h-2 w-2 rounded-full bg-[#10B981]" />
                  </span>
                </span>
              </div>
              <div className="hidden sm:block w-[1px] h-8 bg-[#E1E6EC]" />
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-bold tracking-widest text-[#737A87] uppercase">Departments</span>
                <span className="text-[26px] font-bold text-[#7C3AED] tracking-tight leading-none mt-1">
                  {stats.deptsCount}
                </span>
              </div>
              <div className="hidden sm:block w-[1px] h-8 bg-[#E1E6EC]" />
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-bold tracking-widest text-[#737A87] uppercase">Work Culture</span>
                <span className="text-[12px] font-bold text-white px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#3279F9] to-[#1a3bbd] shadow-[0_2px_10px_-2px_rgba(50,121,249,0.3)] mt-1">
                  Hybrid / Remote
                </span>
              </div>
            </motion.div>
          )}

          {/* Single CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="flex items-center justify-center"
          >
            <button onClick={() => router.push("/jobs")} className="btn-primary">
              <Briefcase className="w-4 h-4" />
              View Open Positions
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
