"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../../src/lib/supabase";
import {
  ArrowLeft, FileText, MapPin, Briefcase, ExternalLink, X,
  MessageSquare, Send, Users, ChevronRight, Loader2, Trash2,
  CheckCircle2, Clock, Eye, UserX, Search, Database, Sparkles,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../../../src/components/Header";

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

/* ─── Helpers ─── */
function parseComments(raw: string | null | undefined): Comment[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
  } catch { /* legacy plain text */ }
  return [{ id: "legacy", text: raw, created_at: new Date().toISOString(), author: "Admin" }];
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
  app, session, onStatusChange, onDelete, onOpenCV,
}: {
  app: Application;
  session: Session | null;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenCV: (url: string) => void;
}) {
  const [commentInput, setCommentInput] = useState("");
  const [comments, setComments] = useState<Comment[]>(() => parseComments(app.notes));
  const [posting, setPosting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState(false);

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
      .update({ notes: JSON.stringify(updated) })
      .eq("id", app.id);
    if (!error) { setComments(updated); setCommentInput(""); }
    setPosting(false);
  }

  async function deleteComment(cid: string) {
    if (!confirm("Delete this comment?")) return;
    const updated = comments.filter(c => c.id !== cid);
    const { error } = await supabase
      .from("applications")
      .update({ notes: JSON.stringify(updated) })
      .eq("id", app.id);
    if (!error) setComments(updated);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
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
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--neutral-900)", margin: 0 }}>{app.name}</h3>
            <StatusBadge status={app.status} />
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
      <div style={{ padding: "16px 24px", background: "rgba(0,0,0,0.005)" }}>
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
    </motion.div>
  );
}

/* ─── Main Page ─── */
export default function JobScreeningPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const jobId = params?.id;

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const [cvOpen, setCvOpen] = useState(false);
  const [selectedCV, setSelectedCV] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  /* Auth check */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) router.replace("/admin");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) router.replace("/admin");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  /* Load data */
  useEffect(() => {
    if (!session || !jobId) return;
    async function load() {
      setLoading(true);
      const [{ data: jobData }, { data: appsData }] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", jobId).single(),
        supabase.from("applications").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
      ]);
      if (jobData) setJob(jobData);
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

  /* Loading state */
  if (authLoading) {
    return (
      <main style={{ minHeight: "100vh", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #e8f0fe", borderTopColor: "var(--google-blue, #1a73e8)", animation: "spin 0.8s linear infinite" }} />
        <style jsx global>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "transparent", color: "var(--neutral-900)", position: "relative", zIndex: 1 }}>
      <Header session={session} />

      <div style={{ flex: 1, width: "100%", maxWidth: 1240, margin: "0 auto", padding: "110px 24px 80px" }}>

        {/* Breadcrumbs */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--neutral-400)", marginBottom: 28 }}>
          <button
            onClick={() => router.push("/admin")}
            style={{ border: "none", background: "none", color: "var(--neutral-500)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} /> Admin
          </button>
          <ChevronRight style={{ width: 14, height: 14, opacity: 0.5 }} />
          <span style={{ color: "var(--neutral-700)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
            {job?.title ?? "Listing"}
          </span>
          <ChevronRight style={{ width: 14, height: 14, opacity: 0.5 }} />
          <span style={{ color: "var(--google-blue)", fontWeight: 600 }}>Candidate Reviews</span>
        </div>

        {/* Page title header */}
        {job && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 36 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--google-blue)", background: "rgba(26,115,232,0.08)", padding: "4px 10px", borderRadius: 10, display: "inline-block", marginBottom: 12 }}>
                  {job.department}
                </span>
                <h1 style={{ fontSize: "clamp(24px, 3.2vw, 36px)", fontWeight: 600, letterSpacing: "-0.025em", color: "var(--neutral-900)", lineHeight: 1.15, fontFamily: '"Google Sans Display", "Google Sans", sans-serif', margin: 0 }}>
                  {job.title}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13.5, color: "var(--neutral-500)", fontWeight: 500, marginTop: 6 }}>
                  <MapPin style={{ width: 14, height: 14, color: "var(--neutral-400)" }} /> {job.location}
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
          </motion.div>
        )}

        {/* Toolbar */}
        {!loading && applications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "row", gap: 12, marginBottom: 28, flexWrap: "wrap" }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
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
          </motion.div>
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

      <footer style={{ borderTop: "1px solid rgba(0, 0, 0, 0.05)", padding: "24px 0", background: "rgba(255, 255, 255, 0.4)", backdropFilter: "blur(10px)", marginTop: "auto" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <p style={{ fontSize: 13, color: "var(--neutral-500)", fontWeight: 500 }}>© {new Date().getFullYear()} Google Antigravity. All rights reserved.</p>
          <div style={{ display: "flex", gap: 20 }}><a href="/jobs" style={{ fontSize: 13, color: "var(--neutral-500)", textDecoration: "none", fontWeight: 500 }}>Careers Desk</a></div>
        </div>
      </footer>
    </main>
  );
}
