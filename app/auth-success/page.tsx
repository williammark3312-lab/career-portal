"use client";

import React, { Suspense } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GlassBackground from "../../src/components/GlassBackground";

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const app = searchParams.get("app") || "Antigravity";

  return (
    <div className="relative flex flex-col min-h-screen bg-[#000000] text-white flex items-center justify-center p-6 relative overflow-hidden">
      <GlassBackground />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[440px] bg-zinc-900 border border-zinc-800/80 rounded-[24px] p-10 sm:p-12 text-center shadow-2xl shadow-black/50"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 16 }}
          className="w-14 h-14 rounded-full bg-emerald-950/30 border border-emerald-900/50 flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle className="w-[26px] h-[26px] text-emerald-450" strokeWidth={2.5} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3"
        >
          Authentication Successful
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-sm text-zinc-400 leading-relaxed mb-9 font-medium"
        >
          You&apos;ve successfully signed in to{" "}
          <strong className="text-blue-400 font-bold">{app}</strong>.{" "}
          You may now close this window or continue to your workspace.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <Link
            href="/"
            className="w-full py-3 px-6 rounded-xl font-bold text-xs text-zinc-950 bg-white hover:bg-zinc-100 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            Continue to {app}
            <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#000000]" />}>
      <AuthSuccessContent />
    </Suspense>
  );
}
