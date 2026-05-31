"use client";

import { useRouter } from "next/navigation";
import { Lock, Briefcase, ExternalLink } from "lucide-react";

export default function Footer() {
  const router = useRouter();

  return (
    <footer className="relative z-10 w-full bg-white/30 backdrop-blur-xl border-t border-[#E1E6EC] mt-auto">
      <div className="w-full max-w-screen-xl mx-auto px-6 sm:px-10 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand + Copyright */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 cursor-pointer group/logo"
              onClick={() => router.push("/")}
            >
              <div className="w-7 h-7 rounded-full bg-[#1a3bbd] flex items-center justify-center shadow-sm border border-white/20">
                <div className="w-[9px] h-[9px] bg-white rounded-[2px] rotate-45 group-hover/logo:rotate-90 transition-transform duration-500" />
              </div>
              <span className="text-[14px] font-bold text-[#121317] tracking-tight group-hover/logo:text-[#3279F9] transition-colors duration-300">
                Careers Portal
              </span>
            </div>
            <span className="hidden sm:inline text-[12px] text-[#737A87]/60 font-medium">
              · © {new Date().getFullYear()}
            </span>
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-5">
            <button
              onClick={() => router.push("/jobs")}
              className="text-[12.5px] font-semibold text-[#737A87] hover:text-[#3279F9] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Briefcase className="w-3 h-3" />
              Openings
            </button>
            <a
              href="https://www.linkedin.com/in/anandugirish/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12.5px] font-semibold text-[#737A87] hover:text-[#3279F9] transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              LinkedIn
            </a>
            <button
              onClick={() => router.push("/admin")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#1a3bbd] to-[#3279F9] text-white text-[12px] font-bold tracking-wide shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              Admin
            </button>
          </div>

          {/* Mobile-only copyright */}
          <span className="sm:hidden text-[11px] text-[#737A87]/60 font-medium">
            © {new Date().getFullYear()} Careers Portal
          </span>
        </div>
      </div>
    </footer>
  );
}
