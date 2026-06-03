"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "../../../src/lib/supabase";
import { ArrowLeft, CheckCircle2, Upload, Briefcase, MapPin, Download, ChevronLeft, Calendar } from "lucide-react";
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
      out.push(`<h3 class="text-[17px] sm:text-[19px] font-bold text-zinc-900 mt-8 mb-4 tracking-tight leading-tight">${text}</h3>`);
      continue;
    }
    if (/^[•\-] /.test(line)) {
      if (!inUl) { out.push('<ul class="space-y-2.5 my-5 ml-5 list-disc text-zinc-600 font-medium">'); inUl = true; }
      const text = line.replace(/^[•\-] /, "").replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-zinc-800'>$1</strong>");
      out.push(`<li class="pl-1 marker:text-blue-500 text-sm leading-relaxed">${text}</li>`);
      continue;
    }
    if (inUl) { out.push("</ul>"); inUl = false; }
    const text = line.replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-zinc-800'>$1</strong>");
    out.push(`<p class="my-3 text-sm sm:text-[15px] leading-relaxed text-zinc-600 font-medium">${text}</p>`);
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

  useEffect(() => { fetchJob(); }, []);

  async function fetchJob() {
    const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
    if (data) setJob(data);
  }

  async function handleDownloadPDF() {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);
      await new Promise((r) => setTimeout(r, 150));
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = canvas.width / 3;
      const pdfHeight = canvas.height / 3;
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
        unit: "px",
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Application_Receipt_${submittedApp?.id?.slice(0, 8).toUpperCase() || "Details"}.pdf`);
    } catch {
      window.print();
    } finally {
      setIsDownloading(false);
    }
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
      else {
        setSubmittedApp(data);
        playSuccessChime();
        setSubmitted(true);
      }
    } catch { alert("Something went wrong. Please check your network and try again."); }
    finally { setLoading(false); }
  }

  /* Loading state */
  if (!job) {
    return (
      <main className="min-h-screen bg-[#F8F9FC] flex items-center justify-center relative overflow-hidden">
        <GlassBackground />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-600 animate-spin" />
          <p className="text-xs font-bold text-zinc-400 tracking-wider">Fetching opening details...</p>
        </div>
      </main>
    );
  }

  /* Success / Ticket Receipt view */
  if (submitted) {
    return (
      <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] text-[#121317]">
        <GlassBackground />
        <Header />
        
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-28 gap-6 max-w-lg mx-auto w-full">
          {/* Receipt card (designed like a Vercel Ticket) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            ref={receiptRef}
            className="w-full bg-white border border-zinc-200/60 rounded-[32px] overflow-hidden shadow-xl shadow-blue-500/5 relative"
          >
            {/* Vercel-style top gradient stripe */}
            <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500" />

            {/* Header section */}
            <div className="px-8 pt-8 pb-6 text-center border-b border-dashed border-zinc-200 relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
                className="w-14 h-14 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"
              >
                <CheckCircle2 className="w-7 h-7" />
              </motion.div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">
                Application Received
              </h2>
              <p className="text-xs font-medium text-zinc-400 mt-1">Thank you! Your profile is in review.</p>
              
              {/* Receipt left/right punch holes */}
              <div className="absolute -bottom-[10px] -left-[10px] w-5 h-5 rounded-full bg-[#F8F9FC] border border-zinc-200/50" />
              <div className="absolute -bottom-[10px] -right-[10px] w-5 h-5 rounded-full bg-[#F8F9FC] border border-zinc-200/50" />
            </div>

            {/* Details table */}
            <div className="p-8 flex flex-col gap-4">
              {[
                { label: "Confirmation ID", value: `#${submittedApp?.id?.slice(0, 8).toUpperCase() || "N/A"}`, isMono: true },
                { label: "Applicant", value: name },
                { label: "Role Applied", value: job.title },
                { label: "Location", value: location },
                {
                  label: "Submitted On",
                  value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-start gap-4">
                  <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">{row.label}</span>
                  <span className={`text-xs font-bold text-zinc-800 text-right max-w-[60%] ${row.isMono ? 'font-mono text-blue-600 bg-blue-50 border border-blue-100/50 px-2 py-0.5 rounded' : ''}`}>
                    {row.value}
                  </span>
                </div>
              ))}
              <div className="border-t border-zinc-100 mt-4 pt-4 text-center">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                  Secure Recruiter Desk Verification
                </span>
              </div>
            </div>
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="w-full flex flex-col gap-3"
          >
            <button
              id="receipt-download-btn"
              disabled={isDownloading}
              onClick={handleDownloadPDF}
              className="w-full py-3 px-6 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4.5 h-4.5" />
                  Download Receipt Slip
                </>
              )}
            </button>
            <button
              id="receipt-return-btn"
              onClick={() => router.push("/jobs")}
              className="w-full py-3 px-6 rounded-xl font-bold text-xs text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Openings
            </button>
          </motion.div>
        </div>
        
        <Footer />
      </main>
    );
  }

  /* Main Form Layout */
  return (
    <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] text-[#121317]">
      <GlassBackground />
      <Header />

      <div className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-6 sm:px-8 pt-32 sm:pt-40 pb-16">
        
        {/* Back Button */}
        <button 
          onClick={() => router.push("/jobs")}
          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 text-xs font-bold uppercase tracking-wider mb-6 group cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Listings
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white border border-zinc-200/60 rounded-3xl overflow-hidden shadow-sm"
        >
          {/* Header Panel */}
          <div className="p-6 sm:p-10 border-b border-zinc-150">
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100/50 px-2.5 py-1 rounded-full uppercase tracking-wider mb-4 inline-block">
              {job.department}
            </span>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-tight mb-5">
              {job.title}
            </h1>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 rounded-xl border border-zinc-250/30 bg-zinc-50 px-3.5 py-1.5 text-xs font-bold text-zinc-500">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl border border-zinc-250/30 bg-zinc-50 px-3.5 py-1.5 text-xs font-bold text-zinc-500">
                <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                <span>Full Time</span>
              </div>
            </div>
          </div>

          {/* Core content split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-150">
            {/* Left Column: Job Description */}
            <div className="lg:col-span-7 p-6 sm:p-10">
              <h2 className="text-lg font-bold text-zinc-800 mb-5 uppercase tracking-wide">
                Role Description
              </h2>
              <div 
                className="prose prose-zinc max-w-none text-zinc-600 font-medium"
                dangerouslySetInnerHTML={{ __html: renderMd(job.description) }} 
              />
            </div>

            {/* Right Column: Application Form */}
            <div className="lg:col-span-5 p-6 sm:p-10 bg-zinc-50/50">
              {!showApply ? (
                <div className="h-full flex flex-col justify-center items-center py-12 text-center">
                  <Briefcase className="w-10 h-10 text-zinc-300 mb-4" />
                  <h3 className="text-base font-bold text-zinc-800 mb-1">Apply for this role</h3>
                  <p className="text-xs text-zinc-400 font-medium max-w-[240px] mb-5">
                    Submit your CV to begin the application review workspace.
                  </p>
                  <button 
                    onClick={() => setShowApply(true)} 
                    className="py-3 px-6 rounded-xl font-bold text-xs text-white bg-zinc-950 hover:bg-zinc-900 transition-all cursor-pointer shadow-sm shadow-zinc-950/10"
                  >
                    Start Application
                  </button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-6"
                >
                  <div>
                    <h3 className="text-lg font-bold text-zinc-800">Apply Now</h3>
                    <p className="text-xs text-zinc-400 font-medium mt-1">Submit your details to start the review process.</p>
                  </div>

                  <div className="space-y-4">
                    {/* Full Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Full Name</label>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full border border-zinc-200/80 rounded-xl px-4 py-2.5 bg-white text-zinc-800 text-sm font-semibold placeholder-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                      {errors.name && <p className="text-[11px] font-bold text-rose-500">{errors.name}</p>}
                    </div>

                    {/* Email */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Email Address</label>
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        type="email"
                        placeholder="jane.doe@company.com"
                        className="w-full border border-zinc-200/80 rounded-xl px-4 py-2.5 bg-white text-zinc-800 text-sm font-semibold placeholder-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                      {errors.email && <p className="text-[11px] font-bold text-rose-500">{errors.email}</p>}
                    </div>

                    {/* Phone & City Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Phone */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Phone Number</label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-zinc-200 bg-zinc-100 text-xs font-bold text-zinc-400 select-none">
                            +91
                          </span>
                          <input
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                            placeholder="9876543210"
                            maxLength={10}
                            className="w-full border border-zinc-200/80 rounded-r-xl px-4 py-2.5 bg-white text-zinc-800 text-sm font-semibold placeholder-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                        {errors.phone && <p className="text-[11px] font-bold text-rose-500">{errors.phone}</p>}
                      </div>
                      
                      {/* City */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Current City</label>
                        <input
                          value={location}
                          onChange={e => setLocation(e.target.value)}
                          placeholder="e.g. Bangalore"
                          className="w-full border border-zinc-200/80 rounded-xl px-4 py-2.5 bg-white text-zinc-800 text-sm font-semibold placeholder-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                        {errors.location && <p className="text-[11px] font-bold text-rose-500">{errors.location}</p>}
                      </div>
                    </div>

                    {/* Resume Upload */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Resume / CV File</label>
                      <div className="relative rounded-xl border border-dashed border-zinc-300 bg-white hover:bg-zinc-50/50 hover:border-zinc-400 transition-colors p-6 text-center cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={e => { const f = e.target.files?.[0]; if (f) setResume(f); }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload className="mx-auto h-6 w-6 text-zinc-400 mb-2" />
                        <p className="text-xs font-bold text-zinc-700 truncate px-2">
                          {resume ? resume.name : "Click to select CV document"}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-semibold mt-1">PDF or Word files up to 5 MB</p>
                      </div>
                      {errors.resume && <p className="text-[11px] font-bold text-rose-500">{errors.resume}</p>}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                      <button
                        disabled={loading}
                        onClick={handleSubmit}
                        className="w-full py-3 px-6 rounded-xl font-bold text-xs text-white bg-zinc-950 hover:bg-zinc-900 transition-all cursor-pointer shadow-md shadow-zinc-950/10 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Submitting...
                          </>
                        ) : "Submit Profile Application"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <Footer />
    </main>
  );
}
