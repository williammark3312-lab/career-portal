"use client";

import { motion } from "framer-motion";
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

  const isAdminPage = pathname?.startsWith("/admin");
  const isJobDetails = pathname?.startsWith("/jobs/") && pathname !== "/jobs";

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="sticky top-0 z-50 px-4 py-5 pointer-events-none flex justify-center w-full"
    >
      <motion.div
        className="pointer-events-auto relative flex items-center justify-between w-full max-w-4xl rounded-full bg-[rgba(26,56,179,0.88)] backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_-4px_rgba(26,86,219,0.4)] px-5 py-3 overflow-hidden"
        whileHover={{ boxShadow: "0 12px 40px -4px rgba(26,86,219,0.6)", borderColor: "rgba(255,255,255,0.3)" }}
      >
        {/* Animated sheen effect sweeping across the pill */}
        <motion.div
          animate={{ x: ["-200%", "300%"] }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
          className="absolute inset-0 z-0 w-1/3 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
        />

        {/* Logo Section */}
        <div
          className="relative z-10 flex items-center gap-3 cursor-pointer group"
          onClick={() => router.push(isAdminPage ? "/jobs" : "/")}
        >
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/25 transition-all duration-300 relative overflow-hidden">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] opacity-30"
            />
            <div className="w-[14px] h-[14px] bg-white rounded-[4px] rotate-45 group-hover:rotate-90 transition-transform duration-500 relative z-10" />
          </div>
          <span className="text-[16px] font-bold text-white tracking-tight flex items-center gap-1.5">
            Careers Portal
            {isAdminPage && <span className="text-white/50 font-normal">/ Admin</span>}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="relative z-10 flex items-center gap-1.5">
          {isAdminPage ? (
            <>
              <button
                onClick={() => router.push("/jobs")}
                className="group relative flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium text-white/75 hover:text-white transition-colors overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-full" />
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to site
              </button>
              {session && handleLogout && (
                <button
                  onClick={handleLogout}
                  className="group relative flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium text-red-300 hover:text-red-200 transition-colors overflow-hidden ml-2"
                >
                  <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/15 transition-colors rounded-full" />
                  <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Sign out
                </button>
              )}
            </>
          ) : isJobDetails ? (
            <button
              onClick={() => router.push("/jobs")}
              className="group relative flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium text-white/75 hover:text-white transition-colors overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-full" />
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              All Positions
            </button>
          ) : (
            <>
              {/* Active Tab Background Animation */}
              <div className="relative flex items-center gap-1">
                <button
                  onClick={() => router.push("/jobs")}
                  className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium transition-colors ${
                    pathname === "/jobs" ? "text-[#1a3bbd]" : "text-white/75 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {pathname === "/jobs" && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white rounded-full -z-10 shadow-sm"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                  <Briefcase className="w-4 h-4" />
                  View Openings
                </button>

                <a
                  href="https://www.linkedin.com/in/anandugirish/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium text-white/75 hover:text-white transition-colors overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-full" />
                  <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  LinkedIn
                </a>
              </div>
            </>
          )}
        </nav>
      </motion.div>
    </motion.header>
  );
}
