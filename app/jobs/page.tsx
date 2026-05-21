"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import { ArrowRight, MapPin, Briefcase, Search, Filter } from "lucide-react";
import Header from "../../src/components/Header";

type Job = {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
};

// ... FloatingRing and Card3D remain the same ...
function FloatingRing() {
  return (
    <Float speed={1.8} rotationIntensity={0.9} floatIntensity={1.2}>
      <mesh rotation={[0.5, -0.5, 0]}>
        <torusGeometry args={[2, 0.45, 64, 128]} />
        <meshPhysicalMaterial 
          transmission={0.95} 
          opacity={1} 
          transparent 
          roughness={0.1} 
          thickness={1} 
          ior={1.5}
          color="#1a3bbd" 
          clearcoat={1} 
          clearcoatRoughness={0.1}
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

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedLoc, setSelectedLoc] = useState("");

  useEffect(() => { fetchJobs(); }, []);

  async function fetchJobs() {
    setLoading(true);
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (!error && data) setJobs(data);
    setLoading(false);
  }

  // Derived filter options
  const departments = Array.from(new Set(jobs.map(j => j.department))).filter(Boolean);
  const locations = Array.from(new Set(jobs.map(j => j.location))).filter(Boolean);

  // Apply filters
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          job.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept ? job.department === selectedDept : true;
    const matchesLoc = selectedLoc ? job.location === selectedLoc : true;
    return matchesSearch && matchesDept && matchesLoc;
  });

  return (
    <main className="relative flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: "high-performance" }} style={{ pointerEvents: "none" }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
          <directionalLight position={[-8, -8, -4]} intensity={1.2} color="#3279F9" />
          <Suspense fallback={null}>
            <FloatingRing />
            <Environment preset="city" />
            <ContactShadows position={[0, -2.5, 0]} opacity={0.2} scale={16} blur={3} color="#737A87" />
          </Suspense>
        </Canvas>
      </div>

      {/* Header */}
      <Header />

      {/* Hero */}
      <section className="relative z-10 w-full max-w-screen-xl mx-auto px-6 sm:px-10 pt-20 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <span className="dept-tag mb-5 inline-block">Join Our Team</span>
          <h1 className="text-[48px] md:text-[64px] font-bold tracking-[-0.03em] leading-[1.05] text-[var(--fg)]">
            Build Your Career<br />
            <span className="text-[#3279F9]">With Us</span>
          </h1>
          <p className="mt-5 text-[17px] leading-[1.7] text-[var(--fg)]/70 max-w-xl">
            Explore premium career opportunities, collaborate with ambitious teams.
          </p>
        </motion.div>
      </section>

      {/* Search & Filter Bar */}
      {!loading && jobs.length > 0 && (
        <section className="relative z-10 w-full max-w-screen-xl mx-auto px-6 sm:px-10 mb-10">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col md:flex-row gap-4 glass bg-[var(--glass-bg)] border-[var(--border)] p-3 rounded-[20px] shadow-[var(--shadow)]"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input 
                type="text" 
                placeholder="Search jobs by title or keyword..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[var(--grey-100)] border border-[var(--border)] focus:border-blue-500 rounded-[14px] text-[14px] text-[var(--fg)] outline-none transition-all placeholder-[var(--grey-500)]/60"
              />
            </div>
            <div className="flex gap-4">
              <select 
                value={selectedDept} 
                onChange={e => setSelectedDept(e.target.value)}
                className="flex-1 md:w-[180px] px-4 py-3 bg-[var(--grey-100)] border border-[var(--border)] focus:border-blue-500 rounded-[14px] text-[14px] text-[var(--fg)] outline-none cursor-pointer transition-all"
              >
                <option value="" className="bg-[var(--grey-100)] text-[var(--fg)]">All Departments</option>
                {departments.map(d => <option key={d} value={d} className="bg-[var(--grey-100)] text-[var(--fg)]">{d}</option>)}
              </select>
              <select 
                value={selectedLoc} 
                onChange={e => setSelectedLoc(e.target.value)}
                className="flex-1 md:w-[180px] px-4 py-3 bg-[var(--grey-100)] border border-[var(--border)] focus:border-blue-500 rounded-[14px] text-[14px] text-[var(--fg)] outline-none cursor-pointer transition-all"
              >
                <option value="" className="bg-[var(--grey-100)] text-[var(--fg)]">All Locations</option>
                {locations.map(l => <option key={l} value={l} className="bg-[var(--grey-100)] text-[var(--fg)]">{l}</option>)}
              </select>
            </div>
          </motion.div>
        </section>
      )}

      {/* Job Cards */}
      <section className="relative z-10 flex-1 w-full max-w-screen-xl mx-auto px-6 sm:px-10 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[#3279F9] rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-[24px] p-20 text-center border border-[var(--border)]">
            <p className="text-[17px] text-[var(--muted)]">No open positions right now. Check back soon!</p>
          </motion.div>
        ) : filteredJobs.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-[24px] p-20 text-center border border-[var(--border)] border-dashed">
            <p className="text-[17px] text-[var(--muted)]">No jobs match your search criteria. Try adjusting your filters.</p>
            <button onClick={() => { setSearchQuery(""); setSelectedDept(""); setSelectedLoc(""); }} className="mt-4 text-[14px] font-bold text-[#3279F9] hover:underline cursor-pointer">Clear all filters</button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredJobs.map((job, i) => (
              <Card3D key={job.id} delay={i * 0.08} onClick={() => router.push(`/jobs/${job.id}`)}
                className="rounded-[24px] p-8 cursor-pointer bg-white/[0.01]"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <span className="dept-tag">{job.department}</span>
                    <div className="flex items-center gap-1.5 shrink-0 rounded-full border border-[var(--border)] bg-[var(--grey-50)] px-3 py-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[12px] font-semibold text-[var(--fg)]/80">{job.location}</span>
                    </div>
                  </div>
                  <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--fg)] transition-colors duration-300 mb-3 group-hover:text-blue-400">
                    {job.title}
                  </h2>
                  <p className="text-[14px] leading-[1.65] text-[var(--fg)]/70 line-clamp-3 flex-1">
                    {job.description.replace(/#{1,3} |[*_~`]/g, "")}
                  </p>
                  <div className="mt-6 pt-5 border-t border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[13px] font-semibold text-[var(--fg)]/80">Full Time</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#3279F9]">
                      Apply Now
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Card3D>
            ))}
          </div>
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
