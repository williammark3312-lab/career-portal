"use client";

import React, { Suspense } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const app = searchParams.get("app") || "Antigravity";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        color: "var(--neutral-900)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: "100%",
          maxWidth: 440,
          border: "1px solid rgba(0, 0, 0, 0.08)",
          borderRadius: 24,
          padding: "52px 40px",
          background: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(20px) saturate(180%)",
          textAlign: "center",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.03)",
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 16 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(30, 142, 62, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            border: "1px solid rgba(30, 142, 62, 0.2)",
          }}
        >
          <CheckCircle style={{ width: 26, height: 26, color: "var(--google-green, #1e8e3e)" }} strokeWidth={2.5} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          style={{
            fontSize: "clamp(22px, 3vw, 28px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: "var(--neutral-900)",
            marginBottom: 12,
            fontFamily: '"Google Sans", "DM Sans", sans-serif',
          }}
        >
          Authentication Successful
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          style={{
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "var(--neutral-600)",
            marginBottom: 36,
            fontWeight: 500,
          }}
        >
          You&apos;ve successfully signed in to{" "}
          <strong style={{ color: "var(--google-blue, #1a73e8)", fontWeight: 600 }}>{app}</strong>.{" "}
          You may now close this window or continue to your workspace.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <Link
            href="/"
            style={{
              width: "100%",
              justifyContent: "center",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 24,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              border: "none",
              color: "#ffffff",
              background: "var(--google-blue, #1a73e8)",
              boxShadow: "0 2px 4px rgba(26, 115, 232, 0.15)",
              textDecoration: "none",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(26, 115, 232, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 115, 232, 0.15)";
            }}
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
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "transparent" }} />}>
      <AuthSuccessContent />
    </Suspense>
  );
}
