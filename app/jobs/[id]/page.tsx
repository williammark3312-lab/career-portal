"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "../../../src/lib/supabase";
import { ArrowLeft, CheckCircle2, Upload, Briefcase, MapPin, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Header from "../../../src/components/Header";
import Footer from "../../../src/components/Footer";
import GlassBackground from "../../../src/components/GlassBackground";

type Job = {
  id: string; title: string; department: string; location: string; description: string;
};

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
      out.push(`<h3 class="text-[17px] sm:text-[19px] font-bold text-blue-400 mt-8 mb-4 tracking-tight">${text}</h3>`);
      continue;
    }
    if (/^[•\-] /.test(line)) {
      if (!inUl) { out.push('<ul class="space-y-2.5 my-5 ml-5 list-disc text-zinc-300 font-medium">'); inUl = true; }
      const text = line.replace(/^[•\-] /, "").replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-white'>$1</strong>");
      out.push(`<li class="pl-1 marker:text-blue-400 text-[14px] leading-relaxed">${text}</li>`);
      continue;
    }
    if (inUl) { out.push("</ul>"); inUl = false; }
    const text = line.replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-white'>$1</strong>");
    out.push(`<p class="my-3 text-[14px] sm:text-[15px] leading-relaxed text-zinc-300">${text}</p>`);
  }
  if (inUl) out.push("</ul>");
  return out.join("\n");
}

function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [
      { freq: 523.25, start: 0, dur: 0.4 },
      { freq: 659.25, start: 0.1, dur: 0.4 },
      { freq: 783.99, start: 0.2, dur: 0.6 },
    ].forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch { /* silent */ }
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
  const [submittedApp, setSubmittedApp] = useState<{ id?: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || id === "[id]") return;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) return;

    async function fetchJob() {
      const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
      if (data) setJob(data);
    }

    fetchJob();
  }, [id]);

  async function handleDownloadPDF() {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);
      await new Promise((r) => setTimeout(r, 150));
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3, backgroundColor: "#ffffff", useCORS: true, allowTaint: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = canvas.width / 3;
      const pdfHeight = canvas.height / 3;
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
        unit: "px", format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Receipt_${submittedApp?.id?.slice(0, 8).toUpperCase() || "App"}.pdf`);
    } catch { window.print(); }
    finally { setIsDownloading(false); }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim() || name.length < 3) e.name = "Enter your full name (min 3 chars)";
    if (!/^\S+@\S+\.\S+$/.test(email))   e.email = "Enter a valid email address";
    if (!/^[6-9]\d{9}$/.test(phone))     e.phone = "Enter a valid 10-digit phone number";
    if (!location.trim())                 e.location = "City is required";
    if (!resume) { e.resume = "Please attach your resume file"; }
    else if (!["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(resume.type))
      e.resume = "Only PDF / DOC / DOCX formats are allowed";
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
      else { setSubmittedApp(data); playSuccessChime(); setSubmitted(true); }
    } catch { alert("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  /* Loading state */
  if (!job) {
    return (
      <main className="min-h-screen bg-transparent flex items-center justify-center relative overflow-hidden">
        <GlassBackground />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
          <p className="text-xs font-bold text-zinc-450 tracking-wider">Loading job details...</p>
        </div>
      </main>
    );
  }

  /* Success receipt */
  if (submitted) {
    return (
      <main className="relative flex flex-col min-h-screen bg-transparent text-white">
        <GlassBackground />
        <Header />
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-28 gap-6 max-w-lg mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            ref={receiptRef}
            className="w-full bg-zinc-900 border border-zinc-800/80 rounded-[32px] overflow-hidden shadow-2xl"
          >
            <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500" />
            <div className="px-8 pt-8 pb-6 text-center border-b border-dashed border-zinc-800 relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
                className="w-14 h-14 bg-emerald-950/30 border border-emerald-900/50 text-emerald-450 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"
              >
                <CheckCircle2 className="w-7 h-7" />
              </motion.div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Application Received</h2>
              <p className="text-xs font-medium text-zinc-400 mt-1">Thank you! Your profile is in review.</p>
              <div className="absolute -bottom-[10px] -left-[10px] w-5 h-5 rounded-full bg-transparent border border-zinc-800/80" />
              <div className="absolute -bottom-[10px] -right-[10px] w-5 h-5 rounded-full bg-transparent border border-zinc-800/80" />
            </div>
            <div className="p-8 flex flex-col gap-4">
              {[
                { label: "Confirmation ID", value: `#${submittedApp?.id?.slice(0, 8).toUpperCase() || "N/A"}`, isMono: true },
                { label: "Applicant", value: name },
                { label: "Role Applied", value: job.title },
                { label: "Location", value: location },
                { label: "Submitted On", value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-start gap-4">
                  <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">{row.label}</span>
                  <span className={`text-xs font-bold text-zinc-200 text-right max-w-[60%] ${row.isMono ? "font-mono text-blue-455 bg-blue-950/30 border border-blue-900/50 px-2 py-0.5 rounded" : ""}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="w-full flex flex-col gap-3"
          >
            <button
              disabled={isDownloading}
              onClick={handleDownloadPDF}
              className="w-full py-3 px-6 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isDownloading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving PDF…</>
              ) : (
                <><Download className="w-4 h-4" />Download Receipt</>
              )}
            </button>
            <button 
              onClick={() => router.push("/jobs")} 
              className="w-full py-3 px-6 rounded-xl font-bold text-xs text-zinc-950 bg-white hover:bg-zinc-100 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              Back to Careers
            </button>
          </motion.div>
        </div>
        <Footer />
      </main>
    );
  }

  /* Main job detail page */
  return (
    <main className="relative flex flex-col min-h-screen bg-transparent text-white">
      <GlassBackground />
      <Header />

      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-4 sm:px-5 md:px-8 pt-28 sm:pt-36 pb-8 sm:pb-16">
        {/* Back link */}
        <button
          onClick={() => router.push("/jobs")}
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white text-[13px] font-semibold mb-6 group cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:-translate-x-0.5 transition-all" />
          Back to Listings
        </button>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="bg-zinc-900/60 backdrop-blur-2xl border border-zinc-800/80 rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-2xl shadow-black/40"
        >
          {/* Job Header */}
          <div className="px-5 sm:px-10 py-6 sm:py-10 border-b border-zinc-800/85">
            <span className="dept-tag mb-5 inline-block">{job.department}</span>
            <h1 className="text-[28px] sm:text-[38px] md:text-[52px] font-bold tracking-[-0.03em] leading-[1.1] mb-4 sm:mb-6 text-white">
              {job.title}
            </h1>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-[13px] font-medium text-zinc-300">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                {job.location}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-[13px] font-medium text-zinc-300">
                <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                Full Time
              </div>
            </div>
          </div>

          {/* Job Body */}
          <div className="px-5 sm:px-10 py-6 sm:py-10">
            <h2 className="text-[22px] font-semibold mb-6 text-white">About the role</h2>
            <div className="text-[15px]" dangerouslySetInnerHTML={{ __html: renderMd(job.description) }} />

            {!showApply ? (
              <div className="mt-10 pt-8 border-t border-zinc-800/85">
                <button onClick={() => setShowApply(true)} className="btn-primary">
                  Apply for this position
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="mt-10 pt-10 border-t border-zinc-800/85"
              >
                <div className="mb-8">
                  <h2 className="text-[26px] font-semibold text-white">Submit your application</h2>
                  <p className="text-[14px] text-zinc-400 mt-2">
                    Fill out the form below to apply for <strong className="text-blue-400">{job.title}</strong>
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Full Name <span className="text-red-500">*</span></label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm font-semibold text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                    {errors.name && <p className="mt-1.5 text-[12px] text-red-500">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Email Address <span className="text-red-500">*</span></label>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      type="email"
                      placeholder="jane@example.com"
                      className="w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm font-semibold text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                    {errors.email && <p className="mt-1.5 text-[12px] text-red-500">{errors.email}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Phone Number <span className="text-red-500">*</span></label>
                      <div className="flex">
                        <span className="inline-flex items-center px-4 rounded-l-[12px] border border-r-0 border-zinc-800 bg-zinc-950 text-[15px] font-medium text-zinc-300 select-none whitespace-nowrap">
                          +91
                        </span>
                        <input
                          value={phone}
                          onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder="98765 43210"
                          maxLength={10}
                          className="w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl rounded-l-none border-l-0 text-sm font-semibold text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      {errors.phone && <p className="mt-1.5 text-[12px] text-red-500">{errors.phone}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">City <span className="text-red-500">*</span></label>
                      <input
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="e.g. Mumbai"
                        className="w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm font-semibold text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                      {errors.location && <p className="mt-1.5 text-[12px] text-red-500">{errors.location}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Resume / CV <span className="text-red-500">*</span></label>
                    <div className="relative rounded-[14px] border-2 border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-9 text-center hover:bg-zinc-900/40 hover:border-zinc-700 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setResume(f); }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="mx-auto h-7 w-7 text-zinc-400 mb-2" />
                      <p className="text-[14px] font-medium text-zinc-200">{resume ? resume.name : "Click to upload or drag & drop"}</p>
                      <p className="text-[12px] text-zinc-500 mt-1">PDF, DOC up to 5 MB</p>
                    </div>
                    {errors.resume && <p className="mt-1.5 text-[12px] text-red-500">{errors.resume}</p>}
                  </div>

                  <div className="pt-2">
                    <button
                      disabled={loading}
                      onClick={handleSubmit}
                      className="w-full py-3.5 px-6 rounded-xl font-bold text-xs text-zinc-950 bg-white hover:bg-zinc-100 transition-all cursor-pointer shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? "Submitting…" : "Submit Application"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      <Footer />
    </main>
  );
}
