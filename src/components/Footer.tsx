"use client";

import { useRouter } from "next/navigation";
import { Lock, Briefcase, ExternalLink } from "lucide-react";

export default function Footer() {
  const router = useRouter();

  return (
    <footer className="relative z-10 w-full mt-auto" style={{ background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="w-full max-w-screen-xl mx-auto px-6 sm:px-10 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand + Copyright */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 cursor-pointer group/logo" onClick={() => router.push("/")}>
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shadow-sm border border-white/10">
                <div className="w-[9px] h-[9px] bg-white rounded-[2px] rotate-45 group-hover/logo:rotate-90 transition-transform duration-500" />
              </div>
              <span className="text-[14px] font-bold text-zinc-300 tracking-tight group-hover/logo:text-white transition-colors duration-300">
                Careers Portal
              </span>
            </div>
            <span className="hidden sm:inline text-[12px] text-zinc-600 font-medium">
              · © {new Date().getFullYear()}
            </span>
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-5">
            <button
              onClick={() => router.push("/jobs")}
              className="text-[12.5px] font-semibold text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Briefcase className="w-3 h-3" />
              Openings
            </button>
            <a
              href="https://www.linkedin.com/in/anandugirish/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12.5px] font-semibold text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              LinkedIn
            </a>
            <button
              onClick={() => router.push("/admin")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/8 border border-white/10 text-zinc-300 text-[12px] font-bold tracking-wide hover:bg-white/12 hover:text-white transition-all duration-200 cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              Admin
            </button>
          </div>

          {/* Mobile copyright */}
          <span className="sm:hidden text-[11px] text-zinc-600 font-medium">
            © {new Date().getFullYear()} Careers Portal
          </span>
        </div>
      </div>
    </footer>
  );
}
