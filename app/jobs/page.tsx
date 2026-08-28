"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import { ArrowRight, MapPin, Search, X } from "lucide-react";
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

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  async function fetchJobs() {
    setLoading(true);
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (!error && data) setJobs(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchJobs();
  }, []);

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
    <main className="relative flex flex-col min-h-screen bg-transparent text-white">
      <GlassBackground />
      <Header />

      {/* Hero section */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 pt-16 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Open positions.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-lg">
            Explore opportunities across our engineering, product, and operations teams. Find your place.
          </p>

          {/* Minimal Info Row */}
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">
            <span>POSITIONS: {jobs.length}</span>
            <span>•</span>
            <span>DEPARTMENTS: {departments.length - 1}</span>
          </div>
        </motion.div>
      </section>

      {/* Search & Filter Bar */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-4"
        >
          {/* Minimal Search Field */}
          <div className={`relative flex items-center bg-zinc-950/80 rounded-xl border px-3.5 py-2.5 transition-all duration-200 ${
            searchFocused ? "border-zinc-700 bg-zinc-950" : "border-zinc-900 bg-zinc-950/50"
          }`}>
            <Search className={`w-4 h-4 mr-2.5 transition-colors ${searchFocused ? "text-zinc-300" : "text-zinc-600"}`} />
            <input
              id="jobs-search"
              type="text"
              placeholder="Search roles, description or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-transparent border-none outline-none text-xs text-zinc-200 placeholder-zinc-650 font-semibold"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                className="ml-2 p-1 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Faint Category selector row */}
          <div className="flex items-center gap-2 flex-wrap pb-2">
            {departments.map((dept) => {
              const isActive = (selectedDept || "All") === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept === "All" ? "" : dept)}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    isActive
                      ? "bg-white text-black border-transparent"
                      : "bg-zinc-950/50 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-zinc-900 hover:border-zinc-800"
                  }`}
                >
                  {dept}
                </button>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* Job Rows */}
      <section className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-800 border-t-zinc-400 rounded-full animate-spin" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-12 text-center"
          >
            <p className="text-zinc-500 text-xs font-semibold">
              {jobs.length === 0 ? "No open vacancies listed at this moment." : "No positions match your search query."}
            </p>
          </motion.div>
        ) : (
          <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden">
            <AnimatePresence mode="popLayout">
              {filteredJobs.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  className="w-full flex justify-between items-center py-5 px-6 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/30 transition-colors cursor-pointer group"
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-zinc-300 transition-colors truncate">
                      {job.title}
                    </h2>
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                      <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                      <span>{job.location}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[10px] font-semibold text-zinc-450 bg-zinc-950/40 border border-zinc-900 px-3 py-1 rounded-md">
                      {job.department}
                    </span>
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:translate-x-1 group-hover:text-white transition-all duration-200" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
