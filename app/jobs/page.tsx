"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, ContactShadows, MeshTransmissionMaterial } from "@react-three/drei";
import { ArrowRight, MapPin, Briefcase, Search, X } from "lucide-react";
import Header from "../../src/components/Header";

type Job = {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
};

function FloatingRing() {
  return (
    <Float speed={1.8} rotationIntensity={0.9} floatIntensity={1.2}>
      <mesh rotation={[0.5, -0.5, 0]}>
        <torusGeometry args={[2, 0.45, 64, 128]} />
        <MeshTransmissionMaterial
          backside samples={6} thickness={0.6}
          chromaticAberration={0.08} anisotropy={0.5}
          distortion={0.12} distortionScale={0.2}
          temporalDistortion={0.03} clearcoat={1}
          clearcoatRoughness={0.05} color="#1a3bbd"
          transmission={0.55} roughness={0.05}
          resolution={1024}
        />
      </mesh>
    </Float>
  );
}

function Card3D({
  children, className = "", onClick, delay = 0,
}: {
  children: React.ReactNode; className?: string; onClick?: () => void; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const rx = ((e.clientY - r.top  - r.height / 2) / (r.height / 2)) * -5;
    const ry = ((e.clientX - r.left - r.width  / 2) / (r.width  / 2)) *  5;
    el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.02,1.02,1.02)`;
  }
  function onMouseLeave() {
    const el = ref.current; if (!el) return;
    el.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale3d(1,1,1)";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <div ref={ref} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} onClick={onClick}
        className={`glass glass-hover h-full ${className}`} style={{ transformStyle: "preserve-3d" }}
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

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 160], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 160], [1, 0.96]);
  const heroY = useTransform(scrollY, [0, 160], [0, -40]);
  const hiringOpacity = useTransform(scrollY, [0, 160], [0, 1]);
  const hiringScale = useTransform(scrollY, [0, 160], [0.88, 1]);

  useEffect(() => { fetchJobs(); }, []);

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
    <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] text-[#121317]">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
          <directionalLight position={[-10, -8, -5]} intensity={1} color="#3279F9" />
          <Suspense fallback={null}>
            <FloatingRing />
            <Environment preset="city" />
            <ContactShadows position={[0, -3, 0]} opacity={0.25} scale={20} blur={3} color="#737A87" />
          </Suspense>
        </Canvas>
      </div>

      {/* Header */}
      <Header />

      {/* Hero */}
      <section className="relative z-10 w-full max-w-screen-xl mx-auto px-6 sm:px-10 pt-44 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          className="max-w-2xl"
        >
          <span className="dept-tag mb-5 inline-block">Join Our Team</span>
          <h1 className="text-[48px] md:text-[64px] font-medium tracking-[-0.03em] leading-[1.05] text-gradient">
            Build Your Career<br />
            With Us
          </h1>
          <p className="mt-5 text-[17px] leading-[1.7] text-[#121317] max-w-xl">
            Explore premium career opportunities, collaborate with ambitious teams.
          </p>
        </motion.div>
      </section>

      {/* Search & Filter Bar */}
      <section className="relative z-10 w-full max-w-screen-xl mx-auto px-6 sm:px-10 pb-8">
        {/* Active Hiring tag */}
        <motion.div
          style={{ opacity: hiringOpacity, scale: hiringScale }}
          className="flex items-center gap-3 mb-4 pl-1"
        >
          <span className="relative flex h-2.5 w-2.5 mt-1">
            <span className="absolute inset-0 rounded-full bg-[#10B981] animate-ping opacity-75" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-[#10B981]" />
          </span>
          <span className="text-[28px] md:text-[36px] font-medium tracking-[-0.03em] text-gradient leading-none">
            hiring.
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{
            opacity: 1,
            y: 0,
            boxShadow: searchFocused
              ? "0 20px 40px -10px rgba(50, 121, 249, 0.20), 0 0 0 2px rgba(50, 121, 249, 0.3)"
              : "0 20px 40px -10px rgba(18, 19, 23, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.5)",
            borderColor: searchFocused ? "rgba(50, 121, 249, 0.4)" : "rgba(255, 255, 255, 0.5)"
          }}
          transition={{ duration: 0.3 }}
          className="glass rounded-[24px] p-5 flex flex-col lg:flex-row items-stretch lg:items-center gap-4 transition-all duration-300 relative overflow-hidden"
        >
          {/* Custom Search Box */}
          <div className="relative flex-1 flex items-center bg-white/40 backdrop-blur-md rounded-[16px] border border-[#E1E6EC] focus-within:border-[#3279F9] focus-within:bg-white/80 focus-within:shadow-[0_4px_20px_-2px_rgba(50,121,249,0.08)] px-4 py-2.5 transition-all duration-300">
            <Search className={`w-4 h-4 mr-3 transition-colors duration-300 ${searchFocused ? "text-[#3279F9]" : "text-[#737A87]"}`} />
            <input
              id="jobs-search"
              type="text"
              placeholder="Search roles, departments, locations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-transparent border-none outline-none text-[14px] text-[#121317] placeholder-[#737A87] font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                className="ml-2 p-1 rounded-full hover:bg-[#E1E6EC] text-[#737A87] hover:text-[#121317] transition-all duration-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dept pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {departments.map((dept) => {
              const isActive = (selectedDept || "All") === dept;
              return (
                <button
                  key={dept}
                  id={`filter-${dept.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setSelectedDept(dept === "All" ? "" : dept)}
                  className={`px-4 py-2 rounded-[12px] text-[13px] font-semibold border transition-all duration-300 relative overflow-hidden group ${
                    isActive
                      ? "bg-gradient-to-r from-[#3279F9] to-[#7C3AED] text-white border-transparent shadow-[0_4px_15px_-3px_rgba(50,121,249,0.35)] scale-[1.02]"
                      : "bg-white/60 hover:bg-white text-[#121317] border-[#E1E6EC] hover:border-[#3279F9] hover:shadow-[0_4px_12px_-2px_rgba(50,121,249,0.06)] hover:-translate-y-0.5"
                  }`}
                >
                  <span className="relative z-10">{dept}</span>
                  {isActive && (
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Result count / clear */}
          {!loading && (searchQuery || (selectedDept && selectedDept !== "All")) && (
            <div className="flex items-center gap-3 ml-auto pr-1">
              <span className="text-[13px] font-medium text-[#737A87] bg-[#E1E6EC]/40 px-3 py-1 rounded-full border border-[#E1E6EC]">
                <strong className="text-[#3279F9]">{filteredJobs.length}</strong> role{filteredJobs.length !== 1 ? "s" : ""} found
              </span>
              <button
                onClick={() => { setSearchQuery(""); setSelectedDept(""); }}
                className="text-[13px] text-[#7C3AED] hover:text-[#3279F9] font-semibold hover:underline flex items-center gap-1 transition-colors duration-200"
              >
                Clear Filters
              </button>
            </div>
          )}
        </motion.div>
      </section>

      {/* Job Cards */}
      <section className="relative z-10 flex-1 w-full max-w-screen-xl mx-auto px-6 sm:px-10 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-[#3279F9]/30 border-t-[#3279F9] rounded-full animate-spin" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-[24px] p-20 text-center">
            <p className="text-[17px] text-[#121317]">
              {jobs.length === 0 ? "No open positions right now. Check back soon!" : "No roles match your search. Try different keywords."}
            </p>
            {(searchQuery || selectedDept) && (
              <button
                onClick={() => { setSearchQuery(""); setSelectedDept(""); }}
                className="mt-4 btn-secondary text-[14px] px-5 py-2"
              >
                Clear filters
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredJobs.map((job, i) => (
                <Card3D key={job.id} delay={i * 0.08} onClick={() => router.push(`/jobs/${job.id}`)}
                  className="rounded-[24px] p-8 cursor-pointer"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <span className="dept-tag">{job.department}</span>
                      <div className="flex items-center gap-1.5 shrink-0 rounded-full border border-[#E1E6EC] bg-white px-3 py-1">
                        <MapPin className="w-3.5 h-3.5 text-[#121317]" />
                        <span className="text-[12px] font-medium text-[#121317]">{job.location}</span>
                      </div>
                    </div>
                    <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[#1a3bbd] transition-colors duration-300 mb-3 group-hover:text-[#3279F9]">
                      {job.title}
                    </h2>
                    <p className="text-[14px] leading-[1.65] text-[#121317] line-clamp-3 flex-1">
                      {job.description.replace(/#{1,3} |[*_~`]/g, "")}
                    </p>
                    <div className="mt-6 pt-5 border-t border-[#E1E6EC] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-[#121317]" />
                        <span className="text-[13px] font-medium text-[#121317]">Full Time</span>
                      </div>
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#3279F9]">
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
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>© {new Date().getFullYear()} Careers Portal</p>
          <div className="site-footer-links">
            <a href="/">Home</a>
            <a href="/admin">Admin</a>
            <a href="https://www.linkedin.com/in/anandugirish/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
