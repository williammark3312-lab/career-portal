"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../src/lib/supabase";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, MeshTransmissionMaterial } from "@react-three/drei";
import { ArrowLeft, Plus, MapPin, Briefcase, FileText, ChevronRight, X, ExternalLink, LogOut, CheckCircle2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../src/components/Header";

interface Job {
  id: string; title: string; department: string; location: string; description: string;
}
interface Application {
  id: string; job_id: string; name: string; email: string; phone: string;
  location: string; resume_url: string; status: string; created_at: string; notes?: string;
}

function FloatingRing() {
  return (
    <Float speed={1.8} rotationIntensity={0.9} floatIntensity={1.2}>
      <mesh rotation={[0.5, -0.5, 0]}>
        <torusGeometry args={[2, 0.45, 64, 128]} />
        <MeshTransmissionMaterial backside samples={3} thickness={0.6}
          chromaticAberration={0.08} anisotropy={0.5} distortion={0.12}
          distortionScale={0.2} temporalDistortion={0.03} clearcoat={1}
          clearcoatRoughness={0.05} color="#1a3bbd"
          transmission={0.55} roughness={0.05} resolution={256}
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

  async function loadJobs() {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (data) setJobs(data);
  }
  async function loadApplications(jobId: string) {
    const { data } = await supabase.from("applications").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
    if (data) setApplications(data);
  }
  function openCreate() {
    setEditingJob(null); setTitle(""); setDepartment(""); setLocation(""); setDescription(""); setShowModal(true);
  }
  function openEdit(job: Job) {
    setEditingJob(job); setTitle(job.title); setDepartment(job.department); setLocation(job.location); setDescription(job.description); setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditingJob(null); }

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
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
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
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
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
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
          <Suspense fallback={null}><FloatingRing /><Environment preset="city" /></Suspense>
        </Canvas>
      </div>

      {/* Header */}
      <Header session={session} handleLogout={handleLogout} />

      {/* Content */}
      <div className="relative z-10 flex-1 w-full max-w-screen-xl mx-auto px-6 sm:px-10 py-12 pb-24">

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
                        <textarea
                          placeholder="Add internal notes about this candidate..."
                          defaultValue={app.notes || ""}
                          onBlur={(e) => handleUpdateNotes(app.id, e.target.value)}
                          className="w-full lg:w-[300px] h-[80px] rounded-[10px] border border-[#E1E6EC] bg-white/50 px-3 py-2 text-[13px] text-[#45474D] outline-none transition-all focus:border-[#3279F9] focus:bg-white resize-none"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
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
              className="relative w-full max-w-4xl max-h-[90vh] rounded-[28px] bg-white border border-[#E1E6EC] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E6EC] bg-[#F8F9FC]">
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
              <div className="flex-1 p-4 bg-[#E1E6EC]">
                <iframe src={selectedCV} className="w-full h-full rounded-[16px] bg-white border border-[#CDD4DC]" title="Resume" />
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
