"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "../../../src/lib/supabase";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import { ArrowLeft, CheckCircle2, Upload, Briefcase, MapPin, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Header from "../../../src/components/Header";

type Job = {
  id: string; title: string; department: string; location: string; description: string;
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
      out.push(`<h3 class="text-[18px] font-semibold text-white mt-7 mb-3">${text}</h3>`);
      continue;
    }
    if (/^[•\-] /.test(line)) {
      if (!inUl) { out.push('<ul class="space-y-1.5 my-4 ml-5 list-disc text-slate-300">'); inUl = true; }
      const text = line.replace(/^[•\-] /, "").replace(/\*\*(.*?)\*\*/g, "<strong class='font-medium text-white'>$1</strong>");
      out.push(`<li class="pl-1 marker:text-[#3279F9]">${text}</li>`);
      continue;
    }
    if (inUl) { out.push("</ul>"); inUl = false; }
    const text = line.replace(/\*\*(.*?)\*\*/g, "<strong class='font-medium text-white'>$1</strong>");
    out.push(`<p class="my-2 text-[15px] leading-[1.7] text-slate-300">${text}</p>`);
  }
  if (inUl) out.push("</ul>");
  return out.join("\n");
}

function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    // Rising triad: C5 (523 Hz) → E5 (659 Hz) → G5 (784 Hz)
    const notes = [
      { freq: 523.25, start: 0,    dur: 0.55 },
      { freq: 659.25, start: 0.13, dur: 0.55 },
      { freq: 783.99, start: 0.26, dur: 0.80 },
    ];
    notes.forEach(({ freq, start, dur }) => {
      // Primary oscillator (sine — warm)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);

      // Shimmer layer (triangle, one octave up, quieter)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime + start);
      gain2.gain.setValueAtTime(0, ctx.currentTime + start);
      gain2.gain.linearRampToValueAtTime(0.05, ctx.currentTime + start + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur * 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + start);
      osc2.stop(ctx.currentTime + start + dur);
    });
    // Auto-close context after sound finishes
    setTimeout(() => ctx.close(), 2000);
  } catch { /* browser may block audio without user gesture — silent fail */ }
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
  
  const [submittedApp, setSubmittedApp] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  async function handleDownloadPDF() {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);
      // Wait a tick so the UI updates to show the loading spinner before html2canvas locks the main thread
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(receiptRef.current, { 
        scale: 4, // 4x scale for super high definition
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true
      });
      
      // Use lossless PNG for crisp text
      const imgData = canvas.toDataURL("image/png");
      
      // Scale down by 4 to get original physical size, keeping 4x pixel density
      const pdfWidth = canvas.width / 4;
      const pdfHeight = canvas.height / 4;
      
      // Create a PDF with the exact dimensions of the receipt card
      const pdf = new jsPDF({ 
        orientation: pdfWidth > pdfHeight ? "landscape" : "portrait", 
        unit: "px", 
        format: [pdfWidth, pdfHeight] 
      });
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Application_Receipt_${submittedApp?.id?.slice(0, 8).toUpperCase() || 'Token'}.pdf`);
    } catch (err: any) {
      console.error("Error generating PDF:", err);
      // Fallback to native print dialog
      window.print();
    } finally {
      setIsDownloading(false);
    }
  }

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
      const { data, error } = await supabase.from("applications").insert([
        { name, email, phone: `+91 ${phone}`, location, resume_url: publicUrl, job_id: id, status: "Pending" },
      ]).select().single();
      if (error) alert(error.message);
      else { 
        setSubmittedApp(data);
        playSuccessChime(); 
        setSubmitted(true); 
      }
    } catch { alert("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  /* Loading */
  if (!job) {
    return (
      <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--fg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--border)] border-t-[#3279F9] animate-spin" />
          <p className="text-[14px] text-[var(--muted)]">Loading…</p>
        </div>
      </main>
    );
  }

  /* Success */
  if (submitted) {
    return (
      <main className="relative flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
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
        <header className="site-header">
          <div className="site-header-inner">
            <span className="site-logo cursor-pointer text-white font-bold" onClick={() => router.push("/jobs")}>
              Careers Portal
            </span>
          </div>
        </header>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            transition={{ duration: 0.5, type: "spring", stiffness: 100 }} 
            className="w-full max-w-md"
          >
            {/* The Receipt Card */}
            <div 
              ref={receiptRef}
              className="bg-white rounded-[24px] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)] overflow-hidden border border-[#E1E6EC]"
            >
              <div className="bg-[#3B54C4] px-8 py-8 text-center relative overflow-hidden">
                <div data-html2canvas-ignore="true" className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent)]" />
                <motion.div 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1 }} 
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                  className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg relative z-10"
                >
                  <CheckCircle2 className="w-8 h-8 text-[#3B54C4]" />
                </motion.div>
                <h2 className="text-[24px] font-bold text-white relative z-10">Application Received</h2>
              </div>
              
              <div className="px-8 py-8">
                <p className="text-[15px] text-[#737A87] text-center mb-8">
                  Thank you for applying. Here is your application token for future reference.
                </p>
                
                <div className="space-y-4 text-[14px]">
                  <div className="flex justify-between items-center py-3 border-b border-[#E1E6EC]/60">
                    <span className="text-[#737A87]">Reference No.</span>
                    <span className="font-mono font-semibold text-[#1a3bbd] bg-[#3279F9]/10 px-2 py-0.5 rounded">
                      #{submittedApp?.id?.slice(0, 8).toUpperCase() || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#E1E6EC]/60">
                    <span className="text-[#737A87]">Applicant</span>
                    <span className="font-medium text-[#121317]">{name}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#E1E6EC]/60">
                    <span className="text-[#737A87]">Position</span>
                    <span className="font-medium text-[#121317] text-right max-w-[60%]">{job.title}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#E1E6EC]/60">
                    <span className="text-[#737A87]">Date</span>
                    <span className="font-medium text-[#121317]">
                      {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.6, duration: 0.4 }}
             className="w-full max-w-md flex flex-col sm:flex-row gap-3"
          >
             <button disabled={isDownloading} onClick={handleDownloadPDF} className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
               {isDownloading ? (
                 <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating PDF...</>
               ) : (
                 <><Download className="w-4 h-4" /> Download PDF Receipt</>
               )}
             </button>
             <button onClick={() => router.push("/jobs")} className="flex-1 btn-secondary cursor-pointer">
               Back to Careers
             </button>
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
    <main className="relative flex flex-col min-h-screen bg-[var(--bg)] text-[var(--fg)]">
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

      <Header />

      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-5 sm:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="glass rounded-[32px] overflow-hidden"
        >
          {/* Job Header */}
          <div className="px-10 py-10 border-b border-[var(--border)]">
            <span className="dept-tag mb-5 inline-block">{job.department}</span>
            <h1 className="text-[38px] md:text-[52px] font-bold tracking-[-0.03em] leading-[1.1] mb-6 text-[var(--fg)]">{job.title}</h1>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--grey-50)] px-4 py-2 text-[13px] font-semibold text-[var(--fg)]/80">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                {job.location}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--grey-50)] px-4 py-2 text-[13px] font-semibold text-[var(--fg)]/80">
                <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                Full Time
              </div>
            </div>
          </div>

          {/* Job Body */}
          <div className="px-10 py-10">
            <h2 className="text-[22px] font-bold mb-6 text-[var(--fg)]">About the role</h2>
            <div className="text-[15px] text-[var(--fg)]/90" dangerouslySetInnerHTML={{ __html: renderMd(job.description) }} />

            {!showApply ? (
              <div className="mt-10 pt-8 border-t border-[var(--border)]">
                <button onClick={() => setShowApply(true)} className="btn-primary">Apply for this position</button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="mt-10 pt-10 border-t border-[var(--border)]"
              >
                <div className="mb-8">
                  <h2 className="text-[26px] font-bold text-blue-400">Submit your application</h2>
                  <p className="text-[14px] text-[var(--muted)] mt-2">
                    Fill out the form below to apply for <strong className="text-[#3279F9]">{job.title}</strong>
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="form-label">Full Name <span className="text-red-500">*</span></label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" className="form-input" />
                    {errors.name && <p className="mt-1.5 text-[12px] text-red-400 font-medium">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="form-label">Email Address <span className="text-red-500">*</span></label>
                    <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="jane@example.com" className="form-input" />
                    {errors.email && <p className="mt-1.5 text-[12px] text-red-400 font-medium">{errors.email}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="form-label">Phone Number <span className="text-red-500">*</span></label>
                      <div className="flex animate-fade-in">
                        <span className="inline-flex items-center px-4 rounded-l-[12px] border border-r-0 border-[var(--border)] bg-[var(--grey-100)] text-[15px] font-bold text-[var(--fg)]/80 select-none whitespace-nowrap">
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
                      {errors.phone && <p className="mt-1.5 text-[12px] text-red-400 font-medium">{errors.phone}</p>}
                    </div>
                    <div>
                      <label className="form-label">City <span className="text-red-500">*</span></label>
                      <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mumbai" className="form-input" />
                      {errors.location && <p className="mt-1.5 text-[12px] text-red-400 font-medium">{errors.location}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Resume / CV <span className="text-red-500">*</span></label>
                    <div className="relative rounded-[14px] border-2 border-dashed border-[var(--border)] bg-[var(--grey-100)]/30 px-6 py-9 text-center hover:bg-[var(--grey-100)] hover:border-blue-500/40 transition-colors cursor-pointer">
                      <input type="file" accept=".pdf,.doc,.docx"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setResume(f); }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="mx-auto h-7 w-7 text-[var(--muted)] mb-2" />
                      <p className="text-[14px] font-bold text-[var(--fg)]">{resume ? resume.name : "Click to upload or drag & drop"}</p>
                      <p className="text-[12px] text-[var(--muted)]/60 mt-1">PDF, DOC up to 5 MB</p>
                    </div>
                    {errors.resume && <p className="mt-1.5 text-[12px] text-red-400 font-medium">{errors.resume}</p>}
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
