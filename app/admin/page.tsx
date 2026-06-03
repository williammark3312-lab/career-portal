"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import {
  Plus, MapPin, Briefcase, FileText, X, ExternalLink,
  CheckCircle2, Upload, MessageSquare, Send, Users,
  UserPlus, ArrowRight, Clock, Trash2, Edit2, Sparkles,
  Copy, Eye, Lock, Search, LogOut, Shield, ChevronRight
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../src/components/Header";
import AnimatedBackground from "../../src/components/AnimatedBackground";
import KineticText from "../../src/components/KineticText";

/* ─── Interfaces ─── */
interface Job {
  id: string; title: string; department: string; location: string; description: string;
}
interface CVRecord {
  id: string; name: string; email: string; phone: string;
  cv_url: string; status: string; comments?: string; created_at: string;
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

/* ─── Department theme colors ─── */
function getDeptStyle(dept: string) {
  const d = dept.toLowerCase();
  if (d.includes("engineer") || d.includes("tech")) {
    return {
      color: "#1a73e8",
      bg: "rgba(26, 115, 232, 0.06)",
      border: "rgba(26, 115, 232, 0.15)",
      glowClass: "glow-blue"
    };
  }
  if (d.includes("design") || d.includes("creative")) {
    return {
      color: "#f9ab00",
      bg: "rgba(249, 171, 0, 0.06)",
      border: "rgba(249, 171, 0, 0.15)",
      glowClass: "glow-yellow"
    };
  }
  if (d.includes("market") || d.includes("growth")) {
    return {
      color: "#1e8e3e",
      bg: "rgba(30, 142, 62, 0.06)",
      border: "rgba(30, 142, 62, 0.15)",
      glowClass: "glow-green"
    };
  }
  return {
    color: "#d93025",
    bg: "rgba(217, 48, 37, 0.06)",
    border: "rgba(217, 48, 37, 0.15)",
    glowClass: "glow-red"
  };
}

/* ─── Status badge styling ─── */
function getStatusStyle(status: string) {
  switch (status) {
    case "Called":
      return { color: "#1e8e3e", bg: "rgba(30, 142, 62, 0.08)", border: "rgba(30, 142, 62, 0.18)" };
    case "Interviewing":
      return { color: "#1a73e8", bg: "rgba(26, 115, 232, 0.08)", border: "rgba(26, 115, 232, 0.18)" };
    case "Rejected":
      return { color: "#d93025", bg: "rgba(217, 48, 37, 0.08)", border: "rgba(217, 48, 37, 0.18)" };
    default:
      return { color: "#5f6368", bg: "rgba(95, 99, 104, 0.08)", border: "rgba(95, 99, 104, 0.15)" };
  }
}

export default function AdminPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  /* Jobs state */
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  /* Job form state */
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  /* Overview Stats state */
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalCVs: 0,
    totalApps: 0,
    pendingApps: 0
  });

  /* CV Database state */
  const [cvs, setCvs] = useState<CVRecord[]>([]);
  const [cvFilter, setCvFilter] = useState("All");
  const [cvSearch, setCvSearch] = useState("");
  const [editingCv, setEditingCv] = useState<CVRecord | null>(null);
  const [showCvModal, setShowCvModal] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvName, setCvName] = useState("");
  const [cvEmail, setCvEmail] = useState("");
  const [cvPhone, setCvPhone] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvCommentValues, setCvCommentValues] = useState<Record<string, string>>({});
  const [expandedCvComments, setExpandedCvComments] = useState<Record<string, boolean>>({});

  /* CV Viewer state */
  const [selectedCV, setSelectedCV] = useState("");
  const [cvOpen, setCvOpen] = useState(false);

  /* Admin Users state */
  interface AdminUser { id: string; email: string; name: string | null; created_at: string; last_sign_in_at?: string; }
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserConfirm, setNewUserConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [createdUser, setCreatedUser] = useState<AdminUser | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  /* Tabs state */
  const [activeTab, setActiveTab] = useState<"jobs" | "cvs" | "users">("jobs");

  /* Auth state */
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);

  /* ── Effects ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setSession(null);
        setAuthLoading(false);
        return;
      }
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
      } else {
        setAuthLoading(false);
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
    if (activeTab === "users" && !usersLoaded) {
      loadAdminUsers();
      setUsersLoaded(true);
    }
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
  function closeCvModal() {
    setShowCvModal(false);
    setEditingCv(null);
    setCvName("");
    setCvEmail("");
    setCvPhone("");
    setCvFile(null);
  }

  async function handleSaveCv() {
    if (!cvName.trim()) { alert("Name is required."); return; }
    if (!editingCv && !cvFile) { alert("CV file is required."); return; }
    try {
      setUploadingCv(true);
      let cvUrl = editingCv ? editingCv.cv_url : "";

      if (cvFile) {
        const fileName = `${Date.now()}-${cvFile.name}`;
        const { error: uploadErr } = await supabase.storage.from("resumes").upload(fileName, cvFile);
        if (uploadErr) { alert(uploadErr.message); return; }
        const { data: { publicUrl } } = supabase.storage.from("resumes").getPublicUrl(fileName);
        cvUrl = publicUrl;
      }

      if (editingCv) {
        const { error } = await supabase
          .from("cv_database")
          .update({ name: cvName, email: cvEmail, phone: cvPhone, cv_url: cvUrl })
          .eq("id", editingCv.id);
        if (error) { alert(error.message); return; }
      } else {
        const { error } = await supabase.from("cv_database").insert([
          { name: cvName, email: cvEmail, phone: cvPhone, cv_url: cvUrl, status: "Not Called" }
        ]);
        if (error) { alert(error.message); return; }
      }
      closeCvModal();
      loadCvs();
      loadStats();
    } catch { alert("Something went wrong saving the profile."); }
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
      setUsersLoaded(false);
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

  /* ── Auth screen rendering ── */
  if ((!mounted || authLoading) && !loginSuccess) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FF] relative overflow-hidden">
        <AnimatedBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-500 tracking-wide animate-pulse-slow">Loading Supervisor Space...</p>
        </div>
      </main>
    );
  }

  if (loginSuccess) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FF] relative overflow-hidden">
        <AnimatedBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 border border-white/60 rounded-[32px] p-12 bg-white/70 backdrop-blur-2xl shadow-xl shadow-blue-500/5 relative z-10 max-w-sm text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-inner"
          >
            <CheckCircle2 className="w-8 h-8" />
          </motion.div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Access Granted</h2>
            <p className="text-sm text-slate-500 font-medium">Session authorized. Redirecting you to console desk...</p>
          </div>
        </motion.div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F8F9FF] relative overflow-hidden p-4">
        <AnimatedBackground />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md border border-white/60 rounded-[32px] p-10 sm:p-12 bg-white/70 backdrop-blur-3xl shadow-xl shadow-slate-900/5 relative z-10"
        >
          <div className="flex flex-col gap-2 mb-8">
            <div className="w-12 h-12 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center text-blue-600 mb-2 shadow-sm">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
              <KineticText text="Recruiter Desk" />
            </h1>
            <p className="text-[14px] text-slate-500 font-medium">Sign in to manage openings, candidates, and evaluations.</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                required
                className="google-form-input focus:border-blue-600 focus:shadow-md transition-all rounded-xl p-3 border-slate-200"
                placeholder="recruiter@company.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                required
                className="google-form-input focus:border-blue-600 focus:shadow-md transition-all rounded-xl p-3 border-slate-200"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 text-center"
              >
                {authError}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full justify-center flex items-center gap-2 py-3 px-6 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-blue-500/10 disabled:opacity-70 disabled:cursor-not-allowed mt-3"
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : "Authenticate Access"}
            </button>
          </form>
        </motion.div>
      </main>
    );
  }

  const isRecruiter =
    session?.user?.app_metadata?.role === "admin" ||
    session?.user?.user_metadata?.role === "admin" ||
    session?.user?.email === "williammark3312@gmail.com";

  if (session && !isRecruiter) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F8F9FF] relative overflow-hidden p-4">
        <AnimatedBackground />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md border border-rose-100 rounded-[32px] p-10 sm:p-12 bg-white/80 backdrop-blur-3xl shadow-xl shadow-rose-950/5 relative z-10 text-center flex flex-col items-center"
        >
          <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-600 mb-6 shadow-inner animate-pulse-slow">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">Access Denied</h1>
          <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
            You are signed in as <span className="font-semibold text-blue-600">{session.user.email}</span>. Only supervisor accounts are authorized to enter this portal.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleLogout}
              className="w-full py-3 px-6 rounded-xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-rose-500/10"
            >
              Sign Out & Relogin
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 px-6 rounded-xl font-bold text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer"
            >
              Back to Careers Page
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  /* ── Main Dashboard Panel UI ── */
  return (
    <main className="min-h-screen bg-[#F8F9FF] text-slate-800 relative z-10 flex flex-col lg:flex-row overflow-hidden">
      <AnimatedBackground />

      {/* ── Desktop Sidebar ── */}
      <aside className="w-80 sidebar-glass hidden lg:flex flex-col justify-between p-6 fixed h-screen z-20">
        <div className="flex flex-col gap-8">
          {/* Logo Section */}
          <div className="flex items-center gap-3 px-2 py-1 cursor-pointer" onClick={() => router.push("/jobs")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1a73e8] to-[#2563EB] flex items-center justify-center shadow-md shadow-blue-500/10">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-950 tracking-tight leading-none">Antigravity</h1>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Recruiter Desk</span>
            </div>
          </div>

          {/* User Widget */}
          <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-white/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {session?.user?.email?.[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Admin</p>
              <p className="text-sm font-semibold text-slate-800 truncate" title={session?.user?.email}>{session?.user?.email}</p>
            </div>
          </div>

          {/* Tab Navigation Menu */}
          <nav className="flex flex-col gap-1.5">
            {([
              { key: "jobs", label: "Openings & Reviews", icon: <Briefcase className="w-4 h-4" />, count: stats.totalJobs },
              { key: "cvs", label: "Recruitment Database", icon: <FileText className="w-4 h-4" />, count: stats.totalCVs },
              { key: "users", label: "Supervisor Accounts", icon: <Users className="w-4 h-4" />, count: adminUsers.length },
            ] as const).map(t => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-[13.5px] font-bold transition-all relative overflow-hidden cursor-pointer ${
                    isActive
                      ? "text-blue-600 bg-blue-50/70 border border-blue-100/60 shadow-sm"
                      : "text-slate-500 hover:text-slate-950 hover:bg-slate-100/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 z-10">
                    {t.icon}
                    <span>{t.label}</span>
                  </div>
                  {t.count !== undefined && (
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full z-10 transition-colors ${
                      isActive ? "bg-blue-600 text-white" : "bg-slate-200/70 text-slate-600"
                    }`}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="flex flex-col gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13.5px] font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Session</span>
          </button>
          <div className="text-[11px] text-slate-400 font-medium px-4">
            © {new Date().getFullYear()} Google Antigravity
          </div>
        </div>
      </aside>

      {/* ── Header component for mobile navigation (hidden on desktop sidebar) ── */}
      <div className="lg:hidden w-full relative z-30">
        <Header session={session} handleLogout={handleLogout} />
        {/* Mobile Tab row */}
        <div className="bg-white/70 backdrop-blur-md border-b border-slate-200/50 px-4 py-2 flex gap-1 overflow-x-auto">
          {([
            { key: "jobs", label: "Openings", icon: <Briefcase className="w-3.5 h-3.5" /> },
            { key: "cvs", label: "Database", icon: <FileText className="w-3.5 h-3.5" /> },
            { key: "users", label: "Supervisors", icon: <Users className="w-3.5 h-3.5" /> },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
                activeTab === t.key
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/10"
                  : "text-slate-500 bg-slate-100 hover:bg-slate-200"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content Dashboard ── */}
      <div className="flex-1 lg:ml-80 min-h-screen flex flex-col p-4 sm:p-8 lg:p-10 relative z-10 pt-20 lg:pt-10 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto flex flex-col gap-8 flex-grow pb-16">
          
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/40 pb-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest">
                <span>Supervisor Space</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="text-slate-500 font-semibold lowercase">
                  {activeTab === "jobs" ? "listings & submissions" : activeTab === "cvs" ? "cv index database" : "admin controls"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {activeTab === "jobs" ? "Job Openings Desk" : activeTab === "cvs" ? "Talent database Index" : "Supervisory Credentials"}
              </h1>
            </div>

            {/* Quick Action Button for active view */}
            {activeTab === "jobs" && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" /> Create Opening
              </button>
            )}
            {activeTab === "cvs" && (
              <button
                onClick={() => setShowCvModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Upload className="w-4 h-4" /> Upload candidate CV
              </button>
            )}
            {activeTab === "users" && (
              <button
                onClick={() => setShowUserModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4" /> Provision Account
              </button>
            )}
          </div>

          {/* ── Jobs Tab ── */}
          {activeTab === "jobs" && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Active Listings", value: stats.totalJobs, icon: <Briefcase className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50 border-blue-100/50" },
                  { label: "Applications", value: stats.totalApps, icon: <Users className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-50 border-emerald-100/50" },
                  { label: "Pending Screening", value: stats.pendingApps, icon: <Clock className="w-5 h-5 text-amber-600" />, bg: "bg-amber-50 border-amber-100/50" },
                  { label: "CV Repository", value: stats.totalCVs, icon: <FileText className="w-5 h-5 text-rose-600" />, bg: "bg-rose-50 border-rose-100/50" }
                ].map((s, idx) => (
                  <div
                    key={s.label}
                    className={`p-5 rounded-2xl border ${s.bg} bg-white/60 backdrop-blur-md shadow-sm flex flex-col justify-between gap-4`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
                      <div className="p-2 rounded-xl bg-white/80 shadow-inner flex items-center justify-center">
                        {s.icon}
                      </div>
                    </div>
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-none">{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Jobs Cards Grid */}
              {jobs.length === 0 ? (
                <div className="p-16 border border-dashed border-slate-200 bg-white/40 backdrop-blur-md rounded-3xl text-center">
                  <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">No published roles found. Click "Create Opening" to start recruiting.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {jobs.map((job) => {
                    const styleInfo = getDeptStyle(job.department);
                    return (
                      <motion.div
                        key={job.id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="dashboard-card rounded-3xl p-6 flex flex-col justify-between gap-6 border-slate-200/50 relative overflow-hidden"
                      >
                        {/* Shadow Gradient Accent */}
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-transparent to-transparent opacity-10 rounded-bl-full pointer-events-none ${styleInfo.color}`} />

                        <div className="flex flex-col gap-4">
                          <div className="flex justify-between items-start gap-4">
                            <span
                              style={{ color: styleInfo.color, backgroundColor: styleInfo.bg, borderColor: styleInfo.border }}
                              className="text-[10px] font-extrabold px-3 py-1 rounded-full border tracking-wide uppercase"
                            >
                              {job.department}
                            </span>
                            
                            {/* Card CRUD Options */}
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => openEdit(job)}
                                className="p-2 border border-slate-200/60 bg-white hover:bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition-all cursor-pointer hover:scale-105"
                                title="Edit Job Opening"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(job.id)}
                                className="p-2 border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-xl transition-all cursor-pointer hover:scale-105"
                                title="Delete Job Opening"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug group-hover:text-blue-600 transition-colors">
                              {job.title}
                            </h2>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {job.location}
                            </div>
                          </div>

                          <p className="text-[13px] text-slate-500 leading-relaxed truncate-3-lines">
                            {job.description.replace(/#{1,3} |[*_~`•]/g, "").slice(0, 110)}
                            {job.description.length > 110 ? "..." : ""}
                          </p>
                        </div>

                        <button
                          onClick={() => router.push(`/admin/jobs/${job.id}`)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer hover:shadow-md hover:shadow-blue-500/5 active:scale-[0.98]"
                        >
                          Review Candidate Pool <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}

          {/* ── CV Database Tab ── */}
          {activeTab === "cvs" && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col gap-6">
              
              {/* Search & Filter Toolbar */}
              <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-slate-200/50 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search talent registry (name, email, phone)..."
                    value={cvSearch}
                    onChange={e => setCvSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 bg-white/90 text-sm focus:outline-none focus:border-blue-600 focus:shadow-inner transition-all text-slate-800"
                  />
                </div>
                
                <div className="flex gap-2">
                  <select
                    value={cvFilter}
                    onChange={e => setCvFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200/80 bg-white/90 text-xs font-bold text-slate-600 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="All">All Pathways</option>
                    <option value="Not Called">Not Called</option>
                    <option value="Called">Called</option>
                    <option value="Interviewing">Interviewing</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* CV Lists */}
              {cvs.length === 0 ? (
                <div className="p-16 border border-dashed border-slate-200 bg-white/40 backdrop-blur-md rounded-3xl text-center">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">No CV files archived. Select "Upload candidate CV" to append.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {cvs.filter(c => {
                    const matchesFilter = cvFilter === "All" || c.status === cvFilter;
                    const matchesSearch = !cvSearch.trim() ||
                      c.name.toLowerCase().includes(cvSearch.toLowerCase()) ||
                      (c.email && c.email.toLowerCase().includes(cvSearch.toLowerCase())) ||
                      (c.phone && c.phone.toLowerCase().includes(cvSearch.toLowerCase()));
                    return matchesFilter && matchesSearch;
                  }).map((cv) => {
                    const cvComments = parseComments(cv.comments);
                    const colors = [
                      "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                      "linear-gradient(135deg, #10b981 0%, #047857 100%)",
                      "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
                      "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                    ];
                    const colorIndex = cv.name.charCodeAt(0) % colors.length;
                    const gradient = colors[colorIndex];
                    const initials = cv.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                    const statusStyle = getStatusStyle(cv.status);

                    return (
                      <motion.div
                        key={cv.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white/60 border border-slate-200/50 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 backdrop-blur-md"
                      >
                        {/* Upper primary info */}
                        <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100">
                          <div className="flex items-center gap-4 min-w-0">
                            <div
                              style={{ background: gradient }}
                              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-slate-900/5 flex-shrink-0"
                            >
                              {initials}
                            </div>
                            <div className="min-w-0 flex flex-col gap-1">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-base font-bold text-slate-950 truncate leading-none">{cv.name}</h3>
                                <span
                                  style={{ color: statusStyle.color, backgroundColor: statusStyle.bg, borderColor: statusStyle.border }}
                                  className="text-[10px] font-bold px-2 py-0.5 border rounded-lg whitespace-nowrap"
                                >
                                  {cv.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5 flex-wrap text-xs text-slate-400 font-semibold">
                                {cv.email && <span className="truncate">{cv.email}</span>}
                                {cv.phone && <span>• {cv.phone}</span>}
                                <span>• Indexed {new Date(cv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                              </div>
                            </div>
                          </div>

                          {/* Interactive status selectors */}
                          <div className="flex items-center gap-2 self-stretch md:self-auto justify-end flex-wrap">
                            <select
                              value={cv.status}
                              onChange={e => handleCvStatus(cv.id, e.target.value)}
                              className="px-3 py-2 rounded-xl border border-slate-200/80 bg-white text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
                            >
                              <option value="Not Called">Not Called</option>
                              <option value="Called">Called</option>
                              <option value="Interviewing">Interviewing</option>
                              <option value="Rejected">Rejected</option>
                            </select>

                            <button
                              onClick={() => {
                                setEditingCv(cv);
                                setCvName(cv.name);
                                setCvEmail(cv.email || "");
                                setCvPhone(cv.phone || "");
                                setShowCvModal(true);
                              }}
                              className="p-2 bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition-all cursor-pointer"
                              title="Edit candidate profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setSelectedCV(cv.cv_url); setCvOpen(true); }}
                              className="p-2 bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition-all cursor-pointer"
                              title="View Document sandbox"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCv(cv.id)}
                              className="p-2 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 text-rose-500 hover:text-rose-700 rounded-xl transition-all cursor-pointer"
                              title="Delete index file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Recruiter Remarks */}
                        <div className="bg-slate-50/50 p-4 border-t border-slate-100">
                          <div
                            onClick={() => setExpandedCvComments(v => ({ ...v, [cv.id]: !v[cv.id] }))}
                            className="flex justify-between items-center cursor-pointer text-slate-500"
                          >
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                              <MessageSquare className="w-4 h-4 text-blue-500" />
                              <span>Recruiter Remarks</span>
                              {cvComments.length > 0 && (
                                <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{cvComments.length}</span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-blue-600 hover:underline">
                              {expandedCvComments[cv.id] ? "Collapse comments" : "Expand comments"}
                            </span>
                          </div>

                          <AnimatePresence>
                            {expandedCvComments[cv.id] && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden mt-4"
                              >
                                <div className="flex flex-col gap-4">
                                  {cvComments.length > 0 && (
                                    <div className="max-h-48 overflow-y-auto flex flex-col gap-3 pr-2">
                                      {cvComments.map(comment => (
                                        <div key={comment.id} className="comment-bubble p-3 rounded-2xl relative flex flex-col gap-1">
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-blue-600">{comment.author.split("@")[0]}</span>
                                            <span className="text-[10px] font-bold text-slate-400">
                                              {new Date(comment.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                          </div>
                                          <p className="text-[12.5px] text-slate-700 leading-relaxed pr-6">{comment.text}</p>
                                          
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (confirm("Delete this comment?")) {
                                                const updated = cvComments.filter(c => c.id !== comment.id);
                                                await handleUpdateCvComments(cv.id, JSON.stringify(updated));
                                              }
                                            }}
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
                                      value={cvCommentValues[cv.id] ?? ""}
                                      onChange={e => setCvCommentValues(v => ({ ...v, [cv.id]: e.target.value }))}
                                      rows={1}
                                      className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 bg-white resize-none"
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
                                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer self-end shadow-sm"
                                    >
                                      <Send className="w-3 h-3" /> Add
                                    </button>
                                  </div>
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
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col gap-6">
              {adminUsers.length === 0 ? (
                <div className="p-16 border border-dashed border-slate-200 bg-white/40 backdrop-blur-md rounded-3xl text-center">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Gathering administrative accounts details...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adminUsers.map((u) => {
                    const initials = (u.name ?? u.email ?? "?")[0].toUpperCase();
                    const colors = [
                      "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                      "linear-gradient(135deg, #10b981 0%, #047857 100%)",
                      "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)"
                    ];
                    const gradient = colors[u.email.charCodeAt(0) % colors.length];

                    return (
                      <motion.div
                        key={u.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/60 border border-slate-200/50 rounded-3xl p-5 flex flex-col justify-between gap-5 relative overflow-hidden backdrop-blur-md shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            style={{ background: gradient }}
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-slate-900/5 flex-shrink-0"
                          >
                            {initials}
                          </div>
                          <div className="min-w-0 flex flex-col gap-0.5">
                            <p className="text-base font-bold text-slate-900 truncate leading-none">
                              {u.name ?? <span className="italic text-slate-400 font-medium">Unnamed Supervisor</span>}
                            </p>
                            <p className="text-xs font-semibold text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
                          <div className="flex justify-between">
                            <span>Key Provisioned:</span>
                            <span className="text-slate-800">{new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Last Sign-In:</span>
                            <span className="text-slate-800">
                              {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                            </span>
                          </div>
                        </div>

                        {/* Revoke administrator access key */}
                        <button
                          onClick={() => handleDeleteAdminUser(u.id)}
                          className="absolute top-4 right-4 p-2 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 text-rose-500 hover:text-rose-700 rounded-xl transition-all cursor-pointer"
                          title="Revoke supervisory rights"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}
        </div>
      </div>

      {/* ── Job Creation/Modification Modal ── */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={closeModal}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-xl bg-white border border-slate-200/80 rounded-[32px] p-8 sm:p-10 shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col gap-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 tracking-tight leading-none">
                    {editingJob ? "Adjust Listing Details" : "Publish New Role"}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">Configure operational parameters for target screen pool.</p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Job Title</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Lead Technical Architect"
                    className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Department</label>
                    <input
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      placeholder="e.g. Engineering"
                      className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Location</label>
                    <input
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. London, UK / Hybrid"
                      className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Description (Supports Markdown)</label>
                  <div className="flex gap-1.5 bg-slate-50 border border-slate-200/50 p-1.5 rounded-xl">
                    {[
                      { label: "Bold", fn: insertBold },
                      { label: "Heading", fn: insertHeading },
                      { label: "Bullet", fn: insertBullet }
                    ].map(btn => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={btn.fn}
                        className="px-3 py-1 bg-white hover:bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200/60 rounded-lg cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={descRef}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={6}
                    placeholder="Provide role prerequisites, compensation parameters, and tasks..."
                    className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200 resize-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6 flex gap-3 mt-4">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  {editingJob ? "Save Changes" : "Publish opening"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CV Viewer Sandbox Modal ── */}
      <AnimatePresence>
        {cvOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
              
              <div className="flex-1 bg-slate-100 p-3 sm:p-4">
                <iframe src={selectedCV} className="w-full h-full border border-slate-200/50 rounded-2xl bg-white" title="Resume Document" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CV Upload / Modification Modal ── */}
      <AnimatePresence>
        {showCvModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={closeCvModal}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-[32px] p-8 shadow-2xl flex flex-col gap-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 tracking-tight leading-none">
                    {editingCv ? "Modify Candidate Record" : "Index Candidate Profile"}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {editingCv ? "Adjust existing record parameters." : "Index target resume directly into database."}
                  </p>
                </div>
                <button onClick={closeCvModal} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Candidate Name <span className="text-rose-500">*</span></label>
                  <input
                    value={cvName}
                    onChange={e => setCvName(e.target.value)}
                    placeholder="Jane Doe"
                    className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email address</label>
                  <input
                    value={cvEmail}
                    onChange={e => setCvEmail(e.target.value)}
                    placeholder="jane@doe.com"
                    type="email"
                    className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Phone contact</label>
                  <input
                    value={cvPhone}
                    onChange={e => setCvPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {editingCv ? "Resume File (optional - upload to replace)" : "Resume File (PDF, DOC)"} {!editingCv && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="relative border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100/50 p-6 rounded-2xl text-center cursor-pointer hover:border-slate-300 transition-all">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setCvFile(f); }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">{cvFile ? cvFile.name : "Select credentials PDF file"}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">Supports PDF, DOC, DOCX up to 5 MB</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6 flex gap-3 mt-2">
                <button
                  onClick={closeCvModal}
                  className="flex-1 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={uploadingCv}
                  onClick={handleSaveCv}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-lg shadow-blue-500/10 disabled:opacity-50"
                >
                  {uploadingCv ? (editingCv ? "Saving..." : "Uploading...") : (editingCv ? "Save Changes" : "Save Profile")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── User Add / Provision Modal ── */}
      <AnimatePresence>
        {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => { setShowUserModal(false); resetUserForm(); setCreatedUser(null); }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-sm bg-white border border-slate-200 rounded-[32px] p-8 shadow-2xl flex flex-col gap-6"
            >
              {createdUser ? (
                // Access setup live success box
                <div className="flex flex-col gap-6 text-center items-center">
                  <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-inner">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-bold text-slate-950 leading-none">Supervisor Added</h2>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Registry key live. Copy access handles below.</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 text-left w-full flex flex-col gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Supervisor Name</span>
                      <p className="text-xs font-bold text-slate-800">{createdUser.name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email address</span>
                      <p className="text-xs font-bold text-slate-800">{createdUser.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <button
                      onClick={() => copyToClipboard(createdUser.email, "email")}
                      className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-all"
                    >
                      {copiedField === "email" ? "Copied handle" : "Copy email handle"}
                    </button>
                    <div className="flex gap-2 mt-2 w-full">
                      <button
                        onClick={() => setCreatedUser(null)}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-sm"
                      >
                        Add Another
                      </button>
                      <button
                        onClick={() => { setShowUserModal(false); resetUserForm(); setCreatedUser(null); }}
                        className="flex-1 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-xs cursor-pointer"
                      >
                        Exit Registry
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Creation Form
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold text-slate-950 tracking-tight leading-none">Provision Keys</h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">Setup supervisor login credentials details.</p>
                    </div>
                    <button onClick={() => { setShowUserModal(false); resetUserForm(); }} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Full Name</label>
                      <input
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                        placeholder="Jane Doe"
                        className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email address <span className="text-rose-500">*</span></label>
                      <input
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                        placeholder="supervisor@example.com"
                        type="email"
                        className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Access Key <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <input
                          value={newUserPass}
                          onChange={e => setNewUserPass(e.target.value)}
                          placeholder="••••••••"
                          type={showPass ? "text" : "password"}
                          className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200 pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPass ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Verify Access Key <span className="text-rose-500">*</span></label>
                      <input
                        value={newUserConfirm}
                        onChange={e => setNewUserConfirm(e.target.value)}
                        placeholder="••••••••"
                        type={showPass ? "text" : "password"}
                        className="google-form-input focus:border-blue-600 transition-all rounded-xl p-3 border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-6 flex gap-3 mt-2">
                    <button
                      onClick={() => { setShowUserModal(false); resetUserForm(); }}
                      className="flex-1 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-xs transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={savingUser || !newUserEmail.trim() || !newUserPass.trim()}
                      onClick={handleCreateAdminUser}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-lg shadow-blue-500/10 disabled:opacity-60"
                    >
                      {savingUser ? "Provisions..." : "Grant Access"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
