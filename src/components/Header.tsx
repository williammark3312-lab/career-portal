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
        className="pointer-events-auto relative flex items-center justify-between w-full max-w-4xl rounded-full bg-[#3B54C4] shadow-lg px-4 py-2.5"
      >
        {/* Logo Section */}
        <div
          className="relative z-10 flex items-center gap-3 cursor-pointer group px-2"
          onClick={() => router.push(isAdminPage ? "/jobs" : "/")}
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:scale-105">
            <div className="w-[12px] h-[12px] bg-white rounded-[2px] rotate-45" />
          </div>
          <span className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-1.5">
            <span className="hidden sm:inline">Careers Portal</span>
            <span className="sm:hidden">Careers</span>
            {isAdminPage && <span className="text-white/70 font-normal hidden sm:inline">/ Admin</span>}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="relative z-10 flex items-center gap-1.5 pr-1">
          {isAdminPage ? (
            <>
              <button
                onClick={() => router.push("/jobs")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-medium text-white/90 hover:bg-white/10 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to site</span>
              </button>
              {session && handleLogout && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-medium text-white bg-red-500/20 hover:bg-red-500/30 transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              )}
            </>
          ) : isJobDetails ? (
            <button
              onClick={() => router.push("/jobs")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-medium text-white/90 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">All Positions</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/jobs")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#3B54C4] text-[14px] font-medium transition-transform hover:scale-105 shadow-sm"
              >
                <Briefcase className="w-4 h-4" />
                <span className="hidden sm:inline">View Openings</span>
              </button>

              <a
                href="https://www.linkedin.com/in/anandugirish/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-medium text-white hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">LinkedIn</span>
              </a>
            </div>
          )}
        </nav>
      </motion.div>
    </motion.header>
  );
}
