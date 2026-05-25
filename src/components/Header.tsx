"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { Briefcase, ExternalLink, ArrowLeft, LogOut } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

interface HeaderProps {
  session?: Session | null;
  handleLogout?: () => void;
}

export default function Header({ session, handleLogout }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdminPage = pathname?.startsWith("/admin");
  const isJobDetails = pathname?.startsWith("/jobs/") && pathname !== "/jobs";

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="site-nav"
    >
      <div className="site-nav-inner">
        {/* Logo */}
        <button
          onClick={() => router.push(isAdminPage ? "/jobs" : "/")}
          className="site-nav-logo"
        >
          <span className="site-nav-logo-dot" />
          {isAdminPage ? (
            <span>
              Careers <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>/ Admin</span>
            </span>
          ) : (
            "Careers"
          )}
        </button>

        {/* Desktop Nav */}
        <nav className="site-nav-links">
          {isAdminPage ? (
            <>
              <button
                onClick={() => router.push("/jobs")}
                className="site-nav-link"
              >
                <ArrowLeft style={{ width: 14, height: 14 }} />
                Back to site
              </button>
              {session && handleLogout && (
                <button
                  onClick={handleLogout}
                  className="site-nav-link"
                  style={{ color: "#f87171" }}
                >
                  <LogOut style={{ width: 14, height: 14 }} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              )}
            </>
          ) : isJobDetails ? (
            <button
              onClick={() => router.push("/jobs")}
              className="site-nav-link"
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              All Positions
            </button>
          ) : (
            <>
              <a
                href="https://www.linkedin.com/in/anandugirish/"
                target="_blank"
                rel="noopener noreferrer"
                className="site-nav-link hidden sm:flex"
              >
                LinkedIn
                <ExternalLink style={{ width: 12, height: 12 }} />
              </a>

              <button
                onClick={() => router.push("/jobs")}
                className="btn-primary"
                style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 600 }}
              >
                <Briefcase style={{ width: 13, height: 13 }} />
                View Openings
              </button>
            </>
          )}
        </nav>
      </div>
    </motion.header>
  );
}
