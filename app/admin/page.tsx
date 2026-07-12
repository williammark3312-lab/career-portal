"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import {
  Plus, MapPin, Briefcase, FileText, X, ExternalLink,
  CheckCircle2, Upload, MessageSquare, Send, Users,
  UserPlus, ArrowRight, Clock, Trash2, Edit2, Sparkles,
  Copy, Lock, Search, LogOut, Shield, ChevronRight,
  Mail, Phone, Calendar, Check, Layers
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../src/components/Header";
import GlassBackground from "../../src/components/GlassBackground";
import { getAppBaseUrl } from "../../src/lib/appUrl";

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
interface InterviewData {
  proposed_slots: string[];
  selected_slot: string | null;
  status: "pending" | "scheduled";
}
interface CvNotesData {
  comments: Comment[];
  interview: InterviewData | null;
}

/* ─── Helpers ─── */
function parseCvNotes(raw: string | null | undefined): CvNotesData {
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
  } catch { /* fallback */ }
  return {
    comments: [{ id: "legacy", text: raw, created_at: new Date().toISOString(), author: "Admin" }],
    interview: null
  };
}

function formatDateTime(str: string) {
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
      const day = d.getDate();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}, ${formattedHours}:${formattedMinutes} ${ampm}`;
    }
  } catch {}
  return str;
}

/* ─── Department theme colors ─── */
function getDeptStyle(dept: string) {
  const d = dept.toLowerCase();
  if (d.includes("engineer") || d.includes("tech")) {
    return { color: "#60a5fa", bg: "rgba(96, 165, 250, 0.15)", border: "rgba(96, 165, 250, 0.3)", dot: "#3b82f6" };
  }
  if (d.includes("design") || d.includes("creative")) {
    return { color: "#fbbf24", bg: "rgba(251, 191, 36, 0.15)", border: "rgba(251, 191, 36, 0.3)", dot: "#f59e0b" };
  }
  if (d.includes("market") || d.includes("growth")) {
    return { color: "#34d399", bg: "rgba(52, 211, 153, 0.15)", border: "rgba(52, 211, 153, 0.3)", dot: "#10b981" };
  }
  return { color: "#f87171", bg: "rgba(248, 113, 113, 0.15)", border: "rgba(248, 113, 113, 0.3)", dot: "#ef4444" };
}

/* ─── Status badge helper ─── */
function getStatusStyle(status: string) {
  switch (status) {
    case "Called":
      return { color: "#34d399", bg: "rgba(52, 211, 153, 0.15)", border: "rgba(52, 211, 153, 0.3)", dot: "#10b981" };
    case "Interviewing":
      return { color: "#60a5fa", bg: "rgba(96, 165, 250, 0.15)", border: "rgba(96, 165, 250, 0.3)", dot: "#3b82f6" };
    case "Rejected":
      return { color: "#f87171", bg: "rgba(248, 113, 113, 0.15)", border: "rgba(248, 113, 113, 0.3)", dot: "#ef4444" };
    default:
      return { color: "#9ca3af", bg: "rgba(156, 163, 175, 0.15)", border: "rgba(156, 163, 175, 0.3)", dot: "#a1a1aa" };
  }
}

export default function AdminPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
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
  
  /* Right Slide-over profile preview drawer */
  const [activePreviewCandidate, setActivePreviewCandidate] = useState<CVRecord | null>(null);
  const [cvProposedSlots, setCvProposedSlots] = useState<string[]>([""]);
  const [cvSavingSchedule, setCvSavingSchedule] = useState(false);
  const [cvCopied, setCvCopied] = useState(false);

  /* CV Viewer modal state (fallback/independent view) */
  const [selectedCV] = useState("");
  const [cvOpen, setCvOpen] = useState(false);

  /* Admin Users state */
  interface AdminUser { id: string; email: string; name: string | null; role: string; created_at: string; last_sign_in_at?: string; }
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserConfirm, setNewUserConfirm] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "superuser">("admin");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "users" && !usersLoaded) {
      loadAdminUsers();
      setTimeout(() => setUsersLoaded(true), 0);
    }
  }, [activeTab, usersLoaded]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "jobs" || tab === "cvs" || tab === "users") {
        setActiveTab(tab);
      }
    }
  }, []);

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
      
      // Update active preview reference if open
      if (activePreviewCandidate) {
        const fresh = data.find(c => c.id === activePreviewCandidate.id);
        if (fresh) setActivePreviewCandidate(fresh);
      }
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

  /* ── CV Database CRUD ── */
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
    if (error) {
      alert(error.message);
    } else {
      loadCvs();
    }
  }

  async function handleDeleteCv(cvId: string) {
    if (!confirm("Delete this CV?")) return;
    const { error } = await supabase.from("cv_database").delete().eq("id", cvId);
    if (error) {
      alert(error.message);
    } else {
      if (activePreviewCandidate?.id === cvId) {
        setActivePreviewCandidate(null);
      }
      loadCvs();
      loadStats();
    }
  }

  async function handleUpdateCvComments(cvId: string, comments: string) {
    const { error } = await supabase.from("cv_database").update({ comments }).eq("id", cvId);
    if (error) {
      alert("Failed to save comments: " + error.message);
    } else {
      setCvs(prev => prev.map(c => c.id === cvId ? { ...c, comments } : c));
      if (activePreviewCandidate?.id === cvId) {
        setActivePreviewCandidate(prev => prev ? { ...prev, comments } : null);
      }
    }
  }

  function getCvMailtoUrl(candidateName: string, link: string, email: string) {
    const subject = encodeURIComponent(`Interview Scheduling - Careers Portal`);
    const body = encodeURIComponent(
      `Hi ${candidateName},\n\n` +
      `We would like to schedule a discussion with you regarding potential opportunities. Please click the link below to view our proposed time slots and confirm a time that works best for you:\n\n` +
      `${link}\n\n` +
      `We look forward to speaking with you!\n\n` +
      `Best regards,\n` +
      `Recruitment Team`
    );
    return `mailto:${email}?subject=${subject}&body=${body}`;
  }

  async function handleSaveCvSchedule() {
    if (!activePreviewCandidate) return;
    const slots = cvProposedSlots.filter(s => s.trim() !== "");
    if (slots.length === 0) {
      alert("Please add at least one date/time slot.");
      return;
    }
    setCvSavingSchedule(true);

    const parsed = parseCvNotes(activePreviewCandidate.comments);
    const updatedInterview: InterviewData = {
      proposed_slots: slots,
      selected_slot: parsed.interview?.selected_slot || null,
      status: parsed.interview?.status || "pending"
    };

    const updatedNotes = JSON.stringify({ comments: parsed.comments, interview: updatedInterview });
    const { error } = await supabase
      .from("cv_database")
      .update({ comments: updatedNotes })
      .eq("id", activePreviewCandidate.id);

    if (!error) {
      setCvs(prev => prev.map(c => c.id === activePreviewCandidate.id ? { ...c, comments: updatedNotes } : c));
      setActivePreviewCandidate(prev => prev ? { ...prev, comments: updatedNotes } : null);
      setCvProposedSlots(slots);
      alert("Scheduling slots updated successfully!");
    } else {
      alert("Failed to save scheduling settings: " + error.message);
    }
    setCvSavingSchedule(false);
  }

  async function handleCancelCvSchedule() {
    if (!activePreviewCandidate) return;
    if (!confirm("Are you sure you want to cancel and delete the interview setup?")) return;
    setCvSavingSchedule(true);

    const parsed = parseCvNotes(activePreviewCandidate.comments);
    const updatedNotes = JSON.stringify({ comments: parsed.comments, interview: null });
    const { error } = await supabase
      .from("cv_database")
      .update({ comments: updatedNotes })
      .eq("id", activePreviewCandidate.id);

    if (!error) {
      setCvs(prev => prev.map(c => c.id === activePreviewCandidate.id ? { ...c, comments: updatedNotes } : c));
      setActivePreviewCandidate(prev => prev ? { ...prev, comments: updatedNotes } : null);
      setCvProposedSlots([""]);
    } else {
      alert("Failed to cancel schedule: " + error.message);
    }
    setCvSavingSchedule(false);
  }

  const isSuperuser =
    session?.user?.app_metadata?.role === "superuser" ||
    session?.user?.user_metadata?.role === "superuser" ||
    session?.user?.email === "williammark3312@gmail.com" ||
    session?.user?.email === "anandugirish3312@gmail.com";

  const isRecruiter =
    session?.user?.app_metadata?.role === "admin" ||
    session?.user?.user_metadata?.role === "admin" ||
    session?.user?.app_metadata?.role === "superuser" ||
    session?.user?.user_metadata?.role === "superuser" ||
    session?.user?.email === "williammark3312@gmail.com" ||
    session?.user?.email === "anandugirish3312@gmail.com";

  /* ── Admin Users CRUD ── */
  function resetUserForm() {
    setNewUserName(""); setNewUserEmail(""); setNewUserPass(""); setNewUserConfirm(""); setNewUserRole("admin"); setShowPass(false);
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
        body: JSON.stringify({ email: newUserEmail.trim(), password: newUserPass, name: newUserName.trim(), role: newUserRole }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Failed to create user."); return; }
      setCreatedUser({ id: json.id, email: json.email, name: newUserName.trim() || null, role: newUserRole, created_at: json.created_at });
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

  async function handleToggleRole(userId: string, currentRole: string) {
    if (!isSuperuser) { alert("Only superusers can change roles."); return; }
    const targetRole = currentRole === "superuser" ? "admin" : "superuser";
    if (!confirm(`Are you sure you want to change this user's role to ${targetRole}?`)) return;
    try {
      const res = await fetch("/api/create-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: targetRole }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Failed to update role."); return; }
      loadAdminUsers();
    } catch {
      alert("Failed to update role due to network error.");
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  /* ── Auth Handlers ── */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true); setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) { setAuthError(error.message); setAuthLoading(false); }
    else { setLoginSuccess(true); setAuthLoading(false); setTimeout(() => setLoginSuccess(false), 1500); }
  }
  async function handleLogout() { await supabase.auth.signOut(); }

  /* ── Spinner loading state ── */
  if ((!mounted || authLoading) && !loginSuccess) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-white relative overflow-hidden">
        <GlassBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm font-bold text-zinc-400 tracking-wide animate-pulse-slow">Initializing Control Console...</p>
        </div>
      </main>
    );
  }

  /* ── Auth Success Animation ── */
  if (loginSuccess) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-white relative overflow-hidden">
        <GlassBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 border border-zinc-800/80 rounded-[32px] p-12 bg-zinc-900/60 backdrop-blur-2xl shadow-xl shadow-blue-500/5 relative z-10 max-w-sm text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-16 h-16 bg-emerald-950/30 border border-emerald-900/50 rounded-full flex items-center justify-center text-emerald-400 shadow-inner"
          >
            <CheckCircle2 className="w-8 h-8" />
          </motion.div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Access Authorized</h2>
            <p className="text-sm text-zinc-400 font-medium">Session secured. Entering supervisor desk...</p>
          </div>
        </motion.div>
      </main>
    );
  }

  /* ── Sleek Dark Login screen ── */
  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#050505] relative overflow-hidden p-4">
        {/* Deep, glowing background rings */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md border border-zinc-800/80 rounded-[32px] p-10 sm:p-12 bg-zinc-950/80 backdrop-blur-3xl shadow-2xl relative z-10 flex flex-col gap-8"
        >
          <div className="flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-white mb-2 shadow-lg shadow-blue-500/10">
              <Lock className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">
              Recruiter Desk
            </h1>
            <p className="text-sm text-zinc-400 font-semibold">Sign in to access your administrative dashboard.</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Email Address</label>
              <input
                type="email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                required
                className="w-full border-b border-zinc-800 focus:border-blue-500 bg-transparent text-white text-sm py-2.5 outline-none transition-colors"
                placeholder="recruiter@company.com"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Password</label>
              <input
                type="password"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                required
                className="w-full border-b border-zinc-800 focus:border-blue-500 bg-transparent text-white text-sm py-2.5 outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs font-bold text-rose-500 bg-rose-950/20 border border-rose-900/50 rounded-xl px-4 py-3 text-center"
              >
                {authError}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-blue-500/10 disabled:opacity-75 disabled:cursor-not-allowed mt-4 flex items-center justify-center"
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : "Sign In to Workspace"}
            </button>
          </form>
        </motion.div>
      </main>
    );
  }



  if (session && !isRecruiter) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#050505] relative overflow-hidden p-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md border border-rose-950 rounded-[32px] p-10 sm:p-12 bg-zinc-950/80 backdrop-blur-3xl shadow-2xl relative z-10 text-center flex flex-col items-center"
        >
          <div className="w-14 h-14 bg-rose-950/30 border border-rose-900 text-rose-500 rounded-full flex items-center justify-center mb-6 shadow-inner animate-pulse-slow">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-3">Access Denied</h1>
          <p className="text-sm text-zinc-400 font-semibold leading-relaxed mb-8">
            You are signed in as <span className="text-blue-400">{session.user.email}</span>. Only supervisor accounts are authorized to access this console.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleLogout}
              className="w-full py-3 px-6 rounded-xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] transition-all cursor-pointer"
            >
              Sign Out & Relogin
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 px-6 rounded-xl font-bold text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-all cursor-pointer"
            >
              Return to Home
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white relative z-10 flex flex-col lg:flex-row overflow-hidden">
      <GlassBackground />

      {/* ── Midnight-Dark Sidebar (Stripe Style) ── */}
      <aside className="w-72 bg-zinc-950 border-r border-zinc-900/80 hidden lg:flex flex-col justify-between p-6 fixed h-screen z-20">
        <div className="flex flex-col gap-8">
          
          {/* Logo Branding */}
          <div className="flex items-center gap-3 px-2 py-1 cursor-pointer" onClick={() => router.push("/jobs")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/10">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-none">Antigravity</h1>
              <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">Supervisor Space</span>
            </div>
          </div>

          {/* User Account context */}
          <div className="bg-zinc-900/40 rounded-xl p-3 border border-zinc-850 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-extrabold text-xs">
              {session?.user?.email?.[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Signed In</p>
              <p className="text-xs font-bold text-zinc-300 truncate" title={session?.user?.email}>{session?.user?.email}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {([
              { key: "jobs", label: "Openings & Reviews", icon: <Briefcase className="w-4 h-4" />, count: stats.totalJobs },
              { key: "cvs", label: "Talent Index", icon: <FileText className="w-4 h-4" />, count: stats.totalCVs },
              { key: "workspace", label: "Workspace", icon: <Layers className="w-4 h-4" />, count: undefined },
              { key: "users", label: "Supervisor Accounts", icon: <Users className="w-4 h-4" />, count: adminUsers.length },
            ] as const).map(t => {
              const isActive = activeTab === (t.key as any);
              return (
                <button
                   key={t.key}
                   onClick={() => {
                     if (t.key === "workspace") {
                       router.push("/admin/workspace");
                     } else {
                       setActiveTab(t.key as any);
                       setActivePreviewCandidate(null);
                     }
                   }}
                   className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                     isActive
                       ? "text-white bg-zinc-900 border border-zinc-850"
                       : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 border border-transparent"
                   }`}
                >
                  <div className="flex items-center gap-2.5">
                    {t.icon}
                    <span>{t.label}</span>
                  </div>
                  {t.count !== undefined && (
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                      isActive ? "bg-zinc-800 text-zinc-200" : "bg-zinc-900 text-zinc-500"
                    }`}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer context */}
        <div className="flex flex-col gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-rose-450 hover:bg-rose-950/20 border border-transparent hover:border-rose-950 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
          <div className="text-[10px] text-zinc-650 font-semibold px-3">
            © {new Date().getFullYear()} Google Antigravity
          </div>
        </div>
      </aside>

      {/* ── Mobile Layout header ── */}
      <div className="lg:hidden w-full relative z-30">
        <Header session={session} handleLogout={handleLogout} />
        {/* Mobile menu navigation tab strip */}
        <div className="bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900/80 px-4 py-2 flex gap-1 overflow-x-auto">
          {([
            { key: "jobs", label: "Openings", icon: <Briefcase className="w-3.5 h-3.5" /> },
            { key: "cvs", label: "Talent Index", icon: <FileText className="w-3.5 h-3.5" /> },
            { key: "workspace", label: "Workspace", icon: <Layers className="w-3.5 h-3.5" /> },
            { key: "users", label: "Supervisors", icon: <Users className="w-3.5 h-3.5" /> },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => {
                if (t.key === "workspace") {
                  router.push("/admin/workspace");
                } else {
                  setActiveTab(t.key as any);
                  setActivePreviewCandidate(null);
                }
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all duration-200 ${
                activeTab === (t.key as any)
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-400 bg-zinc-900 hover:bg-zinc-800"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content pane ── */}
      <div className="flex-1 lg:ml-72 min-h-screen flex flex-col p-4 sm:p-8 lg:p-10 relative z-10 pt-20 lg:pt-10 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto flex flex-col gap-6 flex-grow pb-16">
          
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-zinc-850">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <span>Console</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-zinc-400 font-semibold">{activeTab}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-none">
                {activeTab === "jobs" ? "Job Openings Desk" : activeTab === "cvs" ? "Talent Registry Index" : "Supervising Registry"}
              </h1>
            </div>

            {/* Quick header action button */}
            {activeTab === "jobs" && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-zinc-950 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Opening
              </button>
            )}
            {activeTab === "cvs" && (
              <button
                onClick={() => setShowCvModal(true)}
                className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-zinc-955 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Upload CV File
              </button>
            )}
            {activeTab === "users" && isSuperuser && (
              <button
                onClick={() => setShowUserModal(true)}
                className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-zinc-955 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Provision Account
              </button>
            )}
          </div>

          {/* ── Openings & Reviews Tab ── */}
          {activeTab === "jobs" && (
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
              
              {/* Vercel-Style Extralight Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Active Jobs", value: stats.totalJobs, icon: <Briefcase className="w-4 h-4" /> },
                  { label: "Applications", value: stats.totalApps, icon: <Users className="w-4 h-4" /> },
                  { label: "Evaluations Pending", value: stats.pendingApps, icon: <Clock className="w-4 h-4" /> },
                  { label: "Talent Repository", value: stats.totalCVs, icon: <FileText className="w-4 h-4" /> }
                ].map((s, idx) => (
                  <div key={idx} className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-3 shadow-lg hover:border-zinc-700/80 transition-all">
                    <div className="flex justify-between items-center text-zinc-500">
                      <span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span>
                      {s.icon}
                    </div>
                    <span className="text-3xl font-extralight tracking-tight text-white leading-none">{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Jobs List (Minimal List Design) */}
              {jobs.length === 0 ? (
                <div className="p-16 border border-dashed border-zinc-800 bg-zinc-900/40 backdrop-blur-md rounded-2xl text-center">
                  <Briefcase className="w-8 h-8 text-zinc-650 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400 font-semibold">No job listings published. Click &quot;Create Opening&quot; to start.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {jobs.map((job) => {
                    const styleInfo = getDeptStyle(job.department);
                    return (
                      <div
                        key={job.id}
                        className="bg-[#121214]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700/80 hover:shadow-lg transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                      >
                        <div className="flex items-start gap-4 min-w-0">
                          {/* Colored circular dot representing dept */}
                          <div
                            style={{ backgroundColor: styleInfo.dot }}
                            className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                          />
                          <div className="min-w-0 flex flex-col gap-1">
                            <h2 className="text-base font-bold text-white tracking-tight leading-none hover:text-blue-400 cursor-pointer" onClick={() => router.push(`/admin/jobs/${job.id}`)}>
                              {job.title}
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-zinc-500 font-semibold">
                              <span>{job.department}</span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 text-zinc-500" /> {job.location}</span>
                            </div>
                          </div>
                        </div>

                        {/* Controls Toolbar */}
                        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
                          <button
                            onClick={() => openEdit(job)}
                            className="p-2 border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded-xl transition-all cursor-pointer"
                            title="Modify Listing"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(job.id)}
                            className="p-2 border border-rose-900/50 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 rounded-xl transition-all cursor-pointer"
                            title="Delete Listing"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => router.push(`/admin/jobs/${job.id}`)}
                            className="flex items-center gap-1 bg-white hover:bg-zinc-100 text-zinc-950 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.98]"
                          >
                            Reviews <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}

          {/* ── Talent Index (DataTable Layout) ── */}
          {activeTab === "cvs" && (
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
              
              {/* Search Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3.5 items-stretch">
                {/* Search Box */}
                <div className="relative flex-1 flex items-center bg-zinc-950/80 rounded-xl border border-zinc-900 px-3.5 py-2.5">
                  <Search className="w-4 h-4 mr-2.5 text-zinc-600" />
                  <input
                    type="text"
                    placeholder="Search candidate registry database..."
                    value={cvSearch}
                    onChange={e => setCvSearch(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs text-zinc-200 placeholder-zinc-650 font-semibold"
                  />
                </div>
                
                {/* Status Dropdown */}
                <select
                  value={cvFilter}
                  onChange={e => setCvFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-900 bg-zinc-950/50 text-xs font-bold text-zinc-400 focus:outline-none focus:border-zinc-700 cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Not Called">Not Called</option>
                  <option value="Called">Called</option>
                  <option value="Interviewing">Interviewing</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Data Rows */}
              {cvs.length === 0 ? (
                <div className="py-20 flex flex-col items-center gap-3 animate-pulse-slow" style={{border:'1px dashed rgba(255,255,255,0.06)',borderRadius:'16px'}}>
                  <FileText className="w-7 h-7" style={{color:'rgba(255,255,255,0.12)'}} />
                  <p className="text-sm font-semibold text-zinc-500">No candidate profile files indexed.</p>
                </div>
              ) : (
                <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden">
                  {cvs.filter(c => {
                    const matchesFilter = cvFilter === "All" || c.status === cvFilter;
                    const matchesSearch = !cvSearch.trim() ||
                      c.name.toLowerCase().includes(cvSearch.toLowerCase()) ||
                      (c.email && c.email.toLowerCase().includes(cvSearch.toLowerCase()));
                    return matchesFilter && matchesSearch;
                  }).map((cv) => {
                    const statusStyle = getStatusStyle(cv.status);
                    const initials = cv.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                    
                    return (
                      <div
                        key={cv.id}
                        onClick={() => {
                          setActivePreviewCandidate(cv);
                          const parsed = parseCvNotes(cv.comments);
                          setCvProposedSlots(parsed.interview?.proposed_slots || [""]);
                        }}
                        className="w-full flex justify-between items-center py-5 px-6 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/30 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-4 min-w-0 pr-4">
                          <div className="w-9 h-9 rounded-xl bg-zinc-950/40 border border-zinc-900 flex items-center justify-center text-zinc-300 font-extrabold text-[11px] shrink-0">
                            {initials}
                          </div>
                          <div className="flex flex-col gap-1 min-w-0">
                            <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-zinc-300 transition-colors truncate">
                              {cv.name}
                            </h2>
                            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                              <span>{cv.email || "No email handle"}</span>
                              <span>•</span>
                              <span>Indexed {new Date(cv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <span 
                            style={{ color: statusStyle.color, borderColor: statusStyle.color + "30" }}
                            className="text-[10px] font-semibold bg-zinc-950/40 border px-3 py-1 rounded-md"
                          >
                            {cv.status}
                          </span>
                          
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setEditingCv(cv);
                                setCvName(cv.name);
                                setCvEmail(cv.email || "");
                                setCvPhone(cv.phone || "");
                                setShowCvModal(true);
                              }}
                              className="p-2 bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
                              title="Edit Candidate"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCv(cv.id)}
                              className="p-2 bg-rose-950/10 hover:bg-rose-955/25 border border-rose-900/40 hover:border-rose-900/80 text-rose-450 rounded-lg transition-all cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}

          {activeTab === "users" && (
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              {!isSuperuser && (
                <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-center text-xs text-zinc-400 font-semibold mb-2">
                  ℹ️ Only superusers are authorized to provision new accounts, revoke access, or modify roles.
                </div>
              )}
              {adminUsers.length === 0 ? (
                <div className="p-16 border border-dashed border-zinc-800 bg-zinc-900/40 backdrop-blur-md rounded-2xl text-center">
                  <Users className="w-8 h-8 text-zinc-650 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400 font-semibold font-mono tracking-tight animate-pulse-slow">Loading supervisory accounts list...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adminUsers.map((u) => {
                    const initials = (u.name ?? u.email ?? "?")[0].toUpperCase();
                    return (
                      <div
                        key={u.id}
                        className="border border-zinc-900 bg-zinc-950/20 hover:bg-zinc-900/30 transition-colors rounded-2xl p-6 relative flex flex-col justify-between gap-5 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-zinc-950/40 border border-zinc-900 flex items-center justify-center text-zinc-300 font-extrabold text-xs shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate text-sm leading-none">
                              {u.name || <span className="italic text-zinc-650">Unnamed Admin</span>}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{u.email}</p>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider leading-none ${
                                u.role === "superuser"
                                  ? "bg-violet-950/40 border border-violet-900/60 text-violet-400"
                                  : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                              }`}>
                                {u.role === "superuser" ? "Superuser" : "Admin"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 border-t border-zinc-900/60 pt-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          <div className="flex justify-between">
                            <span>Key Provisioned:</span>
                            <span className="text-zinc-400">{new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Last Sign-In:</span>
                            <span className="text-zinc-400">
                              {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                            </span>
                          </div>
                        </div>

                        <div className="absolute top-5 right-5 flex items-center gap-1.5">
                          {/* Toggle role button */}
                          {isSuperuser && (
                            <button
                              onClick={() => handleToggleRole(u.id, u.role)}
                              className="p-2 border border-zinc-900 hover:border-violet-900/80 bg-zinc-950/40 hover:bg-violet-955/20 text-zinc-550 hover:text-violet-450 rounded-lg cursor-pointer transition-colors"
                              title="Toggle privileges (Admin / Superuser)"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Revoke account button */}
                          {isSuperuser && (
                            <button
                              onClick={() => handleDeleteAdminUser(u.id)}
                              className="p-2 border border-zinc-900 hover:border-rose-900/80 bg-zinc-950/40 hover:bg-rose-955/20 text-zinc-550 hover:text-rose-450 rounded-lg cursor-pointer transition-colors"
                              title="Revoke access key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}
        </div>
      </div>

      {/* ── ╔══════╗ Right Slide-over profile preview drawer (Ashby Style) ╔══════╗ ── */}
      <AnimatePresence>
        {activePreviewCandidate && (
          <div className="fixed inset-0 z-[150] flex justify-end">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
              onClick={() => setActivePreviewCandidate(null)}
            />

            {/* Split screen slide drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 35 }}
              className="relative w-full max-w-4xl h-full bg-zinc-950 shadow-2xl border-l border-zinc-900 z-10 flex flex-col md:flex-row overflow-hidden"
            >
              {/* LEFT HALF: Candidate Info & Comments Timeline */}
              <div className="w-full md:w-1/2 h-[55%] md:h-full flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-900">
                <div className="flex-1 overflow-y-auto p-8 premium-scrollbar flex flex-col gap-8">
                  
                  {/* Drawer Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white font-extrabold text-sm">
                        {activePreviewCandidate.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white leading-tight">{activePreviewCandidate.name}</h2>
                        <span className="text-xs text-zinc-500 font-semibold mt-0.5 block">Candidate Overview details</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setActivePreviewCandidate(null)}
                      className="p-2.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Candidate Quick Contact Details */}
                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                    <div className="flex items-center gap-3 text-sm text-zinc-300 font-semibold">
                      <Mail className="w-4 h-4 text-zinc-555" />
                      <span>{activePreviewCandidate.email || "No email provided"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-300 font-semibold">
                      <Phone className="w-4 h-4 text-zinc-555" />
                      <span>{activePreviewCandidate.phone || "No contact phone"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-300 font-semibold">
                      <Calendar className="w-4 h-4 text-zinc-555" />
                      <span>Indexed: {new Date(activePreviewCandidate.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  </div>

                  {/* Status Picker Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Candidate Status</label>
                    <select
                      value={activePreviewCandidate.status}
                      onChange={e => handleCvStatus(activePreviewCandidate.id, e.target.value)}
                      className="w-full border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-zinc-300 bg-zinc-950 focus:outline-none focus:border-zinc-700 cursor-pointer"
                    >
                      <option value="Not Called">Not Called</option>
                      <option value="Called">Called</option>
                      <option value="Interviewing">Interviewing</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>

                  {/* Interview Scheduler Configuration */}
                  <div className="border-t border-zinc-900 pt-6 flex flex-col gap-5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span>Interview Scheduling desk</span>
                    </label>

                    {parseCvNotes(activePreviewCandidate.comments).interview && parseCvNotes(activePreviewCandidate.comments).interview?.status === "scheduled" && (
                      <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-2xl flex items-center gap-3 text-sm font-bold text-emerald-450 shadow-sm animate-pulse-slow">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Confirmed Slot: {formatDateTime(parseCvNotes(activePreviewCandidate.comments).interview?.selected_slot || "")}</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-3.5">
                      <div className="flex flex-col gap-2.5">
                        {cvProposedSlots.map((slot, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="datetime-local"
                              value={slot}
                              onChange={e => {
                                const updated = [...cvProposedSlots];
                                updated[idx] = e.target.value;
                                setCvProposedSlots(updated);
                              }}
                              className="flex-1 rounded-xl border border-zinc-800 p-3.5 text-sm text-white focus:outline-none focus:border-blue-500/80 bg-zinc-900/60"
                            />
                            <button
                              onClick={() => {
                                const updated = cvProposedSlots.filter((_, i) => i !== idx);
                                setCvProposedSlots(updated.length === 0 ? [""] : updated);
                              }}
                              className="p-3.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/50 text-rose-400 hover:text-rose-350 rounded-xl cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-3 justify-between items-center">
                        <button
                          onClick={() => setCvProposedSlots([...cvProposedSlots, ""])}
                          className="flex items-center gap-2 py-3 px-4 border border-dashed border-blue-900 hover:bg-blue-955/20 text-blue-400 font-bold text-xs rounded-xl cursor-pointer transition-all"
                        >
                          <Plus className="w-4 h-4" /> Add Slot Option
                        </button>
                        
                        <button
                          disabled={cvSavingSchedule}
                          onClick={handleSaveCvSchedule}
                          className="py-3 px-5 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm"
                        >
                          {cvSavingSchedule ? "Saving..." : "Save proposed slots"}
                        </button>
                      </div>
                    </div>

                    {parseCvNotes(activePreviewCandidate.comments).interview && (
                      <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Booking URL</span>
                          <div className="flex gap-3 mt-1.5">
                            <input
                              type="text"
                              readOnly
                              value={`${getAppBaseUrl()}/schedule/${activePreviewCandidate.id}`}
                              onClick={e => (e.target as HTMLInputElement).select()}
                              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 text-xs text-zinc-400 focus:outline-none"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${getAppBaseUrl()}/schedule/${activePreviewCandidate.id}`);
                                setCvCopied(true);
                                setTimeout(() => setCvCopied(false), 2000);
                              }}
                              className={`flex items-center gap-1.5 px-4 border rounded-xl text-sm font-bold transition-all cursor-pointer ${
                                cvCopied ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-450" : "bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 text-zinc-300"
                              }`}
                            >
                              {cvCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              <span>{cvCopied ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-3 w-full">
                          <a
                            href={getCvMailtoUrl(activePreviewCandidate.name, `${getAppBaseUrl()}/schedule/${activePreviewCandidate.id}`, activePreviewCandidate.email)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 border border-blue-900 bg-blue-950/20 hover:bg-blue-955/40 text-blue-450 hover:text-blue-400 text-sm font-bold rounded-xl text-decoration-none transition-all cursor-pointer"
                          >
                            <Mail className="w-4 h-4" /> Email Link
                          </a>
                          <button
                            onClick={handleCancelCvSchedule}
                            className="px-4 py-3 border border-zinc-805 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-rose-500 font-bold text-sm rounded-xl cursor-pointer transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Slack-style Remarks thread timeline */}
                  <div className="flex flex-col gap-4">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      <span>Recruiter Remarks feed</span>
                    </label>

                    <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1 premium-scrollbar">
                      {parseCvNotes(activePreviewCandidate.comments).comments.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No notes created. Write a comment below to index evaluation logs.</p>
                      ) : (
                        parseCvNotes(activePreviewCandidate.comments).comments.map(comment => (
                          <div key={comment.id} className="comment-bubble p-4 rounded-2xl relative flex flex-col gap-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-blue-400">{comment.author.split("@")[0]}</span>
                              <span className="text-[9px] font-bold text-zinc-500">
                                {new Date(comment.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-[12.5px] text-zinc-300 leading-relaxed pr-6">{comment.text}</p>
                            <button
                              onClick={async () => {
                                  if (confirm("Delete this remark?")) {
                                    const parsed = parseCvNotes(activePreviewCandidate.comments);
                                    const freshComments = parsed.comments.filter(c => c.id !== comment.id);
                                    const updatedNotes = JSON.stringify({ comments: freshComments, interview: parsed.interview });
                                    await handleUpdateCvComments(activePreviewCandidate.id, updatedNotes);
                                  }
                                }}
                              className="absolute top-3.5 right-3.5 text-zinc-500 hover:text-rose-500 cursor-pointer transition-colors border-none bg-none"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* Input box at bottom of Remarks panel */}
                <div className="p-5 bg-zinc-950 border-t border-zinc-900 flex gap-3">
                  <textarea
                    placeholder="Append recruiter note..."
                    value={cvCommentValues[activePreviewCandidate.id] ?? ""}
                    onChange={e => setCvCommentValues(v => ({ ...v, [activePreviewCandidate.id]: e.target.value }))}
                    rows={1}
                    className="flex-1 rounded-xl border border-zinc-800 p-3.5 text-sm text-white focus:outline-none focus:border-blue-500/80 bg-zinc-900/60 resize-none placeholder-zinc-600"
                  />
                  <button
                    disabled={!(cvCommentValues[activePreviewCandidate.id] ?? "").trim()}
                    onClick={async () => {
                      const text = (cvCommentValues[activePreviewCandidate.id] ?? "").trim();
                      if (!text) return;
                      const newComment: Comment = {
                        id: Math.random().toString(36).substring(2, 9),
                        text,
                        created_at: new Date().toISOString(),
                        author: session?.user?.email ?? "Admin",
                      };
                      const parsed = parseCvNotes(activePreviewCandidate.comments);
                      const updatedComments = [...parsed.comments, newComment];
                      const updatedNotes = JSON.stringify({ comments: updatedComments, interview: parsed.interview });
                      await handleUpdateCvComments(activePreviewCandidate.id, updatedNotes);
                      setCvCommentValues(v => ({ ...v, [activePreviewCandidate.id]: "" }));
                    }}
                    className="bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl px-5 py-3 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm self-end"
                  >
                    <Send className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {/* RIGHT HALF: Resume File Viewer Iframe Sandbox */}
              <div className="w-full md:w-1/2 h-[45%] md:h-full bg-zinc-900/80 p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-zinc-500">Document sandbox</span>
                  <a
                    href={activePreviewCandidate.cv_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-bold text-blue-400 hover:underline text-decoration-none"
                  >
                    Open Externally <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <iframe
                  src={activePreviewCandidate.cv_url}
                  className="w-full flex-1 border border-zinc-800 rounded-2xl bg-zinc-950 shadow-sm"
                  title="Document Preview"
                />
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-[32px] p-8 shadow-2xl flex flex-col gap-5 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-white">{editingJob ? "Adjust Listing Details" : "Publish New Role"}</h2>
                  <p className="text-xs text-zinc-500 font-semibold mt-0.5">Configure listings and evaluation parameters.</p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Job Title</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Senior Software Architect"
                    className="w-full border border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none placeholder-zinc-600"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Department</label>
                    <input
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      placeholder="e.g. Engineering"
                      className="w-full border border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none placeholder-zinc-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Location</label>
                    <input
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. London / Remote"
                      className="w-full border border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none placeholder-zinc-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Role Description (Markdown)</label>
                  <div className="flex gap-1 bg-zinc-905 bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl self-start">
                    {[
                      { label: "Bold", fn: insertBold },
                      { label: "Heading", fn: insertHeading },
                      { label: "Bullet", fn: insertBullet }
                    ].map(b => (
                      <button
                        key={b.label}
                        type="button"
                        onClick={b.fn}
                        className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-805 border-zinc-800 text-[10px] font-bold text-zinc-350 hover:text-white rounded-lg cursor-pointer"
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={descRef}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={5}
                    placeholder="Describe role specifications..."
                    className="w-full border border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none resize-none placeholder-zinc-600"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-900 pt-6 flex gap-3 mt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl font-bold text-xs shadow-sm cursor-pointer"
                >
                  {editingJob ? "Save Changes" : "Publish opening"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ── Independent CV upload modal ── */}
      <AnimatePresence>
        {showCvModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md" onClick={closeCvModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[32px] p-8 shadow-2xl flex flex-col gap-5"
            >
              <div>
                <h2 className="text-lg font-bold text-white">{editingCv ? "Modify Candidate Profile" : "Index Candidate Profile"}</h2>
                <p className="text-xs text-zinc-500 font-semibold mt-0.5">Load resume details directly to talent index.</p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Candidate Name *</label>
                  <input
                    value={cvName}
                    onChange={e => setCvName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full border border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none placeholder-zinc-650"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Email address</label>
                  <input
                    value={cvEmail}
                    onChange={e => setCvEmail(e.target.value)}
                    placeholder="jane@doe.com"
                    type="email"
                    className="w-full border border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none placeholder-zinc-650"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Phone contact</label>
                  <input
                    value={cvPhone}
                    onChange={e => setCvPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full border border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none placeholder-zinc-650"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Resume Document *</label>
                  <div className="relative border border-dashed border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 p-5 rounded-2xl text-center cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setCvFile(f); }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-5 h-5 text-zinc-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-zinc-300 truncate">{cvFile ? cvFile.name : "Select PDF resume file"}</p>
                    <p className="text-[9px] font-semibold text-zinc-500 mt-1">Supports PDF, DOC, DOCX up to 5 MB</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-900 pt-6 flex gap-3 mt-2">
                <button
                  onClick={closeCvModal}
                  className="flex-1 py-2.5 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={uploadingCv}
                  onClick={handleSaveCv}
                  className="flex-1 py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {uploadingCv ? "Uploading..." : "Save Profile"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Supervisor Accounts provisioning modal ── */}
      <AnimatePresence>
        {showUserModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md"
              onClick={() => { setShowUserModal(false); resetUserForm(); setCreatedUser(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[32px] p-8 shadow-2xl flex flex-col gap-6"
            >
              {createdUser ? (
                <div className="flex flex-col gap-5 text-center items-center">
                  <div className="w-12 h-12 bg-emerald-950/30 border border-emerald-900/50 rounded-full flex items-center justify-center text-emerald-400 shadow-inner">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Access Key Granted</h2>
                    <p className="text-xs text-zinc-550 text-zinc-500 font-semibold mt-1">Supervisor user account created successfully.</p>
                  </div>

                  <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-4 text-left w-full flex flex-col gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-550 text-zinc-500 uppercase tracking-widest">Name</span>
                      <p className="font-bold text-white mt-0.5">{createdUser.name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-zinc-555 text-zinc-500 uppercase tracking-widest">Email Handle</span>
                      <p className="font-bold text-white mt-0.5">{createdUser.email}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-zinc-555 text-zinc-500 uppercase tracking-widest">Privilege Role</span>
                      <p className="font-bold text-white mt-0.5 uppercase">{createdUser.role}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full mt-2">
                    <button
                      onClick={() => copyToClipboard(createdUser.email, "email")}
                      className="w-full py-2.5 border border-zinc-800 hover:bg-zinc-900 text-zinc-350 rounded-xl font-bold text-xs cursor-pointer transition-all"
                    >
                      {copiedField === "email" ? "Copied" : "Copy Email Handle"}
                    </button>
                    <div className="flex gap-2 mt-2 w-full">
                      <button
                        onClick={() => setCreatedUser(null)}
                        className="flex-1 py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl font-bold text-xs cursor-pointer shadow-sm"
                      >
                        Add Another
                      </button>
                      <button
                        onClick={() => { setShowUserModal(false); resetUserForm(); setCreatedUser(null); }}
                        className="flex-1 py-2.5 border border-zinc-805 border-zinc-800 hover:bg-zinc-900 text-zinc-400 rounded-xl font-bold text-xs cursor-pointer"
                      >
                        Close Desk
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-bold text-white">Provision Keys</h2>
                      <p className="text-xs text-zinc-500 font-semibold mt-0.5">Create new supervisor credentials.</p>
                    </div>
                    <button onClick={() => { setShowUserModal(false); resetUserForm(); }} className="p-2 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Full Name</label>
                      <input
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full border border-zinc-805 border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none placeholder-zinc-650"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Email address *</label>
                      <input
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                        placeholder="supervisor@example.com"
                        type="email"
                        className="w-full border border-zinc-805 border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none placeholder-zinc-650"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Access Key *</label>
                      <div className="relative">
                        <input
                          value={newUserPass}
                          onChange={e => setNewUserPass(e.target.value)}
                          placeholder="••••••••"
                          type={showPass ? "text" : "password"}
                          className="w-full border border-zinc-805 border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none pr-12 placeholder-zinc-650"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-500 hover:text-zinc-350 cursor-pointer"
                        >
                          {showPass ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Verify Access Key *</label>
                      <input
                        value={newUserConfirm}
                        onChange={e => setNewUserConfirm(e.target.value)}
                        placeholder="••••••••"
                        type={showPass ? "text" : "password"}
                        className="w-full border border-zinc-850 border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-white outline-none placeholder-zinc-650"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Role Privilege *</label>
                      <select
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value as any)}
                        className="w-full border border-zinc-800 focus:border-blue-500/80 transition-colors bg-zinc-900/60 rounded-xl p-3 text-xs font-semibold text-zinc-350 bg-zinc-950 rounded-xl outline-none cursor-pointer"
                      >
                        <option value="admin">Admin (Standard)</option>
                        <option value="superuser">Superuser (Full Control)</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-zinc-900 pt-6 flex gap-3 mt-2">
                    <button
                      onClick={() => { setShowUserModal(false); resetUserForm(); }}
                      className="flex-1 py-2.5 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 rounded-xl font-bold text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={savingUser || !newUserEmail.trim() || !newUserPass.trim()}
                      onClick={handleCreateAdminUser}
                      className="flex-1 py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl font-bold text-xs shadow-sm cursor-pointer disabled:opacity-60"
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

      {/* Fallback Full-Screen Resume Viewer modal */}
      <AnimatePresence>
        {cvOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={() => setCvOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-4xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-zinc-900 flex justify-between items-center bg-zinc-950">
                <h3 className="text-base font-bold text-white">Candidate CV Sandbox</h3>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedCV}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all text-decoration-none"
                  >
                    Open Externally <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => setCvOpen(false)} className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-zinc-900/60 p-4">
                <iframe src={selectedCV} className="w-full h-full border border-zinc-800 rounded-2xl bg-zinc-950" title="Resume Sandbox" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
