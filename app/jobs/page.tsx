"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import { ArrowRight, MapPin, Briefcase, Search, X, Sparkles } from "lucide-react";
import Header from "../../src/components/Header";
import Footer from "../../src/components/Footer";
import GlassBackground from "../../src/components/GlassBackground";

type Job = {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
};

function Card3D({
  children, className = "", onClick, delay = 0,
}: {
  children: React.ReactNode; className?: string; onClick?: () => void; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const rx = ((e.clientY - r.top  - r.height / 2) / (r.height / 2)) * -4;
    const ry = ((e.clientX - r.left - r.width  / 2) / (r.width  / 2)) *  4;
    el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.01,1.01,1.01)`;
  }
  function onMouseLeave() {
    const el = ref.current; if (!el) return;
    el.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale3d(1,1,1)";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <div 
        ref={ref} 
        onMouseMove={onMouseMove} 
        onMouseLeave={onMouseLeave} 
        onClick={onClick}
        className={`bg-[#121214]/60 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl shadow-lg hover:shadow-xl hover:border-zinc-700/80 transition-all duration-300 cursor-pointer h-full ${className}`} 
        style={{ transformStyle: "preserve-3d", transition: "transform 0.1s ease, border-color 0.3s ease, box-shadow 0.3s ease" }}
      >
        {children}
      </div>
    </motion.div>
  );
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchJobs();
  }, []);

  async function fetchJobs() {
    setLoading(true);
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (!error && data) setJobs(data);
    setLoading(false);
  }

  const departments = ["All", ...Array.from(new Set(jobs.map((j) => j.department))).filter(Boolean)];

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept =
      selectedDept && selectedDept !== "All"
        ? job.department.toLowerCase() === selectedDept.toLowerCase()
        : true;
    return matchesSearch && matchesDept;
  });

  return (
    <main className="relative flex flex-col min-h-screen bg-[#09090b] text-white">
      {/* 2D Premium Glow Background */}
      <GlassBackground />

      {/* Header */}
      <Header />

      {/* Hero */}
      <section className="relative z-10 w-full max-w-screen-xl mx-auto px-6 sm:px-8 md:px-12 pt-20 sm:pt-24 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <h1 className="text-[36px] sm:text-[54px] md:text-[68px] font-medium tracking-[-0.03em] leading-[1.04] text-white">
            Shape the Future<br />
            <span style={{ background: "linear-gradient(135deg, #60a5fa 0%, #818cf8 60%, #c084fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              With Antigravity
            </span>
          </h1>
          <p className="mt-4 text-base sm:text-lg leading-[1.65] text-zinc-400 max-w-xl font-medium">
            Join a fast-moving, design-obsessed team building the next generation of web infrastructure. Discover open opportunities below.
          </p>
        </motion.div>
      </section>

      {/* Search & Filter Bar */}
      <section className="relative z-10 w-full max-w-screen-xl mx-auto px-6 sm:px-8 md:px-12 pb-6">
        {/* Dynamic Live Stats Bar */}
        {mounted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex flex-wrap items-center gap-3 mb-4 pl-1"
          >
            {/* Live Database Badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/30 border border-emerald-900/50 shadow-sm animate-pulse-slow">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                Active Openings
              </span>
            </div>

            {/* Total Roles */}
            <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-zinc-900/50 border border-zinc-800/50 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Positions: <strong className="text-zinc-200">{jobs.length}</strong>
              </span>
            </div>

            {/* Departments Count */}
            <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-zinc-900/50 border border-zinc-800/50 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Departments: <strong className="text-zinc-200">{departments.length - 1}</strong>
              </span>
            </div>
          </motion.div>
        )}

        {/* Elegant Glass Search Area */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{
            opacity: 1,
            y: 0,
            boxShadow: searchFocused
              ? "0 24px 48px -12px rgba(99, 102, 241, 0.15), 0 0 0 2px rgba(99, 102, 241, 0.25)"
              : "0 20px 40px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            borderColor: searchFocused ? "rgba(99, 102, 241, 0.4)" : "rgba(255, 255, 255, 0.08)"
          }}
          transition={{ duration: 0.25 }}
          className="bg-zinc-950/60 backdrop-blur-2xl rounded-3xl p-4 flex flex-col xl:flex-row items-stretch xl:items-center gap-4 transition-all duration-300 border relative overflow-hidden"
        >
          {/* Custom Search Box */}
          <div className="relative flex-1 flex items-center bg-zinc-900/80 rounded-2xl border border-zinc-800/60 focus-within:border-blue-500/80 focus-within:bg-zinc-900 px-4 py-3 transition-all duration-300">
            <Search className={`w-4 h-4 mr-3 transition-colors duration-300 ${searchFocused ? "text-blue-400" : "text-zinc-500"}`} />
            <input
              id="jobs-search"
              type="text"
              placeholder="Search by role name, description, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-transparent border-none outline-none text-sm text-zinc-200 placeholder-zinc-500 font-semibold"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                className="ml-2 p-1 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all duration-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Department filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {departments.map((dept) => {
              const isActive = (selectedDept || "All") === dept;
              return (
                <button
                  key={dept}
                  id={`filter-${dept.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setSelectedDept(dept === "All" ? "" : dept)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                    isActive
                      ? "bg-white text-zinc-950 border-transparent shadow-md scale-[1.02]"
                      : "bg-zinc-900/80 hover:bg-zinc-850 text-zinc-400 border-zinc-800/60 hover:border-zinc-700/80"
                  }`}
                >
                  <span className="relative z-10">{dept}</span>
                </button>
              );
            })}
          </div>

          {/* Results Info */}
          {!loading && (searchQuery || (selectedDept && selectedDept !== "All")) && (
            <div className="flex items-center gap-3 ml-auto xl:ml-0 xl:pl-2 shrink-0">
              <span className="text-xs font-semibold text-zinc-400 bg-zinc-900 border border-zinc-800/60 px-3 py-1.5 rounded-full">
                Found <strong className="text-blue-400">{filteredJobs.length}</strong> matching role{filteredJobs.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => { setSearchQuery(""); setSelectedDept(""); }}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          )}
        </motion.div>
      </section>

      {/* Job Cards */}
      <section className="relative z-10 flex-1 w-full max-w-screen-xl mx-auto px-6 sm:px-8 md:px-12 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-16 text-center"
          >
            <Briefcase className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 font-semibold">
              {jobs.length === 0 ? "No open vacancies listed at this moment. check back later!" : "No jobs match your search parameters. Try adjusting filters."}
            </p>
            {(searchQuery || selectedDept) && (
              <button
                onClick={() => { setSearchQuery(""); setSelectedDept(""); }}
                className="mt-4 px-4 py-2 bg-white text-zinc-950 rounded-xl text-xs font-bold hover:bg-zinc-100 cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredJobs.map((job, i) => (
                <Card3D 
                  key={job.id} 
                  delay={i * 0.06} 
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  className="rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 cursor-pointer"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <span className="dept-tag">{job.department}</span>
                      <div className="flex items-center gap-1.5 shrink-0 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-[12px] font-medium text-zinc-300">{job.location}</span>
                      </div>
                    </div>
                    <h2 className="text-[24px] font-bold tracking-[-0.02em] text-white transition-colors duration-300 mb-3 group-hover:text-blue-400">
                      {job.title}
                    </h2>
                    <p className="text-[14px] leading-[1.65] text-zinc-400 line-clamp-3 flex-1">
                      {job.description.replace(/#{1,3} |[*_~`]/g, "")}
                    </p>
                    <div className="mt-6 pt-5 border-t border-zinc-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-[13px] font-medium text-zinc-300">Full Time</span>
                      </div>
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-400 hover:text-blue-300">
                        Apply Now
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Card3D>
              ))}
            </div>
          </AnimatePresence>
        )}
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
