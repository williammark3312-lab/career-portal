"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../src/lib/supabase";
import { 
  ArrowRight, MapPin, Briefcase, Search, X, Sparkles, 
  ChevronRight, ExternalLink, Lock, Upload, CheckCircle2, Download 
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Header from "../../../src/components/Header";
import GlassBackground from "../../../src/components/GlassBackground";

type Job = {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
};

function renderMd(md: string): string {
  const blocks = md.split(/\n\s*\n/);
  const out: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (/^#{1,3} /.test(trimmed)) {
      const text = trimmed.replace(/^#{1,3} /, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      out.push(`<h3 class="text-xs font-bold text-zinc-900 mt-6 mb-2.5 uppercase tracking-wider">${text}</h3>`);
      continue;
    }

    if (/^[•\-] /.test(trimmed)) {
      const items = trimmed.split("\n").map(line => line.trim()).filter(Boolean);
      out.push('<ul class="space-y-2.5 my-4 ml-5 list-disc text-zinc-500 font-medium">');
      for (const item of items) {
        const text = item.replace(/^[•\-] /, "").replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-zinc-800'>$1</strong>");
        out.push(`<li class="pl-1 marker:text-blue-500 text-xs leading-relaxed">${text}</li>`);
      }
      out.push('</ul>');
      continue;
    }

    const text = trimmed
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-zinc-800'>$1</strong>");
    
    out.push(`<p class="my-3 text-xs sm:text-[13.5px] leading-relaxed text-zinc-500 font-medium">${text}</p>`);
  }

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

export default function JobsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [mounted, setMounted] = useState(false);

  /* Drawer / Application form states */
  const [activeDrawerJob, setActiveDrawerJob] = useState<Job | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedApp, setSubmittedApp] = useState<{ id?: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    fetchJobs();
  }, []);

  async function fetchJobs() {
    setLoading(true);
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      setJobs(data);
      // Pre-open matching drawer if ID exists in URL params
      if (id) {
        const matchingJob = data.find(j => j.id === id);
        if (matchingJob) {
          setActiveDrawerJob(matchingJob);
        }
      }
    }
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

  /* Drawer Handlers */
  function handleOpenJobDrawer(job: Job) {
    // Modify URL route dynamically for better UX without full reloads
    window.history.pushState(null, "", `/jobs/${job.id}`);
    setActiveDrawerJob(job);
    setShowApply(false);
    setSubmitted(false);
    setName("");
    setEmail("");
    setPhone("");
    setLocation("");
    setResume(null);
    setErrors({});
    setSubmittedApp(null);
  }

  function handleCloseJobDrawer() {
    // Reset URL route back to index listings
    window.history.pushState(null, "", "/jobs");
    setActiveDrawerJob(null);
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
    if (!validate() || !resume || !activeDrawerJob) return;
    try {
      setFormLoading(true);
      const fileName = `${Date.now()}-${resume.name}`;
      const { error: uploadErr } = await supabase.storage.from("resumes").upload(fileName, resume);
      if (uploadErr) { alert(uploadErr.message); return; }
      const { data: { publicUrl } } = supabase.storage.from("resumes").getPublicUrl(fileName);
      const { data, error } = await supabase.from("applications").insert([
        { name, email, phone: `+91 ${phone}`, location, resume_url: publicUrl, job_id: activeDrawerJob.id, status: "Pending" },
      ]).select().single();
      if (error) alert(error.message);
      else {
        setSubmittedApp(data);
        playSuccessChime();
        setSubmitted(true);
      }
    } catch { alert("Something went wrong. Please check your network and try again."); }
    finally { setFormLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#F8F9FC] text-zinc-800 relative z-10 flex flex-col lg:flex-row overflow-hidden">
      {/* 2D Premium Glow Background */}
      <GlassBackground />

      {/* ── Midnight-Dark Sidebar (Admin Mirror) ── */}
      <aside className="w-72 bg-zinc-950 border-r border-zinc-900/80 hidden lg:flex flex-col justify-between p-6 fixed h-screen z-20">
        <div className="flex flex-col gap-8">
          
          {/* Logo Branding */}
          <div className="flex items-center gap-3 px-2 py-1 cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/10">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-none">Antigravity</h1>
              <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">Careers Portal</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => { handleCloseJobDrawer(); setSelectedDept(""); setSearchQuery(""); }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold text-white bg-zinc-900 border border-zinc-855 cursor-pointer w-full text-left"
            >
              <Briefcase className="w-4 h-4 text-blue-500" />
              <span>Explore Openings</span>
            </button>
            <a
              href="https://www.linkedin.com/in/anandugirish/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 border border-transparent transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>LinkedIn Profile</span>
            </a>
          </nav>
        </div>

        {/* Sidebar Footer Link to Admin Dashboard */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-zinc-250 hover:bg-zinc-900 border border-transparent hover:border-zinc-900 transition-all cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>Admin Console</span>
          </button>
          <div className="text-[10px] text-zinc-650 font-semibold px-3">
            © {new Date().getFullYear()} Google Antigravity
          </div>
        </div>
      </aside>

      {/* ── Mobile Layout Header ── */}
      <div className="lg:hidden w-full relative z-30">
        <Header />
        {/* Mobile menu navigation tab strip */}
        <div className="bg-white/80 backdrop-blur-md border-b border-zinc-250 px-4 py-2 flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => { handleCloseJobDrawer(); setSelectedDept(""); setSearchQuery(""); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white bg-zinc-950 shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Briefcase className="w-3.5 h-3.5" />
            Openings
          </button>
          <a
            href="https://www.linkedin.com/in/anandugirish/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            LinkedIn
          </a>
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 cursor-pointer whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            Admin
          </button>
        </div>
      </div>

      {/* ── Main Workspace Content ── */}
      <div className="flex-1 lg:ml-72 min-h-screen flex flex-col p-4 sm:p-8 lg:p-10 relative z-10 pt-20 lg:pt-10 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto flex flex-col gap-6 flex-grow pb-16">
          
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-zinc-200/50">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <span>Careers</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-zinc-500 font-semibold">Openings</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 leading-none">
                Available Opportunities
              </h1>
            </div>
          </div>

          {/* Vercel-Style Stats Grid */}
          {mounted && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Active Roles", value: jobs.length, icon: <Briefcase className="w-4 h-4" /> },
                { label: "Departments", value: departments.length - 1, icon: <Sparkles className="w-4 h-4" /> },
                { label: "Locations", value: Array.from(new Set(jobs.map(j => j.location))).length, icon: <MapPin className="w-4 h-4" /> }
              ].map((s, idx) => (
                <div key={idx} className="bg-white border border-zinc-200/60 rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:border-zinc-300 transition-all">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span>
                    {s.icon}
                  </div>
                  <span className="text-3xl font-extralight tracking-tight text-zinc-900 leading-none">{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Search & Filters */}
          <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 flex flex-col xl:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="relative flex-1 w-full flex items-center bg-zinc-50 rounded-xl border border-zinc-200/60 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-sm px-3.5 py-2 transition-all">
              <Search className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter openings by title, department, location..."
                className="w-full bg-transparent border-none outline-none text-xs font-semibold text-zinc-800 placeholder-zinc-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-zinc-400 hover:text-zinc-650 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 overflow-x-auto w-full xl:w-auto pb-1 xl:pb-0">
              {departments.map(dept => {
                const isActive = (selectedDept || "All") === dept;
                return (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept === "All" ? "" : dept)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap cursor-pointer transition-all ${
                      isActive
                        ? "bg-zinc-950 text-white border-transparent"
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Job Openings Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20 bg-white border border-zinc-200/60 rounded-3xl">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-16 border border-zinc-200/65 bg-white rounded-3xl text-center">
              <Briefcase className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm text-zinc-500 font-semibold">
                {jobs.length === 0 ? "No active positions found." : "No postings match your search filters."}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200/60 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-150 bg-zinc-50/50 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      <th className="py-4 px-6">Role Title</th>
                      <th className="py-4 px-6">Department</th>
                      <th className="py-4 px-6">Location</th>
                      <th className="py-4 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs font-semibold text-zinc-750">
                    {filteredJobs.map((job) => (
                      <tr 
                        key={job.id} 
                        onClick={() => handleOpenJobDrawer(job)}
                        className="hover:bg-zinc-50/70 transition-colors cursor-pointer group"
                      >
                        <td className="py-4.5 px-6 font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">
                          {job.title}
                        </td>
                        <td className="py-4.5 px-6">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                            {job.department}
                          </span>
                        </td>
                        <td className="py-4.5 px-6 text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{job.location}</span>
                          </div>
                        </td>
                        <td className="py-4.5 px-6 text-right" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => handleOpenJobDrawer(job)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-750 cursor-pointer"
                          >
                            <span>Apply</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right-Side Slide-Over Workspace Drawer ── */}
      <AnimatePresence>
        {activeDrawerJob && (
          <>
            {/* Backdrop filter overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseJobDrawer}
              className="fixed inset-0 bg-black/30 z-30 pointer-events-auto backdrop-blur-sm"
            />
            {/* Sliding Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl bg-white border-l border-zinc-200/80 shadow-2xl flex flex-col pointer-events-auto"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-zinc-150 flex justify-between items-start bg-zinc-50/50">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100/50 px-2.5 py-1 rounded-full uppercase tracking-wider mb-2.5 inline-block">
                    {activeDrawerJob.department}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
                    {activeDrawerJob.title}
                  </h2>
                  <div className="flex gap-2.5 mt-2.5 text-xs font-bold text-zinc-500">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-zinc-400" />{activeDrawerJob.location}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5 text-zinc-400" />Full Time</span>
                  </div>
                </div>
                <button 
                  onClick={handleCloseJobDrawer}
                  className="p-1.5 rounded-xl border border-zinc-200 bg-white text-zinc-400 hover:text-zinc-650 hover:bg-zinc-50 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col gap-8">
                {submitted ? (
                  /* Success ticket slip view */
                  <div className="flex flex-col items-center gap-6 py-6 max-w-md mx-auto w-full">
                    {/* Receipt ticket card */}
                    <div ref={receiptRef} className="w-full bg-white border border-zinc-200/60 rounded-[28px] overflow-hidden shadow-lg relative">
                      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500" />
                      <div className="px-6 pt-6 pb-5 text-center border-b border-dashed border-zinc-200 relative">
                        <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-950">Application Received</h3>
                        <p className="text-[10px] font-semibold text-zinc-450 mt-0.5">We are reviewing your CV profile.</p>
                        
                        <div className="absolute -bottom-[10px] -left-[10px] w-5 h-5 rounded-full bg-white border border-zinc-200/50" />
                        <div className="absolute -bottom-[10px] -right-[10px] w-5 h-5 rounded-full bg-white border border-zinc-200/50" />
                      </div>
                      <div className="p-6 flex flex-col gap-3.5 text-xs font-semibold text-zinc-700">
                        {[
                          { label: "CONFIRMATION ID", value: `#${submittedApp?.id?.slice(0, 8).toUpperCase() || "N/A"}`, isMono: true },
                          { label: "NAME", value: name },
                          { label: "POSITION", value: activeDrawerJob.title },
                          { label: "CITY", value: location },
                          { label: "SUBMITTED ON", value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) }
                        ].map(row => (
                          <div key={row.label} className="flex justify-between items-start gap-4">
                            <span className="text-[9px] font-bold text-zinc-400 tracking-wider uppercase">{row.label}</span>
                            <span className={`text-right max-w-[60%] ${row.isMono ? 'font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100/50' : 'text-zinc-800'}`}>
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="w-full flex flex-col gap-2.5">
                      <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="w-full py-3 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isDownloading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Generating PDF...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Download Receipt
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleCloseJobDrawer}
                        className="w-full py-3 rounded-xl font-bold text-xs text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 cursor-pointer text-center"
                      >
                        Close Panel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Role Description */}
                    <div>
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Role Description</h3>
                      <div 
                        className="prose prose-zinc text-zinc-655 font-medium text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMd(activeDrawerJob.description) }}
                      />
                    </div>

                    {/* Apply Toggle / Form */}
                    <div className="pt-6 border-t border-zinc-150">
                      {!showApply ? (
                        <button 
                          onClick={() => setShowApply(true)}
                          className="w-full py-3.5 bg-zinc-950 hover:bg-zinc-900 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer text-center transition-all active:scale-[0.98]"
                        >
                          Apply For This Position
                        </button>
                      ) : (
                        <div className="flex flex-col gap-5">
                          <div>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Submit Application</h3>
                            <p className="text-[11px] text-zinc-400 font-semibold mt-1">Please fill in your details below.</p>
                          </div>

                          <div className="space-y-4">
                            {/* Full Name */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Full Name</label>
                              <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Jane Doe"
                                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 bg-white text-zinc-800 text-xs font-semibold placeholder-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                              />
                              {errors.name && <p className="text-[10px] font-bold text-rose-500">{errors.name}</p>}
                            </div>

                            {/* Email */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Email Address</label>
                              <input
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                type="email"
                                placeholder="jane@example.com"
                                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 bg-white text-zinc-800 text-xs font-semibold placeholder-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                              />
                              {errors.email && <p className="text-[10px] font-bold text-rose-500">{errors.email}</p>}
                            </div>

                            {/* Grid: Phone / City */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Phone Number</label>
                                <div className="flex">
                                  <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-zinc-200 bg-zinc-55 text-[11px] font-bold text-zinc-400 select-none">
                                    +91
                                  </span>
                                  <input
                                    value={phone}
                                    onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                                    placeholder="9876543210"
                                    maxLength={10}
                                    className="w-full border border-zinc-200 rounded-r-xl px-3.5 py-2.5 bg-white text-zinc-800 text-xs font-semibold placeholder-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                  />
                                </div>
                                {errors.phone && <p className="text-[10px] font-bold text-rose-500">{errors.phone}</p>}
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">City</label>
                                <input
                                  value={location}
                                  onChange={e => setLocation(e.target.value)}
                                  placeholder="e.g. Mumbai"
                                  className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 bg-white text-zinc-800 text-xs font-semibold placeholder-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                />
                                {errors.location && <p className="text-[10px] font-bold text-rose-500">{errors.location}</p>}
                              </div>
                            </div>

                            {/* Resume CV */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Resume Document</label>
                              <div className="relative rounded-xl border border-dashed border-zinc-300 bg-white hover:bg-zinc-50/50 hover:border-zinc-405 p-6 text-center cursor-pointer transition-colors">
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) setResume(f); }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Upload className="mx-auto h-5.5 w-5.5 text-zinc-400 mb-1.5" />
                                <p className="text-xs font-bold text-zinc-700 truncate px-2">
                                  {resume ? resume.name : "Click to select CV document"}
                                </p>
                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">PDF or Word files up to 5 MB</p>
                              </div>
                              {errors.resume && <p className="text-[10px] font-bold text-rose-500">{errors.resume}</p>}
                            </div>

                            {/* Submit */}
                            <div className="pt-2">
                              <button
                                disabled={formLoading}
                                onClick={handleSubmit}
                                className="w-full py-3.5 bg-zinc-950 hover:bg-zinc-900 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                              >
                                {formLoading ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Submitting...
                                  </>
                                ) : "Submit Application Form"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
