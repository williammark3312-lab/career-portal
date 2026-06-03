"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";
import Header from "../src/components/Header";
import Footer from "../src/components/Footer";
import GlassBackground from "../src/components/GlassBackground";

export default function Home() {
  const router = useRouter();

  return (
    <main className="relative flex flex-col min-h-screen bg-[#09090b] text-white">
      <GlassBackground />
      <Header />

      {/* Hero — vertically centred, no padding waste */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl mx-auto rounded-[24px] sm:rounded-[36px] px-6 sm:px-12 py-10 sm:py-14"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* We're Hiring pill */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-7 px-4 py-1.5 rounded-full border border-white/10 bg-white/6 text-zinc-300 text-[13px] font-semibold"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            We&apos;re Hiring
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="text-[36px] sm:text-[48px] md:text-[64px] font-bold tracking-[-0.04em] leading-[1.04] mb-7 text-white"
          >
            Build the Future<br />
            <span style={{ background: "linear-gradient(135deg, #60a5fa 0%, #818cf8 60%, #c084fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              With Us
            </span>
          </motion.h1>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            <button
              onClick={() => router.push("/jobs")}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[14px] font-bold text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", boxShadow: "0 8px 24px -4px rgba(99,102,241,0.45)" }}
            >
              <Briefcase className="w-4 h-4" />
              View Open Positions
            </button>
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </main>
  );
}
