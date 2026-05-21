"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import {
  Plus, MapPin, Briefcase, FileText, X, ExternalLink,
  CheckCircle2, Upload, MessageSquare, Send, Users,
  UserPlus, ShieldCheck, User, ArrowRight, LogOut,
  Search, Filter, TrendingUp, Clock, Menu, Trash2, Edit2, Sparkles, Copy, Eye, Lock
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../src/components/Header";

/* ─── Interfaces ─── */
interface Job {
  id: string; title: string; department: string; location: string; description: string;
}
interface CVRecord {
  id: string; name: string; email: string; phone: string;
  cv_url: string; status: string; comments?: string; created_at: string;
}
interface UserRecord {
  id: string;
  name: string | null;
  email: string | null;
  username?: string | null;
  role: string;
  created_at: string;
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
  } catch { /* ignore */ }
  return [{ id: "legacy", text: raw, created_at: new Date().toISOString(), author: "Admin" }];
}

/* ─── 3D Ring ─── */
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

/* ─── Background Canvas ─── */
function BgCanvas() {
  return (
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
  );
}

/* ─── Status badge (CV database) ─── */
function CvStatusBadge({ status }: { status: string }) {
  const cls =
    status === "Called"      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
    status === "Interviewing"? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
    status === "Rejected"    ? "bg-red-500/10 text-red-400 border-red-500/20" :
                               "bg-white/5 text-white/50 border-white/10";
  return <span className={`badge border ${cls}`}>{status}</span>;
}

/* ─── Main Component ─── */
export default function AdminPage() {
  const router = useRouter();

  /* Jobs */
  const [jobs, setJobs]               = useState<Job[]>([]);
  const [showModal, setShowModal]     = useState(false);
  const [editingJob, setEditingJob]   = useState<Job | null>(null);

  /* Job form */
  const descRef                        = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle]             = useState("");
  const [department, setDepartment]   = useState("");
  const [location, setLocation]       = useState("");
  const [description, setDescription] = useState("");

  /* Overview Stats */
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalCVs: 0,
    totalApps: 0,
    pendingApps: 0
  });

  /* CV Database */
  const [cvs, setCvs]                   = useState<CVRecord[]>([]);
  const [cvFilter, setCvFilter]         = useState("All");
  const [showCvModal, setShowCvModal]   = useState(false);
  const [uploadingCv, setUploadingCv]   = useState(false);
  const [cvName, setCvName]             = useState("");
  const [cvEmail, setCvEmail]           = useState("");
  const [cvPhone, setCvPhone]           = useState("");
  const [cvFile, setCvFile]             = useState<File | null>(null);
  const [cvCommentValues, setCvCommentValues] = useState<Record<string, string>>({});
  const [expandedCvComments, setExpandedCvComments] = useState<Record<string, boolean>>({});

  /* CV Viewer */
  const [selectedCV, setSelectedCV]   = useState("");
  const [cvOpen, setCvOpen]           = useState(false);

  /* Admin Users */
  interface AdminUser { id: string; email: string; name: string | null; created_at: string; last_sign_in_at?: string; }
  const [adminUsers, setAdminUsers]         = useState<AdminUser[]>([]);
  const [showUserModal, setShowUserModal]   = useState(false);
  const [newUserName, setNewUserName]       = useState("");
  const [newUserEmail, setNewUserEmail]     = useState("");
  const [newUserPass, setNewUserPass]       = useState("");
  const [newUserConfirm, setNewUserConfirm] = useState("");
  const [showPass, setShowPass]             = useState(false);
  const [savingUser, setSavingUser]         = useState(false);
  const [usersLoaded, setUsersLoaded]       = useState(false);
  const [createdUser, setCreatedUser]       = useState<AdminUser | null>(null);
  const [copiedField, setCopiedField]       = useState<string | null>(null);

  /* Tabs */
  const [activeTab, setActiveTab]       = useState<"jobs" | "cvs" | "users">("jobs");

  /* Auth */
  const [session, setSession]           = useState<Session | null>(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [authEmail, setAuthEmail]       = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError]       = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);

  /* ── Effects ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) {
        loadJobs();
        loadStats();
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) {
        loadJobs();
        loadStats();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { 
    if (activeTab === "cvs") {
      loadCvs(); 
      loadStats();
    }
  }, [activeTab]);
  useEffect(() => {
    if (activeTab === "users" && !usersLoaded) { loadAdminUsers(); setUsersLoaded(true); }
  }, [activeTab]);

  /* ── Data loaders ── */
  async function loadJobs() {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (data) setJobs(data);
  }
  async function loadCvs() {
    const { data } = await supabase.from("cv_database").select("*").order("created_at", { ascending: false });
    if (data) {
      setCvs(data);
      const seed: Record<string, string> = {};
      data.forEach((cv: CVRecord) => { seed[cv.id] = ""; });
      setCvCommentValues(seed);
    }
  }
  async function loadAdminUsers() {
    try {
      const res = await fetch("/api/create-admin");
      const json = await res.json();
      if (json.users) setAdminUsers(json.users);
    } catch { /* silently fail */ }
  }

  async function loadStats() {
    try {
      const { count: jobCount } = await supabase.from("jobs").select("*", { count: "exact", head: true });
      const { count: cvCount } = await supabase.from("cv_database").select("*", { count: "exact", head: true });
      const { count: appCount } = await supabase.from("applications").select("*", { count: "exact", head: true });
      const { count: pendingCount } = await supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "Pending");
      
      setStats({
        totalJobs: jobCount ?? 0,
        totalCVs: cvCount ?? 0,
        totalApps: appCount ?? 0,
        pendingApps: pendingCount ?? 0
      });
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  }

  /* ── Job CRUD ── */
  function openCreate() {
    setEditingJob(null); setTitle(""); setDepartment(""); setLocation(""); setDescription(""); setShowModal(true);
  }
  function openEdit(job: Job) {
    setEditingJob(job); setTitle(job.title); setDepartment(job.department);
    setLocation(job.location); setDescription(job.description); setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditingJob(null); }

  async function handleSave() {
    if (!title.trim() || !department.trim() || !location.trim() || !description.trim()) {
      alert("All fields are required."); return;
    }
    if (editingJob) {
      const { error } = await supabase.from("jobs").update({ title, department, location, description }).eq("id", editingJob.id);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from("jobs").insert([{ title, department, location, description }]);
      if (error) { alert(error.message); return; }
    }
    closeModal(); 
    loadJobs();
    loadStats();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job posting?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    loadJobs();
    loadStats();
  }

  /* ── Rich text helpers ── */
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

  /* ── CV Database ── */
  function closeCvModal() { setShowCvModal(false); setCvName(""); setCvEmail(""); setCvPhone(""); setCvFile(null); }

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
      loadStats();
    } catch { alert("Something went wrong uploading the CV."); }
    finally { setUploadingCv(false); }
  }

  async function handleCvStatus(cvId: string, status: string) {
    const { error } = await supabase.from("cv_database").update({ status }).eq("id", cvId);
    if (error) alert(error.message); else loadCvs();
  }

  async function handleDeleteCv(cvId: string) {
    if (!confirm("Delete this CV?")) return;
    const { error } = await supabase.from("cv_database").delete().eq("id", cvId);
    if (error) alert(error.message); else {
      loadCvs();
      loadStats();
    }
  }

  async function handleUpdateCvComments(cvId: string, comments: string) {
    const { error } = await supabase.from("cv_database").update({ comments }).eq("id", cvId);
    if (error) alert("Failed to save comments: " + error.message);
    else setCvs(prev => prev.map(c => c.id === cvId ? { ...c, comments } : c));
  }

  /* ── Admin Users ── */
  function resetUserForm() {
    setNewUserName(""); setNewUserEmail(""); setNewUserPass(""); setNewUserConfirm(""); setShowPass(false);
  }

  async function handleCreateAdminUser() {
    if (!newUserEmail.trim() || !newUserPass.trim()) { alert("Email and password are required."); return; }
    if (newUserPass !== newUserConfirm) { alert("Passwords do not match."); return; }
    if (newUserPass.length < 6) { alert("Password must be at least 6 characters."); return; }
    setSavingUser(true);
    try {
      const res = await fetch("/api/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUserEmail.trim(), password: newUserPass, name: newUserName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Failed to create user."); return; }
      setCreatedUser({ id: json.id, email: json.email, name: newUserName.trim() || null, created_at: json.created_at });
      resetUserForm();
      setUsersLoaded(false); // will re-fetch when user re-focuses tab
      loadAdminUsers();
    } finally { setSavingUser(false); }
  }

  async function handleDeleteAdminUser(id: string) {
    if (!confirm("Are you sure you want to delete this admin user?")) return;
    try {
      const res = await fetch(`/api/create-admin?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Failed to delete user."); return; }
      loadAdminUsers();
    } catch {
      alert("Failed to delete user due to network error.");
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  /* ── Auth ── */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true); setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) { setAuthError(error.message); setAuthLoading(false); }
    else { setLoginSuccess(true); setAuthLoading(false); setTimeout(() => setLoginSuccess(false), 1500); }
  }
  async function handleLogout() { await supabase.auth.signOut(); }

  /* ── Auth screens ── */
  if (authLoading && !loginSuccess) {
    return (
      <main className="min-h-screen bg-[#07080b] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-[#3279F9] animate-spin" />
      </main>
    );
  }

  if (loginSuccess) {
    return (
      <main className="relative flex flex-col min-h-screen bg-[#07080b] items-center justify-center text-white select-none">
        <BgCanvas />
        <motion.div 
          initial={{ opacity: 0, scale: 0.92 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="glass relative z-10 flex flex-col items-center justify-center rounded-[32px] border border-white/[0.06] p-10 w-full max-w-xs shadow-2xl bg-white/[0.01]"
        >
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/10"
          >
            <CheckCircle2 className="w-8 h-8" />
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }}
            className="text-[20px] font-bold text-white tracking-tight"
          >
            Authorized
          </motion.h2>
        </motion.div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="relative flex flex-col min-h-screen bg-[#07080b] items-center justify-center text-white select-none overflow-hidden">
        <BgCanvas />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 24, scale: 0.96 }} 
          animate={{ opacity: 1, y: 0, scale: 1 }} 
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="glass relative z-10 w-full max-w-[400px] rounded-[32px] border border-white/[0.06] p-8 sm:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden bg-white/[0.01]"
        >
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-[24px] font-bold text-white tracking-tight">Admin Console</h1>
            <p className="text-[14px] text-white/50 mt-1">Sign in to manage recruitment portal</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/60 mb-2">Email Address</label>
              <input 
                type="email" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)} 
                required 
                className="w-full px-4 py-3 bg-[#0E0F15] border border-white/[0.08] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" 
                placeholder="admin@example.com" 
              />
            </div>
            
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/60 mb-2">Password</label>
              <input 
                type="password" 
                value={authPassword} 
                onChange={e => setAuthPassword(e.target.value)} 
                required 
                className="w-full px-4 py-3 bg-[#0E0F15] border border-white/[0.08] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" 
                placeholder="••••••••" 
              />
            </div>
            
            {authError && (
              <motion.p 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[13px] text-red-400 text-center font-medium bg-red-500/10 border border-red-500/20 p-2.5 rounded-[12px]"
              >
                {authError}
              </motion.p>
            )}
            
            <button 
              type="submit" 
              disabled={authLoading} 
              className="w-full mt-2 py-3.5 rounded-[14px] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-[14px] shadow-[0_4px_15px_-3px_rgba(50,121,249,0.3)] hover:shadow-[0_8px_20px_-3px_rgba(50,121,249,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Access Dashboard"
              )}
            </button>
          </form>
        </motion.div>
      </main>
    );
  }

  /* ── Main Admin UI ── */
  return (
    <main className="relative flex flex-col min-h-screen bg-[#07080b] text-[#f3f4f6] font-sans antialiased selection:bg-blue-500/20 selection:text-blue-300">
      <BgCanvas />
      
      {/* Dynamic ambient background glow circles */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none" />

      <Header session={session} handleLogout={handleLogout} />

      <div className="relative z-10 flex-1 w-full max-w-screen-xl mx-auto px-6 sm:px-10 py-10 pb-24">
        
        {/* Dashboard Title / Greeting Section */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10"
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-white/50">Recruiter Console</span>
            </div>
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-tight">
              Control Panel
            </h1>
            <p className="text-[14px] text-white/40 mt-1">
              Welcome back, <span className="text-[#5B9BFF] font-semibold">{session?.user?.email?.split("@")[0]}</span>. Manage listings and screen active candidates.
            </p>
          </div>
          
          {/* Quick Date Display */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2.5 rounded-[16px] bg-white/[0.02] border border-white/[0.06] backdrop-blur-md">
            <span className="text-[13px] font-semibold text-white/60">
              {new Date().toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </motion.div>

        {/* Tab Navigation & Search/Filter Panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-10 border-b border-white/[0.06] pb-6">
          <div className="flex gap-1.5 p-1 bg-white/[0.02] border border-white/[0.05] rounded-[20px] inline-flex flex-wrap shadow-inner backdrop-blur-md">
            {([
              { key: "jobs", label: "Jobs & Applications", icon: <Briefcase className="w-4 h-4" /> },
              { key: "cvs",  label: "CV Database",          icon: <FileText className="w-4 h-4" /> },
              { key: "users",label: "User Management",      icon: <Users className="w-4 h-4" /> },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-5 py-3 rounded-[16px] text-[13px] font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                  activeTab === t.key 
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[0_6px_20px_-4px_rgba(50,121,249,0.4)] scale-102" 
                    : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Jobs Tab ── */}
        {activeTab === "jobs" && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {[
                { label: "Active Jobs", value: stats.totalJobs, icon: <Briefcase className="w-5 h-5 text-blue-400" />, desc: "Currently open roles", trend: "+1 this week", color: "from-blue-500/10 to-indigo-500/5", border: "border-blue-500/20" },
                { label: "Total Applicants", value: stats.totalApps, icon: <Users className="w-5 h-5 text-purple-400" />, desc: "Submitted applications", trend: "High response rate", color: "from-purple-500/10 to-pink-500/5", border: "border-purple-500/20" },
                { label: "Pending Reviews", value: stats.pendingApps, icon: <Clock className="w-5 h-5 text-amber-400 animate-pulse" />, desc: "Require recruiter action", trend: "Action required", color: "from-amber-500/10 to-orange-500/5", border: "border-amber-500/20" },
                { label: "Talent Pool CVs", value: stats.totalCVs, icon: <FileText className="w-5 h-5 text-emerald-400" />, desc: "Archived for future roles", trend: "Database active", color: "from-emerald-500/10 to-teal-500/5", border: "border-emerald-500/20" }
              ].map((s, idx) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className={`glass hover:bg-white/[0.04] border ${s.border} rounded-[24px] p-6 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col justify-between relative overflow-hidden group`}
                >
                  <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-gradient-to-br ${s.color} opacity-40 blur-xl group-hover:scale-125 transition-transform duration-500`} />
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[14px] font-semibold text-white/50">{s.label}</span>
                    <div className="p-2.5 rounded-[12px] bg-white/[0.03] border border-white/[0.06] shadow-sm">
                      {s.icon}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[32px] font-bold text-white tracking-tight leading-none mb-1.5">{s.value}</h3>
                    <div className="flex items-center gap-1.5 text-[12px]">
                      <span className="text-[#3279F9] font-medium">{s.desc}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* List Header */}
            <div className="flex items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-[22px] font-bold tracking-tight text-white">Active Postings</h2>
                <p className="text-white/40 mt-1 text-[13px]">Select a position below to initiate recruiter screening.</p>
              </div>
              <button onClick={openCreate} className="px-5 py-3 rounded-[16px] text-[13px] font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[0_6px_20px_-4px_rgba(50,121,249,0.4)] hover:from-blue-600 hover:to-indigo-700 shrink-0">
                <Plus className="w-4 h-4" /> New Job Listing
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="glass rounded-[28px] p-16 text-center border border-white/[0.06]">
                <p className="text-[16px] text-white/40">No jobs posted yet. Click &quot;New Job Listing&quot; to create one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {jobs.map((job, i) => (
                  <motion.div 
                    key={job.id} 
                    initial={{ opacity: 0, y: 24 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ duration: 0.45, delay: i * 0.06 }}
                  >
                    <div className="glass rounded-[24px] border border-white/[0.06] hover:border-white/[0.12] p-6 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative group overflow-hidden bg-white/[0.01]">
                      {/* Decorative gradient overlay */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      
                      <div className="flex items-start justify-between mb-4">
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B9BFF] bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                          {job.department}
                        </span>
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <button 
                            onClick={() => openEdit(job)}
                            className="p-2 rounded-[10px] bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] text-white/70 hover:text-white transition-colors cursor-pointer"
                            title="Edit Job"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(job.id)}
                            className="p-2 rounded-[10px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="Delete Job"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <h2 className="text-[20px] font-bold tracking-tight text-white mb-2 leading-tight group-hover:text-blue-400 transition-colors">
                        {job.title}
                      </h2>
                      
                      <div className="flex items-center gap-1.5 text-[13px] text-white/50 mb-4">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        {job.location}
                      </div>
                      
                      <p className="text-[13px] text-white/40 line-clamp-3 leading-[1.6] mb-6 flex-1">
                        {job.description.replace(/#{1,3} |[*_~`•]/g, "")}
                      </p>
                      
                      <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
                        <button
                          onClick={() => router.push(`/admin/jobs/${job.id}`)}
                          className="w-full flex items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-3 text-[13px] font-bold shadow-[0_4px_15px_-3px_rgba(50,121,249,0.3)] hover:shadow-[0_8px_20px_-3px_rgba(50,121,249,0.4)] transition-all duration-300"
                        >
                          Screen Candidates <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {/* ── CV Database Tab ── */}
        {activeTab === "cvs" && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
              <div>
                <h2 className="text-[22px] font-bold tracking-tight text-white">CV Repository</h2>
                <p className="text-white/40 mt-1 text-[13px]">Manage stored resumes, update status states, and append comments.</p>
              </div>
              <div className="flex items-center gap-3">
                <select 
                  value={cvFilter} 
                  onChange={e => setCvFilter(e.target.value)}
                  className="rounded-[12px] border border-white/[0.08] bg-[#0E0F15] px-4 py-2.5 text-[14px] font-semibold text-white/80 outline-none cursor-pointer hover:border-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="All">All CVs</option>
                  <option value="Not Called">Not Called</option>
                  <option value="Called">Called</option>
                  <option value="Interviewing">Interviewing</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <button onClick={() => setShowCvModal(true)} className="px-5 py-3 rounded-[16px] text-[13px] font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[0_6px_20px_-4px_rgba(50,121,249,0.4)] hover:from-blue-600 hover:to-indigo-700 shrink-0">
                  <Upload className="w-4 h-4" /> Upload CV
                </button>
              </div>
            </div>

            {cvs.length === 0 ? (
              <div className="glass rounded-[28px] p-16 text-center border border-white/[0.06]">
                <p className="text-[16px] text-white/40">No CVs uploaded yet. Click &quot;Upload CV&quot; to add one.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cvs.filter(c => cvFilter === "All" || c.status === cvFilter).map((cv, i) => {
                  const cvComments = parseComments(cv.comments);
                  const colors = [
                    "from-pink-500 to-rose-500 shadow-pink-500/10",
                    "from-blue-500 to-indigo-500 shadow-blue-500/10",
                    "from-emerald-500 to-teal-500 shadow-emerald-500/10",
                    "from-amber-500 to-orange-500 shadow-amber-500/10",
                    "from-purple-500 to-indigo-500 shadow-purple-500/10",
                    "from-cyan-500 to-blue-500 shadow-cyan-500/10"
                  ];
                  const colorIndex = cv.name.charCodeAt(0) % colors.length;
                  const gradient = colors[colorIndex];
                  const initials = cv.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

                  return (
                    <motion.div 
                      key={cv.id} 
                      initial={{ opacity: 0, y: 18 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ delay: i * 0.05 }}
                      className="glass rounded-[24px] border border-white/[0.06] hover:border-white/[0.1] bg-white/[0.01] overflow-hidden hover:shadow-[0_12px_30px_rgba(0,0,0,0.15)] transition-all duration-300"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-6">
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Initials bubble */}
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-[15px] shrink-0 shadow-md`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                              <h3 className="text-[17px] font-bold text-white">{cv.name}</h3>
                              <CvStatusBadge status={cv.status} />
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-white/50">
                              {cv.email && <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-blue-400" />{cv.email}</span>}
                              {cv.phone && <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-purple-400" />{cv.phone}</span>}
                            </div>
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/30">
                              Uploaded {new Date(cv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start lg:self-center">
                          <select 
                            value={cv.status} 
                            onChange={e => handleCvStatus(cv.id, e.target.value)}
                            className="rounded-[12px] border border-white/[0.08] bg-[#0E0F15] px-3.5 py-2 text-[13px] font-semibold text-white/80 outline-none cursor-pointer hover:border-blue-500 focus:border-blue-500 transition-all"
                          >
                            <option value="Not Called">Not Called</option>
                            <option value="Called">Called</option>
                            <option value="Interviewing">Interviewing</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                          <button 
                            onClick={() => { setSelectedCV(cv.cv_url); setCvOpen(true); }}
                            className="flex items-center gap-1.5 rounded-[12px] border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] hover:border-blue-500/30 text-white/80 hover:text-white px-4 py-2.5 text-[13px] font-semibold transition-all cursor-pointer"
                          >
                            <Eye className="w-4 h-4" /> View Resume
                          </button>
                          <button 
                            onClick={() => handleDeleteCv(cv.id)}
                            className="rounded-[12px] border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 px-4 py-2.5 text-[13px] font-semibold transition-all cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Recruiter Comments section */}
                      <div className="px-6 pb-5 border-t border-white/[0.06] pt-4">
                        <div
                          onClick={() => setExpandedCvComments(v => ({ ...v, [cv.id]: !v[cv.id] }))}
                          className="flex items-center justify-between cursor-pointer hover:text-white transition-colors text-white/50"
                        >
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                            <span className="text-[13px] font-semibold">Comments</span>
                            {cvComments.length > 0 && (
                              <span className="text-[11px] font-bold bg-white/[0.08] text-white/70 px-2 py-0.5 rounded-full">{cvComments.length}</span>
                            )}
                          </div>
                          <span className="text-[12px] font-bold text-blue-400 hover:underline select-none">
                            {expandedCvComments[cv.id] ? "Hide Comments" : "Show Comments"}
                          </span>
                        </div>

                        <AnimatePresence>
                          {expandedCvComments[cv.id] && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="mt-4 overflow-hidden"
                            >
                              {cvComments.length > 0 && (
                                <div className="max-h-[180px] overflow-y-auto mb-4 space-y-2.5 pr-2">
                                  {cvComments.map(comment => (
                                    <div key={comment.id} className="group relative bg-[#090A0E] border border-white/[0.05] rounded-[16px] p-3.5 text-[12px] transition-all hover:border-blue-500/20">
                                      <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <span className="font-bold text-blue-400 truncate max-w-[170px]">{comment.author.split("@")[0]}</span>
                                        <span className="text-[10px] text-white/30">
                                          {new Date(comment.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      </div>
                                      <p className="text-white/70 whitespace-pre-wrap break-words leading-relaxed">{comment.text}</p>
                                      <button
                                        onClick={async () => {
                                          if (confirm("Delete this comment?")) {
                                            const updated = cvComments.filter(c => c.id !== comment.id);
                                            await handleUpdateCvComments(cv.id, JSON.stringify(updated));
                                          }
                                        }}
                                        className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all cursor-pointer"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex gap-2">
                                <textarea
                                  placeholder="Post a comment…"
                                  value={cvCommentValues[cv.id] ?? ""}
                                  onChange={e => setCvCommentValues(v => ({ ...v, [cv.id]: e.target.value }))}
                                  rows={2}
                                  className="flex-1 rounded-[16px] border border-white/[0.06] bg-[#0E0F15] px-4 py-3 text-[13px] text-white placeholder-white/20 outline-none transition-all focus:border-blue-500/50 resize-none"
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
                                      author: session?.user?.email ?? "Admin",
                                    };
                                    const updated = [...cvComments, newComment];
                                    await handleUpdateCvComments(cv.id, JSON.stringify(updated));
                                    setCvCommentValues(v => ({ ...v, [cv.id]: "" }));
                                  }}
                                  className="btn-primary py-2 px-4 self-end rounded-[14px] text-[12px] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                                >
                                  <Send className="w-3.5 h-3.5" /> Post
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}

        {/* ── Users Tab ── */}
        {activeTab === "users" && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <div>
                <h2 className="text-[22px] font-bold tracking-tight text-white">System Administrators</h2>
                <p className="text-white/40 mt-1 text-[13px]">Provision credential keys and revoke administrator access permissions.</p>
              </div>
              <button onClick={() => setShowUserModal(true)}
                className="px-5 py-3 rounded-[16px] text-[13px] font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[0_6px_20px_-4px_rgba(50,121,249,0.4)] hover:from-blue-600 hover:to-indigo-700">
                <UserPlus className="w-4 h-4" /> Add Admin User
              </button>
            </div>

            {adminUsers.length === 0 ? (
              <div className="glass rounded-[28px] p-16 text-center border border-white/[0.06]">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-[18px] font-bold mb-2">No admin users found</h3>
                <p className="text-[14px] text-white/40">Click &quot;Add Admin User&quot; to provision the first workspace supervisor account.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {adminUsers.map((u, i) => {
                  const initials = (u.name ?? u.email ?? "?")[0].toUpperCase();
                  const colors = [
                    "from-[#3279F9] to-[#1a3bbd] shadow-blue-500/10",
                    "from-purple-500 to-indigo-600 shadow-purple-500/10",
                    "from-pink-500 to-rose-600 shadow-pink-500/10",
                    "from-emerald-500 to-teal-600 shadow-emerald-500/10"
                  ];
                  const gradient = colors[u.email.charCodeAt(0) % colors.length];

                  return (
                    <motion.div 
                      key={u.id}
                      initial={{ opacity: 0, y: 18, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.06, duration: 0.4 }}
                      className="glass hover:bg-white/[0.03] rounded-[24px] p-6 flex flex-col gap-5 border border-white/[0.06] hover:border-white/[0.12] hover:shadow-[0_12px_30px_rgba(0,0,0,0.15)] relative group transition-all duration-300"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-[18px] shrink-0 shadow-md`}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[16px] font-bold text-white truncate">{u.name ?? <span className="text-white/30 italic">Unnamed Admin</span>}</p>
                          <p className="text-[12px] text-white/50 truncate">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 text-[12px] text-white/55 border-t border-white/[0.06] pt-4">
                        <div className="flex justify-between">
                          <span>Created:</span>
                          <span className="font-semibold text-white">
                            {new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Sign-in:</span>
                          <span className="font-semibold text-white">
                            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDeleteAdminUser(u.id)}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 cursor-pointer"
                        title="Delete admin user"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}
      </div>

      {/* ── Job Modal ── */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[rgba(5,6,10,0.5)] backdrop-blur-[12px]" onClick={closeModal} />
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-2xl rounded-[32px] bg-[#0E0F15] border border-white/[0.08] p-8 sm:p-10 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-start justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-[24px] font-bold text-white tracking-tight">{editingJob ? "Modify Listing" : "Create Position"}</h2>
                  <p className="text-[13px] text-white/40 mt-1">{editingJob ? "Update active operational metrics." : "Add a new open position to start screening applicants."}</p>
                </div>
                <button onClick={closeModal} className="rounded-full p-2 hover:bg-white/5 text-white/60 hover:text-white transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Job Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Product Designer" className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Department</label>
                    <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Product" className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Location</label>
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Remote / Bangalore" className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Description Markdown</label>
                  <div className="flex items-center gap-2 mb-3 p-1.5 bg-white/[0.02] border border-white/[0.06] rounded-[14px]">
                    {[
                      { label: "B", title: "Bold",    fn: insertBold,    cls: "font-bold" },
                      { label: "H", title: "Heading", fn: insertHeading, cls: "font-semibold" },
                      { label: "• List", title: "Bullet", fn: insertBullet, cls: "" },
                    ].map(b => (
                      <button key={b.title} type="button" title={b.title} onClick={b.fn}
                        className={`rounded-[10px] bg-white/[0.03] border border-white/[0.06] px-3.5 py-1.5 text-[13px] ${b.cls} text-white/80 hover:border-blue-500 hover:text-white transition-all cursor-pointer`}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <textarea ref={descRef} value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Provide full description and requirements using Markdown…" rows={8} className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20 resize-none leading-relaxed" />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col-reverse sm:flex-row gap-3">
                <button onClick={closeModal} className="flex-1 rounded-[14px] border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white/80 hover:text-white px-4 py-3 text-[14px] font-bold transition-all cursor-pointer">Cancel</button>
                <button onClick={handleSave} className="flex-1 rounded-[14px] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-3 text-[14px] font-bold shadow-[0_4px_15px_-3px_rgba(50,121,249,0.3)] transition-all cursor-pointer">{editingJob ? "Save Changes" : "Publish Job"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CV Viewer ── */}
      <AnimatePresence>
        {cvOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[rgba(5,6,10,0.5)] backdrop-blur-[12px]" onClick={() => setCvOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 24 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative w-full max-w-4xl h-[85vh] rounded-[32px] bg-[#0E0F15] border border-white/[0.08] overflow-hidden flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
                <h3 className="text-[15px] font-bold text-white">Resume Viewer</h3>
                <div className="flex items-center gap-3">
                  <a href={selectedCV} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-[12px] border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white/80 hover:text-white px-4 py-2 text-[13px] font-bold transition-all">
                    Open in Tab <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => setCvOpen(false)} className="rounded-full p-2 hover:bg-white/5 text-white/60 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 p-4 bg-[#121317]">
                <iframe src={selectedCV} className="w-full h-full rounded-[20px] bg-white border border-white/[0.06]" title="Resume" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CV Upload Modal ── */}
      <AnimatePresence>
        {showCvModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[rgba(5,6,10,0.5)] backdrop-blur-[12px]" onClick={closeCvModal} />
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-lg rounded-[32px] bg-[#0E0F15] border border-white/[0.08] p-8 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-start justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-[24px] font-bold text-white tracking-tight">Upload Candidate CV</h2>
                  <p className="text-[13px] text-white/40 mt-1">Directly add a new resume to your primary talent database.</p>
                </div>
                <button onClick={closeCvModal} className="rounded-full p-2 hover:bg-white/5 text-white/60 hover:text-white transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Candidate Name <span className="text-red-500">*</span></label>
                  <input value={cvName} onChange={e => setCvName(e.target.value)} placeholder="Jane Doe" className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Email Address</label>
                  <input value={cvEmail} onChange={e => setCvEmail(e.target.value)} placeholder="jane@example.com" type="email" className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Phone Number</label>
                  <input value={cvPhone} onChange={e => setCvPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Resume / CV (PDF, DOC) <span className="text-red-500">*</span></label>
                  <div className="relative rounded-[20px] border-2 border-dashed border-white/[0.08] hover:border-blue-500/40 bg-white/[0.01] px-6 py-10 text-center hover:bg-white/[0.02] transition-all cursor-pointer">
                    <input type="file" accept=".pdf,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setCvFile(f); }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <Upload className="mx-auto h-8 w-8 text-white/40 mb-3" />
                    <p className="text-[14px] font-bold text-white">{cvFile ? cvFile.name : "Select candidate file or drag & drop"}</p>
                    <p className="text-[11px] text-white/30 mt-1">Accepts PDF, DOC, DOCX up to 5 MB</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.06] flex gap-3">
                <button onClick={closeCvModal} className="flex-1 rounded-[14px] border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white/80 hover:text-white px-4 py-3 text-[14px] font-bold transition-all cursor-pointer">Cancel</button>
                <button disabled={uploadingCv} onClick={handleUploadCv} className="flex-1 rounded-[14px] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-3 text-[14px] font-bold shadow-[0_4px_15px_-3px_rgba(50,121,249,0.3)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  {uploadingCv ? "Uploading..." : "Save Candidate"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── User Modal ── */}
      <AnimatePresence>
        {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[rgba(5,6,10,0.5)] backdrop-blur-[12px]"
              onClick={() => { setShowUserModal(false); resetUserForm(); setCreatedUser(null); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 30, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.93, y: 20, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="relative w-full max-w-md rounded-[32px] bg-[#0E0F15] border border-white/[0.08] p-8 shadow-2xl">
              
              {createdUser ? (
                // Success Credentials Screen
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/5">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-[22px] font-bold text-white tracking-tight">Admin Provisioned!</h2>
                  <p className="text-[13px] text-white/40 mt-1 mb-6">The administrator account is now active and can sign in.</p>
                  
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-[20px] p-5 text-left space-y-4 mb-6">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/40">Full Name</span>
                      <p className="text-[15px] font-semibold text-white mt-1">{createdUser.name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/40">Email Address</span>
                      <p className="text-[15px] font-semibold text-white mt-1">{createdUser.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => copyToClipboard(createdUser.email, "email")}
                      className="w-full py-3 rounded-[12px] bg-white/[0.02] border border-white/[0.08] text-white/80 hover:text-white font-bold text-[13px] hover:border-blue-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedField === "email" ? "Copied!" : <><Copy className="w-4 h-4" /> Copy Email</>}
                    </button>
                    <div className="flex gap-3 mt-1.5">
                      <button
                        onClick={() => setCreatedUser(null)}
                        className="flex-1 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-[13px] rounded-[12px] transition-all cursor-pointer"
                      >
                        Create Another
                      </button>
                      <button
                        onClick={() => { setShowUserModal(false); resetUserForm(); setCreatedUser(null); }}
                        className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold text-[13px] rounded-[12px] transition-colors cursor-pointer"
                      >
                        Close Portal
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Creation Form
                <>
                  <div className="flex items-start justify-between mb-6 gap-4">
                    <div>
                      <h2 className="text-[22px] font-bold text-white tracking-tight">Provision Admin</h2>
                      <p className="text-[13px] text-white/40 mt-1">Configure administrator email and workspace keys.</p>
                    </div>
                    <button onClick={() => { setShowUserModal(false); resetUserForm(); }}
                      className="p-2 rounded-[10px] text-white/60 hover:bg-white/5 hover:text-white transition-colors cursor-pointer mt-0.5 shrink-0">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Full Name</label>
                      <input value={newUserName} onChange={e => setNewUserName(e.target.value)}
                        placeholder="e.g. Jane Doe" className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" autoFocus />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Email Address <span className="text-red-500">*</span></label>
                      <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}
                        placeholder="admin@example.com" type="email" className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input value={newUserPass} onChange={e => setNewUserPass(e.target.value)}
                          placeholder="••••••••" type={showPass ? "text" : "password"} className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20 pr-12" />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-[12px] font-bold transition-colors cursor-pointer"
                        >
                          {showPass ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 mb-2">Confirm Password <span className="text-red-500">*</span></label>
                      <input value={newUserConfirm} onChange={e => setNewUserConfirm(e.target.value)}
                        placeholder="••••••••" type={showPass ? "text" : "password"} className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] focus:border-blue-500 rounded-[14px] text-[15px] text-white outline-none transition-all placeholder-white/20" />
                    </div>
                  </div>

                  <div className="mt-7 pt-6 border-t border-white/[0.06] flex gap-3">
                    <button onClick={() => { setShowUserModal(false); resetUserForm(); }}
                      className="flex-1 rounded-[14px] border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white/80 hover:text-white px-4 py-3 text-[14px] font-bold transition-all cursor-pointer">Cancel</button>
                    <button disabled={savingUser || !newUserEmail.trim() || !newUserPass.trim()} onClick={handleCreateAdminUser}
                      className="flex-1 rounded-[14px] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-3 text-[14px] font-bold shadow-[0_4px_15px_-3px_rgba(50,121,249,0.3)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {savingUser ? "Creating..." : <><UserPlus className="w-4 h-4" /> Create Admin</>}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="site-footer border-t border-white/[0.04]">
        <div className="site-footer-inner">
          <p>© {new Date().getFullYear()} Careers Portal</p>
          <div className="site-footer-links"><a href="/jobs">Careers</a></div>
        </div>
      </footer>
    </main>
  );
}
