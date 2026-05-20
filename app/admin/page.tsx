"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../src/lib/supabase";
import { Canvas } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import { ArrowLeft, Plus, MapPin, Briefcase, FileText, ChevronRight, X, ExternalLink, LogOut, CheckCircle2, Save, Check, Upload, MessageSquare, Send } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../src/components/Header";

interface Job {
  id: string; title: string; department: string; location: string; description: string;
}
interface Application {
  id: string; job_id: string; name: string; email: string; phone: string;
  location: string; resume_url: string; status: string; created_at: string; notes?: string;
}
interface CVRecord {
  id: string; name: string; email: string; phone: string;
  cv_url: string; status: string; comments?: string; created_at: string;
}

interface Comment {
  id: string;
  text: string;
  created_at: string;
  author: string;
}

function parseComments(commentsStr: string | null | undefined): Comment[] {
  if (!commentsStr) return [];
  try {
    const parsed = JSON.parse(commentsStr);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    // Ignore, treat as legacy plain text
  }
  return [{
    id: "legacy",
    text: commentsStr,
    created_at: new Date().toISOString(),
    author: "Admin"
  }];
}

function FloatingRing() {
  return (
    <Float speed={1.8} rotationIntensity={0.9} floatIntensity={1.2}>
      <mesh rotation={[0.5, -0.5, 0]}>
        <torusGeometry args={[2, 0.45, 64, 128]} />
        <meshPhysicalMaterial 
          transmission={0.95} 
          opacity={1} 
          transparent 
          roughness={0.1} 
          thickness={1} 
          ior={1.5}
          color="#1a3bbd" 
          clearcoat={1} 
          clearcoatRoughness={0.1}
        />
      </mesh>
    </Float>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Pending:     "badge badge-pending",
  Reviewed:    "badge badge-reviewed",
  Shortlisted: "badge badge-shortlisted",
  Rejected:    "badge badge-rejected",
};

function StatusBadge({ status }: { status: string }) {
  return <span className={STATUS_STYLES[status] ?? "badge border-[#E1E6EC] text-[#45474D]"}>{status}</span>;
}

export default function AdminPage() {
  const [jobs, setJobs]                 = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedJob, setSelectedJob]   = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [editingJob, setEditingJob]     = useState<Job | null>(null);
  const [selectedCV, setSelectedCV]     = useState("");
  const [cvOpen, setCvOpen]             = useState(false);

  // Notes state: keyed by application id
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});
  const [noteSaved,  setNoteSaved]  = useState<Record<string, boolean>>({});

  // CV Database State
  const [activeTab, setActiveTab]       = useState<"jobs" | "cvs">("jobs");
  const [cvs, setCvs]                   = useState<CVRecord[]>([]);
  const [cvFilter, setCvFilter]         = useState("All");
  const [showCvModal, setShowCvModal]   = useState(false);
  const [uploadingCv, setUploadingCv]   = useState(false);
  
  // CV Upload Form
  const [cvName, setCvName]             = useState("");
  const [cvEmail, setCvEmail]           = useState("");
  const [cvPhone, setCvPhone]           = useState("");
  const [cvFile, setCvFile]             = useState<File | null>(null);

  // CV Comments State
  const [cvCommentValues, setCvCommentValues] = useState<Record<string, string>>({});
  const [cvCommentSaved, setCvCommentSaved]   = useState<Record<string, boolean>>({});

  const descRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle]           = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation]     = useState("");
  const [description, setDescription] = useState("");

  // Auth State
  const [session, setSession]         = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail]     = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError]     = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) loadJobs();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadJobs();
    });

    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => { if (selectedJob) loadApplications(selectedJob); }, [selectedJob]);
  useEffect(() => { if (activeTab === "cvs") loadCvs(); }, [activeTab]);

  async function loadJobs() {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (data) setJobs(data);
  }
  async function loadApplications(jobId: string) {
    const { data } = await supabase.from("applications").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
    if (data) {
      setApplications(data);
      // Seed controlled note values from DB
      const seed: Record<string, string> = {};
      data.forEach((a: Application) => { seed[a.id] = a.notes || ""; });
      setNoteValues(seed);
    }
  }
  async function loadCvs() {
    const { data } = await supabase.from("cv_database").select("*").order("created_at", { ascending: false });
    if (data) {
      setCvs(data);
      const seed: Record<string, string> = {};
      data.forEach((cv: CVRecord) => { seed[cv.id] = cv.comments || ""; });
      setCvCommentValues(seed);
    }
  }
  function openCreate() {
    setEditingJob(null); setTitle(""); setDepartment(""); setLocation(""); setDescription(""); setShowModal(true);
  }
  function openEdit(job: Job) {
    setEditingJob(job); setTitle(job.title); setDepartment(job.department); setLocation(job.location); setDescription(job.description); setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditingJob(null); }
  function closeCvModal() { setShowCvModal(false); setCvName(""); setCvEmail(""); setCvPhone(""); setCvFile(null); }

  async function handleSave() {
    if (!title.trim() || !department.trim() || !location.trim() || !description.trim()) { alert("All fields are required."); return; }
    if (editingJob) {
      const { error } = await supabase.from("jobs").update({ title, department, location, description }).eq("id", editingJob.id);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from("jobs").insert([{ title, department, location, description }]);
      if (error) { alert(error.message); return; }
    }
    closeModal(); loadJobs();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job posting?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    if (selectedJob === id) { setSelectedJob(""); setApplications([]); }
    loadJobs();
  }

  async function handleStatus(appId: string, status: string) {
    const { error } = await supabase.from("applications").update({ status }).eq("id", appId);
    if (error) alert(error.message);
    else loadApplications(selectedJob);
  }

  async function handleDeleteApp(appId: string) {
    if (!confirm("Are you sure you want to permanently delete this candidate's application?")) return;
    const { error } = await supabase.from("applications").delete().eq("id", appId);
    if (error) alert(error.message);
    else loadApplications(selectedJob);
  }

  async function handleUpdateNotes(appId: string, notes: string) {
    const { error } = await supabase.from("applications").update({ notes }).eq("id", appId);
    if (error) alert("Failed to save notes: " + error.message);
    else {
      setApplications(apps => apps.map(a => a.id === appId ? { ...a, notes } : a));
    }
  }

  async function handleUploadCv() {
    if (!cvName.trim() || !cvFile) { alert("Name and CV file are required."); return; }
    try {
      setUploadingCv(true);
      const fileName = `${Date.now()}-${cvFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("resumes").upload(fileName, cvFile);
      if (uploadErr) { alert(uploadErr.message); return; }
      
      const { data: { publicUrl } } = supabase.storage.from("resumes").getPublicUrl(fileName);
      
      const { error } = await supabase.from("cv_database").insert([
        { name: cvName, email: cvEmail, phone: cvPhone, cv_url: publicUrl, status: "Not Called" }
      ]);
      if (error) { alert(error.message); return; }
      
      closeCvModal();
      loadCvs();
    } catch {
      alert("Something went wrong uploading the CV.");
    } finally {
      setUploadingCv(false);
    }
  }

  async function handleCvStatus(cvId: string, status: string) {
    const { error } = await supabase.from("cv_database").update({ status }).eq("id", cvId);
    if (error) alert(error.message);
    else loadCvs();
  }

  async function handleDeleteCv(cvId: string) {
    if (!confirm("Are you sure you want to delete this CV?")) return;
    const { error } = await supabase.from("cv_database").delete().eq("id", cvId);
    if (error) alert(error.message);
    else loadCvs();
  }

  async function handleUpdateCvComments(cvId: string, comments: string) {
    const { error } = await supabase.from("cv_database").update({ comments }).eq("id", cvId);
    if (error) alert("Failed to save comments: " + error.message);
    else {
      setCvs(prev => prev.map(c => c.id === cvId ? { ...c, comments } : c));
    }
  }

  function insertBold() {
    const ta = descRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd, t = description;
    const hasBold = s >= 2 && t.slice(s-2,s) === "**" && t.slice(e,e+2) === "**";
    let next: string, ns: number, ne: number;
    if (hasBold) { next=t.slice(0,s-2)+t.slice(s,e)+t.slice(e+2); ns=s-2; ne=e-2; }
    else { next=t.slice(0,s)+`**${t.slice(s,e)}**`+t.slice(e); ns=s+2; ne=e+2; }
    setDescription(next);
    setTimeout(()=>{ ta.focus(); ta.selectionStart=ns; ta.selectionEnd=ne; },0);
  }

  function insertHeading() {
    const ta = descRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd, t = description;
    const lineStart = t.slice(0,s).lastIndexOf("\n")+1;
    const prefix = t.slice(lineStart,lineStart+3);
    let next: string, ns: number, ne: number;
    if (prefix==="## ") { next=t.slice(0,lineStart)+t.slice(lineStart+3); ns=Math.max(s-3,lineStart); ne=Math.max(e-3,lineStart); }
    else { next=t.slice(0,lineStart)+`## ${t.slice(lineStart)}`; ns=s+3; ne=e+3; }
    setDescription(next);
    setTimeout(()=>{ ta.focus(); ta.selectionStart=ns; ta.selectionEnd=ne; },0);
  }

  function insertBullet() {
    const ta = descRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd, t = description;
    const sel = t.slice(s,e);
    const lines = sel.split("\n");
    const allBullet = lines.every(l => !l.trim() || l.startsWith("• "));
    const result = allBullet
      ? lines.map(l => l.startsWith("• ") ? l.slice(2) : l).join("\n")
      : lines.map(l => l.trim() && !l.startsWith("• ") ? `• ${l}` : l).join("\n");
    setDescription(t.slice(0,s)+result+t.slice(e));
    setTimeout(()=>{ ta.focus(); ta.selectionStart=s; ta.selectionEnd=s+result.length; },0);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true); setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    } else {
      setLoginSuccess(true);
      setAuthLoading(false);
      // The onAuthStateChange listener will set the session automatically.
      // We just wait for the success animation to finish, then it transitions.
      setTimeout(() => setLoginSuccess(false), 1500);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (authLoading && !loginSuccess) {
    return (
      <main className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[rgba(50,121,249,0.25)] border-t-[#3279F9] animate-spin" />
      </main>
    );
  }

  if (loginSuccess) {
    return (
      <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] items-center justify-center text-[#121317]">
        <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: "high-performance" }} style={{ pointerEvents: "none" }}>
            <ambientLight intensity={1.4} />
            <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
            <Suspense fallback={null}><FloatingRing /><Environment preset="city" /></Suspense>
          </Canvas>
        </div>
        
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass relative z-10 flex flex-col items-center justify-center rounded-[24px] p-10 w-full max-w-sm">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-16 h-16 bg-[#3279F9]/10 text-[#3279F9] rounded-full flex items-center justify-center mb-5"
          >
            <CheckCircle2 className="w-8 h-8" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[20px] font-bold text-[#1a3bbd]"
          >
            Login Successful
          </motion.h2>
        </motion.div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] items-center justify-center text-[#121317]">
        <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: "high-performance" }} style={{ pointerEvents: "none" }}>
            <ambientLight intensity={1.4} />
            <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
            <Suspense fallback={null}><FloatingRing /><Environment preset="city" /></Suspense>
          </Canvas>
        </div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass relative z-10 w-full max-w-sm rounded-[24px] p-8">
          <div className="text-center mb-8">
            <h1 className="text-[24px] font-bold text-[#1a3bbd] mb-1">Admin Panel</h1>
            <p className="text-[14px] text-[#737A87]">Sign in to manage jobs</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="form-label">Email</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required className="form-input" placeholder="admin@example.com" />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required className="form-input" placeholder="••••••••" />
            </div>
            {authError && <p className="text-[13px] text-red-500 text-center">{authError}</p>}
            <button type="submit" disabled={authLoading} className="btn-dark w-full mt-2">
              Sign In
            </button>
          </form>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] text-[#121317]">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: "high-performance" }} style={{ pointerEvents: "none" }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
          <Suspense fallback={null}><FloatingRing /><Environment preset="city" /></Suspense>
        </Canvas>
      </div>

      {/* Header */}
      <Header session={session} handleLogout={handleLogout} />

      {/* Content */}
      <div className="relative z-10 flex-1 w-full max-w-screen-xl mx-auto px-6 sm:px-10 py-12 pb-24">

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-10 p-1 bg-white/40 border border-[#E1E6EC] rounded-[16px] inline-flex">
          <button onClick={() => setActiveTab("jobs")}
            className={`px-6 py-2.5 rounded-[12px] text-[14px] font-medium transition-all ${
              activeTab === "jobs" ? "bg-white shadow-sm text-[#1a3bbd]" : "text-[#737A87] hover:text-[#121317]"
            }`}
          >
            Jobs & Applications
          </button>
          <button onClick={() => setActiveTab("cvs")}
            className={`px-6 py-2.5 rounded-[12px] text-[14px] font-medium transition-all ${
              activeTab === "cvs" ? "bg-white shadow-sm text-[#1a3bbd]" : "text-[#737A87] hover:text-[#121317]"
            }`}
          >
            CV Database
          </button>
        </div>

        {activeTab === "jobs" && (
          <>
            {/* Jobs Section */}
            <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="flex items-start justify-between mb-8 gap-4">
            <div>
              <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Job Listings</h1>
              <p className="text-[#737A87] mt-1 text-[14px]">Manage your open positions and track applicants.</p>
            </div>
            <button onClick={openCreate} className="btn-primary shrink-0">
              <Plus className="w-4 h-4" /> New Job
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="glass rounded-[24px] p-16 text-center">
              <p className="text-[16px] text-[#737A87]">No jobs posted yet. Click &quot;New Job&quot; to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {jobs.map((job, i) => (
                <motion.div key={job.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: i*0.06 }}>
                  <div
                    onClick={() => setSelectedJob(job.id)}
                    className={`glass glass-hover rounded-[22px] p-6 cursor-pointer border-2 transition-all ${
                      selectedJob === job.id
                        ? "border-[#3279F9] shadow-[0_0_28px_-6px_rgba(50,121,249,0.22)]"
                        : "border-transparent"
                    }`}
                  >
                    <span className="dept-tag mb-4 inline-block">{job.department}</span>
                    <h2 className="text-[18px] font-semibold tracking-tight mb-1">{job.title}</h2>
                    <div className="flex items-center gap-1.5 text-[13px] text-[#737A87] mb-4">
                      <MapPin className="w-3.5 h-3.5" />{job.location}
                    </div>
                    <p className="text-[13px] text-[#737A87] line-clamp-2 leading-[1.6] mb-5">
                      {job.description.replace(/#{1,3} |[*_~`•]/g, "")}
                    </p>
                    <div className="flex gap-2 pt-4 border-t border-[#E1E6EC]">
                      <button onClick={e => { e.stopPropagation(); openEdit(job); }}
                        className="flex-1 rounded-[10px] border border-[#E1E6EC] bg-white px-3 py-2 text-[13px] font-medium text-[#45474D] hover:border-[#3279F9] hover:text-[#3279F9] transition-colors">
                        Edit
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(job.id); }}
                        className="flex-1 rounded-[10px] border border-[#E1E6EC] bg-white px-3 py-2 text-[13px] font-medium text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Applications Section */}
        <AnimatePresence>
          {selectedJob && (
            <motion.section key="apps" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.5 }}
              className="mt-16 pt-12 border-t border-[#E1E6EC]"
            >
              <div className="mb-8">
                <h2 className="text-[24px] font-semibold tracking-tight flex items-center gap-2 flex-wrap">
                  <span className="text-[#3279F9]">{jobs.find(j => j.id === selectedJob)?.title ?? "Job"}</span>
                  <ChevronRight className="w-5 h-5 text-[#737A87]" />
                  Applicants
                  {applications.length > 0 && (
                    <span className="text-[13px] font-medium text-[#737A87] bg-[#EFF2F7] px-3 py-1 rounded-full">{applications.length}</span>
                  )}
                </h2>
              </div>

              {applications.length === 0 ? (
                <div className="glass rounded-[24px] p-16 text-center">
                  <p className="text-[16px] text-[#737A87]">No applications received yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((app, i) => (
                    <motion.div key={app.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i*0.05 }}
                      className="glass glass-hover rounded-[20px] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-[17px] font-semibold">{app.name}</h3>
                          <StatusBadge status={app.status} />
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-[#737A87]">
                          <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />{app.email}</span>
                          <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />{app.phone}</span>
                          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{app.location}</span>
                        </div>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B2BBC5]">
                          Applied {new Date(app.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 w-full lg:w-auto mt-4 lg:mt-0">
                        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start lg:self-end">
                          <select value={app.status} onChange={e => handleStatus(app.id, e.target.value)}
                            className="rounded-[10px] border border-[#E1E6EC] bg-white px-3 py-2 text-[13px] font-medium text-[#45474D] outline-none cursor-pointer hover:border-[#3279F9] transition-colors"
                          >
                            <option>Pending</option>
                            <option>Reviewed</option>
                            <option>Shortlisted</option>
                            <option>Rejected</option>
                          </select>
                          <button onClick={() => { setSelectedCV(app.resume_url); setCvOpen(true); }}
                            className="flex items-center gap-1.5 rounded-[10px] border border-[#E1E6EC] bg-white px-4 py-2 text-[13px] font-medium text-[#45474D] hover:border-[#3279F9] hover:text-[#3279F9] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> View CV
                          </button>
                          <button onClick={() => handleDeleteApp(app.id)}
                            className="rounded-[10px] border border-[#E1E6EC] bg-white px-3 py-2 text-[13px] font-medium text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                        <div className="flex flex-col gap-1.5 w-full lg:w-[350px] border-t border-[#E1E6EC] pt-4 mt-2">
                          <div className="flex items-center gap-1.5 mb-2 text-[#737A87]">
                            <MessageSquare className="w-4 h-4 text-[#3279F9]" />
                            <span className="text-[13px] font-semibold">Comments</span>
                          </div>
                          
                          {/* Comments List */}
                          {(() => {
                            const comments = parseComments(app.notes);
                            return (
                              <>
                                {comments.length > 0 && (
                                  <div className="max-h-[160px] overflow-y-auto mb-3 space-y-2 pr-1.5">
                                    {comments.map((comment) => (
                                      <div key={comment.id} className="bg-white/60 border border-[#E1E6EC] rounded-[10px] p-2.5 text-[12px] relative group transition-all hover:bg-white hover:border-[#3279F9]/30">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <span className="font-semibold text-[#1a3bbd] truncate max-w-[170px]" title={comment.author}>
                                            {comment.author.split('@')[0]}
                                          </span>
                                          <span className="text-[10px] text-[#B2BBC5]">
                                            {new Date(comment.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                                          </span>
                                        </div>
                                        <p className="text-[#45474D] whitespace-pre-wrap break-words leading-relaxed">{comment.text}</p>
                                        <button
                                          onClick={async () => {
                                            if (confirm("Are you sure you want to delete this comment?")) {
                                              const updated = comments.filter(c => c.id !== comment.id);
                                              await handleUpdateNotes(app.id, JSON.stringify(updated));
                                            }
                                          }}
                                          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 text-[#B2BBC5] hover:text-red-500 transition-all cursor-pointer"
                                          title="Delete Comment"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                <div className="flex flex-col gap-1.5">
                                  <textarea
                                    placeholder="Post a comment..."
                                    value={noteValues[app.id] ?? ""}
                                    onChange={(e) => setNoteValues(v => ({ ...v, [app.id]: e.target.value }))}
                                    className="w-full h-[60px] rounded-[10px] border border-[#E1E6EC] bg-white/50 px-3 py-2 text-[13px] text-[#45474D] outline-none transition-all focus:border-[#3279F9] focus:bg-white resize-none"
                                  />
                                  <button
                                    disabled={!(noteValues[app.id] ?? "").trim()}
                                    onClick={async () => {
                                      const text = (noteValues[app.id] ?? "").trim();
                                      if (!text) return;
                                      const newComment: Comment = {
                                        id: Math.random().toString(36).substring(2, 9),
                                        text,
                                        created_at: new Date().toISOString(),
                                        author: session?.user?.email ?? "Admin"
                                      };
                                      const updated = [...comments, newComment];
                                      await handleUpdateNotes(app.id, JSON.stringify(updated));
                                      setNoteValues(v => ({ ...v, [app.id]: "" }));
                                    }}
                                    className="btn-dark py-1.5 px-3 rounded-[9px] text-[12px] font-medium self-end flex items-center gap-1.5 hover:bg-[#3279F9] disabled:opacity-50 disabled:hover:bg-[#121317] disabled:cursor-not-allowed transition-all cursor-pointer"
                                  >
                                    <Send className="w-3 h-3" /> Post Comment
                                  </button>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
          </>
        )}

        {activeTab === "cvs" && (
          <motion.section key="cv_database" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
              <div>
                <h1 className="text-[30px] font-semibold tracking-[-0.02em]">CV Database</h1>
                <p className="text-[#737A87] mt-1 text-[14px]">Upload and manage candidate resumes for future use.</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={cvFilter}
                  onChange={(e) => setCvFilter(e.target.value)}
                  className="rounded-[10px] border border-[#E1E6EC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#45474D] outline-none cursor-pointer hover:border-[#3279F9] transition-colors"
                >
                  <option value="All">All CVs</option>
                  <option value="Not Called">Not Called</option>
                  <option value="Called">Called</option>
                  <option value="Interviewing">Interviewing</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <button onClick={() => setShowCvModal(true)} className="btn-primary shrink-0">
                  <Upload className="w-4 h-4" /> Upload CV
                </button>
              </div>
            </div>

            {cvs.length === 0 ? (
              <div className="glass rounded-[24px] p-16 text-center">
                <p className="text-[16px] text-[#737A87]">No CVs uploaded yet. Click &quot;Upload CV&quot; to add one.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cvs.filter(c => cvFilter === "All" || c.status === cvFilter).map((cv, i) => (
                  <motion.div key={cv.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i*0.05 }}
                    className="glass glass-hover rounded-[20px] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-[17px] font-semibold">{cv.name}</h3>
                        <span className={`badge ${cv.status === 'Called' ? 'bg-emerald-100 text-emerald-700' : cv.status === 'Interviewing' ? 'bg-blue-100 text-blue-700' : cv.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                          {cv.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-[#737A87]">
                        {cv.email && <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />{cv.email}</span>}
                        {cv.phone && <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />{cv.phone}</span>}
                      </div>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B2BBC5]">
                        Uploaded {new Date(cv.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 w-full lg:w-auto mt-4 lg:mt-0">
                      <div className="flex flex-wrap items-center gap-3 shrink-0 self-start lg:self-end">
                        <select value={cv.status} onChange={e => handleCvStatus(cv.id, e.target.value)}
                          className="rounded-[10px] border border-[#E1E6EC] bg-white px-3 py-2 text-[13px] font-medium text-[#45474D] outline-none cursor-pointer hover:border-[#3279F9] transition-colors"
                        >
                          <option>Not Called</option>
                          <option>Called</option>
                          <option>Interviewing</option>
                          <option>Rejected</option>
                        </select>
                        <button onClick={() => { setSelectedCV(cv.cv_url); setCvOpen(true); }}
                          className="flex items-center gap-1.5 rounded-[10px] border border-[#E1E6EC] bg-white px-4 py-2 text-[13px] font-medium text-[#45474D] hover:border-[#3279F9] hover:text-[#3279F9] transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View CV
                        </button>
                        <button onClick={() => handleDeleteCv(cv.id)}
                          className="rounded-[10px] border border-[#E1E6EC] bg-white px-3 py-2 text-[13px] font-medium text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex flex-col gap-1.5 w-full lg:w-[350px] border-t border-[#E1E6EC] pt-4 mt-2">
                        <div className="flex items-center gap-1.5 mb-2 text-[#737A87]">
                          <MessageSquare className="w-4 h-4 text-[#3279F9]" />
                          <span className="text-[13px] font-semibold">Comments</span>
                        </div>
                        
                        {/* Comments List */}
                        {(() => {
                          const cvComments = parseComments(cv.comments);
                          return (
                            <>
                              {cvComments.length > 0 && (
                                <div className="max-h-[160px] overflow-y-auto mb-3 space-y-2 pr-1.5">
                                  {cvComments.map((comment) => (
                                    <div key={comment.id} className="bg-white/60 border border-[#E1E6EC] rounded-[10px] p-2.5 text-[12px] relative group transition-all hover:bg-white hover:border-[#3279F9]/30">
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="font-semibold text-[#1a3bbd] truncate max-w-[170px]" title={comment.author}>
                                          {comment.author.split('@')[0]}
                                        </span>
                                        <span className="text-[10px] text-[#B2BBC5]">
                                          {new Date(comment.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                                        </span>
                                      </div>
                                      <p className="text-[#45474D] whitespace-pre-wrap break-words leading-relaxed">{comment.text}</p>
                                      <button
                                        onClick={async () => {
                                          if (confirm("Are you sure you want to delete this comment?")) {
                                            const updated = cvComments.filter(c => c.id !== comment.id);
                                            await handleUpdateCvComments(cv.id, JSON.stringify(updated));
                                          }
                                        }}
                                        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 text-[#B2BBC5] hover:text-red-500 transition-all cursor-pointer"
                                        title="Delete Comment"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              <div className="flex flex-col gap-1.5">
                                <textarea
                                  placeholder="Post a comment..."
                                  value={cvCommentValues[cv.id] ?? ""}
                                  onChange={(e) => setCvCommentValues(v => ({ ...v, [cv.id]: e.target.value }))}
                                  className="w-full h-[60px] rounded-[10px] border border-[#E1E6EC] bg-white/50 px-3 py-2 text-[13px] text-[#45474D] outline-none transition-all focus:border-[#3279F9] focus:bg-white resize-none"
                                />
                                <button
                                  disabled={!(cvCommentValues[cv.id] ?? "").trim()}
                                  onClick={async () => {
                                    const text = (cvCommentValues[cv.id] ?? "").trim();
                                    if (!text) return;
                                    const newComment: Comment = {
                                      id: Math.random().toString(36).substring(2, 9),
                                      text,
                                      created_at: new Date().toISOString(),
                                      author: session?.user?.email ?? "Admin"
                                    };
                                    const updated = [...cvComments, newComment];
                                    await handleUpdateCvComments(cv.id, JSON.stringify(updated));
                                    setCvCommentValues(v => ({ ...v, [cv.id]: "" }));
                                  }}
                                  className="btn-dark py-1.5 px-3 rounded-[9px] text-[12px] font-medium self-end flex items-center gap-1.5 hover:bg-[#3279F9] disabled:opacity-50 disabled:hover:bg-[#121317] disabled:cursor-not-allowed transition-all cursor-pointer"
                                >
                                  <Send className="w-3 h-3" /> Post Comment
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>
        )}
      </div>

      {/* Job Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[rgba(18,19,23,0.4)] backdrop-blur-[6px]" onClick={closeModal}
            />
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-2xl rounded-[28px] bg-white border border-[#E1E6EC] p-8 sm:p-10 max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-start justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-tight">{editingJob ? "Edit Job Listing" : "Create Job Listing"}</h2>
                  <p className="text-[13px] text-[#737A87] mt-1">{editingJob ? "Modify the details of this role." : "Add a new role to your careers portal."}</p>
                </div>
                <button onClick={closeModal} className="rounded-full p-2 hover:bg-[#EFF2F7] text-[#737A87] hover:text-[#121317] transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="form-label">Job Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Engineer" className="form-input" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="form-label">Department</label>
                    <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Location</label>
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Remote / Bangalore" className="form-input" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Job Description</label>
                  <div className="flex items-center gap-2 mb-2 p-1.5 bg-[#F8F9FC] border border-[#E1E6EC] rounded-[10px]">
                    {[
                      { label: "B", title: "Bold",    fn: insertBold,    cls: "font-bold" },
                      { label: "H", title: "Heading", fn: insertHeading, cls: "font-semibold" },
                      { label: "• List", title: "Bullet", fn: insertBullet, cls: "" },
                    ].map(b => (
                      <button key={b.title} type="button" title={b.title} onClick={b.fn}
                        className={`rounded-[8px] bg-white border border-[#E1E6EC] px-3 py-1.5 text-[13px] ${b.cls} text-[#121317] hover:border-[#3279F9] hover:text-[#3279F9] transition-colors`}
                      >{b.label}</button>
                    ))}
                  </div>
                  <textarea ref={descRef} value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Full job description…" rows={10} className="form-input resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#E1E6EC] flex flex-col-reverse sm:flex-row gap-3">
                <button onClick={closeModal} className="btn-secondary flex-1 sm:flex-none">Cancel</button>
                <button onClick={handleSave} className="btn-dark flex-1">{editingJob ? "Save Changes" : "Publish Job"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CV Viewer */}
      <AnimatePresence>
        {cvOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[rgba(18,19,23,0.4)] backdrop-blur-[6px]" onClick={() => setCvOpen(false)}
            />
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 24 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative w-full max-w-4xl h-[90vh] rounded-[28px] bg-white border border-[#E1E6EC] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E6EC] bg-[#F8F9FC] shrink-0">
                <h3 className="text-[16px] font-semibold">Resume Viewer</h3>
                <div className="flex items-center gap-3">
                  <a href={selectedCV} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-[10px] border border-[#E1E6EC] bg-white px-4 py-2 text-[13px] font-medium text-[#45474D] hover:text-[#3279F9] hover:border-[#3279F9] transition-colors"
                  >Open in New Tab <ExternalLink className="w-3.5 h-3.5" /></a>
                  <button onClick={() => setCvOpen(false)} className="rounded-full p-2 hover:bg-[#EFF2F7] text-[#737A87] hover:text-[#121317] transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 p-4 bg-[#E1E6EC]">
                <iframe src={selectedCV} className="w-full h-full rounded-[16px] bg-white border border-[#CDD4DC]" title="Resume" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CV Upload Modal */}
      <AnimatePresence>
        {showCvModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[rgba(18,19,23,0.4)] backdrop-blur-[6px]" onClick={closeCvModal}
            />
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-lg rounded-[28px] bg-white border border-[#E1E6EC] p-8 max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-start justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-tight">Upload CV</h2>
                  <p className="text-[13px] text-[#737A87] mt-1">Add a candidate resume to the database.</p>
                </div>
                <button onClick={closeCvModal} className="rounded-full p-2 hover:bg-[#EFF2F7] text-[#737A87] hover:text-[#121317] transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="form-label">Candidate Name <span className="text-red-500">*</span></label>
                  <input value={cvName} onChange={e => setCvName(e.target.value)} placeholder="Jane Doe" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Email Address</label>
                  <input value={cvEmail} onChange={e => setCvEmail(e.target.value)} placeholder="jane@example.com" type="email" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Phone Number</label>
                  <input value={cvPhone} onChange={e => setCvPhone(e.target.value)} placeholder="+91 98765 43210" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Resume / CV (PDF, DOC) <span className="text-red-500">*</span></label>
                  <div className="relative rounded-[14px] border-2 border-dashed border-[#CDD4DC] bg-white/60 px-6 py-8 text-center hover:bg-white transition-colors cursor-pointer">
                    <input type="file" accept=".pdf,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setCvFile(f); }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="mx-auto h-6 w-6 text-[#737A87] mb-2" />
                    <p className="text-[14px] font-medium text-[#121317]">{cvFile ? cvFile.name : "Click to upload or drag & drop"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#E1E6EC] flex gap-3">
                <button onClick={closeCvModal} className="btn-secondary flex-1">Cancel</button>
                <button disabled={uploadingCv} onClick={handleUploadCv} className="btn-dark flex-1 disabled:opacity-70 disabled:cursor-not-allowed">
                  {uploadingCv ? "Uploading..." : "Save CV"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>© {new Date().getFullYear()} Careers Portal</p>
          <div className="site-footer-links"><a href="/jobs">Careers</a></div>
        </div>
      </footer>
    </main>
  );
}
