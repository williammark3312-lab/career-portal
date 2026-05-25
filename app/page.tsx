"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, MapPin, Zap } from "lucide-react";
import Header from "../src/components/Header";

const features = [
  {
    icon: <Zap style={{ width: 18, height: 18, color: "var(--fg-muted)" }} />,
    title: "Move fast",
    description:
      "Work in small, autonomous teams that ship meaningful products without bureaucracy.",
  },
  {
    icon: <Briefcase style={{ width: 18, height: 18, color: "var(--fg-muted)" }} />,
    title: "Own your work",
    description:
      "Take full ownership from concept to production. Your fingerprints on what ships.",
  },
  {
    icon: <MapPin style={{ width: 18, height: 18, color: "var(--fg-muted)" }} />,
    title: "Work anywhere",
    description:
      "Remote-first culture with optional in-person collaboration. You set your environment.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

export default function Home() {
  const router = useRouter();

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "transparent",
        color: "var(--white)",
      }}
    >
      <Header />

      {/* ── Hero ── */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "120px 40px 80px",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Subtle vignette glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 40% at 50% 60%, rgba(255,255,255,0.03), transparent)",
            pointerEvents: "none",
          }}
        />

        <motion.div
          initial="hidden"
          animate="show"
          variants={container}
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 760,
            width: "100%",
          }}
        >
          {/* Tag */}
          <motion.div variants={item} style={{ marginBottom: 32 }}>
            <span className="hero-tag">
              <span className="pulse-dot" />
              We&apos;re Hiring
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={item}
            style={{
              fontSize: "clamp(56px, 9vw, 100px)",
              fontWeight: 700,
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              color: "var(--white)",
              marginBottom: 24,
              fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
            }}
          >
            Build the future.{" "}
            <span style={{ color: "var(--grey-600)" }}>With us.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={item}
            style={{
              fontSize: "17px",
              lineHeight: 1.7,
              color: "var(--fg-muted)",
              maxWidth: 480,
              margin: "0 auto 48px",
            }}
          >
            Join a team of builders obsessed with craft. We make products people
            actually love.
          </motion.p>

          {/* CTA */}
          <motion.div
            variants={item}
            style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
          >
            <button
              onClick={() => router.push("/jobs")}
              className="btn-primary btn-primary-lg"
            >
              View open positions
              <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
            <a
              href="https://www.linkedin.com/in/anandugirish/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-secondary-lg"
            >
              LinkedIn
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Divider ── */}
      <div className="section-divider" />

      {/* ── Why Join Us ── */}
      <section
        style={{
          padding: "80px 40px",
          maxWidth: 1280,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: 56 }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
              marginBottom: 16,
            }}
          >
            Why join us
          </p>
          <h2
            style={{
              fontSize: "clamp(32px, 4vw, 52px)",
              fontWeight: 700,
              letterSpacing: "-0.035em",
              color: "var(--white)",
              lineHeight: 1.05,
            }}
          >
            Built different.
          </h2>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 1,
            border: "1px solid var(--border)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                padding: "40px 36px",
                background: "var(--black-100)",
                borderRight: i < features.length - 1 ? "1px solid var(--border)" : "none",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--black-200)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  color: "var(--white)",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: "var(--fg-muted)",
                }}
              >
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section
        style={{
          padding: "0 40px 80px",
          maxWidth: 1280,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "60px 48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 32,
            flexWrap: "wrap",
            background: "var(--black-100)",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 36px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--white)",
                marginBottom: 8,
              }}
            >
              Ready to apply?
            </h2>
            <p style={{ fontSize: 15, color: "var(--fg-muted)" }}>
              Browse all open roles and find where you fit.
            </p>
          </div>
          <button
            onClick={() => router.push("/jobs")}
            className="btn-primary btn-primary-lg"
          >
            See open positions
            <ArrowRight style={{ width: 16, height: 16 }} />
          </button>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>© {new Date().getFullYear()} Careers Portal</p>
          <div className="site-footer-links">
            <a href="/jobs">Careers</a>
            <a href="https://www.linkedin.com/in/anandugirish/" target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
