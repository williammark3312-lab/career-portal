"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { Briefcase, ExternalLink, ArrowLeft, LogOut, Lock, Menu, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import DigitalClock from "./DigitalClock";

interface HeaderProps {
  session?: Session | null;
  handleLogout?: () => void;
  activeAdminTab?: string;
  onAdminTabChange?: (tab: string) => void;
}

export default function Header({ session, handleLogout, activeAdminTab, onAdminTabChange }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdminPage = pathname?.startsWith("/admin");
  const isWorkspace = pathname === "/admin/workspace";
  const isJobDetails = pathname?.startsWith("/jobs/") && pathname !== "/jobs";

  const currentAdminTab = isWorkspace ? "workspace" : (activeAdminTab || "cvs");

  const handleTabClick = (tabKey: string) => {
    if (tabKey === "workspace") {
      router.push("/admin/workspace");
    } else {
      if (pathname !== "/admin") {
        router.push(`/admin?tab=${tabKey}`);
      } else if (onAdminTabChange) {
        onAdminTabChange(tabKey);
      }
    }
  };

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="sticky top-0 z-50 px-3 sm:px-4 py-4 sm:py-5 pointer-events-none flex justify-center w-full"
      style={{ zIndex: 100 }}
    >
      <motion.div
        className="pointer-events-auto relative flex items-center justify-between w-full max-w-4xl rounded-full bg-[rgba(15,15,17,0.92)] backdrop-blur-2xl border border-white/8 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5)] px-4 sm:px-5 py-2.5 sm:py-3 overflow-hidden"
        whileHover={{ boxShadow: "0 12px 40px -4px rgba(0,0,0,0.7)", borderColor: "rgba(255,255,255,0.15)" }}
      >
        {/* Animated sheen effect sweeping across the pill */}
        <motion.div
          animate={{ x: ["-200%", "300%"] }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
          className="absolute inset-0 z-0 w-1/3 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
        />

        {/* Logo & Clock Section */}
        <div className="relative z-10 flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
            onClick={() => router.push(isAdminPage ? "/jobs" : "/")}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/25 transition-all duration-300 relative overflow-hidden">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] opacity-30"
              />
              <div className="w-[12px] h-[12px] sm:w-[14px] sm:h-[14px] bg-white rounded-[4px] rotate-45 group-hover:rotate-90 transition-transform duration-500 relative z-10" />
            </div>
            <span className="text-[14px] sm:text-[16px] font-bold text-white tracking-tight flex items-center gap-1.5">
              Careers Portal
              {isAdminPage && <span className="text-white/50 font-normal hidden sm:inline">/ Admin</span>}
            </span>
          </div>

          <div className="hidden sm:block ml-1">
            <DigitalClock />
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="relative z-10 hidden md:flex items-center gap-1">
          {isAdminPage ? (
            <div className="flex items-center gap-1">
              {session && (
                <div className="flex items-center gap-1 mr-2 bg-zinc-950/60 p-1 rounded-full border border-white/5">
                  {([
                    { key: "cvs", label: "Talent Index" },
                    { key: "workspace", label: "Workspace" },
                    { key: "users", label: "Supervisors" },
                  ] as const).map((t) => {
                    const isActive = currentAdminTab === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => handleTabClick(t.key)}
                        className={`relative z-10 px-3 py-1 rounded-full text-[11.5px] font-bold transition-colors cursor-pointer ${
                          isActive ? "text-black" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeAdminNavTab"
                            className="absolute inset-0 bg-white rounded-full -z-10 shadow-sm"
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          />
                        )}
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => router.push("/jobs")}
                className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium text-white/75 hover:text-white transition-colors overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-full" />
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                Back to site
              </button>
              {session && handleLogout && (
                <button
                  onClick={handleLogout}
                  className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium text-red-300 hover:text-red-200 transition-colors overflow-hidden ml-1"
                >
                  <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/15 transition-colors rounded-full" />
                  <LogOut className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  Sign out
                </button>
              )}
            </div>
          ) : isJobDetails ? (
            <div className="relative flex items-center gap-1">
              <button
                onClick={() => router.push("/jobs")}
                className="group relative flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium text-white/75 hover:text-white transition-colors overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-full" />
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                All Positions
              </button>

              <button
                onClick={() => router.push("/admin")}
                className="group relative flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium text-white/75 hover:text-white transition-colors overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-full" />
                <Lock className="w-3.5 h-3.5" />
                Admin
              </button>
            </div>
          ) : (
            <>
              {/* Active Tab Background Animation */}
              <div className="relative flex items-center gap-1">
                <button
                  onClick={() => router.push("/jobs")}
                  className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium transition-colors ${
                    pathname === "/jobs" ? "text-black" : "text-white/75 hover:text-white hover:bg-white/10"
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

                <button
                  onClick={() => router.push("/admin")}
                  className="group relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium text-white/75 hover:text-white transition-colors overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-full" />
                  <Lock className="w-3.5 h-3.5" />
                  Admin
                </button>
              </div>
            </>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="relative z-10 md:hidden flex items-center justify-center w-8 h-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </motion.div>

      {/* Mobile Dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto absolute top-full left-3 right-3 mt-2 rounded-2xl bg-[rgba(15,15,17,0.97)] backdrop-blur-2xl border border-white/8 shadow-[0_12px_40px_-4px_rgba(0,0,0,0.6)] p-3 md:hidden z-50"
          >
            <div className="flex flex-col gap-1">
              {isAdminPage ? (
                <>
                  {session && (
                    <div className="flex flex-col gap-1 pb-2 mb-2 border-b border-white/10">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase px-3 pt-1">Admin Sections</span>
                      <button
                        onClick={() => { handleTabClick("cvs"); setMobileOpen(false); }}
                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[14px] font-semibold transition-colors ${
                          currentAdminTab === "cvs" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
                        }`}
                      >
                        Talent Index
                      </button>
                      <button
                        onClick={() => { handleTabClick("workspace"); setMobileOpen(false); }}
                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[14px] font-semibold transition-colors ${
                          currentAdminTab === "workspace" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
                        }`}
                      >
                        Workspace Desk
                      </button>
                      <button
                        onClick={() => { handleTabClick("users"); setMobileOpen(false); }}
                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[14px] font-semibold transition-colors ${
                          currentAdminTab === "users" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
                        }`}
                      >
                        Supervisors
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => { router.push("/jobs"); setMobileOpen(false); }}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[14px] font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to site
                  </button>
                  {session && handleLogout && (
                    <button
                      onClick={() => { handleLogout(); setMobileOpen(false); }}
                      className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[14px] font-medium text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => { router.push("/jobs"); setMobileOpen(false); }}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[14px] font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Briefcase className="w-4 h-4" />
                    View Openings
                  </button>
                  <a
                    href="https://www.linkedin.com/in/anandugirish/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[14px] font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    LinkedIn
                  </a>
                  <button
                    onClick={() => { router.push("/admin"); setMobileOpen(false); }}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[14px] font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Lock className="w-4 h-4" />
                    Admin
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
