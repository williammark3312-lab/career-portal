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
    <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] text-[#121317]">
      {/* 3D Background */}
      <GlassBackground />

      {/* Header */}
      <Header />

      {/* Hero */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-28 sm:pt-44 pb-12 sm:pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="glass w-full max-w-3xl rounded-[24px] sm:rounded-[36px] px-5 sm:px-12 py-10 sm:py-16 mx-auto"
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
            className="text-[36px] sm:text-[48px] md:text-[68px] font-medium tracking-[-0.03em] leading-[1.04] mb-6 sm:mb-8 text-gradient"
          >
            Build the Future<br />
            With Us
          </motion.h1>

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
