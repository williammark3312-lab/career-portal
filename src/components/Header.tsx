"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { Briefcase, ExternalLink, ArrowLeft, LogOut, Sun, Moon } from "lucide-react";
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

  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light";
    const active = saved || "light";
    setTheme(active);
    if (active === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  };

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="sticky top-0 z-50 px-4 py-5 pointer-events-none flex justify-center w-full"
    >
      <motion.div
        className="pointer-events-auto relative flex items-center justify-between w-full max-w-4xl rounded-full bg-[var(--nav-bg)] border border-[var(--nav-border)] backdrop-blur-md shadow-2xl px-4 py-2.5"
      >
        {/* Logo Section */}
        <div
          className="relative z-10 flex items-center gap-3 cursor-pointer group px-2"
          onClick={() => router.push(isAdminPage ? "/jobs" : "/")}
        >
          <div className="w-8 h-8 rounded-full bg-[var(--grey-200)] flex items-center justify-center transition-transform group-hover:scale-105 border border-[var(--grey-300)]">
            <div className="w-[12px] h-[12px] bg-[var(--grey-1000)] rounded-[2px] rotate-45" />
          </div>
          <span className="text-[16px] font-semibold text-[var(--grey-1000)] tracking-tight flex items-center gap-1.5">
            <span className="hidden sm:inline">Careers Portal</span>
            <span className="sm:hidden">Careers</span>
            {isAdminPage && <span className="text-[var(--grey-700)] font-normal hidden sm:inline">/ Admin</span>}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="relative z-10 flex items-center gap-1.5 pr-1">
          {isAdminPage ? (
            <>
              <button
                onClick={() => router.push("/jobs")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-medium text-[var(--grey-900)] hover:bg-[var(--grey-200)] hover:text-[var(--grey-1000)] transition-colors"
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-medium text-[var(--grey-900)] hover:bg-[var(--grey-200)] hover:text-[var(--grey-1000)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">All Positions</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => router.push("/jobs")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[14px] font-bold shadow-[0_4px_12px_rgba(50,121,249,0.3)] hover:scale-105 transition-all cursor-pointer"
              >
                <Briefcase className="w-4 h-4" />
                <span className="hidden sm:inline">View Openings</span>
              </button>

              <a
                href="https://www.linkedin.com/in/anandugirish/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-medium text-[var(--grey-800)] hover:text-[var(--grey-1000)] hover:bg-[var(--grey-200)] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">LinkedIn</span>
              </a>
            </div>
          )}

          {/* Premium Theme Toggle Switch */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--grey-200)] border border-[var(--grey-300)] text-[var(--grey-1000)] hover:bg-[var(--grey-300)] transition-all cursor-pointer ml-1.5"
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={theme}
                initial={{ y: -10, opacity: 0, rotate: -45 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                exit={{ y: 10, opacity: 0, rotate: 45 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex items-center justify-center"
              >
                {theme === "dark" ? (
                  <Sun className="w-[17px] h-[17px] text-amber-400" />
                ) : (
                  <Moon className="w-[17px] h-[17px] text-indigo-500" />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.button>
        </nav>
      </motion.div>
    </motion.header>
  );
}
