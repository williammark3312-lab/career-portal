"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "../../../src/lib/supabase";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, MeshTransmissionMaterial } from "@react-three/drei";
import { ArrowLeft, CheckCircle2, Upload, Briefcase, MapPin } from "lucide-react";
import Header from "../../../src/components/Header";

type Job = {
  id: string; title: string; department: string; location: string; description: string;
};

function FloatingRing() {
  return (
    <Float speed={1.8} rotationIntensity={0.9} floatIntensity={1.2}>
      <mesh rotation={[0.5, -0.5, 0]}>
        <torusGeometry args={[2, 0.45, 64, 128]} />
        <MeshTransmissionMaterial backside samples={6} thickness={0.6}
          chromaticAberration={0.08} anisotropy={0.5} distortion={0.12}
          distortionScale={0.2} temporalDistortion={0.03} clearcoat={1}
          clearcoatRoughness={0.05} color="#1a3bbd"
          transmission={0.55} roughness={0.05} resolution={1024}
        />
      </mesh>
    </Float>
  );
}

function renderMd(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (inUl) { out.push("</ul>"); inUl = false; } continue; }
    if (/^#{1,3} /.test(line)) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      const text = line.replace(/^#{1,3} /, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      out.push(`<h3 class="text-[18px] font-semibold text-[#121317] mt-7 mb-3">${text}</h3>`);
      continue;
    }
    if (/^[•\-] /.test(line)) {
      if (!inUl) { out.push('<ul class="space-y-1.5 my-4 ml-5 list-disc text-[#737A87]">'); inUl = true; }
      const text = line.replace(/^[•\-] /, "").replace(/\*\*(.*?)\*\*/g, "<strong class='font-medium text-[#121317]'>$1</strong>");
      out.push(`<li class="pl-1 marker:text-[#3279F9]">${text}</li>`);
      continue;
    }
    if (inUl) { out.push("</ul>"); inUl = false; }
    const text = line.replace(/\*\*(.*?)\*\*/g, "<strong class='font-medium text-[#121317]'>$1</strong>");
    out.push(`<p class="my-2 text-[15px] leading-[1.7] text-[#737A87]">${text}</p>`);
  }
  if (inUl) out.push("</ul>");
  return out.join("\n");
}

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [job, setJob]               = useState<Job | null>(null);
  const [loading, setLoading]       = useState(false);
  const [showApply, setShowApply]   = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [phone, setPhone]           = useState("");
  const [location, setLocation]     = useState("");
  const [resume, setResume]         = useState<File | null>(null);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  useEffect(() => { fetchJob(); }, []);

  async function fetchJob() {
    const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
    if (data) setJob(data);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim() || name.length < 3) e.name = "Enter your full name (min 3 chars)";
    if (!/^\S+@\S+\.\S+$/.test(email))   e.email = "Enter a valid email";
    if (!/^[6-9]\d{9}$/.test(phone))     e.phone = "Enter a valid 10-digit number";
    if (!location.trim())                 e.location = "City is required";
    if (!resume) { e.resume = "Please attach your resume"; }
    else if (!["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(resume.type))
      e.resume = "Only PDF / DOC / DOCX allowed";
    else if (resume.size > 5*1024*1024) e.resume = "Max file size is 5 MB";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || !resume) return;
    try {
      setLoading(true);
      const fileName = `${Date.now()}-${resume.name}`;
      const { error: uploadErr } = await supabase.storage.from("resumes").upload(fileName, resume);
      if (uploadErr) { alert(uploadErr.message); return; }
      const { data: { publicUrl } } = supabase.storage.from("resumes").getPublicUrl(fileName);
      const { error } = await supabase.from("applications").insert([
        { name, email, phone: `+91 ${phone}`, location, resume_url: publicUrl, job_id: id, status: "Pending" },
      ]);
      if (error) alert(error.message);
      else setSubmitted(true);
    } catch { alert("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  /* Loading */
  if (!job) {
    return (
      <main className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[rgba(50,121,249,0.25)] border-t-[#3279F9] animate-spin" />
          <p className="text-[14px] text-[#737A87]">Loading…</p>
        </div>
      </main>
    );
  }

  /* Success */
  if (submitted) {
    return (
      <main className="relative flex flex-col min-h-screen bg-[#F8F9FC]">
        <div className="fixed inset-0 z-0 pointer-events-none opacity-50">
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
            <ambientLight intensity={1.4} />
            <directionalLight position={[10, 10, 5]} intensity={2} />
            <Suspense fallback={null}><FloatingRing /><Environment preset="city" /></Suspense>
          </Canvas>
        </div>
        <header className="site-header">
          <div className="site-header-inner">
            <span className="site-logo" onClick={() => router.push("/jobs")}>
              Careers Portal
            </span>
          </div>
        </header>
        <div className="relative z-10 flex-1 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.5, type: "spring", stiffness: 100 }} 
            className="glass max-w-md w-full rounded-[28px] p-10 text-center"
          >
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="w-24 h-24 bg-[#3279F9]/10 text-[#3279F9] rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                  d="M20 6L9 17l-5-5"
                />
              </svg>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.4, duration: 0.4 }}
              className="text-[32px] font-bold tracking-tight mb-3 text-[#1a3bbd]"
            >
              Application Submitted!
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-[15px] text-[#737A87] leading-[1.65] mb-8"
            >
              Thank you for applying. We&apos;ll review your application and get back to you soon.
            </motion.p>
            <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.8, duration: 0.4 }}
            >
               <button onClick={() => router.push("/jobs")} className="btn-dark w-full text-[14px]">
                 Back to Careers
               </button>
            </motion.div>
          </motion.div>
        </div>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <p>© {new Date().getFullYear()} Careers Portal</p>
          </div>
        </footer>
      </main>
    );
  }

  /* Main */
  return (
    <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] text-[#121317]">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
          <Suspense fallback={null}><FloatingRing /><Environment preset="city" /></Suspense>
        </Canvas>
      </div>

      <Header />

      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-5 sm:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="glass rounded-[32px] overflow-hidden"
        >
          {/* Job Header */}
          <div className="px-10 py-10 border-b border-[#E1E6EC]">
            <span className="dept-tag mb-5 inline-block">{job.department}</span>
            <h1 className="text-[38px] md:text-[52px] font-bold tracking-[-0.03em] leading-[1.1] mb-6 text-[#1a3bbd]">{job.title}</h1>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-full border border-[#E1E6EC] bg-white px-4 py-2 text-[13px] font-medium text-[#45474D]">
                <MapPin className="w-3.5 h-3.5 text-[#737A87]" />
                {job.location}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#E1E6EC] bg-white px-4 py-2 text-[13px] font-medium text-[#45474D]">
                <Briefcase className="w-3.5 h-3.5 text-[#737A87]" />
                Full Time
              </div>
            </div>
          </div>

          {/* Job Body */}
          <div className="px-10 py-10">
            <h2 className="text-[22px] font-semibold mb-6 text-[#121317]">About the role</h2>
            <div className="text-[15px]" dangerouslySetInnerHTML={{ __html: renderMd(job.description) }} />

            {!showApply ? (
              <div className="mt-10 pt-8 border-t border-[#E1E6EC]">
                <button onClick={() => setShowApply(true)} className="btn-primary">Apply for this position</button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="mt-10 pt-10 border-t border-[#E1E6EC]"
              >
                <div className="mb-8">
                  <h2 className="text-[26px] font-semibold text-[#1a3bbd]">Submit your application</h2>
                  <p className="text-[14px] text-[#737A87] mt-2">
                    Fill out the form below to apply for <strong className="text-[#3279F9]">{job.title}</strong>
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="form-label">Full Name <span className="text-red-500">*</span></label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" className="form-input" />
                    {errors.name && <p className="mt-1.5 text-[12px] text-red-500">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="form-label">Email Address <span className="text-red-500">*</span></label>
                    <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="jane@example.com" className="form-input" />
                    {errors.email && <p className="mt-1.5 text-[12px] text-red-500">{errors.email}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="form-label">Phone Number <span className="text-red-500">*</span></label>
                      <div className="flex">
                        <span className="inline-flex items-center px-4 rounded-l-[12px] border border-r-0 border-[#CDD4DC] bg-[#F8F9FC] text-[15px] font-medium text-[#45474D] select-none whitespace-nowrap">
                          +91
                        </span>
                        <input
                          value={phone}
                          onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder="98765 43210"
                          maxLength={10}
                          className="form-input rounded-l-none border-l-0"
                        />
                      </div>
                      {errors.phone && <p className="mt-1.5 text-[12px] text-red-500">{errors.phone}</p>}
                    </div>
                    <div>
                      <label className="form-label">City <span className="text-red-500">*</span></label>
                      <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mumbai" className="form-input" />
                      {errors.location && <p className="mt-1.5 text-[12px] text-red-500">{errors.location}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Resume / CV <span className="text-red-500">*</span></label>
                    <div className="relative rounded-[14px] border-2 border-dashed border-[#CDD4DC] bg-white/60 px-6 py-9 text-center hover:bg-white transition-colors cursor-pointer">
                      <input type="file" accept=".pdf,.doc,.docx"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setResume(f); }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="mx-auto h-7 w-7 text-[#737A87] mb-2" />
                      <p className="text-[14px] font-medium text-[#121317]">{resume ? resume.name : "Click to upload or drag & drop"}</p>
                      <p className="text-[12px] text-[#737A87] mt-1">PDF, DOC up to 5 MB</p>
                    </div>
                    {errors.resume && <p className="mt-1.5 text-[12px] text-red-500">{errors.resume}</p>}
                  </div>
                  <div className="pt-2">
                    <button disabled={loading} onClick={handleSubmit} className="btn-dark w-full disabled:opacity-60 disabled:cursor-not-allowed">
                      {loading ? "Submitting…" : "Submit Application"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>© {new Date().getFullYear()} Careers Portal</p>
          <div className="site-footer-links"><a href="/jobs">Careers</a></div>
        </div>
      </footer>
    </main>
  );
}
