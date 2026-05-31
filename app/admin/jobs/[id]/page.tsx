"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../../src/lib/supabase";
import {
  ArrowLeft, FileText, MapPin, Briefcase, ExternalLink, X,
  MessageSquare, Send, Users, ChevronRight, Loader2, Trash2,
  CheckCircle2, Clock, Eye, UserX, Search, Database, Sparkles,
  Calendar, Mail, Plus, Copy, Check,
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

function parseComments(raw: string | null | undefined): Comment[] {
  return parseNotes(raw).comments;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Pending:     { label: "Pending",     color: "#f9ab00", bg: "rgba(249, 171, 0, 0.06)", border: "rgba(249, 171, 0, 0.12)", icon: <Clock className="w-3.5 h-3.5" /> },
  Reviewed:    { label: "Reviewed",    color: "#9b51e0", bg: "rgba(155, 81, 224, 0.06)", border: "rgba(155, 81, 224, 0.12)", icon: <Eye className="w-3.5 h-3.5" /> },
  Shortlisted: { label: "Shortlisted", color: "#1e8e3e", bg: "rgba(30, 142, 62, 0.06)", border: "rgba(30, 142, 62, 0.12)", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  Rejected:    { label: "Rejected",    color: "#d93025", bg: "rgba(217, 48, 37, 0.06)", border: "rgba(217, 48, 37, 0.12)", icon: <UserX className="w-3.5 h-3.5" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#5f6368", bg: "var(--neutral-100)", border: "rgba(0,0,0,0.06)", icon: null };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 10,
        fontSize: 11.5,
        fontWeight: 600,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}

/* ─── Google Brand colors for departments ─── */
function getDeptStyle(dept: string) {
  const d = dept.toLowerCase();
  if (d.includes("engineer") || d.includes("tech")) {
    return {
      color: "var(--google-blue, #1a73e8)",
      bg: "rgba(26, 115, 232, 0.06)",
      border: "rgba(26, 115, 232, 0.12)",
    };
  }
  if (d.includes("design") || d.includes("creative")) {
    return {
      color: "var(--google-yellow, #f9ab00)",
      bg: "rgba(249, 171, 0, 0.06)",
      border: "rgba(249, 171, 0, 0.12)",
    };
  }
  if (d.includes("market") || d.includes("growth")) {
    return {
      color: "var(--google-green, #1e8e3e)",
      bg: "rgba(30, 142, 62, 0.06)",
      border: "rgba(30, 142, 62, 0.12)",
    };
  }
  return {
    color: "var(--google-red, #d93025)",
    bg: "rgba(217, 48, 37, 0.06)",
    border: "rgba(217, 48, 37, 0.12)",
  };
}

/* ─── Applicant Card ─── */
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
    <div
      style={{
        borderRadius: 24,
        border: "1px solid rgba(0,0,0,0.06)",
        background: "rgba(255, 255, 255, 0.75)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.01)"
      }}
    >
      {/* Top bar */}
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "16px 16px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--neutral-900)", margin: 0 }}>{app.name}</h3>
            <StatusBadge status={app.status} />
            {interview && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 10,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: interview.status === "scheduled" ? "#1e8e3e" : "#1a73e8",
                  backgroundColor: interview.status === "scheduled" ? "rgba(30, 142, 62, 0.06)" : "rgba(26, 115, 232, 0.06)",
                  border: interview.status === "scheduled" ? "1px solid rgba(30, 142, 62, 0.12)" : "1px solid rgba(26, 115, 232, 0.12)",
                }}
              >
                {interview.status === "scheduled" ? (
                  <>
                    <CheckCircle2 style={{ width: 13, height: 13 }} />
                    <span>📅 Confirmed: {formatDateTime(interview.selected_slot!)}</span>
                  </>
                ) : (
                  <>
                    <Clock style={{ width: 13, height: 13 }} />
                    <span>⏳ Awaiting Candidate Slot Confirmation</span>
                  </>
                )}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12.5, color: "var(--neutral-500)", fontWeight: 500 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><FileText style={{ width: 13, height: 13, color: "var(--neutral-400)" }} />{app.email}</span>
            {app.phone && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Briefcase style={{ width: 13, height: 13, color: "var(--neutral-400)" }} />{app.phone}</span>}
            {app.location && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><MapPin style={{ width: 13, height: 13, color: "var(--neutral-400)" }} />{app.location}</span>}
            <span style={{ color: "var(--neutral-400)" }}>• Applied {new Date(app.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            value={app.status}
            onChange={e => onStatusChange(app.id, e.target.value)}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#ffffff",
              padding: "6px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--neutral-700)",
              outline: "none",
              cursor: "pointer"
            }}
          >
            <option>Pending</option>
            <option>Reviewed</option>
            <option>Shortlisted</option>
            <option>Rejected</option>
          </select>
          <button
            onClick={() => onOpenCV(app.resume_url)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0, 0, 0, 0.08)",
              background: "#ffffff",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--neutral-700)",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--neutral-50)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
          >
            <Eye style={{ width: 14, height: 14 }} /> View Resume
          </button>
          <button
            onClick={() => onSetUpInterview(app)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 12,
              border: interview ? "1px solid rgba(26,115,232,0.2)" : "1px solid rgba(0, 0, 0, 0.08)",
              background: interview ? "rgba(26,115,232,0.04)" : "#ffffff",
              color: interview ? "var(--google-blue)" : "var(--neutral-700)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              if (!interview) e.currentTarget.style.background = "var(--neutral-50)";
            }}
            onMouseLeave={(e) => {
              if (!interview) e.currentTarget.style.background = "#ffffff";
            }}
          >
            <Calendar style={{ width: 14, height: 14 }} />
            {interview ? "Interview Settings" : "Set Up Interview"}
          </button>
          <button
            disabled={moving || moved}
            onClick={handleMoveToDatabase}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 12,
              border: moved ? "1px solid rgba(30,142,62,0.2)" : "1px solid rgba(0, 0, 0, 0.08)",
              background: moved ? "rgba(30,142,62,0.04)" : "#ffffff",
              color: moved ? "var(--google-green)" : "var(--neutral-700)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: moved ? "default" : "pointer",
              transition: "all 0.2s",
              opacity: moving ? 0.65 : 1
            }}
          >
            {moving ? (
              <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
            ) : moved ? (
              <CheckCircle2 style={{ width: 14, height: 14 }} />
            ) : (
              <Database style={{ width: 14, height: 14 }} />
            )}
            {moved ? "In CV DB" : "Move to DB"}
          </button>
          <button
            onClick={() => onDelete(app.id)}
            style={{
              padding: "8px",
              borderRadius: 12,
              border: "1px solid rgba(217,48,37,0.12)",
              background: "rgba(217,48,37,0.04)",
              color: "var(--google-red)",
              cursor: "pointer",
              display: "inline-flex"
            }}
            title="Delete application"
          >
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Comments remarks block */}
      <div style={{ padding: "12px 16px", background: "rgba(0,0,0,0.005)" }}>
        <div
          onClick={() => setShowComments(!showComments)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: "var(--neutral-500)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
            <MessageSquare style={{ width: 14, height: 14, color: "var(--google-blue)" }} />
            <span>Recruiter Remarks</span>
            {comments.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(0,0,0,0.06)", color: "var(--neutral-700)", padding: "2px 6px", borderRadius: 8 }}>{comments.length}</span>
            )}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--google-blue)" }}>
            {showComments ? "Collapse Remarks" : "Expand Remarks"}
          </span>
        </div>

        {/* Collapsible comment section */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {comments.length > 0 && (
                  <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 6 }}>
                    {comments.map(c => (
                      <div key={c.id} style={{ position: "relative", padding: "12px", border: "1px solid rgba(0,0,0,0.05)", background: "#ffffff", borderRadius: 12, fontSize: 12.5 }} className="group">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: "var(--google-blue)" }}>{c.author.split("@")[0]}</span>
                          <span style={{ fontSize: 11, color: "var(--neutral-400)" }}>{new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p style={{ color: "var(--neutral-700)", margin: 0, lineHeight: 1.5 }}>{c.text}</p>
                        <button
                          onClick={() => deleteComment(c.id)}
                          style={{ position: "absolute", top: 10, right: 10, border: "none", background: "none", color: "var(--neutral-400)", cursor: "pointer", display: "flex" }}
                        >
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* New comment input */}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <textarea
                    placeholder="Append recruiter note..."
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    rows={1}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "#ffffff",
                      padding: "10px 14px",
                      fontSize: 12.5,
                      color: "var(--neutral-900)",
                      outline: "none",
                      resize: "none",
                      fontFamily: "inherit"
                    }}
                  />
                  <button
                    disabled={!commentInput.trim() || posting}
                    onClick={postComment}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 12,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                      border: "none",
                      color: "#ffffff",
                      background: "var(--google-blue, #1a73e8)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      alignSelf: "flex-end"
                    }}
                  >
                    {posting ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Send style={{ width: 12, height: 12 }} />}
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

/* ─── Main Page ─── */
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
    return `mailto:${email}?subject=${subject}&body=${body}`;
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

  /* Auth check */
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

  /* Load data */
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

  /* Filters implementation */
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

  /* Loading state */
  if (!mounted || authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F8F9FF] relative overflow-hidden">
        <AnimatedBackground />
        <div className="w-8 h-8 border-2 border-[var(--google-blue)]/30 border-t-[var(--google-blue)] rounded-full animate-spin relative z-10" />
      </main>
    );
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "#F8F9FF", color: "var(--neutral-900)", position: "relative", zIndex: 1 }}>
      <AnimatedBackground />
      <Header session={session} handleLogout={handleLogout} />

      <div style={{ flex: 1, width: "100%", maxWidth: 1240, margin: "0 auto", padding: "clamp(80px, 8vw, 100px) clamp(12px, 3vw, 24px) 80px" }}>

        {/* Breadcrumbs */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "#5f6368", marginBottom: 28 }}>
          <button
            onClick={() => router.push("/admin")}
            style={{ border: "none", background: "none", color: "#5f6368", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} /> Admin
          </button>
          <ChevronRight style={{ width: 14, height: 14, opacity: 0.5 }} />
          <span style={{ color: "#3c4043", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
            {job?.title ?? "Listing"}
          </span>
          <ChevronRight style={{ width: 14, height: 14, opacity: 0.5 }} />
          <span style={{ color: "#1a73e8", fontWeight: 600 }}>Candidate Reviews</span>
        </div>

        {/* Page title header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#1a73e8", background: "rgba(26,115,232,0.08)", padding: "4px 10px", borderRadius: 10, display: "inline-block", marginBottom: 12 }}>
                {job?.department ?? "Evaluation"}
              </span>
              <h1 style={{ color: "#121317", fontSize: "clamp(24px, 3.2vw, 36px)", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15, fontFamily: '"Google Sans Display", "Google Sans", sans-serif', margin: 0 }}>
                {job?.title ?? "Evaluation Dashboard"}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13.5, color: "#5f6368", fontWeight: 500, marginTop: 6 }}>
                <MapPin style={{ width: 14, height: 14, color: "#9aa0a6" }} /> {job?.location ?? "Remote / Hybrid"}
              </div>
            </div>

            {/* Status summary list */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {(["Pending", "Reviewed", "Shortlisted", "Rejected"] as const).map(s => {
                const sc = STATUS_CONFIG[s];
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: sc.color, backgroundColor: sc.bg, border: `1px solid ${sc.border}` }}>
                    {sc.icon}
                    <span>{s}</span>
                    <span style={{ fontWeight: 700, marginLeft: 2, background: "rgba(0,0,0,0.04)", padding: "1px 6px", borderRadius: 6 }}>{counts[s] ?? 0}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        {applications.length > 0 && (
          <div style={{ display: "flex", flexDirection: "row", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "min(100%, 260px)" }}>
              <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--neutral-400)" }} />
              <input
                type="text"
                placeholder="Search candidates by name or email address..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: 38,
                  paddingRight: 16,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: "#ffffff",
                  border: "1px solid rgba(0, 0, 0, 0.08)",
                  borderRadius: 24,
                  fontSize: 13.5,
                  color: "var(--neutral-900)",
                  outline: "none",
                  transition: "all 0.2s",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.01)"
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                borderRadius: 24,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "#ffffff",
                padding: "8px 16px",
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--neutral-700)",
                outline: "none",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.01)"
              }}
            >
              <option value="All">All Applications ({applications.length})</option>
              <option value="Pending">Pending ({counts.Pending ?? 0})</option>
              <option value="Reviewed">Reviewed ({counts.Reviewed ?? 0})</option>
              <option value="Shortlisted">Shortlisted ({counts.Shortlisted ?? 0})</option>
              <option value="Rejected">Rejected ({counts.Rejected ?? 0})</option>
            </select>
          </div>
        )}

        {/* Grid List */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 100 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #e8f0fe", borderTopColor: "var(--google-blue, #1a73e8)", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : applications.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: "60px 40px", borderRadius: 24, border: "1px dashed rgba(0,0,0,0.1)", textAlign: "center", background: "rgba(255,255,255,0.6)" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(26, 115, 232, 0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Users style={{ width: 22, height: 22, color: "var(--google-blue)" }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: "var(--neutral-900)" }}>No candidate profiles</h3>
            <p style={{ fontSize: 13.5, color: "var(--neutral-500)", margin: 0, fontWeight: 500 }}>Applications submitted for this opening will appear here in real time.</p>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: "50px 40px", borderRadius: 24, border: "1px solid rgba(0,0,0,0.06)", textAlign: "center", background: "rgba(255,255,255,0.6)" }}>
            <p style={{ fontSize: 14.5, color: "var(--neutral-500)", margin: "0 0 12px", fontWeight: 500 }}>No applications match your filtering configurations.</p>
            <button onClick={() => { setSearch(""); setStatusFilter("All"); }} style={{ border: "none", background: "none", color: "var(--google-blue)", fontWeight: 600, fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>
              Reset Filters
            </button>
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 13, color: "var(--neutral-500)", fontWeight: 600, margin: "0 0 4px" }}>
              Showing <span style={{ color: "var(--neutral-800)", fontWeight: 700 }}>{filtered.length}</span> of {applications.length} profiles
            </p>
            {filtered.map((app, i) => (
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

      {/* CV Resume Modal Sandbox */}
      <AnimatePresence>
        {cvOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.2)", backdropFilter: "blur(8px)" }}
              onClick={() => setCvOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 820,
                height: "85vh",
                borderRadius: 24,
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.08)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 10px 40px rgba(0,0,0,0.05)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.05)", background: "#ffffff", flexShrink: 0 }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--neutral-900)", margin: 0 }}>Resume Sandbox</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <a
                    href={selectedCV}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "#ffffff",
                      color: "var(--neutral-700)",
                      padding: "6px 12px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      textDecoration: "none"
                    }}
                  >
                    External view <ExternalLink style={{ width: 13, height: 13 }} />
                  </a>
                  <button
                    onClick={() => setCvOpen(false)}
                    style={{ border: "none", background: "none", color: "var(--neutral-400)", cursor: "pointer", display: "flex" }}
                  >
                    <X style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, background: "#f8f9ff", padding: 12 }}>
                <iframe
                  src={selectedCV}
                  style={{ width: "100%", height: "100%", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", background: "#ffffff" }}
                  title="Resume Sandbox"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interview Scheduling Settings Modal */}
      <AnimatePresence>
        {schedulingApp && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.25)", backdropFilter: "blur(8px)" }}
              onClick={() => setSchedulingApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 500,
                maxHeight: "90vh",
                borderRadius: 24,
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.08)",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 12px 48px rgba(0,0,0,0.12)",
                padding: "24px",
                zIndex: 101,
                overflow: "visible"
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(26,115,232,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Calendar style={{ width: 18, height: 18, color: "var(--google-blue)" }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--neutral-900)", margin: 0 }}>Interview Scheduler</h3>
                    <p style={{ fontSize: 12, color: "var(--neutral-500)", margin: 0 }}>Propose dates for {schedulingApp.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSchedulingApp(null)}
                  style={{ border: "none", background: "none", color: "var(--neutral-400)", cursor: "pointer", display: "flex", padding: 4 }}
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>

              {/* Status Display if confirmed */}
              {parseNotes(schedulingApp.notes).interview && parseNotes(schedulingApp.notes).interview?.status === "scheduled" && (
                <div style={{
                  padding: "12px 16px",
                  borderRadius: 16,
                  background: "rgba(30,142,62,0.06)",
                  border: "1px solid rgba(30,142,62,0.12)",
                  color: "#1e8e3e",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <CheckCircle2 style={{ width: 16, height: 16 }} />
                  <span>
                    <strong>Confirmed Slot:</strong> {formatDateTime(parseNotes(schedulingApp.notes).interview?.selected_slot!)}
                  </span>
                </div>
              )}

              {/* Propose Slots Scrollbox container */}
              <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--neutral-700)", marginBottom: 8 }}>
                  Proposed Date & Time Slots
                </label>
                
                <div style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  paddingRight: 6,
                  marginBottom: 12
                }}>
                  {proposedSlots.map((slot, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="datetime-local"
                        value={slot}
                        onChange={(e) => {
                          const updated = [...proposedSlots];
                          updated[idx] = e.target.value;
                          setProposedSlots(updated);
                        }}
                        style={{
                          flex: 1,
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.08)",
                          background: "#ffffff",
                          padding: "10px 14px",
                          fontSize: 13,
                          color: "var(--neutral-900)",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => {
                          const updated = proposedSlots.filter((_, i) => i !== idx);
                          setProposedSlots(updated.length === 0 ? [""] : updated);
                        }}
                        style={{
                          padding: "10px",
                          borderRadius: 12,
                          border: "1px solid rgba(217,48,37,0.12)",
                          background: "rgba(217,48,37,0.04)",
                          color: "var(--google-red)",
                          cursor: "pointer",
                          display: "inline-flex"
                        }}
                        title="Remove slot"
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setProposedSlots([...proposedSlots, ""])}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    alignSelf: "flex-start",
                    padding: "6px 12px",
                    borderRadius: 10,
                    border: "1px dashed rgba(26,115,232,0.3)",
                    background: "rgba(26,115,232,0.02)",
                    color: "var(--google-blue)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Plus style={{ width: 14, height: 14 }} /> Add Option
                </button>
              </div>

              {/* Action and Generated Link */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <button
                  disabled={savingSchedule}
                  onClick={handleSaveSchedule}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 14,
                    fontWeight: 600,
                    fontSize: 13.5,
                    cursor: "pointer",
                    border: "none",
                    color: "#ffffff",
                    background: "var(--google-blue, #1a73e8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {savingSchedule ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <Sparkles style={{ width: 16, height: 16 }} />}
                  {parseNotes(schedulingApp.notes).interview ? "Update & Save Slots" : "Generate Scheduling Link"}
                </button>

                {parseNotes(schedulingApp.notes).interview && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--neutral-500)" }}>Scheduling Link</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="text"
                          readOnly
                          value={`${window.location.origin}/schedule/${schedulingApp.id}`}
                          style={{
                            flex: 1,
                            borderRadius: 12,
                            border: "1px solid rgba(0,0,0,0.08)",
                            background: "rgba(0,0,0,0.02)",
                            padding: "8px 12px",
                            fontSize: 12.5,
                            color: "var(--neutral-600)",
                            outline: "none",
                          }}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/schedule/${schedulingApp.id}`);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "8px 12px",
                            borderRadius: 12,
                            border: "1px solid rgba(0,0,0,0.08)",
                            background: copied ? "rgba(30,142,62,0.06)" : "#ffffff",
                            color: copied ? "#1e8e3e" : "var(--neutral-700)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <a
                        href={getMailtoUrl(schedulingApp.name, job?.title || "Job Application", `${window.location.origin}/schedule/${schedulingApp.id}`, schedulingApp.email)}
                        style={{
                          flex: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          padding: "10px",
                          borderRadius: 12,
                          border: "1px solid rgba(26,115,232,0.15)",
                          background: "rgba(26,115,232,0.04)",
                          color: "var(--google-blue)",
                          fontSize: 12.5,
                          fontWeight: 600,
                          textDecoration: "none",
                          cursor: "pointer",
                          textAlign: "center"
                        }}
                      >
                        <Mail style={{ width: 14, height: 14 }} /> Email Candidate
                      </a>
                      <button
                        onClick={handleCancelSchedule}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.08)",
                          background: "#ffffff",
                          color: "var(--google-red)",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
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

      <footer style={{ borderTop: "1px solid rgba(0, 0, 0, 0.05)", padding: "24px 0", background: "rgba(255, 255, 255, 0.4)", backdropFilter: "blur(10px)", marginTop: "auto" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <p style={{ fontSize: 13, color: "var(--neutral-500)", fontWeight: 500 }}>© {new Date().getFullYear()} Google Antigravity. All rights reserved.</p>
          <div style={{ display: "flex", gap: 20 }}><a href="/jobs" style={{ fontSize: 13, color: "var(--neutral-500)", textDecoration: "none", fontWeight: 500 }}>Careers Desk</a></div>
        </div>
      </footer>
    </main>
  );
}
