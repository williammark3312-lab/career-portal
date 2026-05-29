"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Briefcase, ExternalLink, ShieldCheck } from "lucide-react";

export default function Footer() {
  const router = useRouter();

  return (
    <footer className="relative z-10 w-full bg-white/30 backdrop-blur-2xl border-t border-[#E1E6EC] mt-auto overflow-hidden">
      {/* Background illumination meshes */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-25">
        <div className="absolute -left-[10%] -top-[40%] w-[300px] h-[300px] rounded-full bg-[#3279F9] blur-[120px]" />
        <div className="absolute -right-[10%] -bottom-[40%] w-[250px] h-[250px] rounded-full bg-[#7C3AED] blur-[120px]" />
      </div>

      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#3279F9]/30 to-transparent z-10" />

      {/* Sweeping diagonal background light sheen */}
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 z-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
      />

      <div className="relative z-10 w-full max-w-screen-xl mx-auto px-6 sm:px-10 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-[#E1E6EC]/60">
          
          {/* Brand Col */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 group/logo cursor-pointer w-fit" onClick={() => router.push("/")}>
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center relative overflow-hidden shadow-sm border border-white/20 bg-[#1a3bbd]">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] opacity-30"
                />
                <div className="w-[12px] h-[12px] bg-white rounded-[3px] rotate-45 relative z-10 group-hover/logo:rotate-90 transition-transform duration-500" />
              </div>
              <span className="text-[17px] font-bold text-[#121317] tracking-tight group-hover/logo:text-[#3279F9] transition-colors duration-300">
                Careers Portal
              </span>
            </div>
            <p className="text-[13.5px] leading-[1.65] text-[#737A87] max-w-sm font-medium">
              Discover premium career opportunities, collaborate with ambitious teams, and shape the next generation of engineering.
            </p>
          </div>

          {/* Links Col */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[12px] font-extrabold tracking-[0.15em] text-[#121317] uppercase flex items-center gap-1.5">
              Explore
              <span className="w-1.5 h-1.5 rounded-full bg-[#3279F9] shadow-[0_0_8px_#3279F9]" />
            </h4>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/")}
                className="text-[13.5px] font-semibold text-[#737A87] hover:text-[#3279F9] transition-colors text-left cursor-pointer relative group/link w-fit pb-0.5"
              >
                <span>Home</span>
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#3279F9] group-hover/link:w-full transition-all duration-300" />
              </button>
              <button
                onClick={() => router.push("/jobs")}
                className="text-[13.5px] font-semibold text-[#737A87] hover:text-[#3279F9] transition-colors text-left flex items-center gap-1.5 cursor-pointer relative group/link w-fit pb-0.5"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>View Openings</span>
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#3279F9] group-hover/link:w-full transition-all duration-300" />
              </button>
              <a
                href="https://www.linkedin.com/in/anandugirish/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13.5px] font-semibold text-[#737A87] hover:text-[#3279F9] transition-colors flex items-center gap-1.5 relative group/link w-fit pb-0.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>LinkedIn</span>
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#3279F9] group-hover/link:w-full transition-all duration-300" />
              </a>
            </div>
          </div>

          {/* Secure Col */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[12px] font-extrabold tracking-[0.15em] text-[#121317] uppercase flex items-center gap-1.5">
              Secure Access
              <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] shadow-[0_0_8px_#7C3AED]" />
            </h4>
            <div className="w-fit">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 10px 25px -5px rgba(26, 86, 219, 0.3)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/admin")}
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1a3bbd] to-[#3279F9] border border-white/20 text-white shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-white/95 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-[13.5px] font-bold tracking-wide text-white">
                  Admin Dashboard
                </span>
              </motion.button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              <span className="text-[12px] font-semibold text-[#10B981]">
                Protected by Supabase Auth
              </span>
            </div>
          </div>
        </div>

        {/* Bottom copyright and live ticker */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
          <p className="text-[13px] font-bold text-[#737A87]">
            © {new Date().getFullYear()} Careers Portal. All rights reserved.
          </p>
          <div className="flex items-center gap-2 bg-[#10B981]/5 px-3.5 py-1.5 rounded-full border border-[#10B981]/15">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-[#10B981] animate-ping opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-[#10B981]" />
            </span>
            <span className="text-[11px] font-extrabold text-[#10B981] uppercase tracking-[0.08em]">
              Active Recruitment Drive
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
