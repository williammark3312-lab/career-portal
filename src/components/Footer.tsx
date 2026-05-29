"use client";

import { useRouter } from "next/navigation";
import { Lock, Briefcase, ExternalLink, ShieldCheck } from "lucide-react";

export default function Footer() {
  const router = useRouter();

  return (
    <footer className="relative z-10 w-full bg-white/20 backdrop-blur-xl border-t border-[#E1E6EC] mt-auto">
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#3279F9]/20 to-transparent" />

      <div className="w-full max-w-screen-xl mx-auto px-6 sm:px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-[#E1E6EC]/60">
          {/* Brand Col */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1a3bbd] flex items-center justify-center">
                <div className="w-[10px] h-[10px] bg-white rounded-[2px] rotate-45" />
              </div>
              <span className="text-[16px] font-bold text-[#121317] tracking-tight">
                Careers Portal
              </span>
            </div>
            <p className="text-[13.5px] leading-[1.6] text-[#737A87] max-w-sm">
              Discover premium career opportunities, collaborate with ambitious teams, and shape the next generation of engineering.
            </p>
          </div>

          {/* Links Col */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[12px] font-bold tracking-[0.1em] text-[#121317] uppercase">
              Explore
            </h4>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.push("/")}
                className="text-[13.5px] font-medium text-[#737A87] hover:text-[#3279F9] transition-colors text-left cursor-pointer"
              >
                Home
              </button>
              <button
                onClick={() => router.push("/jobs")}
                className="text-[13.5px] font-medium text-[#737A87] hover:text-[#3279F9] transition-colors text-left flex items-center gap-1.5 cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5" />
                View Openings
              </button>
              <a
                href="https://www.linkedin.com/in/anandugirish/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13.5px] font-medium text-[#737A87] hover:text-[#3279F9] transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                LinkedIn
              </a>
            </div>
          </div>

          {/* Secure Col */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[12px] font-bold tracking-[0.1em] text-[#121317] uppercase">
              Secure
            </h4>
            <div>
              <button
                onClick={() => router.push("/admin")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E1E6EC] shadow-sm hover:border-[#3279F9] hover:text-[#3279F9] hover:shadow-md transition-all duration-300 group cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-[#737A87] group-hover:text-[#3279F9] transition-colors" />
                <span className="text-[13px] font-semibold text-[#121317] group-hover:text-[#3279F9] transition-colors">
                  Admin Dashboard
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              <span className="text-[12px] font-medium text-[#10B981]">
                Protected by Supabase Auth
              </span>
            </div>
          </div>
        </div>

        {/* Bottom copyright and live ticker */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
          <p className="text-[12.5px] font-medium text-[#737A87]">
            © {new Date().getFullYear()} Careers Portal. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-[#10B981] animate-ping opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-[#10B981]" />
            </span>
            <span className="text-[11px] font-bold text-[#10B981] uppercase tracking-[0.05em]">
              Active Recruitment Drive
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
