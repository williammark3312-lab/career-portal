"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import {
  MapPin, Briefcase, Search, X, Sparkles,
  ExternalLink, Lock, Upload, CheckCircle2, Download,
  ArrowUpRight, Globe, Users, Building2
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import GlassBackground from "../../src/components/GlassBackground";

type Job = {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
};

/* ─── Department theming ─────────────────────────────────────── */
function getDeptTheme(dept: string) {
  const d = dept.toLowerCase();
  if (d.includes("engineer") || d.includes("tech"))
    return { accent: "#3b82f6", light: "rgba(59,130,246,0.08)", dot: "#3b82f6", tag: "bg-blue-50 text-blue-700 border-blue-100/60", glow: "rgba(59,130,246,0.15)" };
  if (d.includes("design") || d.includes("ux") || d.includes("creative"))
    return { accent: "#f59e0b", light: "rgba(245,158,11,0.08)", dot: "#f59e0b", tag: "bg-amber-50 text-amber-700 border-amber-100/60", glow: "rgba(245,158,11,0.15)" };
  if (d.includes("market") || d.includes("growth"))
    return { accent: "#10b981", light: "rgba(16,185,129,0.08)", dot: "#10b981", tag: "bg-emerald-50 text-emerald-700 border-emerald-100/60", glow: "rgba(16,185,129,0.15)" };
  if (d.includes("product"))
    return { accent: "#8b5cf6", light: "rgba(139,92,246,0.08)", dot: "#8b5cf6", tag: "bg-violet-50 text-violet-700 border-violet-100/60", glow: "rgba(139,92,246,0.15)" };
  return { accent: "#6366f1", light: "rgba(99,102,241,0.08)", dot: "#6366f1", tag: "bg-indigo-50 text-indigo-700 border-indigo-100/60", glow: "rgba(99,102,241,0.15)" };
}

/* ─── Markdown renderer ──────────────────────────────────────── */
function renderMd(md: string): string {
  const blocks = md.split(/\n\s*\n/);
  const out: string[] = [];
  for (const block of blocks) {
    const t = block.trim();
    if (!t) continue;
    if (/^#{1,3} /.test(t)) {
      const text = t.replace(/^#{1,3} /, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      out.push(`<h3 class="text-[10px] font-black text-zinc-400 uppercase tracking-[0.14em] mt-7 mb-3">${text}</h3>`);
      continue;
    }
    if (/^[•\-] /.test(t)) {
      const items = t.split("\n").map(l => l.trim()).filter(Boolean);
      out.push('<ul class="space-y-2 my-3 ml-1 list-none text-zinc-600">');
      for (const item of items) {
        const txt = item.replace(/^[•\-] /, "").replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-zinc-800'>$1</strong>");
        out.push(`<li class="flex gap-2.5 text-[13px] leading-relaxed items-start"><span class="mt-[6px] w-1 h-1 rounded-full bg-blue-500 flex-shrink-0"></span><span>${txt}</span></li>`);
      }
      out.push("</ul>");
      continue;
    }
    const text = t.split("\n").map(l => l.trim()).filter(Boolean).join(" ")
      .replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-zinc-800'>$1</strong>");
    out.push(`<p class="text-[13px] leading-[1.75] text-zinc-500 my-2">${text}</p>`);
  }
  return out.join("\n");
}

/* ─── Audio chime ────────────────────────────────────────────── */
function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [{ freq: 523.25, start: 0, dur: 0.4 }, { freq: 659.25, start: 0.1, dur: 0.4 }, { freq: 783.99, start: 0.2, dur: 0.6 }]
      .forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur);
      });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

/* ─── Floating label input ───────────────────────────────────── */
function FloatInput({ label, type = "text", value, onChange, placeholder, prefix }: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string;
}) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3.5 bottom-[13px] text-xs font-bold text-zinc-400 select-none z-10">{prefix}</span>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(type === "tel" ? e.target.value.replace(/\D/g, "") : e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={active ? placeholder : ""}
        maxLength={type === "tel" ? 10 : undefined}
        className={`w-full border rounded-xl bg-white text-zinc-800 text-[13px] font-semibold outline-none transition-all peer
          ${prefix ? "pl-10" : "pl-4"} pr-4 pt-5 pb-2
          ${focused ? "border-blue-500 ring-2 ring-blue-500/12 shadow-sm" : "border-zinc-200/80 hover:border-zinc-300"}`}
      />
      <label className={`absolute left-${prefix ? "10" : "4"} transition-all duration-150 pointer-events-none font-semibold
        ${active ? "top-1.5 text-[9px] tracking-widest uppercase text-blue-600" : "top-3.5 text-[13px] text-zinc-400"}`}
        style={{ left: prefix ? "2.5rem" : "1rem" }}>
        {label}
      </label>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [mounted, setMounted] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  /* Drawer state */
  const [activeJob, setActiveJob] = useState<Job | null>(null);
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
  const drawerBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); fetchJobs(); }, []);

  async function fetchJobs() {
    setLoading(true);
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (!error && data) setJobs(data);
    setLoading(false);
  }

  const departments = ["All", ...Array.from(new Set(jobs.map(j => j.department))).filter(Boolean)];
  const filteredJobs = jobs.filter(job => {
    const matchSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDept = selectedDept && selectedDept !== "All"
      ? job.department.toLowerCase() === selectedDept.toLowerCase() : true;
    return matchSearch && matchDept;
  });

  function openJobDrawer(job: Job) {
    setActiveJob(job); setShowApply(false); setSubmitted(false);
    setName(""); setEmail(""); setPhone(""); setLocation("");
    setResume(null); setErrors({}); setSubmittedApp(null);
    setTimeout(() => drawerBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }
  function closeJobDrawer() { setActiveJob(null); }

  async function handleDownloadPDF() {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);
      await new Promise(r => setTimeout(r, 150));
      const canvas = await html2canvas(receiptRef.current, { scale: 3, backgroundColor: "#ffffff", useCORS: true });
      const img = canvas.toDataURL("image/png");
      const w = canvas.width / 3, h = canvas.height / 3;
      const pdf = new jsPDF({ orientation: w > h ? "landscape" : "portrait", unit: "px", format: [w, h] });
      pdf.addImage(img, "PNG", 0, 0, w, h);
      pdf.save(`Receipt_${submittedApp?.id?.slice(0, 8).toUpperCase() || "App"}.pdf`);
    } catch { window.print(); } finally { setIsDownloading(false); }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim() || name.length < 3) e.name = "Full name required (min 3 characters)";
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email address";
    if (!/^[6-9]\d{9}$/.test(phone)) e.phone = "Enter valid 10-digit Indian number";
    if (!location.trim()) e.location = "Current city is required";
    if (!resume) e.resume = "Please attach your resume";
    else if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(resume.type))
      e.resume = "Only PDF / DOC / DOCX allowed";
    else if (resume.size > 5 * 1024 * 1024) e.resume = "Max file size is 5 MB";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || !resume || !activeJob) return;
    try {
      setFormLoading(true);
      const fileName = `${Date.now()}-${resume.name}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(fileName, resume);
      if (upErr) { alert(upErr.message); return; }
      const { data: { publicUrl } } = supabase.storage.from("resumes").getPublicUrl(fileName);
      const { data, error } = await supabase.from("applications").insert([
        { name, email, phone: `+91 ${phone}`, location, resume_url: publicUrl, job_id: activeJob.id, status: "Pending" }
      ]).select().single();
      if (error) alert(error.message);
      else { setSubmittedApp(data); playSuccessChime(); setSubmitted(true); }
    } catch { alert("Something went wrong. Please try again."); }
    finally { setFormLoading(false); }
  }

  const uniqueLocations = Array.from(new Set(jobs.map(j => j.location))).length;
  const theme = activeJob ? getDeptTheme(activeJob.department) : null;

  /* ════ JSX ═══════════════════════════════════════════════════ */
  return (
    <main className="min-h-screen flex flex-col lg:flex-row overflow-hidden" style={{ background: "#f5f5f0" }}>
      <GlassBackground />

      {/* ── SIDEBAR ──────────────────────────────────────────── */}
      <aside
        className="w-[260px] hidden lg:flex flex-col justify-between fixed h-screen z-20 overflow-hidden"
        style={{ background: "#09090b" }}
      >
        {/* Breathing ambient mesh inside sidebar */}
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.15, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute bottom-[-60px] right-[-60px] w-[250px] h-[250px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)" }}
        />

        {/* Top section */}
        <div className="relative z-10 flex flex-col gap-9 p-6">
          {/* Brand */}
          <button onClick={() => router.push("/")} className="flex items-center gap-3 group text-left">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white leading-none tracking-tight">Antigravity</p>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.15em] mt-0.5">Careers</p>
            </div>
          </button>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 px-2">Explore</p>
            <button
              onClick={() => { setSelectedDept(""); setSearchQuery(""); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Briefcase className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-[12px] font-semibold text-white">Open Positions</span>
              <span className="ml-auto text-[10px] font-bold text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">{jobs.length}</span>
            </button>
            <a
              href="https://www.linkedin.com/in/anandugirish/"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full transition-all hover:bg-white/5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
              <span className="text-[12px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors">LinkedIn</span>
            </a>
          </nav>

          {/* Live tag */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.1)" }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Actively Hiring</span>
          </div>
        </div>

        {/* Bottom section */}
        <div className="relative z-10 flex flex-col gap-3 p-6">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg w-full text-left transition-all hover:bg-white/5"
          >
            <Lock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-zinc-600 hover:text-zinc-400 transition-colors">Recruiter Sign In</span>
          </button>
          <div className="h-px bg-zinc-900" />
          <p className="text-[9px] font-semibold text-zinc-700 px-1">© {new Date().getFullYear()} Google Antigravity</p>
        </div>
      </aside>

      {/* ── MOBILE HEADER ──────────────────────────────────────── */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-5 py-4" style={{ background: "#09090b", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-[13px] font-bold text-white">Antigravity Careers</span>
        </div>
        <button onClick={() => router.push("/admin")} className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-semibold">
          <Lock className="w-3.5 h-3.5" />Admin
        </button>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────── */}
      <div className="flex-1 lg:ml-[260px] min-h-screen relative z-10 overflow-y-auto">

        {/* Hero section */}
        <div className="px-7 sm:px-10 pt-10 pb-8">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">We're hiring</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-zinc-900 leading-tight mb-3">
              Build what's<br />
              <span style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                next with us
              </span>
            </h1>
            <p className="text-zinc-500 text-[13.5px] font-medium max-w-md leading-relaxed">
              Join an ambitious, design-obsessed team that ships fast, thinks deeply, and builds infrastructure at scale.
            </p>
          </motion.div>
        </div>

        {/* Stats row */}
        {mounted && (
          <div className="px-7 sm:px-10 pb-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Open Roles", value: jobs.length, icon: <Briefcase className="w-4 h-4 text-zinc-400" /> },
                { label: "Departments", value: departments.length - 1, icon: <Building2 className="w-4 h-4 text-zinc-400" /> },
                { label: "Locations", value: uniqueLocations, icon: <Globe className="w-4 h-4 text-zinc-400" /> },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="bg-white border border-zinc-200/70 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all"
                >
                  <div className="flex items-center justify-between">{s.icon}
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{s.label}</span>
                  </div>
                  <span className="text-[28px] font-extralight tracking-tight text-zinc-900 leading-none tabular-nums">{s.value}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Search + filters */}
        <div className="px-7 sm:px-10 pb-5">
          <div className="bg-white border border-zinc-200/70 rounded-2xl p-3.5 flex flex-wrap gap-3 items-center shadow-sm">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] flex items-center gap-2 bg-zinc-50 border border-zinc-200/70 rounded-xl px-3.5 py-2.5 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-sm transition-all">
              <Search className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search roles, skills, cities..."
                className="w-full bg-transparent border-none outline-none text-[12.5px] font-semibold text-zinc-800 placeholder-zinc-400"
              />
              {searchQuery && <button onClick={() => setSearchQuery("")}><X className="w-3 h-3 text-zinc-400 hover:text-zinc-600" /></button>}
            </div>
            {/* Dept pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {departments.map(dept => {
                const active = (selectedDept || "All") === dept;
                return (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept === "All" ? "" : dept)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                      active ? "bg-zinc-950 text-white border-transparent shadow-sm" : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:text-zinc-800"
                    }`}
                  >{dept}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Job listings */}
        <div className="px-7 sm:px-10 pb-20">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="bg-white border border-zinc-200/70 rounded-2xl p-16 text-center shadow-sm">
              <Briefcase className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
              <p className="text-[13px] font-semibold text-zinc-400">
                {jobs.length === 0 ? "No open positions at this time." : "No results match your filters."}
              </p>
              {(searchQuery || selectedDept) && (
                <button onClick={() => { setSearchQuery(""); setSelectedDept(""); }} className="mt-4 text-xs font-bold text-blue-600 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="flex flex-col gap-2">
                {filteredJobs.map((job, i) => {
                  const t = getDeptTheme(job.department);
                  const isHovered = hoveredRow === job.id;
                  return (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      onHoverStart={() => setHoveredRow(job.id)}
                      onHoverEnd={() => setHoveredRow(null)}
                      onClick={() => openJobDrawer(job)}
                      className="group bg-white border rounded-2xl cursor-pointer overflow-hidden transition-all duration-200 shadow-sm"
                      style={{
                        borderColor: isHovered ? t.accent + "44" : "#e4e4e7",
                        boxShadow: isHovered ? `0 4px 24px -6px ${t.glow}, 0 1px 3px rgba(0,0,0,0.04)` : "0 1px 3px rgba(0,0,0,0.04)"
                      }}
                    >
                      <div className="flex items-center gap-0 relative">
                        {/* Color accent bar */}
                        <div
                          className="w-1 self-stretch flex-shrink-0 transition-all duration-300 rounded-l-2xl"
                          style={{ background: isHovered ? t.accent : "transparent", minWidth: "4px" }}
                        />

                        <div className="flex-1 flex items-center gap-5 px-5 py-4.5">
                          {/* Dept dot */}
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                            style={{ background: isHovered ? t.light : "#f4f4f5" }}>
                            <div className="w-2 h-2 rounded-full" style={{ background: t.dot }} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-zinc-900 group-hover:text-zinc-950 truncate tracking-tight transition-colors">
                              {job.title}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={`text-[9px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded-md border ${t.tag}`}>
                                {job.department}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                                <MapPin className="w-3 h-3" />{job.location}
                              </span>
                              <span className="text-[11px] font-medium text-zinc-400 hidden sm:inline">Full Time</span>
                            </div>
                          </div>

                          {/* CTA arrow */}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}
                            style={{ background: t.light }}>
                            <ArrowUpRight className="w-4 h-4" style={{ color: t.accent }} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── SLIDE-OVER DRAWER ────────────────────────────────── */}
      <AnimatePresence>
        {activeJob && theme && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={closeJobDrawer}
              className="fixed inset-0 z-30 backdrop-blur-sm"
              style={{ background: "rgba(9,9,11,0.55)" }}
            />

            {/* Panel */}
            <motion.div
              key="drawer"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 280, mass: 0.8 }}
              className="fixed inset-y-0 right-0 z-40 flex flex-col overflow-hidden"
              style={{ width: "min(640px, 100vw)", background: "#ffffff", borderLeft: "1px solid #e4e4e7" }}
            >
              {/* Department gradient header */}
              <div className="relative flex-shrink-0 px-7 pt-7 pb-6 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${theme.light.replace("0.08", "0.25")} 0%, rgba(255,255,255,0) 100%)`, borderBottom: "1px solid #f4f4f5" }}>
                {/* Subtle dept glow orb */}
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)` }} />

                {/* Header bar with accent stripe */}
                <div className="h-0.5 w-12 rounded-full mb-5" style={{ background: theme.accent }} />

                <div className="flex items-start justify-between gap-4 relative z-10">
                  <div>
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg border ${theme.tag} inline-block mb-3`}>
                      {activeJob.department}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 leading-snug mb-2.5">
                      {activeJob.title}
                    </h2>
                    <div className="flex items-center gap-3 text-[11.5px] font-semibold text-zinc-500">
                      <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{activeJob.location}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-300" />
                      <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />Full Time</span>
                    </div>
                  </div>
                  <button
                    onClick={closeJobDrawer}
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer border border-zinc-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div ref={drawerBodyRef} className="flex-1 overflow-y-auto premium-scrollbar">
                {submitted ? (
                  /* ── Receipt ─────────────────────────── */
                  <div className="flex flex-col items-center gap-6 p-8 py-10">
                    <div ref={receiptRef} className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-xl border border-zinc-100">
                      <div className="h-1" style={{ background: `linear-gradient(90deg, ${theme.accent}, #6366f1, #ec4899)` }} />
                      <div className="px-7 py-7 text-center border-b border-dashed border-zinc-100 relative">
                        <motion.div
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 250, damping: 14, delay: 0.1 }}
                          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border"
                          style={{ background: theme.light, borderColor: theme.accent + "33" }}
                        >
                          <CheckCircle2 className="w-7 h-7" style={{ color: theme.accent }} />
                        </motion.div>
                        <h3 className="text-lg font-bold text-zinc-950 tracking-tight">Application Received</h3>
                        <p className="text-[11px] font-medium text-zinc-400 mt-1">Thank you — we'll review your profile shortly.</p>
                        <div className="absolute -bottom-2.5 -left-2.5 w-5 h-5 rounded-full bg-zinc-50 border border-zinc-100" />
                        <div className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full bg-zinc-50 border border-zinc-100" />
                      </div>
                      <div className="px-7 py-6 flex flex-col gap-3.5">
                        {[
                          { label: "Reference", value: `#${submittedApp?.id?.slice(0, 8).toUpperCase() || "N/A"}`, mono: true },
                          { label: "Applicant", value: name },
                          { label: "Position", value: activeJob.title },
                          { label: "City", value: location },
                          { label: "Date", value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) }
                        ].map(row => (
                          <div key={row.label} className="flex justify-between items-center gap-4">
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{row.label}</span>
                            <span className={`text-[12px] text-right max-w-[55%] truncate ${row.mono ? "font-mono font-bold px-2 py-0.5 rounded-md border text-blue-600 bg-blue-50 border-blue-100" : "font-semibold text-zinc-800"}`}>
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="w-full max-w-sm flex flex-col gap-2.5">
                      <button onClick={handleDownloadPDF} disabled={isDownloading}
                        className="w-full py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                        style={{ background: theme.accent }}>
                        {isDownloading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</> : <><Download className="w-4 h-4" />Download Receipt</>}
                      </button>
                      <button onClick={closeJobDrawer} className="w-full py-3 rounded-xl text-xs font-bold text-zinc-600 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-all cursor-pointer">
                        Back to Listings
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Description + Form ──────────────── */
                  <div className="p-7 flex flex-col gap-8">
                    {/* Description */}
                    <div>
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.18em] mb-4">About the Role</p>
                      <div dangerouslySetInnerHTML={{ __html: renderMd(activeJob.description) }} />
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-zinc-100" />
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.18em]">Apply Now</span>
                      <div className="flex-1 h-px bg-zinc-100" />
                    </div>

                    {!showApply ? (
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowApply(true)}
                        className="w-full py-4 rounded-2xl text-[13px] font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
                        style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, #6366f1 100%)`, boxShadow: `0 8px 24px -6px ${theme.glow}` }}
                      >
                        <Briefcase className="w-4 h-4" />
                        Apply for {activeJob.title.split(",")[0]}
                        <ArrowUpRight className="w-4 h-4 ml-1" />
                      </motion.button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col gap-4"
                      >
                        {/* Full name */}
                        <div>
                          <FloatInput label="Full Name" value={name} onChange={setName} placeholder="e.g. Jane Doe" />
                          {errors.name && <p className="mt-1 text-[10px] font-bold text-rose-500">{errors.name}</p>}
                        </div>
                        {/* Email */}
                        <div>
                          <FloatInput label="Email Address" type="email" value={email} onChange={setEmail} placeholder="jane@company.com" />
                          {errors.email && <p className="mt-1 text-[10px] font-bold text-rose-500">{errors.email}</p>}
                        </div>
                        {/* Phone + City */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <FloatInput label="Phone Number" type="tel" value={phone} onChange={setPhone} placeholder="9876543210" prefix="+91" />
                            {errors.phone && <p className="mt-1 text-[10px] font-bold text-rose-500">{errors.phone}</p>}
                          </div>
                          <div>
                            <FloatInput label="Current City" value={location} onChange={setLocation} placeholder="e.g. Bangalore" />
                            {errors.location && <p className="mt-1 text-[10px] font-bold text-rose-500">{errors.location}</p>}
                          </div>
                        </div>

                        {/* File drop */}
                        <div>
                          <div className={`relative rounded-2xl border-2 border-dashed transition-all p-6 text-center cursor-pointer
                            ${resume ? "border-emerald-300 bg-emerald-50/30" : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-white"}`}>
                            <input type="file" accept=".pdf,.doc,.docx"
                              onChange={e => { const f = e.target.files?.[0]; if (f) setResume(f); }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            {resume ? (
                              <><CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                                <p className="text-[12px] font-bold text-emerald-700 truncate px-4">{resume.name}</p>
                                <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">File selected ✓</p></>
                            ) : (
                              <><Upload className="w-5 h-5 text-zinc-400 mx-auto mb-1.5" />
                                <p className="text-[12px] font-bold text-zinc-600">Drop your CV or click to browse</p>
                                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">PDF · DOC · DOCX — max 5 MB</p></>
                            )}
                          </div>
                          {errors.resume && <p className="mt-1 text-[10px] font-bold text-rose-500">{errors.resume}</p>}
                        </div>

                        {/* Submit */}
                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={formLoading}
                          onClick={handleSubmit}
                          className="w-full py-4 rounded-2xl text-[13px] font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-70"
                          style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, #6366f1 100%)`, boxShadow: `0 8px 24px -6px ${theme.glow}` }}
                        >
                          {formLoading ? (
                            <><div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
                          ) : (
                            <><CheckCircle2 className="w-4 h-4" />Submit Application</>
                          )}
                        </motion.button>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
