"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../../src/lib/supabase";
import {
  ArrowLeft, FileText, MapPin, Briefcase, ExternalLink, X,
  MessageSquare, Send, Users, ChevronRight, Loader2, Trash2,
  CheckCircle2, Clock, Eye, UserX, Search, Database, Sparkles,
  Calendar, Mail, Plus, Copy, Check
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../../../src/components/Header";
import AnimatedBackground from "../../../../src/components/AnimatedBackground";

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Pending:     { label: "Pending",     color: "#f9ab00", bg: "rgba(249, 171, 0, 0.08)", border: "rgba(249, 171, 0, 0.18)", icon: <Clock className="w-3.5 h-3.5" /> },
  Reviewed:    { label: "Reviewed",    color: "#9b51e0", bg: "rgba(155, 81, 224, 0.08)", border: "rgba(155, 81, 224, 0.18)", icon: <Eye className="w-3.5 h-3.5" /> },
  Shortlisted: { label: "Shortlisted", color: "#1e8e3e", bg: "rgba(30, 142, 62, 0.08)", border: "rgba(30, 142, 62, 0.18)", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  Rejected:    { label: "Rejected",    color: "#d93025", bg: "rgba(217, 48, 37, 0.08)", border: "rgba(217, 48, 37, 0.18)", icon: <UserX className="w-3.5 h-3.5" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#5f6368", bg: "rgba(95, 99, 104, 0.08)", border: "rgba(95, 99, 104, 0.15)", icon: null };
  return (
    <span
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}
      className="inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-bold whitespace-nowrap"
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}

/* ─── Applicant Card Component ─── */
function ApplicantCard({
  app, session, onStatusChange, onDelete, onOpenCV, onSetUpInterview,
}: {
  app: Application;
  session: Session | null;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenCV: (url: string) => void;
  onSetUpInterview: (app: Application) => void;
}) {
  const [commentInput, setCommentInput] = useState("");
  const notesData = parseNotes(app.notes);
  const [comments, setComments] = useState<Comment[]>(notesData.comments);
  const [interview, setInterview] = useState<InterviewData | null>(notesData.interview);
  const [posting, setPosting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const nd = parseNotes(app.notes);
    setComments(nd.comments);
    setInterview(nd.interview);
  }, [app.notes]);

  function formatDateTime(str: string) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      }
    } catch {}
    return str;
  }

  async function handleMoveToDatabase() {
    if (moved) return;
    setMoving(true);
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
        setMoved(true);
      }
    } catch (e: any) {
      alert("Error moving to database: " + e.message);
    } finally {
      setMoving(false);
    }
  }

  async function postComment() {
    const text = commentInput.trim();
    if (!text) return;
    setPosting(true);
    const newComment: Comment = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      created_at: new Date().toISOString(),
      author: session?.user?.email ?? "Admin",
    };
    const updated = [...comments, newComment];
    const { error } = await supabase
      .from("applications")
      .update({ notes: JSON.stringify({ comments: updated, interview }) })
      .eq("id", app.id);
    if (!error) { setComments(updated); setCommentInput(""); }
    setPosting(false);
  }

  async function deleteComment(cid: string) {
    if (!confirm("Delete this comment?")) return;
    const updated = comments.filter(c => c.id !== cid);
    const { error } = await supabase
      .from("applications")
      .update({ notes: JSON.stringify({ comments: updated, interview }) })
      .eq("id", app.id);
    if (!error) setComments(updated);
  }

  return (
    <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      {/* Top Header Card Panel */}
      <div className="p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-100">
        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 leading-none">{app.name}</h3>
            <StatusBadge status={app.status} />
            {interview && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-bold whitespace-nowrap ${
                  interview.status === "scheduled"
                    ? "text-emerald-600 bg-emerald-50 border-emerald-150"
                    : "text-blue-600 bg-blue-50 border-blue-150 animate-pulse-slow"
                }`}
              >
                {interview.status === "scheduled" ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Interview: {formatDateTime(interview.selected_slot!)}</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "3s" }} />
                    <span>Awaiting Candidate Confirmation</span>
                  </>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-400 font-semibold">
            <span className="truncate flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {app.email}</span>
            {app.phone && <span className="flex items-center gap-1">• <Briefcase className="w-3.5 h-3.5" /> {app.phone}</span>}
            {app.location && <span className="flex items-center gap-1">• <MapPin className="w-3.5 h-3.5" /> {app.location}</span>}
            <span>• Applied {new Date(app.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-2 self-stretch xl:self-auto justify-end flex-wrap">
          <select
            value={app.status}
            onChange={e => onStatusChange(app.id, e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200/80 bg-white text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
          >
            <option>Pending</option>
            <option>Reviewed</option>
            <option>Shortlisted</option>
            <option>Rejected</option>
          </select>
          <button
            onClick={() => onOpenCV(app.resume_url)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/60 hover:border-slate-300 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <Eye className="w-3.5 h-3.5" /> View Resume
          </button>
          <button
            onClick={() => onSetUpInterview(app)}
            className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98] ${
              interview
                ? "bg-blue-50/50 hover:bg-blue-50 border-blue-100 text-blue-600"
                : "bg-white hover:bg-slate-50 border-slate-200/60 hover:border-slate-300 text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {interview ? "Interview Settings" : "Set Up Interview"}
          </button>
          <button
            disabled={moving || moved}
            onClick={handleMoveToDatabase}
            className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm ${
              moved
                ? "bg-emerald-50/50 border-emerald-100 text-emerald-600 cursor-default"
                : "bg-white hover:bg-slate-50 border-slate-200/60 hover:border-slate-300 text-slate-500 hover:text-slate-800 cursor-pointer active:scale-[0.98]"
            }`}
          >
            {moving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : moved ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Database className="w-3.5 h-3.5" />
            )}
            {moved ? "In CV DB" : "Move to DB"}
          </button>
          <button
            onClick={() => onDelete(app.id)}
            className="p-2 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 text-rose-500 hover:text-rose-700 rounded-xl transition-all cursor-pointer"
            title="Delete Application Record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recruiter Remarks section */}
      <div className="bg-slate-50/50 p-4">
        <div
          onClick={() => setShowComments(!showComments)}
          className="flex justify-between items-center cursor-pointer text-slate-500"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span>Evaluation Remarks</span>
            {comments.length > 0 && (
              <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{comments.length}</span>
            )}
          </div>
          <span className="text-xs font-bold text-blue-600 hover:underline">
            {showComments ? "Collapse comments" : "Expand comments"}
          </span>
        </div>

        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-4"
            >
              <div className="flex flex-col gap-4">
                {comments.length > 0 && (
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-3 pr-2">
                    {comments.map(c => (
                      <div key={c.id} className="comment-bubble p-3 rounded-2xl relative flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-blue-600">{c.author.split("@")[0]}</span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-[12.5px] text-slate-700 leading-relaxed pr-6">{c.text}</p>
                        
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="absolute top-2 right-2 border-none bg-none text-slate-300 hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <textarea
                    placeholder="Add evaluation note..."
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    rows={1}
                    className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 bg-white resize-none"
                  />
                  <button
                    disabled={!commentInput.trim() || posting}
                    onClick={postComment}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer self-end shadow-sm"
                  >
                    {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Add
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
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

  const [cvOpen, setCvOpen] = useState(false);
  const [selectedCV, setSelectedCV] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [schedulingApp, setSchedulingApp] = useState<Application | null>(null);
  const [proposedSlots, setProposedSlots] = useState<string[]>([""]);
  const [copied, setCopied] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

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
    return `mailto:${email}?subject=${subject}?&body=${body}`;
  }

  async function handleSaveSchedule() {
    if (!schedulingApp) return;
    const slots = proposedSlots.filter(s => s.trim() !== "");
    if (slots.length === 0) {
      alert("Please add at least one date/time slot.");
      return;
    }
    setSavingSchedule(true);

    const parsed = parseNotes(schedulingApp.notes);
    const updatedInterview: InterviewData = {
      proposed_slots: slots,
      selected_slot: parsed.interview?.selected_slot || null,
      status: parsed.interview?.status || "pending"
    };

    const updatedNotes = JSON.stringify({ comments: parsed.comments, interview: updatedInterview });
    const { error } = await supabase
      .from("applications")
      .update({ notes: updatedNotes })
      .eq("id", schedulingApp.id);

    if (!error) {
      setApplications(prev => prev.map(a => a.id === schedulingApp.id ? { ...a, notes: updatedNotes } : a));
      setSchedulingApp(prev => prev ? { ...prev, notes: updatedNotes } : null);
      setProposedSlots(slots);
      alert("Scheduling link generated successfully!");
    } else {
      alert("Failed to save scheduling settings: " + error.message);
    }
    setSavingSchedule(false);
  }

  async function handleCancelSchedule() {
    if (!schedulingApp) return;
    if (!confirm("Are you sure you want to cancel and delete the interview setup?")) return;
    setSavingSchedule(true);

    const parsed = parseNotes(schedulingApp.notes);
    const updatedNotes = JSON.stringify({ comments: parsed.comments, interview: null });
    const { error } = await supabase
      .from("applications")
      .update({ notes: updatedNotes })
      .eq("id", schedulingApp.id);

    if (!error) {
      setApplications(prev => prev.map(a => a.id === schedulingApp.id ? { ...a, notes: updatedNotes } : a));
      setSchedulingApp(null);
      setProposedSlots([""]);
    } else {
      alert("Failed to cancel schedule: " + error.message);
    }
    setSavingSchedule(false);
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

      if (appsData) setApplications(appsData);
      setLoading(false);
    }
    load();
  }, [session, jobId]);

  async function handleStatusChange(appId: string, status: string) {
    const { error } = await supabase.from("applications").update({ status }).eq("id", appId);
    if (error) { alert(error.message); return; }
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
  }

  async function handleDelete(appId: string) {
    if (!confirm("Are you sure you want to permanently delete this application?")) return;
    const { error } = await supabase.from("applications").delete().eq("id", appId);
    if (error) { alert(error.message); return; }
    setApplications(prev => prev.filter(a => a.id !== appId));
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
        <AnimatedBackground />
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin relative z-10" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F9FF] text-slate-800 relative z-10 flex flex-col overflow-hidden">
      <AnimatedBackground />
      <Header session={session} handleLogout={handleLogout} />

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pt-28 pb-20 relative z-10 flex flex-col gap-8">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-1 text-slate-400 hover:text-blue-600 transition-colors border-none bg-none cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Console
          </button>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="truncate max-w-[150px] font-medium">{job?.title ?? "Role Panel"}</span>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-blue-600 font-bold">Screening Pool</span>
        </div>

        {/* Screening Page Header Title */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200/40 pb-6">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-extrabold px-3 py-1 bg-blue-50 border border-blue-100 text-blue-600 rounded-full uppercase tracking-wider self-start">
              {job?.department ?? "Evaluation"}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 leading-tight">
              {job?.title ?? "Screening Panel"}
            </h1>
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-slate-300" /> {job?.location ?? "Remote / Hybrid"}
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
                  {cfg.icon}
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
          <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-slate-200/50 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search candidate profiles by name or email handle..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 bg-white/90 text-sm focus:outline-none focus:border-blue-600 focus:shadow-inner transition-all text-slate-800"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200/80 bg-white/90 text-xs font-bold text-slate-600 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="All">All Applications ({applications.length})</option>
              <option value="Pending">Pending ({counts.Pending ?? 0})</option>
              <option value="Reviewed">Reviewed ({counts.Reviewed ?? 0})</option>
              <option value="Shortlisted">Shortlisted ({counts.Shortlisted ?? 0})</option>
              <option value="Rejected">Rejected ({counts.Rejected ?? 0})</option>
            </select>
          </div>
        )}

        {/* Applications workspace results panel */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-16 border border-dashed border-slate-200 bg-white/40 backdrop-blur-md rounded-3xl text-center">
            <div className="w-14 h-14 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-4 shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">No candidate files loaded</h3>
            <p className="text-xs text-slate-400 font-medium">Submissions submitted for this role will register here automatically.</p>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 border border-slate-200/50 bg-white/50 backdrop-blur-md rounded-3xl text-center flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-slate-500">No applications match your search parameter filters.</p>
            <button
              onClick={() => { setSearch(""); setStatusFilter("All"); }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 underline border-none bg-none cursor-pointer"
            >
              Reset screening filter parameters
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Showing <span className="text-slate-800 font-extrabold">{filtered.length}</span> of {applications.length} active submissions
            </p>
            
            {filtered.map((app) => (
              <ApplicantCard
                key={app.id}
                app={app}
                session={session}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onOpenCV={url => { setSelectedCV(url); setCvOpen(true); }}
                onSetUpInterview={targetApp => {
                  setSchedulingApp(targetApp);
                  const parsed = parseNotes(targetApp.notes);
                  setProposedSlots(parsed.interview?.proposed_slots || [""]);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* CV Document Sandbox Modal */}
      <AnimatePresence>
        {cvOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
              onClick={() => setCvOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-4xl h-[85vh] bg-white border border-slate-200 rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 className="text-base font-bold text-slate-950">Candidate CV Sandbox</h3>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedCV}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition-all text-decoration-none"
                  >
                    Open Externally <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => setCvOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-100 p-4">
                <iframe src={selectedCV} className="w-full h-full border border-slate-200/50 rounded-2xl bg-white" title="Resume Document Sandbox" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interview Scheduling Configuration Overlay Modal */}
      <AnimatePresence>
        {schedulingApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setSchedulingApp(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-2xl flex flex-col gap-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-blue-100 bg-blue-50 flex items-center justify-center text-blue-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-950">Interview Scheduler</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Invite candidate {schedulingApp.name}</p>
                  </div>
                </div>
                <button onClick={() => setSchedulingApp(null)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Display if confirmed */}
              {parseNotes(schedulingApp.notes).interview && parseNotes(schedulingApp.notes).interview?.status === "scheduled" && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-600 shadow-sm animate-pulse-slow">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmed Slot: {formatDateTime(parseNotes(schedulingApp.notes).interview?.selected_slot!)}</span>
                </div>
              )}

              {/* Slots List config */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Proposed Slots Options</label>
                
                <div className="max-h-48 overflow-y-auto flex flex-col gap-2.5 pr-2 mb-1">
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
                        className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 bg-white"
                      />
                      <button
                        onClick={() => {
                          const updated = proposedSlots.filter((_, i) => i !== idx);
                          setProposedSlots(updated.length === 0 ? [""] : updated);
                        }}
                        className="p-2.5 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 text-rose-500 hover:text-rose-700 rounded-xl transition-all cursor-pointer"
                        title="Remove slot option"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setProposedSlots([...proposedSlots, ""])}
                  className="flex items-center gap-1.5 py-2 px-3 border border-dashed border-blue-200 hover:bg-blue-50/20 text-blue-600 font-bold text-xs rounded-xl cursor-pointer self-start transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Slot Option
                </button>
              </div>

              <div className="border-t border-slate-100 pt-6 flex flex-col gap-4 mt-2">
                <button
                  disabled={savingSchedule}
                  onClick={handleSaveSchedule}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-500/10 disabled:opacity-50"
                >
                  {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {parseNotes(schedulingApp.notes).interview ? "Save & Update Slots" : "Generate Booking Link"}
                </button>

                {parseNotes(schedulingApp.notes).interview && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Candidate Booking URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${window.location.origin}/schedule/${schedulingApp.id}`}
                          onClick={e => (e.target as HTMLInputElement).select()}
                          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/schedule/${schedulingApp.id}`);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className={`flex items-center gap-1 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            copied ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                          }`}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full mt-1">
                      <a
                        href={getMailtoUrl(schedulingApp.name, job?.title || "Job Application", `${window.location.origin}/schedule/${schedulingApp.id}`, schedulingApp.email)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-blue-150 bg-blue-50/50 hover:bg-blue-50 text-blue-600 text-xs font-bold rounded-xl text-decoration-none transition-all cursor-pointer"
                      >
                        <Mail className="w-4 h-4" /> Send Invite Email
                      </a>
                      <button
                        onClick={handleCancelSchedule}
                        className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-rose-500 font-bold text-xs rounded-xl cursor-pointer transition-all"
                      >
                        Cancel Scheduler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
