"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import {
  Plus, MapPin, Briefcase, FileText, X, ExternalLink,
  CheckCircle2, Upload, MessageSquare, Send, Users,
  UserPlus, ArrowRight,
  Clock, Trash2, Edit2, Sparkles, Copy, Eye, Lock
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

/* ─── Status badge helper ─── */
function getStatusStyle(status: string) {
  switch (status) {
    case "Called":
      return { color: "#1e8e3e", bg: "rgba(30, 142, 62, 0.06)", border: "rgba(30, 142, 62, 0.12)" };
    case "Interviewing":
      return { color: "#1a73e8", bg: "rgba(26, 115, 232, 0.06)", border: "rgba(26, 115, 232, 0.12)" };
    case "Rejected":
      return { color: "#d93025", bg: "rgba(217, 48, 37, 0.06)", border: "rgba(217, 48, 37, 0.12)" };
    default:
      return { color: "#5f6368", bg: "var(--neutral-100)", border: "rgba(0, 0, 0, 0.06)" };
  }
}

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
    // getSession() may throw AuthApiError if a stale refresh token is stored.
    // We catch and treat it as "no session" so the login form is shown cleanly.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Stale token — Supabase already signed out internally; just clear loading.
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
        // Signed out (including token refresh failure) — stop spinner if still loading
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

  /* ── Auth screens ── */
  if (authLoading && !loginSuccess) {
    return (
      <main style={{ minHeight: "100vh", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #e8f0fe", borderTopColor: "var(--google-blue, #1a73e8)", animation: "spin 0.8s linear infinite" }} />
        <style jsx global>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  if (loginSuccess) {
    return (
      <main style={{ minHeight: "100vh", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--neutral-900)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 24, padding: "52px 40px", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)" }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            style={{ width: 56, height: 56, background: "rgba(30,142,62,0.08)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(30,142,62,0.2)" }}
            className="flex items-center justify-center"
          >
            <CheckCircle2 style={{ width: 26, height: 26, color: "var(--google-green, #1e8e3e)" }} />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ fontSize: 20, fontWeight: 600, color: "var(--neutral-900)", fontFamily: '"Google Sans", sans-serif' }}
          >
            Authorized Session
          </motion.h2>
        </motion.div>
      </main>
    );
  }

  if (!session) {
    return (
      <main style={{ minHeight: "100vh", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--neutral-900)", padding: "24px" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100%", maxWidth: 410, border: "1px solid rgba(0, 0, 0, 0.08)", borderRadius: 24, padding: "48px 36px", background: "rgba(255, 255, 255, 0.8)", backdropFilter: "blur(20px)", boxShadow: "0 8px 30px rgba(0,0,0,0.03)" }}
        >
          <div style={{ marginBottom: 28 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
              <Lock style={{ width: 18, height: 18, color: "var(--google-blue)" }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--neutral-900)", marginBottom: 6, fontFamily: '"Google Sans", sans-serif' }}>Recruiter Console</h1>
            <p style={{ fontSize: 13, color: "var(--neutral-500)", fontWeight: 500 }}>Sign in to manage your recruitment workspaces</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="google-form-label">Email address</label>
              <input
                type="email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                required
                className="google-form-input"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="google-form-label">Password</label>
              <input
                type="password"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                required
                className="google-form-input"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ fontSize: 13, color: "var(--google-red)", background: "rgba(217,48,37,0.06)", border: "1px solid rgba(217,48,37,0.12)", borderRadius: 10, padding: "10px 14px", textAlign: "center", fontWeight: 500 }}
              >
                {authError}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: "100%",
                justifyContent: "center",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 24px",
                borderRadius: 24,
                fontWeight: 600,
                fontSize: 14,
                cursor: authLoading ? "not-allowed" : "pointer",
                border: "none",
                color: "#ffffff",
                background: "var(--google-blue, #1a73e8)",
                opacity: authLoading ? 0.7 : 1,
                boxShadow: "0 2px 4px rgba(26, 115, 232, 0.15)",
                marginTop: 8,
                transition: "all 0.2s"
              }}
            >
              {authLoading ? (
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
              ) : "Access Dashboard"}
            </button>
          </form>
        </motion.div>
      </main>
    );
  }

  /* ── Main Admin UI ── */
  return (
    <main style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "transparent", color: "var(--neutral-900)" }}>
      <Header session={session} handleLogout={handleLogout} />

      <div style={{ position: "relative", zIndex: 10, flex: 1, width: "100%", maxWidth: 1240, margin: "0 auto", padding: "110px 24px 80px" }}>
        
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 36 }}
        >
          <div style={{ display: "inline-flex", alignSelf: "flex-start", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--google-blue, #1a73e8)", background: "rgba(26,115,232,0.08)", padding: "4px 10px", borderRadius: 12 }}>
            Control Console
          </div>
          <h1 style={{ fontSize: "clamp(26px, 3.5vw, 38px)", fontWeight: 600, letterSpacing: "-0.025em", color: "var(--neutral-900)", lineHeight: 1.1, fontFamily: '"Google Sans Display", "Google Sans", sans-serif' }}>
            Supervisor Control Desk
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--neutral-500)", fontWeight: 500 }}>
            Session active: <span style={{ color: "var(--neutral-800)", fontWeight: 600 }}>{session?.user?.email}</span>
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div style={{ borderBottom: "1px solid rgba(0, 0, 0, 0.08)", marginBottom: 36, display: "flex", gap: 16, overflowX: "auto" }}>
          {([
            { key: "jobs", label: "Openings & Reviews", icon: <Briefcase style={{ width: 14, height: 14 }} /> },
            { key: "cvs",  label: "Recruitment Database",  icon: <FileText style={{ width: 14, height: 14 }} /> },
            { key: "users",label: "Supervisor Accounts",   icon: <Users style={{ width: 14, height: 14 }} /> },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding: "10px 12px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: "none",
                color: activeTab === t.key ? "var(--google-blue, #1a73e8)" : "var(--neutral-500)",
                borderBottom: activeTab === t.key ? "3px solid var(--google-blue)" : "3px solid transparent",
                marginBottom: -1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
                fontFamily: "inherit",
                whiteSpace: "nowrap"
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Jobs Tab ── */}
        {activeTab === "jobs" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            
            {/* Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20, marginBottom: 40 }}>
              {[
                { label: "Active Openings", value: stats.totalJobs, icon: <Briefcase style={{ width: 18, height: 18, color: "var(--google-blue)" }} />, color: "rgba(26, 115, 232, 0.08)" },
                { label: "Total Candidate Applications", value: stats.totalApps, icon: <Users style={{ width: 18, height: 18, color: "var(--google-green)" }} />, color: "rgba(30, 142, 62, 0.08)" },
                { label: "Pending Evaluations", value: stats.pendingApps, icon: <Clock style={{ width: 18, height: 18, color: "var(--google-yellow)" }} />, color: "rgba(249, 171, 0, 0.08)" },
                { label: "CV Talent Repository", value: stats.totalCVs, icon: <FileText style={{ width: 18, height: 18, color: "var(--google-red)" }} />, color: "rgba(217, 48, 37, 0.08)" }
              ].map((s, idx) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.04 }}
                  style={{
                    padding: "24px 20px",
                    borderRadius: 20,
                    background: "rgba(255, 255, 255, 0.75)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(0,0,0,0.06)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.01)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 16
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-500)" }}>{s.label}</span>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {s.icon}
                    </div>
                  </div>
                  <h3 style={{ fontSize: 28, fontWeight: 600, color: "var(--neutral-900)", fontFamily: '"Google Sans", sans-serif', margin: 0, tracking: "-0.015em" }}>{s.value}</h3>
                </motion.div>
              ))}
            </div>

            {/* List Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--neutral-900)", fontFamily: '"Google Sans", sans-serif' }}>Active Listings</h2>
                <p style={{ fontSize: 13, color: "var(--neutral-500)", mt: 4, fontWeight: 500 }}>Select a job card to evaluate its real-time applicants panel.</p>
              </div>
              <button
                onClick={openCreate}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  borderRadius: 20,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  border: "none",
                  color: "#ffffff",
                  background: "var(--google-blue, #1a73e8)",
                  boxShadow: "0 2px 4px rgba(26, 115, 232, 0.15)",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 10px rgba(26, 115, 232, 0.2)"}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 2px 4px rgba(26, 115, 232, 0.15)"}
              >
                <Plus style={{ width: 15, height: 15 }} /> Create Job Listing
              </button>
            </div>

            {jobs.length === 0 ? (
              <div style={{ padding: "60px 40px", borderRadius: 24, border: "1px dashed rgba(0,0,0,0.1)", textAlign: "center", background: "rgba(255,255,255,0.6)" }}>
                <p style={{ fontSize: 15, color: "var(--neutral-500)", fontWeight: 500 }}>No active openings published. Add one to start recruiting.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 20 }}>
                {jobs.map((job, i) => {
                  const styleInfo = getDeptStyle(job.department);
                  return (
                    <motion.div 
                      key={job.id} 
                      initial={{ opacity: 0, y: 16 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ duration: 0.35, delay: i * 0.04 }}
                    >
                      <div
                        style={{
                          padding: "24px",
                          borderRadius: 24,
                          border: "1px solid rgba(0, 0, 0, 0.05)",
                          background: "rgba(255,255,255,0.75)",
                          backdropFilter: "blur(20px)",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.01)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 20,
                          height: "100%",
                          position: "relative"
                        }}
                      >
                        <div>
                          {/* Upper Card: Badge + options */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: styleInfo.color, backgroundColor: styleInfo.bg, border: `1px solid ${styleInfo.border}`, padding: "4px 10px", borderRadius: 10 }}>
                              {job.department}
                            </span>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button 
                                onClick={() => openEdit(job)}
                                style={{ p: 6, border: "1px solid rgba(0,0,0,0.06)", background: "#ffffff", color: "var(--neutral-600)", cursor: "pointer", display: "inline-flex", padding: 6, borderRadius: 8, transition: "color 0.2s" }}
                                onMouseEnter={(e) => e.currentTarget.style.color = "var(--google-blue)"}
                                onMouseLeave={(e) => e.currentTarget.style.color = "var(--neutral-600)"}
                              >
                                <Edit2 style={{ width: 13, height: 13 }} />
                              </button>
                              <button 
                                onClick={() => handleDelete(job.id)}
                                style={{ p: 6, border: "1px solid rgba(217,48,37,0.12)", background: "rgba(217,48,37,0.04)", color: "var(--google-red)", cursor: "pointer", display: "inline-flex", padding: 6, borderRadius: 8, transition: "background 0.2s" }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(217,48,37,0.08)"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(217,48,37,0.04)"}
                              >
                                <Trash2 style={{ width: 13, height: 13 }} />
                              </button>
                            </div>
                          </div>
                          
                          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--neutral-900)", marginBottom: 8, lineHeight: 1.25, fontFamily: '"Google Sans", sans-serif' }}>
                            {job.title}
                          </h2>
                          
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--neutral-500)", fontWeight: 500, marginBottom: 12 }}>
                            <MapPin style={{ width: 13, height: 13, color: "var(--neutral-400)" }} />
                            {job.location}
                          </div>
                          
                          <p style={{ fontSize: 13, color: "var(--neutral-600)", lineHeight: 1.55, margin: 0 }}>
                            {job.description.replace(/#{1,3} |[*_~`•]/g, "").slice(0, 95)}
                            {job.description.length > 95 ? "..." : ""}
                          </p>
                        </div>
                        
                        <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 14 }}>
                          <button
                            onClick={() => router.push(`/admin/jobs/${job.id}`)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              padding: "10px",
                              borderRadius: 12,
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: "pointer",
                              border: "none",
                              color: "#ffffff",
                              background: "var(--google-blue, #1a73e8)",
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = 0.95}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
                          >
                            Review Submissions <ArrowRight style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}

        {/* ── CV Database Tab ── */}
        {activeTab === "cvs" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--neutral-900)", fontFamily: '"Google Sans", sans-serif' }}>Talent Index</h2>
                <p style={{ fontSize: 13, color: "var(--neutral-500)", mt: 4, fontWeight: 500 }}>Update active candidate status pathways, delete indexes, or write remarks.</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <select 
                  value={cvFilter} 
                  onChange={e => setCvFilter(e.target.value)}
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.08)",
                    background: "#ffffff",
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--neutral-700)",
                    outline: "none",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.01)"
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Not Called">Not Called</option>
                  <option value="Called">Called</option>
                  <option value="Interviewing">Interviewing</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <button
                  onClick={() => setShowCvModal(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 16px",
                    borderRadius: 20,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    border: "none",
                    color: "#ffffff",
                    background: "var(--google-blue, #1a73e8)",
                    boxShadow: "0 2px 4px rgba(26, 115, 232, 0.15)"
                  }}
                >
                  <Upload style={{ width: 14, height: 14 }} /> Upload CV
                </button>
              </div>
            </div>

            {cvs.length === 0 ? (
              <div style={{ padding: "60px 40px", borderRadius: 24, border: "1px dashed rgba(0,0,0,0.1)", textAlign: "center", background: "rgba(255,255,255,0.6)" }}>
                <p style={{ fontSize: 15, color: "var(--neutral-500)", fontWeight: 500 }}>No CV records currently loaded in index.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {cvs.filter(c => cvFilter === "All" || c.status === cvFilter).map((cv, i) => {
                  const cvComments = parseComments(cv.comments);
                  const colors = [
                    "linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)",
                    "linear-gradient(135deg, #34a853 0%, #1e8e3e 100%)",
                    "linear-gradient(135deg, #f9ab00 0%, #f4b400 100%)",
                    "linear-gradient(135deg, #ea4335 0%, #d93025 100%)"
                  ];
                  const colorIndex = cv.name.charCodeAt(0) % colors.length;
                  const gradient = colors[colorIndex];
                  const initials = cv.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                  const statusStyle = getStatusStyle(cv.status);

                  return (
                    <motion.div 
                      key={cv.id} 
                      initial={{ opacity: 0, y: 12 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ delay: i * 0.03 }}
                      style={{
                        borderRadius: 24,
                        border: "1px solid rgba(0,0,0,0.06)",
                        background: "rgba(255,255,255,0.75)",
                        backdropFilter: "blur(20px)",
                        overflow: "hidden",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.01)"
                      }}
                    >
                      {/* CV Primary Row */}
                      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, padding: "20px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                          <div style={{ width: 44, height: 44, borderRadius: "50%", background: gradient, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                              <h3 style={{ fontSize: 16.5, fontWeight: 600, color: "var(--neutral-900)", margin: 0 }}>{cv.name}</h3>
                              <span style={{ fontSize: 11, fontWeight: 600, color: statusStyle.color, backgroundColor: statusStyle.bg, border: `1px solid ${statusStyle.border}`, padding: "3px 9px", borderRadius: 8 }}>
                                {cv.status}
                              </span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12.5, color: "var(--neutral-500)", fontWeight: 500 }}>
                              {cv.email && <span>{cv.email}</span>}
                              {cv.phone && <span>{cv.phone}</span>}
                              <span style={{ color: "var(--neutral-400)" }}>• {new Date(cv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <select 
                            value={cv.status} 
                            onChange={e => handleCvStatus(cv.id, e.target.value)}
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
                            <option value="Not Called">Not Called</option>
                            <option value="Called">Called</option>
                            <option value="Interviewing">Interviewing</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                          <button 
                            onClick={() => { setSelectedCV(cv.cv_url); setCvOpen(true); }}
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
                            <Eye style={{ width: 14, height: 14 }} /> View
                          </button>
                          <button 
                            onClick={() => handleDeleteCv(cv.id)}
                            style={{
                              padding: "7px 14px",
                              borderRadius: 12,
                              border: "1px solid rgba(217,48,37,0.12)",
                              background: "rgba(217,48,37,0.04)",
                              color: "var(--google-red)",
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: "pointer"
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Recruiter Remarks Box */}
                      <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.005)" }}>
                        <div
                          onClick={() => setExpandedCvComments(v => ({ ...v, [cv.id]: !v[cv.id] }))}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: "var(--neutral-500)" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                            <MessageSquare style={{ width: 14, height: 14, color: "var(--google-blue)" }} />
                            <span>Recruiter Remarks</span>
                            {cvComments.length > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(0,0,0,0.06)", color: "var(--neutral-700)", px: 6, py: 2, borderRadius: 8, padding: "2px 6px" }}>{cvComments.length}</span>
                            )}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--google-blue)", cursor: "pointer" }}>
                            {expandedCvComments[cv.id] ? "Collapse Remarks" : "Expand Remarks"}
                          </span>
                        </div>

                        <AnimatePresence>
                          {expandedCvComments[cv.id] && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                                {cvComments.length > 0 && (
                                  <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 6 }}>
                                    {cvComments.map(comment => (
                                      <div key={comment.id} style={{ position: "relative", padding: "12px", border: "1px solid rgba(0,0,0,0.05)", background: "#ffffff", borderRadius: 12, fontSize: 12.5 }} className="group">
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                          <span style={{ fontWeight: 600, color: "var(--google-blue)" }}>{comment.author.split("@")[0]}</span>
                                          <span style={{ fontSize: 11, color: "var(--neutral-400)" }}>{new Date(comment.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                        </div>
                                        <p style={{ color: "var(--neutral-700)", margin: 0, lineHeight: 1.5 }}>{comment.text}</p>
                                        <button
                                          onClick={async () => {
                                            if (confirm("Delete this comment?")) {
                                              const updated = cvComments.filter(c => c.id !== comment.id);
                                              await handleUpdateCvComments(cv.id, JSON.stringify(updated));
                                            }
                                          }}
                                          style={{ position: "absolute", top: 10, right: 10, border: "none", background: "none", color: "var(--neutral-400)", cursor: "pointer", display: "flex", alignItems: "center" }}
                                        >
                                          <X style={{ width: 12, height: 12 }} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                  <textarea
                                    placeholder="Append recruiter note..."
                                    value={cvCommentValues[cv.id] ?? ""}
                                    onChange={e => setCvCommentValues(v => ({ ...v, [cv.id]: e.target.value }))}
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
                                    <Send style={{ width: 12, height: 12 }} /> Add
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
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--neutral-900)", fontFamily: '"Google Sans", sans-serif' }}>Authorized Administrators</h2>
                <p style={{ fontSize: 13, color: "var(--neutral-500)", mt: 4, fontWeight: 500 }}>Provision supervising keys or revoke control access credentials.</p>
              </div>
              <button onClick={() => setShowUserModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  borderRadius: 20,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  border: "none",
                  color: "#ffffff",
                  background: "var(--google-blue, #1a73e8)",
                  boxShadow: "0 2px 4px rgba(26, 115, 232, 0.15)"
                }}>
                <UserPlus style={{ width: 14, height: 14 }} /> Provision Account
              </button>
            </div>

            {adminUsers.length === 0 ? (
              <div style={{ padding: "60px 40px", borderRadius: 24, border: "1px dashed rgba(0,0,0,0.1)", textAlign: "center", background: "rgba(255,255,255,0.6)" }}>
                <h3 style={{ fontSize: 16, fontStyle: "italic", color: "var(--neutral-500)", margin: 0 }}>Gathering supervisory registry...</h3>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 20 }}>
                {adminUsers.map((u, i) => {
                  const initials = (u.name ?? u.email ?? "?")[0].toUpperCase();
                  const colors = [
                    "linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)",
                    "linear-gradient(135deg, #34a853 0%, #1e8e3e 100%)",
                    "linear-gradient(135deg, #f9ab00 0%, #f4b400 100%)"
                  ];
                  const gradient = colors[u.email.charCodeAt(0) % colors.length];

                  return (
                    <motion.div 
                      key={u.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{
                        padding: "20px 24px",
                        borderRadius: 24,
                        border: "1px solid rgba(0,0,0,0.06)",
                        background: "rgba(255,255,255,0.75)",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.01)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        position: "relative"
                      }}
                      className="group"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: "50%", background: gradient, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: 600, fontSize: 14, flexShrink: 0 }} className="flex items-center justify-center">
                          {initials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--neutral-900)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name ?? <span style={{ fontStyle: "italic", color: "var(--neutral-400)" }}>Unnamed supervisor</span>}</p>
                          <p style={{ fontSize: 12.5, color: "var(--neutral-500)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--neutral-500)", borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 12 }}>
                        <div style={{ display: "flex", justify="space-between" }} className="flex justify-between">
                          <span>Created date:</span>
                          <span style={{ fontWeight: 600, color: "var(--neutral-800)" }}>
                            {new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <div style={{ display: "flex", justify="space-between" }} className="flex justify-between">
                          <span>Last login:</span>
                          <span style={{ fontWeight: 600, color: "var(--neutral-800)" }}>
                            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDeleteAdminUser(u.id)}
                        style={{
                          position: "absolute",
                          top: 18,
                          right: 18,
                          border: "none",
                          background: "none",
                          color: "var(--neutral-400)",
                          cursor: "pointer",
                          transition: "color 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "var(--google-red)"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "var(--neutral-400)"}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}
      </div>

      {/* ── Job Modal (Create/Edit) ── */}
      <AnimatePresence>
        {showModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.25)", backdropFilter: "blur(8px)" }} onClick={closeModal} />
            <motion.div initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 600,
                borderRadius: 24,
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.08)",
                padding: "36px",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 10px 40px rgba(0,0,0,0.05)"
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--neutral-900)", margin: 0, fontFamily: '"Google Sans", sans-serif' }}>{editingJob ? "Modify Listing Details" : "Publish New Role"}</h2>
                  <p style={{ fontSize: 13, color: "var(--neutral-500)", mt: 4, fontWeight: 500 }}>{editingJob ? "Adjust publication and job role descriptions." : "Configure operational parameters for candidate screening."}</p>
                </div>
                <button onClick={closeModal} style={{ border: "none", background: "none", color: "var(--neutral-400)", cursor: "pointer" }}>
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label className="google-form-label">Job Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Software Engineer" className="google-form-input" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="google-form-label">Department</label>
                    <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" className="google-form-input" />
                  </div>
                  <div>
                    <label className="google-form-label">Location</label>
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Bangalore / Remote" className="google-form-input" />
                  </div>
                </div>
                <div>
                  <label className="google-form-label">Description (Supports Markdown)</label>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, background: "var(--neutral-100)", border: "1px solid rgba(0,0,0,0.06)", padding: "4px", borderRadius: 12 }}>
                    {[
                      { label: "Bold",    fn: insertBold },
                      { label: "Heading", fn: insertHeading },
                      { label: "Bullet",  fn: insertBullet },
                    ].map(b => (
                      <button key={b.label} type="button" onClick={b.fn}
                        style={{
                          borderRadius: 8,
                          border: "none",
                          background: "#ffffff",
                          px: 12,
                          py: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--neutral-700)",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                          cursor: "pointer",
                          padding: "6px 12px"
                        }}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <textarea ref={descRef} value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Provide responsibilities, requirements, and information using markdown format..." rows={6} className="google-form-input" style={{ resize: "none", fontFamily: "inherit" }} />
                </div>
              </div>

              <div style={{ marginTop: 28, pt: 18, borderTop: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 12 }}>
                <button onClick={closeModal} style={{ flex: 1, padding: "11px", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", background: "#ffffff", fontSize: 13.5, fontWeight: 600, color: "var(--neutral-600)", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSave} style={{ flex: 1, padding: "11px", borderRadius: 20, border: "none", background: "var(--google-blue, #1a73e8)", color: "#ffffff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{editingJob ? "Save Changes" : "Publish opening"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CV Viewer Modal ── */}
      <AnimatePresence>
        {cvOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.2)", backdropFilter: "blur(8px)" }} onClick={() => setCvOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }}
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
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 20, py: 14, borderBottom: "1px solid rgba(0,0,0,0.05)", background: "#ffffff", padding: "14px 20px" }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--neutral-900)", margin: 0 }}>Resume Sandbox</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <a href={selectedCV} target="_blank" rel="noopener noreferrer"
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
                    }}>
                    External view <ExternalLink style={{ width: 13, height: 13 }} />
                  </a>
                  <button onClick={() => setCvOpen(false)} style={{ border: "none", background: "none", color: "var(--neutral-400)", cursor: "pointer", display: "flex" }}>
                    <X style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, background: "#f8f9ff", padding: 12 }}>
                <iframe src={selectedCV} style={{ width: "100%", height: "100%", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", background: "#ffffff" }} title="Resume" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CV Upload Modal ── */}
      <AnimatePresence>
        {showCvModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.2)", backdropFilter: "blur(8px)" }} onClick={closeCvModal} />
            <motion.div initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 440,
                borderRadius: 24,
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.08)",
                padding: "32px",
                boxShadow: "0 10px 40px rgba(0,0,0,0.05)"
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--neutral-900)", margin: 0, fontFamily: '"Google Sans", sans-serif' }}>Load Candidate profile</h2>
                  <p style={{ fontSize: 13, color: "var(--neutral-500)", mt: 4, fontWeight: 500 }}>Index a target resume directly into the primary pipeline.</p>
                </div>
                <button onClick={closeCvModal} style={{ border: "none", background: "none", color: "var(--neutral-400)", cursor: "pointer" }}>
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="google-form-label">Full Name <span style={{ color: "var(--google-red)" }}>*</span></label>
                  <input value={cvName} onChange={e => setCvName(e.target.value)} placeholder="Jane Doe" className="google-form-input" />
                </div>
                <div>
                  <label className="google-form-label">Email address</label>
                  <input value={cvEmail} onChange={e => setCvEmail(e.target.value)} placeholder="jane@example.com" type="email" className="google-form-input" />
                </div>
                <div>
                  <label className="google-form-label">Phone contact</label>
                  <input value={cvPhone} onChange={e => setCvPhone(e.target.value)} placeholder="+91 9876543210" className="google-form-input" />
                </div>
                <div>
                  <label className="google-form-label">Resume file (PDF, DOC) <span style={{ color: "var(--google-red)" }}>*</span></label>
                  <div style={{ position: "relative", rounded: 12, border: "2px dashed rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.005)", padding: "24px 16px", textAlign: "center", cursor: "pointer" }} className="hover-dashed-border">
                    <input type="file" accept=".pdf,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setCvFile(f); }}
                      style={{ position: "absolute", inset: 0, w: "100%", h: "100%", opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                    <Upload style={{ width: 22, height: 22, color: "var(--neutral-400)", margin: "0 auto 8px" }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-800)", margin: "0 0 4px" }}>{cvFile ? cvFile.name : "Select credentials file"}</p>
                    <p style={{ fontSize: 11, color: "var(--neutral-400)", margin: 0 }}>Supports PDF, DOC, DOCX up to 5 MB</p>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24, pt: 14, borderTop: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 12 }}>
                <button onClick={closeCvModal} style={{ flex: 1, padding: "10px", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", background: "#ffffff", fontSize: 13, fontWeight: 600, color: "var(--neutral-600)", cursor: "pointer" }}>Cancel</button>
                <button disabled={uploadingCv} onClick={handleUploadCv} style={{ flex: 1, padding: "10px", borderRadius: 20, border: "none", background: "var(--google-blue, #1a73e8)", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: uploadingCv ? 0.7 : 1 }}>
                  {uploadingCv ? "Uploading..." : "Save Profile"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── User Add Modal ── */}
      <AnimatePresence>
        {showUserModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.2)", backdropFilter: "blur(8px)" }}
              onClick={() => { setShowUserModal(false); resetUserForm(); setCreatedUser(null); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 400,
                borderRadius: 24,
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.08)",
                padding: "32px",
                boxShadow: "0 10px 40px rgba(0,0,0,0.05)"
              }}>
              
              {createdUser ? (
                // Success Credentials Screen
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, background: "rgba(30,142,62,0.08)", border: "1px solid rgba(30,142,62,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }} className="flex items-center justify-center">
                    <CheckCircle2 style={{ width: 24, height: 24, color: "var(--google-green)" }} />
                  </div>
                  <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--neutral-900)", margin: 0, fontFamily: '"Google Sans", sans-serif' }}>Supervisor Added</h2>
                  <p style={{ fontSize: 13, color: "var(--neutral-500)", mt: 4, mb: 20 }}>The supervising registry credentials are live.</p>
                  
                  <div style={{ background: "var(--neutral-100)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 16, padding: "18px", textAlign: "left", marginBottom: 20 }}>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--neutral-400)", letterSpacing: "0.05em" }}>Name</span>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--neutral-800)", margin: "2px 0 0" }}>{createdUser.name || "N/A"}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--neutral-400)", letterSpacing: "0.05em" }}>Email address</span>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--neutral-800)", margin: "2px 0 0" }}>{createdUser.email}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button
                      onClick={() => copyToClipboard(createdUser.email, "email")}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "#ffffff",
                        color: "var(--neutral-700)",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer"
                      }}
                    >
                      {copiedField === "email" ? "Copied address" : "Copy email handle"}
                    </button>
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <button
                        onClick={() => setCreatedUser(null)}
                        style={{
                          flex: 1,
                          padding: "11px",
                          borderRadius: 12,
                          border: "none",
                          background: "var(--google-blue, #1a73e8)",
                          color: "#ffffff",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer"
                        }}
                      >
                        Add Another
                      </button>
                      <button
                        onClick={() => { setShowUserModal(false); resetUserForm(); setCreatedUser(null); }}
                        style={{
                          flex: 1,
                          padding: "11px",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.08)",
                          background: "#ffffff",
                          color: "var(--neutral-600)",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer"
                        }}
                      >
                        Exit Registry
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Creation Form
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--neutral-900)", margin: 0, fontFamily: '"Google Sans", sans-serif' }}>Provision Keys</h2>
                      <p style={{ fontSize: 13, color: "var(--neutral-500)", mt: 4, fontWeight: 500 }}>Setup supervisor login credentials details.</p>
                    </div>
                    <button onClick={() => { setShowUserModal(false); resetUserForm(); }} style={{ border: "none", background: "none", color: "var(--neutral-400)", cursor: "pointer" }}>
                      <X style={{ width: 18, height: 18 }} />
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label className="google-form-label">Full Name</label>
                      <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Jane Doe" className="google-form-input" />
                    </div>
                    <div>
                      <label className="google-form-label">Email address <span style={{ color: "var(--google-red)" }}>*</span></label>
                      <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="supervisor@example.com" type="email" className="google-form-input" />
                    </div>
                    <div>
                      <label className="google-form-label">Supervisor Access key <span style={{ color: "var(--google-red)" }}>*</span></label>
                      <div style={{ position: "relative" }}>
                        <input value={newUserPass} onChange={e => setNewUserPass(e.target.value)} placeholder="••••••••" type={showPass ? "text" : "password"} className="google-form-input" style={{ paddingRight: 48 }} />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", color: "var(--neutral-400)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                        >
                          {showPass ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="google-form-label">Verify Access key <span style={{ color: "var(--google-red)" }}>*</span></label>
                      <input value={newUserConfirm} onChange={e => setNewUserConfirm(e.target.value)} placeholder="••••••••" type={showPass ? "text" : "password"} className="google-form-input" />
                    </div>
                  </div>

                  <div style={{ marginTop: 24, pt: 14, borderTop: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 12 }}>
                    <button onClick={() => { setShowUserModal(false); resetUserForm(); }} style={{ flex: 1, padding: "10px", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", background: "#ffffff", fontSize: 13, fontWeight: 600, color: "var(--neutral-600)", cursor: "pointer" }}>Cancel</button>
                    <button disabled={savingUser || !newUserEmail.trim() || !newUserPass.trim()} onClick={handleCreateAdminUser}
                      style={{ flex: 1, padding: "10px", borderRadius: 20, border: "none", background: "var(--google-blue, #1a73e8)", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: (savingUser || !newUserEmail.trim() || !newUserPass.trim()) ? 0.6 : 1 }}>
                      {savingUser ? "Provisions..." : "Grant Access"}
                    </button>
                  </div>
                </>
              )}
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
