"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import { ArrowRight, MapPin, Briefcase } from "lucide-react";
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

  useEffect(() => { fetchJobs(); }, []);

  async function fetchJobs() {
    setLoading(true);
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (!error && data) setJobs(data);
    setLoading(false);
  }

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
      <section className="relative z-10 w-full max-w-screen-xl mx-auto px-6 sm:px-10 pt-20 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <span className="dept-tag mb-5 inline-block">Join Our Team</span>
          <h1 className="text-[48px] md:text-[64px] font-medium tracking-[-0.03em] leading-[1.05] text-[#121317]">
            Build Your Career<br />
            <span className="text-[#3279F9]">With Us</span>
          </h1>
          <p className="mt-5 text-[17px] leading-[1.7] text-[#737A87] max-w-xl">
            Explore premium career opportunities, collaborate with ambitious teams.
          </p>
        </motion.div>
      </section>

      {/* Job Cards */}
      <section className="relative z-10 flex-1 w-full max-w-screen-xl mx-auto px-6 sm:px-10 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-[#3279F9]/30 border-t-[#3279F9] rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-[24px] p-20 text-center">
            <p className="text-[17px] text-[#737A87]">No open positions right now. Check back soon!</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {jobs.map((job, i) => (
              <Card3D key={job.id} delay={i * 0.08} onClick={() => router.push(`/jobs/${job.id}`)}
                className="rounded-[24px] p-8 cursor-pointer"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <span className="dept-tag">{job.department}</span>
                    <div className="flex items-center gap-1.5 shrink-0 rounded-full border border-[#E1E6EC] bg-white px-3 py-1">
                      <MapPin className="w-3.5 h-3.5 text-[#737A87]" />
                      <span className="text-[12px] font-medium text-[#45474D]">{job.location}</span>
                    </div>
                  </div>
                  <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[#1a3bbd] transition-colors duration-300 mb-3 group-hover:text-[#3279F9]">
                    {job.title}
                  </h2>
                  <p className="text-[14px] leading-[1.65] text-[#737A87] line-clamp-3 flex-1">
                    {job.description.replace(/#{1,3} |[*_~`]/g, "")}
                  </p>
                  <div className="mt-6 pt-5 border-t border-[#E1E6EC] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-[#737A87]" />
                      <span className="text-[13px] font-medium text-[#45474D]">Full Time</span>
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
