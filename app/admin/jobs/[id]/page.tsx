"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../../src/lib/supabase";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import {
  ArrowLeft, FileText, MapPin, Briefcase, ExternalLink, X,
  MessageSquare, Send, Users, ChevronRight, Loader2, Trash2,
  CheckCircle2, Clock, Eye, UserX, Search, Database,
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

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  Pending:     { label: "Pending",     cls: "bg-amber-50 text-amber-700 border-amber-200",   icon: <Clock className="w-3 h-3" /> },
  Reviewed:    { label: "Reviewed",    cls: "bg-blue-50 text-blue-700 border-blue-200",       icon: <Eye className="w-3 h-3" /> },
  Shortlisted: { label: "Shortlisted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  Rejected:    { label: "Rejected",    cls: "bg-red-50 text-red-700 border-red-200",          icon: <UserX className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

/* ─── 3D Ring (lightweight background) ─── */
function FloatingRing() {
  return (
    <Float speed={1.8} rotationIntensity={0.9} floatIntensity={1.2}>
      <mesh rotation={[0.5, -0.5, 0]}>
        <torusGeometry args={[2, 0.45, 64, 128]} />
        <meshPhysicalMaterial
          transmission={0.95} opacity={1} transparent roughness={0.1}
          thickness={1} ior={1.5} color="#1a3bbd" clearcoat={1} clearcoatRoughness={0.1}
        />
      </mesh>
    </Float>
  );
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
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-[22px] overflow-hidden"
    >
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-[#E1E6EC]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h3 className="text-[18px] font-semibold tracking-tight">{app.name}</h3>
            <StatusBadge status={app.status} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[#737A87]">
            <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />{app.email}</span>
            {app.phone && <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />{app.phone}</span>}
            {app.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{app.location}</span>}
          </div>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B2BBC5]">
            Applied {new Date(app.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value={app.status}
            onChange={e => onStatusChange(app.id, e.target.value)}
            className="rounded-[10px] border border-[#E1E6EC] bg-white px-3 py-2 text-[13px] font-medium text-[#45474D] outline-none cursor-pointer hover:border-[#3279F9] transition-colors"
          >
            <option>Pending</option>
            <option>Reviewed</option>
            <option>Shortlisted</option>
            <option>Rejected</option>
          </select>
          <button
            onClick={() => onOpenCV(app.resume_url)}
            className="flex items-center gap-1.5 rounded-[10px] border border-[#E1E6EC] bg-white px-4 py-2 text-[13px] font-medium text-[#45474D] hover:border-[#3279F9] hover:text-[#3279F9] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View CV
          </button>
          <button
            disabled={moving || moved}
            onClick={handleMoveToDatabase}
            className={`flex items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-[13px] font-medium transition-all ${
              moved
                ? "bg-emerald-50 border-emerald-200 text-emerald-600 cursor-default"
                : "bg-white border-[#E1E6EC] text-[#45474D] hover:border-[#3279F9] hover:text-[#3279F9] active:scale-95 disabled:opacity-50"
            }`}
            title={moved ? "Moved to CV Database" : "Move CV to Database"}
          >
            {moving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : moved ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Database className="w-3.5 h-3.5 text-[#3279F9]" />
            )}
            {moved ? "In CV Database" : "Move to DB"}
          </button>
          <button
            onClick={() => onDelete(app.id)}
            className="rounded-[10px] border border-[#E1E6EC] bg-white p-2 text-red-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete application"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="px-6 py-5">
        <div
          onClick={() => setShowComments(!showComments)}
          className="flex items-center justify-between cursor-pointer hover:text-[#121317] transition-colors text-[#737A87]"
        >
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[#3279F9]" />
            <span className="text-[13px] font-semibold">Recruiter Comments</span>
            {comments.length > 0 && (
              <span className="ml-1 text-[11px] font-medium bg-[#EFF2F7] text-[#737A87] px-2 py-0.5 rounded-full">{comments.length}</span>
            )}
          </div>
          <span className="text-[12px] font-medium text-[#3279F9] hover:underline">
            {showComments ? "Hide Comments" : "Show Comments"}
          </span>
        </div>

        {/* Collapsible comment section */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-4 overflow-hidden"
            >
              {/* Comment list */}
              {comments.length > 0 && (
                <div className="max-h-[240px] overflow-y-auto mb-4 space-y-2 pr-1">
                  {comments.map(c => (
                    <div key={c.id} className="group relative bg-white/70 border border-[#E1E6EC] rounded-[12px] p-3 hover:bg-white hover:border-[#3279F9]/30 transition-all">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[12px] font-semibold text-[#1a3bbd] truncate max-w-[200px]" title={c.author}>
                          {c.author.split("@")[0]}
                        </span>
                        <span className="text-[10px] text-[#B2BBC5] shrink-0">
                          {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#45474D] whitespace-pre-wrap break-words leading-relaxed">{c.text}</p>
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 text-[#B2BBC5] hover:text-red-500 transition-all cursor-pointer"
                        title="Delete comment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New comment input */}
              <div className="flex gap-2">
                <textarea
                  placeholder="Add a comment…"
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) postComment(); }}
                  rows={2}
                  className="flex-1 rounded-[12px] border border-[#E1E6EC] bg-white/60 px-4 py-2.5 text-[13px] text-[#45474D] outline-none transition-all focus:border-[#3279F9] focus:bg-white resize-none"
                />
                <button
                  disabled={!commentInput.trim() || posting}
                  onClick={postComment}
                  className="btn-dark rounded-[12px] px-4 py-2 self-end flex items-center gap-1.5 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Post
                </button>
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

  /* Auth */
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

  /* Derived */
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

  /* Loading / auth states */
  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[rgba(50,121,249,0.25)] border-t-[#3279F9] animate-spin" />
      </main>
    );
  }

  return (
    <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] text-[#121317]">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: "high-performance" }}
          style={{ pointerEvents: "none" }}
        >
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

      <Header session={session} />

      <div className="relative z-10 flex-1 w-full max-w-screen-xl mx-auto px-6 sm:px-10 py-10 pb-24">

        {/* Breadcrumb / back */}
        <div className="flex items-center gap-2 mb-8 text-[14px] text-[#737A87]">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-1.5 hover:text-[#3279F9] transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Admin
          </button>
          <ChevronRight className="w-4 h-4 opacity-50" />
          <span className="text-[#121317] font-semibold truncate max-w-[240px]">
            {job?.title ?? "Job"}
          </span>
          <ChevronRight className="w-4 h-4 opacity-50" />
          <span className="text-[#3279F9] font-semibold">CV Screening</span>
        </div>

        {/* Page header */}
        {job && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
              <div>
                <span className="dept-tag mb-3 inline-block">{job.department}</span>
                <h1 className="text-[32px] font-bold tracking-[-0.025em] leading-tight">
                  {job.title}
                </h1>
                <div className="flex items-center gap-1.5 mt-1.5 text-[14px] text-[#737A87]">
                  <MapPin className="w-3.5 h-3.5" /> {job.location}
                </div>
              </div>

              {/* Status summary chips */}
              <div className="flex flex-wrap gap-2">
                {(["Pending", "Reviewed", "Shortlisted", "Rejected"] as const).map(s => (
                  <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border ${STATUS_CONFIG[s].cls}`}>
                    {STATUS_CONFIG[s].icon}
                    <span>{s}</span>
                    <span className="font-bold">{counts[s] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Toolbar */}
        {!loading && applications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row gap-3 mb-8"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737A87]" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-[12px] border border-[#E1E6EC] bg-white text-[14px] outline-none focus:border-[#3279F9] focus:ring-2 focus:ring-[#3279F9]/10 transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-[12px] border border-[#E1E6EC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#45474D] outline-none cursor-pointer hover:border-[#3279F9] transition-colors"
            >
              <option value="All">All Statuses ({applications.length})</option>
              <option value="Pending">Pending ({counts.Pending ?? 0})</option>
              <option value="Reviewed">Reviewed ({counts.Reviewed ?? 0})</option>
              <option value="Shortlisted">Shortlisted ({counts.Shortlisted ?? 0})</option>
              <option value="Rejected">Rejected ({counts.Rejected ?? 0})</option>
            </select>
          </motion.div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-10 h-10 rounded-full border-2 border-[rgba(50,121,249,0.25)] border-t-[#3279F9] animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-[24px] p-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#3279F9]/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-[#3279F9]" />
            </div>
            <h3 className="text-[18px] font-semibold mb-2">No applications yet</h3>
            <p className="text-[14px] text-[#737A87]">Candidates who apply for this role will appear here.</p>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-[24px] p-16 text-center">
            <p className="text-[16px] text-[#737A87]">No applicants match your search or filter.</p>
            <button onClick={() => { setSearch(""); setStatusFilter("All"); }} className="mt-3 text-[14px] font-medium text-[#3279F9] hover:underline">
              Clear filters
            </button>
          </motion.div>
        ) : (
          <div className="space-y-5">
            <p className="text-[13px] text-[#737A87] font-medium">
              Showing <span className="text-[#121317] font-semibold">{filtered.length}</span> of {applications.length} applicants
            </p>
            {filtered.map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ApplicantCard
                  app={app}
                  session={session}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onOpenCV={url => { setSelectedCV(url); setCvOpen(true); }}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* CV Viewer Modal */}
      <AnimatePresence>
        {cvOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[rgba(18,19,23,0.45)] backdrop-blur-[6px]"
              onClick={() => setCvOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 24 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative w-full max-w-5xl h-[92vh] rounded-[28px] bg-white border border-[#E1E6EC] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E6EC] bg-[#F8F9FC] shrink-0">
                <h3 className="text-[16px] font-semibold">Resume Viewer</h3>
                <div className="flex items-center gap-3">
                  <a
                    href={selectedCV}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-[10px] border border-[#E1E6EC] bg-white px-4 py-2 text-[13px] font-medium text-[#45474D] hover:text-[#3279F9] hover:border-[#3279F9] transition-colors"
                  >
                    Open in New Tab <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setCvOpen(false)}
                    className="rounded-full p-2 hover:bg-[#EFF2F7] text-[#737A87] hover:text-[#121317] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 p-4 bg-[#E1E6EC]">
                <iframe
                  src={selectedCV}
                  className="w-full h-full rounded-[16px] bg-white border border-[#CDD4DC]"
                  title="Resume"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>© {new Date().getFullYear()} Careers Portal</p>
          <div className="site-footer-links"><a href="/jobs">Careers</a></div>
        </div>
      </footer>
    </main>
  );
}
