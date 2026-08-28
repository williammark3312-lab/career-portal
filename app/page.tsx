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
    <main className="relative flex flex-col min-h-screen bg-transparent text-white">
      <GlassBackground />
      <Header />

      {/* Hero section */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-xl mx-auto flex flex-col items-center gap-6"
        >
          {/* Faint status indicator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-950/40 text-zinc-400 text-xs font-semibold"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            we are hiring
          </motion.div>

          {/* Heading */}
          <div className="flex flex-col gap-3">
            <h1 className="text-[40px] sm:text-[52px] font-bold tracking-tight text-white leading-none">
              Build the future.
            </h1>
            <p className="text-zinc-450 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
              Join us in creating modern software. Explore our open positions and build your career.
            </p>
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-2"
          >
            <button
              onClick={() => router.push("/jobs")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold text-black bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm"
            >
              <Briefcase className="w-3.5 h-3.5" />
              View Open Positions
            </button>
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </main>
  );
}
