"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../../src/lib/supabase";
import {
  ArrowLeft, MapPin, ExternalLink, X,
  MessageSquare, Send, Users, ChevronRight, Loader2, Trash2,
  CheckCircle2, Clock, Eye, UserX, Search, Database,
  Calendar, Mail, Plus, Copy, Check, Phone, ArrowRight
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../../../src/components/Header";
import Footer from "../../../../src/components/Footer";
import GlassBackground from "../../../../src/components/GlassBackground";
import { getAppBaseUrl } from "../../../../src/lib/appUrl";

/* ─── Types ─── */
interface Job {
  id: string; title: string; department: string; location: string; description: string;
}
interface Application {
  id: string; job_id: string; name: string; email: string; phone: string;
  location: string; resume_url: string; status: string; created_at: string; notes?: string;
}
interface Comment {
  id: string; text: string; created_at: string; author: string;
}

interface InterviewData {
  proposed_slots: string[];
  selected_slot: string | null;
  status: "pending" | "scheduled";
}

interface NotesData {
  comments: Comment[];
  interview: InterviewData | null;
}

/* ─── Helpers ─── */
function parseNotes(raw: string | null | undefined): NotesData {
  if (!raw) return { comments: [], interview: null };
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) {
      return { comments: p, interview: null };
    }
    if (p && typeof p === "object") {
      return {
        comments: Array.isArray(p.comments) ? p.comments : [],
        interview: p.interview || null
      };
    }
  } catch { /* legacy */ }
  return {
    comments: [{ id: "legacy", text: raw, created_at: new Date().toISOString(), author: "Admin" }],
    interview: null
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string; icon: React.ReactNode }> = {
  Pending:     { label: "Pending",     color: "#fbbf24", bg: "rgba(251, 191, 36, 0.15)", border: "rgba(251, 191, 36, 0.3)", dot: "#fbbf24", icon: <Clock className="w-3.5 h-3.5" /> },
  Reviewed:    { label: "Reviewed",    color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.3)", dot: "#a855f7", icon: <Eye className="w-3.5 h-3.5" /> },
  Shortlisted: { label: "Shortlisted", color: "#34d399", bg: "rgba(52, 211, 153, 0.15)", border: "rgba(52, 211, 153, 0.3)", dot: "#34d399", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  Rejected:    { label: "Rejected",    color: "#f87171", bg: "rgba(248, 113, 113, 0.15)", border: "rgba(248, 113, 113, 0.3)", dot: "#f87171", icon: <UserX className="w-3.5 h-3.5" /> },
};


/* ─── Main Job Screening Workspace ─── */
export default function JobScreeningPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const jobId = params?.id;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  /* Toolbar State */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [copiedShare, setCopiedShare] = useState(false);

  function handleCopyShareLink() {
    const link = `${getAppBaseUrl()}/jobs/${jobId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    });
  }

  /* Right Slide-over profile preview drawer */
  const [activePreviewApp, setActivePreviewApp] = useState<Application | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  /* Interview Scheduler State (inside drawer context) */
  const [proposedSlots, setProposedSlots] = useState<string[]>([""]);
  const [copied, setCopied] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  
  /* CV Viewer independent modal (fallback view) */
  const [cvOpen, setCvOpen] = useState(false);
  const [selectedCV] = useState("");

  /* Move to CV DB states */
  const [movingToDb, setMovingToDb] = useState<Record<string, boolean>>({});
  const [movedToDb, setMovedToDb] = useState<Record<string, boolean>>({});

  function formatDateTime(str: string) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const hours = d.getHours();
        const minutes = d.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
        const day = d.getDate();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames[d.getMonth()];
        const year = d.getFullYear();
        return `${day} ${month} ${year}, ${formattedHours}:${formattedMinutes} ${ampm}`;
      }
    } catch {}
    return str;
  }
  function getMailtoUrl(candidateName: string, jobTitle: string, link: string, email: string) {
    const subject = encodeURIComponent(`Interview Scheduling - Careers Portal`);
    const body = encodeURIComponent(
      `Hi ${candidateName},\n\n` +
      `We would like to schedule a discussion with you regarding potential opportunities. Please click the link below to view our proposed time slots and confirm a time that works best for you:\n\n` +
      `${link}\n\n` +
      `We look forward to speaking with you!\n\n` +
      `Best regards,\n` +
      `Recruitment Team`
    );
    return `mailto:${email}?subject=${subject}&body=${body}`;
  }

  /* Excel Export function */
  const handleExportApplications = () => {
    if (applications.length === 0) {
      alert("No applications data to export.");
      return;
    }
    const dataToExport = applications.map(a => ({
      ID: a.id,
      CandidateName: a.name,
      Email: a.email,
      Phone: a.phone,
      Location: a.location,
      Status: a.status,
      DateApplied: a.created_at
    }));
    
    const headers = Object.keys(dataToExport[0]).join(",");
    const rows = dataToExport.map(row => 
      Object.values(row).map(val => {
        let str = String(val === null || val === undefined ? "" : val);
        str = str.replace(/"/g, '""');
        if (str.includes(",") || str.includes("\n") || str.includes('"')) {
          str = `"${str}"`;
        }
        return str;
      }).join(",")
    );
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Applications_${job?.title || "Screening"}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* Auth validation check */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      const isRecruiter =
        session?.user?.app_metadata?.role === "admin" ||
        session?.user?.user_metadata?.role === "admin" ||
        session?.user?.app_metadata?.role === "superuser" ||
        session?.user?.user_metadata?.role === "superuser" ||
        session?.user?.email === "williammark3312@gmail.com" ||
        session?.user?.email === "anandugirish3312@gmail.com";
      if (!session || !isRecruiter) router.replace("/admin");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      const isRecruiter =
        s?.user?.app_metadata?.role === "admin" ||
        s?.user?.user_metadata?.role === "admin" ||
        s?.user?.app_metadata?.role === "superuser" ||
        s?.user?.user_metadata?.role === "superuser" ||
        s?.user?.email === "williammark3312@gmail.com" ||
        s?.user?.email === "anandugirish3312@gmail.com";
      if (!s || !isRecruiter) router.replace("/admin");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  /* Load database records */
  useEffect(() => {
    if (!session || !jobId) return;
    async function load() {
      setLoading(true);
      const [{ data: jobData, error: jobErr }, { data: appsData, error: appsErr }] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", jobId).single(),
        supabase.from("applications").select("*, jobs(*)").eq("job_id", jobId).order("created_at", { ascending: false }),
      ]);

      if (jobErr) console.error("Direct job load error:", jobErr);
      if (appsErr) console.error("Applications load error:", appsErr);

      if (jobData) {
        setJob(jobData);
      } else if (appsData && appsData.length > 0) {
        const firstApp = appsData[0] as unknown as { jobs?: Job | Job[] | null; job?: Job | Job[] | null };
        const joinedJob = firstApp.jobs || firstApp.job;
        if (joinedJob) {
          setJob(Array.isArray(joinedJob) ? (joinedJob[0] || null) : joinedJob);
        }
      }

      if (appsData) {
        setApplications(appsData);
        
        // Update active preview reference if open
        if (activePreviewApp) {
          const fresh = appsData.find(a => a.id === activePreviewApp.id);
          if (fresh) setActivePreviewApp(fresh);
        }
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, jobId]);

  /* Status update database call */
  async function handleStatusChange(appId: string, status: string) {
    const { error } = await supabase.from("applications").update({ status }).eq("id", appId);
    if (error) { alert(error.message); return; }
    
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
    if (activePreviewApp?.id === appId) {
      setActivePreviewApp(prev => prev ? { ...prev, status } : null);
    }
  }

  /* Delete application database call */
  async function handleDelete(appId: string) {
    if (!confirm("Are you sure you want to permanently delete this application?")) return;
    const { error } = await supabase.from("applications").delete().eq("id", appId);
    if (error) { alert(error.message); return; }
    
    setApplications(prev => prev.filter(a => a.id !== appId));
    if (activePreviewApp?.id === appId) {
      setActivePreviewApp(null);
    }
  }

  /* Move to CV DB database call */
  async function handleMoveToDatabase(app: Application) {
    if (movedToDb[app.id]) return;
    setMovingToDb(prev => ({ ...prev, [app.id]: true }));
    try {
      const { error } = await supabase.from("cv_database").insert([
        {
          name: app.name,
          email: app.email || null,
          phone: app.phone || null,
          cv_url: app.resume_url,
          comments: app.notes || null,
          status: "Not Called"
        }
      ]);
      if (error) {
        alert("Failed to move to CV Database: " + error.message);
      } else {
        setMovedToDb(prev => ({ ...prev, [app.id]: true }));
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      alert("Error moving to database: " + errMsg);
    } finally {
      setMovingToDb(prev => ({ ...prev, [app.id]: false }));
    }
  }

  /* Post remarks timeline comment call */
  async function postComment() {
    if (!activePreviewApp) return;
    const text = commentInput.trim();
    if (!text) return;
    setPostingComment(true);
    
    const notesData = parseNotes(activePreviewApp.notes);
    const newComment: Comment = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      created_at: new Date().toISOString(),
      author: session?.user?.email ?? "Admin",
    };
    const updatedComments = [...notesData.comments, newComment];
    const updatedNotes = JSON.stringify({ comments: updatedComments, interview: notesData.interview });
    
    const { error } = await supabase
      .from("applications")
      .update({ notes: updatedNotes })
      .eq("id", activePreviewApp.id);
      
    if (!error) {
      setApplications(prev => prev.map(a => a.id === activePreviewApp.id ? { ...a, notes: updatedNotes } : a));
      setActivePreviewApp(prev => prev ? { ...prev, notes: updatedNotes } : null);
      setCommentInput("");
    } else {
      alert(error.message);
    }
    setPostingComment(false);
  }

  /* Delete comment call */
  async function deleteComment(cid: string) {
    if (!activePreviewApp || !confirm("Delete this comment?")) return;
    
    const notesData = parseNotes(activePreviewApp.notes);
    const updatedComments = notesData.comments.filter(c => c.id !== cid);
    const updatedNotes = JSON.stringify({ comments: updatedComments, interview: notesData.interview });
    
    const { error } = await supabase
      .from("applications")
      .update({ notes: updatedNotes })
      .eq("id", activePreviewApp.id);
      
    if (!error) {
      setApplications(prev => prev.map(a => a.id === activePreviewApp.id ? { ...a, notes: updatedNotes } : a));
      setActivePreviewApp(prev => prev ? { ...prev, notes: updatedNotes } : null);
    } else {
      alert(error.message);
    }
  }

  /* Save Interview slots database call */
  async function handleSaveSchedule() {
    if (!activePreviewApp) return;
    const slots = proposedSlots.filter(s => s.trim() !== "");
    if (slots.length === 0) {
      alert("Please add at least one date/time slot.");
      return;
    }
    setSavingSchedule(true);

    const parsed = parseNotes(activePreviewApp.notes);
    const updatedInterview: InterviewData = {
      proposed_slots: slots,
      selected_slot: parsed.interview?.selected_slot || null,
      status: parsed.interview?.status || "pending"
    };

    const updatedNotes = JSON.stringify({ comments: parsed.comments, interview: updatedInterview });
    const { error } = await supabase
      .from("applications")
      .update({ notes: updatedNotes })
      .eq("id", activePreviewApp.id);

    if (!error) {
      setApplications(prev => prev.map(a => a.id === activePreviewApp.id ? { ...a, notes: updatedNotes } : a));
      setActivePreviewApp(prev => prev ? { ...prev, notes: updatedNotes } : null);
      setProposedSlots(slots);
      alert("Scheduling slots updated successfully!");
    } else {
      alert("Failed to save scheduling settings: " + error.message);
    }
    setSavingSchedule(false);
  }

  /* Cancel Interview Scheduler database call */
  async function handleCancelSchedule() {
    if (!activePreviewApp) return;
    if (!confirm("Are you sure you want to cancel and delete the interview setup?")) return;
    setSavingSchedule(true);

    const parsed = parseNotes(activePreviewApp.notes);
    const updatedNotes = JSON.stringify({ comments: parsed.comments, interview: null });
    const { error } = await supabase
      .from("applications")
      .update({ notes: updatedNotes })
      .eq("id", activePreviewApp.id);

    if (!error) {
      setApplications(prev => prev.map(a => a.id === activePreviewApp.id ? { ...a, notes: updatedNotes } : a));
      setActivePreviewApp(prev => prev ? { ...prev, notes: updatedNotes } : null);
      setProposedSlots([""]);
    } else {
      alert("Failed to cancel schedule: " + error.message);
    }
    setSavingSchedule(false);
  }

  /* Toolbar Filters logic */
  const filtered = applications.filter(a => {
    const matchSearch = !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (!mounted || authLoading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-white relative overflow-hidden font-space">
        <GlassBackground />
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin relative z-10" />
      </main>
    );
  }

  return (
    <main className="relative flex flex-col min-h-screen bg-[#050505] text-white">
      <GlassBackground />
      <Header session={session} handleLogout={handleLogout} activeAdminTab="jobs" />

      {/* Hero Section */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 pt-16 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center gap-1 text-zinc-500 hover:text-white transition-colors border-none bg-none cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Openings
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-800" />
            <span className="text-zinc-300 font-bold">{job?.department ?? "Evaluation"}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {job?.title ?? "Screening pool."}
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-lg">
            Review candidate applications, manage evaluation statuses, and schedule interviews.
          </p>

          {/* Minimal Info Row */}
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">
            <span>APPLICATIONS: {applications.length}</span>
            <span>•</span>
            <span>PENDING: {counts.Pending || 0}</span>
            <span>•</span>
            <span>SHORTLISTED: {counts.Shortlisted || 0}</span>
          </div>
        </motion.div>
      </section>

      {/* Search & Filter Bar Section */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-4"
        >
          {/* Top Control Bar: Search Input + Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Minimal Search Field */}
            <div
              className="flex-1 relative flex items-center bg-zinc-950/80 rounded-xl border border-zinc-900 focus-within:border-zinc-700 px-3.5 py-2.5 transition-all duration-200"
            >
              <Search className="w-4 h-4 mr-2.5 text-zinc-600" />
              <input
                type="text"
                placeholder="Search candidate profiles by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-xs text-zinc-200 placeholder-zinc-650 font-semibold"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="ml-2 p-1 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyShareLink}
                className="px-3.5 py-2.5 rounded-xl border border-zinc-900 bg-zinc-950/50 hover:bg-zinc-900 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedShare ? "Copied" : "Share Link"}</span>
              </button>
              <button
                onClick={handleExportApplications}
                className="px-3.5 py-2.5 rounded-xl border border-zinc-900 bg-zinc-950/50 hover:bg-zinc-900 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Export Excel
              </button>
            </div>
          </div>

          {/* Status Filter Pills Row */}
          <div className="flex items-center gap-2 flex-wrap pb-2">
            {["All", "Pending", "Reviewed", "Shortlisted", "Rejected"].map((status) => {
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    isActive
                      ? "bg-white text-black border-transparent"
                      : "bg-zinc-950/50 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-zinc-900 hover:border-zinc-800"
                  }`}
                >
                  {status} {status !== "All" && `(${counts[status] || 0})`}
                </button>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* Applications List Section */}
      <section className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 border border-zinc-900 bg-zinc-950/20 rounded-2xl">
            <div className="w-6 h-6 border-2 border-zinc-800 border-t-white rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-12 text-center">
            <p className="text-zinc-500 text-xs font-semibold">
              {applications.length === 0 ? "No candidate applications received for this vacancy." : "No applications match your search query or status filter."}
            </p>
          </div>
        ) : (
          <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden">
            <AnimatePresence mode="popLayout">
              {filtered.map((app, i) => {
                const statusStyle = STATUS_CONFIG[app.status] ?? { color: "#71717a", dot: "#a1a1aa" };
                const initials = app.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

                return (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => {
                      setActivePreviewApp(app);
                      const parsed = parseNotes(app.notes);
                      setProposedSlots(parsed.interview?.proposed_slots || [""]);
                    }}
                    className="w-full flex justify-between items-center py-5 px-6 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <div className="w-9 h-9 rounded-xl bg-zinc-950/40 border border-zinc-900 flex items-center justify-center text-zinc-300 font-extrabold text-[11px] shrink-0">
                        {initials}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-zinc-300 transition-colors truncate">
                          {app.name}
                        </h2>
                        <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                          <span>{app.email}</span>
                          <span>•</span>
                          <span>Applied {new Date(app.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {app.location && (
                        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                          <span>{app.location}</span>
                        </div>
                      )}
                      <span
                        style={{ color: statusStyle.color, borderColor: statusStyle.color + "30" }}
                        className="text-[10px] font-semibold bg-zinc-950/40 border px-3 py-1 rounded-md"
                      >
                        {app.status}
                      </span>
                      <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:translate-x-1 group-hover:text-white transition-all duration-200" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      <Footer />

      {/* ── ╔══════╗ Right Slide-over Split screening workspace drawer ╔══════╗ ── */}
      <AnimatePresence>
        {activePreviewApp && (
          <div className="fixed inset-0 z-[150] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
              onClick={() => {
                setActivePreviewApp(null);
                setProposedSlots([""]);
              }}
            />

            {/* Split drawer body */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 35 }}
              className="relative w-full max-w-4xl h-full bg-zinc-950 shadow-2xl border-l border-zinc-900 z-10 flex flex-col md:flex-row overflow-hidden"
            >
              
              {/* LEFT HALF: Candidate Info, Remarks feed, Interview scheduler */}
              <div className="w-full md:w-1/2 h-[55%] md:h-full flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-900">
                <div className="flex-1 overflow-y-auto p-8 premium-scrollbar flex flex-col gap-8">
                  
                  {/* Drawer Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white font-extrabold text-sm">
                        {activePreviewApp.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white leading-tight">{activePreviewApp.name}</h2>
                        <span className="text-xs text-zinc-500 font-semibold mt-0.5 block">Candidate Application details</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActivePreviewApp(null);
                        setProposedSlots([""]);
                      }}
                      className="p-2.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Actions Toolbar (Status Picker, Move to DB, Delete) */}
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <select
                        value={activePreviewApp.status}
                        onChange={e => handleStatusChange(activePreviewApp.id, e.target.value)}
                        className="flex-1 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-zinc-300 bg-zinc-950 focus:outline-none focus:border-zinc-700 cursor-pointer"
                      >
                        <option>Pending</option>
                        <option>Reviewed</option>
                        <option>Shortlisted</option>
                        <option>Rejected</option>
                      </select>

                      <button
                        disabled={movingToDb[activePreviewApp.id] || movedToDb[activePreviewApp.id]}
                        onClick={() => handleMoveToDatabase(activePreviewApp)}
                        className={`flex items-center gap-2 px-4 py-3 border rounded-xl text-sm font-bold transition-all shadow-sm ${
                          movedToDb[activePreviewApp.id]
                            ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-450 cursor-default"
                            : "bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 text-zinc-350 cursor-pointer active:scale-[0.98]"
                        }`}
                      >
                        {movingToDb[activePreviewApp.id] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : movedToDb[activePreviewApp.id] ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Database className="w-3.5 h-3.5" />
                        )}
                        <span>{movedToDb[activePreviewApp.id] ? "Archived" : "Archive"}</span>
                      </button>

                      <button
                        onClick={() => handleDelete(activePreviewApp.id)}
                        className="p-3.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/50 text-rose-400 rounded-xl cursor-pointer hover:text-rose-350 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-4 text-sm text-zinc-300 font-semibold shadow-sm">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-zinc-550" />
                      <span>{activePreviewApp.email}</span>
                    </div>
                    {activePreviewApp.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-zinc-550" />
                        <span>{activePreviewApp.phone}</span>
                      </div>
                    )}
                    {activePreviewApp.location && (
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-zinc-550" />
                        <span>{activePreviewApp.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Interview Scheduler Configuration */}
                  <div className="border-t border-zinc-900 pt-6 flex flex-col gap-5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span>Interview Scheduling desk</span>
                    </label>

                    {parseNotes(activePreviewApp.notes).interview && parseNotes(activePreviewApp.notes).interview?.status === "scheduled" && (
                      <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-2xl flex items-center gap-3 text-sm font-bold text-emerald-450 shadow-sm animate-pulse-slow">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Confirmed Slot: {formatDateTime(parseNotes(activePreviewApp.notes).interview?.selected_slot || "")}</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-3.5">
                      <div className="flex flex-col gap-2.5">
                        {proposedSlots.map((slot, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="datetime-local"
                              value={slot}
                              onChange={e => {
                                const updated = [...proposedSlots];
                                updated[idx] = e.target.value;
                                setProposedSlots(updated);
                              }}
                              className="flex-1 rounded-xl border border-zinc-800 p-3.5 text-sm text-white focus:outline-none focus:border-blue-500/80 bg-zinc-900/60"
                            />
                            <button
                              onClick={() => {
                                const updated = proposedSlots.filter((_, i) => i !== idx);
                                setProposedSlots(updated.length === 0 ? [""] : updated);
                              }}
                              className="p-3.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/50 text-rose-400 hover:text-rose-350 rounded-xl cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-3 justify-between items-center">
                        <button
                          onClick={() => setProposedSlots([...proposedSlots, ""])}
                          className="flex items-center gap-2 py-3 px-4 border border-dashed border-blue-900 hover:bg-blue-955/20 text-blue-400 font-bold text-xs rounded-xl cursor-pointer transition-all"
                        >
                          <Plus className="w-4 h-4" /> Add Slot Option
                        </button>
                        
                        <button
                          disabled={savingSchedule}
                          onClick={handleSaveSchedule}
                          className="py-3 px-5 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm"
                        >
                          {savingSchedule ? "Saving..." : "Save proposed slots"}
                        </button>
                      </div>
                    </div>

                    {parseNotes(activePreviewApp.notes).interview && (
                      <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Booking URL</span>
                          <div className="flex gap-3 mt-1.5">
                            <input
                              type="text"
                              readOnly
                              value={`${getAppBaseUrl()}/schedule/${activePreviewApp.id}`}
                              onClick={e => (e.target as HTMLInputElement).select()}
                              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 text-xs text-zinc-400 focus:outline-none"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${getAppBaseUrl()}/schedule/${activePreviewApp.id}`);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              className={`flex items-center gap-1.5 px-4 border rounded-xl text-sm font-bold transition-all cursor-pointer ${
                                copied ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-450" : "bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 text-zinc-300"
                              }`}
                            >
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              <span>{copied ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-3 w-full">
                          <a
                            href={getMailtoUrl(activePreviewApp.name, job?.title || "Job Opening", `${getAppBaseUrl()}/schedule/${activePreviewApp.id}`, activePreviewApp.email)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 border border-blue-900 bg-blue-950/20 hover:bg-blue-955/40 text-blue-450 hover:text-blue-400 text-sm font-bold rounded-xl text-decoration-none transition-all cursor-pointer"
                          >
                            <Mail className="w-4 h-4" /> Email Link
                          </a>
                          <button
                            onClick={handleCancelSchedule}
                            className="px-4 py-3 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-rose-500 font-bold text-sm rounded-xl cursor-pointer transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recruiter Remarks timeline feed */}
                  <div className="border-t border-zinc-900 pt-6 flex flex-col gap-4">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      <span>Evaluations Remarks</span>
                    </label>

                    <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1 premium-scrollbar">
                      {parseNotes(activePreviewApp.notes).comments.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No notes created. Write evaluation remarks below.</p>
                      ) : (
                        parseNotes(activePreviewApp.notes).comments.map(comment => (
                          <div key={comment.id} className="comment-bubble p-4 rounded-2xl relative flex flex-col gap-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-blue-400">{comment.author.split("@")[0]}</span>
                              <span className="text-[9px] font-bold text-zinc-500">
                                {new Date(comment.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-[12.5px] text-zinc-300 leading-relaxed pr-6">{comment.text}</p>
                            <button
                              onClick={() => deleteComment(comment.id)}
                              className="absolute top-3.5 right-3.5 text-zinc-500 hover:text-rose-500 cursor-pointer transition-colors border-none bg-none"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* Remarks comment input panel */}
                <div className="p-5 bg-zinc-950 border-t border-zinc-900 flex gap-3">
                  <textarea
                    placeholder="Append recruiter note..."
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    rows={1}
                    className="flex-1 rounded-xl border border-zinc-800 p-3.5 text-sm text-white focus:outline-none focus:border-blue-500/80 bg-zinc-900/60 resize-none placeholder-zinc-600"
                  />
                  <button
                    disabled={!commentInput.trim() || postingComment}
                    onClick={postComment}
                    className="bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl px-5 py-3 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm self-end"
                  >
                    {postingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Add
                  </button>
                </div>

              </div>

              {/* RIGHT HALF: Resume sandbox iframe */}
              <div className="w-full md:w-1/2 h-[45%] md:h-full bg-zinc-900/80 p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-zinc-500">Document Sandbox</span>
                  <a
                    href={activePreviewApp.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-bold text-blue-400 hover:underline text-decoration-none"
                  >
                    Open Externally <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <iframe
                  src={activePreviewApp.resume_url}
                  className="w-full flex-1 border border-zinc-800 rounded-2xl bg-zinc-950 shadow-sm"
                  title="Document Preview"
                />
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fallback independent resume modal dialog */}
      <AnimatePresence>
        {cvOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={() => setCvOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-4xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-zinc-900 flex justify-between items-center bg-zinc-950">
                <h3 className="text-base font-bold text-white">Candidate CV Sandbox</h3>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedCV}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all text-decoration-none"
                  >
                    Open Externally <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => setCvOpen(false)} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-zinc-900/60 p-4">
                <iframe src={selectedCV} className="w-full h-full border border-zinc-800 rounded-2xl bg-zinc-950" title="Resume Document Sandbox" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
