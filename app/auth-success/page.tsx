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
        color: "var(--white)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: "100%",
          maxWidth: 440,
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: "56px 48px",
          background: "var(--black-100)",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--white)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 28px",
          }}
        >
          <CheckCircle style={{ width: 28, height: 28, color: "var(--black)" }} strokeWidth={2.5} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{
            fontSize: "clamp(24px, 3vw, 32px)",
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 1.1,
            color: "var(--white)",
            marginBottom: 12,
            fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
          }}
        >
          Authentication Successful
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--fg-muted)",
            marginBottom: 40,
          }}
        >
          You&apos;ve signed in to{" "}
          <strong style={{ color: "var(--white)", fontWeight: 600 }}>{app}</strong>.{" "}
          You may now close this window or continue.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <Link
            href="/"
            className="btn-primary btn-primary-lg"
            style={{ width: "100%", justifyContent: "center", display: "flex", gap: 8 }}
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
