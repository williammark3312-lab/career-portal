"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../../src/lib/supabase";
import {
  ArrowLeft, FileText, MapPin, Briefcase, ExternalLink, X,
  MessageSquare, Send, Users, ChevronRight, Loader2, Trash2,
  CheckCircle2, Clock, Eye, UserX, Search, Database, Sparkles,
  Calendar, Mail, Plus, Copy, Check, Phone
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../../../src/components/Header";
import GlassBackground from "../../../../src/components/GlassBackground";

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
  Pending:     { label: "Pending",     color: "#d97706", bg: "#fef3c7", border: "#fde68a", dot: "#f59e0b", icon: <Clock className="w-3.5 h-3.5" /> },
  Reviewed:    { label: "Reviewed",    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", dot: "#8b5cf6", icon: <Eye className="w-3.5 h-3.5" /> },
  Shortlisted: { label: "Shortlisted", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", dot: "#10b981", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  Rejected:    { label: "Rejected",    color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", icon: <UserX className="w-3.5 h-3.5" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#71717a", bg: "#f4f4f5", border: "#e4e4e7", dot: "#a1a1aa", icon: null };
  return (
    <span
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-bold whitespace-nowrap"
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}

/* ─── Main Job Screening Workspace ─── */
export default function JobScreeningPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const jobId = params?.id;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  /* Toolbar State */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

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
  const [selectedCV, setSelectedCV] = useState("");

  /* Move to CV DB states */
  const [movingToDb, setMovingToDb] = useState<Record<string, boolean>>({});
  const [movedToDb, setMovedToDb] = useState<Record<string, boolean>>({});

  function formatDateTime(str: string) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      }
    } catch {}
    return str;
  }

  function getMailtoUrl(appName: string, jobTitle: string, link: string, email: string) {
    const subject = encodeURIComponent(`Interview Scheduling - ${jobTitle}`);
    const body = encodeURIComponent(
      `Hi ${appName},\n\n` +
      `Thank you for applying for the ${jobTitle} position.\n\n` +
      `We would like to schedule an interview with you. Please click the link below to view our proposed time slots and confirm a time that works best for you:\n\n` +
      `${link}\n\n` +
      `We look forward to speaking with you!\n\n` +
      `Best regards,\n` +
      `Recruitment Team`
    );
    return `mailto:${email}?subject=${subject}&body=${body}`;
  }

  /* Auth validation check */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      const isRecruiter =
        session?.user?.app_metadata?.role === "admin" ||
        session?.user?.user_metadata?.role === "admin" ||
        session?.user?.email === "williammark3312@gmail.com";
      if (!session || !isRecruiter) router.replace("/admin");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      const isRecruiter =
        s?.user?.app_metadata?.role === "admin" ||
        s?.user?.user_metadata?.role === "admin" ||
        s?.user?.email === "williammark3312@gmail.com";
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
        const firstApp = appsData[0] as any;
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
    } catch (e: any) {
      alert("Error moving to database: " + e.message);
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
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FF] relative overflow-hidden">
        <GlassBackground />
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin relative z-10" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F9FC] text-zinc-800 relative z-10 flex flex-col overflow-hidden">
      <GlassBackground />
      <Header session={session} handleLogout={handleLogout} />

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pt-28 pb-20 relative z-10 flex flex-col gap-6">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-1 text-zinc-400 hover:text-blue-600 transition-colors border-none bg-none cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Console
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
          <span className="truncate max-w-[150px] font-medium">{job?.title ?? "Role"}</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
          <span className="text-zinc-950 font-bold">Screening Pool</span>
        </div>

        {/* Screening Header Panel */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-200/50 pb-4">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-extrabold px-3 py-1 bg-zinc-950 text-white rounded-lg uppercase tracking-wider self-start shadow-sm">
              {job?.department ?? "Evaluation"}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 leading-tight">
              {job?.title ?? "Screening Pool Workspace"}
            </h1>
            <div className="flex items-center gap-1 text-xs font-semibold text-zinc-400">
              <MapPin className="w-3.5 h-3.5 text-zinc-300" /> {job?.location ?? "Remote / Hybrid"}
            </div>
          </div>

          {/* Quick stats counters indicators row */}
          <div className="flex flex-wrap gap-2">
            {(["Pending", "Reviewed", "Shortlisted", "Rejected"] as const).map(statusVal => {
              const cfg = STATUS_CONFIG[statusVal];
              return (
                <div
                  key={statusVal}
                  style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[11px] font-bold shadow-sm"
                >
                  <span>{statusVal}</span>
                  <span className="bg-white/80 px-1.5 py-0.5 rounded-md font-extrabold text-[9px] shadow-sm ml-1 text-slate-700">
                    {counts[statusVal] ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Search & Status Filter Toolbar */}
        {applications.length > 0 && (
          <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search candidate profiles by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200/80 bg-white text-xs font-semibold focus:outline-none focus:border-blue-600 transition-colors text-zinc-800"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-xl border border-zinc-200/80 bg-white text-xs font-bold text-zinc-650 focus:outline-none cursor-pointer"
            >
              <option value="All">All Applications ({applications.length})</option>
              <option value="Pending">Pending ({counts.Pending ?? 0})</option>
              <option value="Reviewed">Reviewed ({counts.Reviewed ?? 0})</option>
              <option value="Shortlisted">Shortlisted ({counts.Shortlisted ?? 0})</option>
              <option value="Rejected">Rejected ({counts.Rejected ?? 0})</option>
            </select>
          </div>
        )}

        {/* Applications DataTable Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <div className="p-16 border border-dashed border-zinc-200 bg-white/40 backdrop-blur-md rounded-2xl text-center">
            <Users className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 font-semibold">No candidate applications loaded.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 border border-zinc-200/50 bg-white/50 backdrop-blur-md rounded-2xl text-center flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-zinc-500">No applications match your search parameter filters.</p>
            <button
              onClick={() => { setSearch(""); setStatusFilter("All"); }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 underline border-none bg-none cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200/60 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Status</th>
                    <th>Date Applied</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app) => {
                    const statusStyle = STATUS_CONFIG[app.status] ?? { color: "#71717a", dot: "#a1a1aa" };
                    const initials = app.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                    
                    return (
                      <tr
                        key={app.id}
                        className="group cursor-pointer"
                        onClick={() => {
                          setActivePreviewApp(app);
                          const parsed = parseNotes(app.notes);
                          setProposedSlots(parsed.interview?.proposed_slots || [""]);
                        }}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 font-bold text-[11px] border border-zinc-200">
                              {initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-950">{app.name}</span>
                              <span className="text-xs text-zinc-400 font-semibold">{app.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <span style={{ backgroundColor: statusStyle.dot }} className="w-1.5 h-1.5 rounded-full" />
                            <span style={{ color: statusStyle.color }} className="text-xs font-bold">{app.status}</span>
                          </span>
                        </td>
                        <td className="text-xs font-semibold text-zinc-400">
                          {new Date(app.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="text-xs font-semibold text-zinc-500">
                          {app.location || "Remote"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── ╔══════╗ Right Slide-over Split screening workspace drawer ╔══════╗ ── */}
      <AnimatePresence>
        {activePreviewApp && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/20 backdrop-blur-sm"
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
              className="relative w-full max-w-4xl h-full bg-white shadow-2xl border-l border-zinc-200 z-10 flex flex-col md:flex-row overflow-hidden"
            >
              
              {/* LEFT HALF: Candidate Info, Remarks feed, Interview scheduler */}
              <div className="w-full md:w-1/2 h-full flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-100">
                <div className="flex-1 overflow-y-auto p-6 premium-scrollbar flex flex-col gap-6">
                  
                  {/* Drawer Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white font-extrabold text-xs">
                        {activePreviewApp.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-zinc-950">{activePreviewApp.name}</h2>
                        <span className="text-xs text-zinc-400 font-semibold">Candidate Application details</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActivePreviewApp(null);
                        setProposedSlots([""]);
                      }}
                      className="p-2 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 rounded-xl transition-all cursor-pointer"
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
                        className="flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-750 bg-white focus:outline-none cursor-pointer"
                      >
                        <option>Pending</option>
                        <option>Reviewed</option>
                        <option>Shortlisted</option>
                        <option>Rejected</option>
                      </select>

                      <button
                        disabled={movingToDb[activePreviewApp.id] || movedToDb[activePreviewApp.id]}
                        onClick={() => handleMoveToDatabase(activePreviewApp)}
                        className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm ${
                          movedToDb[activePreviewApp.id]
                            ? "bg-emerald-50 border-emerald-100 text-emerald-600 cursor-default"
                            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600 cursor-pointer active:scale-[0.98]"
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
                        className="p-2 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 text-rose-500 rounded-xl cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 flex flex-col gap-3 text-xs text-zinc-600 font-semibold">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-zinc-400" />
                      <span>{activePreviewApp.email}</span>
                    </div>
                    {activePreviewApp.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-zinc-400" />
                        <span>{activePreviewApp.phone}</span>
                      </div>
                    )}
                    {activePreviewApp.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-zinc-400" />
                        <span>{activePreviewApp.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Interview Scheduler Configuration */}
                  <div className="border-t border-zinc-100 pt-5 flex flex-col gap-4">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Interview Scheduling desk</span>
                    </label>

                    {parseNotes(activePreviewApp.notes).interview && parseNotes(activePreviewApp.notes).interview?.status === "scheduled" && (
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-600 shadow-sm animate-pulse-slow">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmed Slot: {formatDateTime(parseNotes(activePreviewApp.notes).interview?.selected_slot!)}</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-2.5">
                      <div className="flex flex-col gap-2">
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
                              className="flex-1 rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-800 focus:outline-none focus:border-blue-600 bg-white"
                            />
                            <button
                              onClick={() => {
                                const updated = proposedSlots.filter((_, i) => i !== idx);
                                setProposedSlots(updated.length === 0 ? [""] : updated);
                              }}
                              className="p-2.5 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 text-rose-500 hover:text-rose-700 rounded-xl cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 justify-between">
                        <button
                          onClick={() => setProposedSlots([...proposedSlots, ""])}
                          className="flex items-center gap-1.5 py-2 px-3 border border-dashed border-blue-200 hover:bg-blue-50/20 text-blue-600 font-bold text-xs rounded-xl cursor-pointer transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Slot Option
                        </button>
                        
                        <button
                          disabled={savingSchedule}
                          onClick={handleSaveSchedule}
                          className="py-2 px-4 bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm"
                        >
                          {savingSchedule ? "Saving..." : "Save proposed slots"}
                        </button>
                      </div>
                    </div>

                    {parseNotes(activePreviewApp.notes).interview && (
                      <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase">Booking URL</span>
                          <div className="flex gap-2 mt-1">
                            <input
                              type="text"
                              readOnly
                              value={`${window.location.origin}/schedule/${activePreviewApp.id}`}
                              onClick={e => (e.target as HTMLInputElement).select()}
                              className="flex-1 rounded-xl border border-zinc-200 bg-white p-2.5 text-xs text-zinc-500 focus:outline-none"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/schedule/${activePreviewApp.id}`);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              className={`flex items-center gap-1 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                copied ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-white hover:bg-slate-50 border-zinc-200 text-zinc-600"
                              }`}
                            >
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              <span>{copied ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2 w-full mt-1">
                          <a
                            href={getMailtoUrl(activePreviewApp.name, job?.title || "Job Opening", `${window.location.origin}/schedule/${activePreviewApp.id}`, activePreviewApp.email)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-blue-150 bg-blue-50/50 hover:bg-blue-50 text-blue-600 text-xs font-bold rounded-xl text-decoration-none transition-all cursor-pointer"
                          >
                            <Mail className="w-4 h-4" /> Email Link
                          </a>
                          <button
                            onClick={handleCancelSchedule}
                            className="px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-rose-500 font-bold text-xs rounded-xl cursor-pointer transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recruiter Remarks timeline feed */}
                  <div className="border-t border-zinc-100 pt-5 flex flex-col gap-4">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                      <span>Evaluations Remarks</span>
                    </label>

                    <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1 premium-scrollbar">
                      {parseNotes(activePreviewApp.notes).comments.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic">No notes created. Write evaluation remarks below.</p>
                      ) : (
                        parseNotes(activePreviewApp.notes).comments.map(comment => (
                          <div key={comment.id} className="comment-bubble p-3 rounded-2xl relative flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-blue-600">{comment.author.split("@")[0]}</span>
                              <span className="text-[9px] font-bold text-slate-400">
                                {new Date(comment.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-[12px] text-zinc-700 leading-relaxed pr-6">{comment.text}</p>
                            <button
                              onClick={() => deleteComment(comment.id)}
                              className="absolute top-2.5 right-2 text-zinc-300 hover:text-rose-500 cursor-pointer transition-colors border-none bg-none"
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
                <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex gap-2">
                  <textarea
                    placeholder="Append recruiter note..."
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    rows={1}
                    className="flex-1 rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-800 focus:outline-none bg-white resize-none"
                  />
                  <button
                    disabled={!commentInput.trim() || postingComment}
                    onClick={postComment}
                    className="bg-zinc-950 hover:bg-zinc-900 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm self-end"
                  >
                    {postingComment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Add
                  </button>
                </div>

              </div>

              {/* RIGHT HALF: Resume sandbox iframe */}
              <div className="w-full md:w-1/2 h-full bg-zinc-100 p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-500">Document Sandbox</span>
                  <a
                    href={activePreviewApp.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline text-decoration-none"
                  >
                    Open Externally <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <iframe
                  src={activePreviewApp.resume_url}
                  className="w-full flex-1 border border-zinc-200 rounded-2xl bg-white shadow-sm"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/20 backdrop-blur-sm" onClick={() => setCvOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-4xl h-[85vh] bg-white border border-zinc-200 rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-white">
                <h3 className="text-base font-bold text-zinc-950">Candidate CV Sandbox</h3>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedCV}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 border border-zinc-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-zinc-650 hover:text-zinc-900 transition-all text-decoration-none"
                  >
                    Open Externally <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => setCvOpen(false)} className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-700 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-zinc-100 p-4">
                <iframe src={selectedCV} className="w-full h-full border border-zinc-200 rounded-2xl bg-white" title="Resume Document Sandbox" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
