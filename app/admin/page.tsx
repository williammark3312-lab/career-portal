"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import {
  Plus, MapPin, Briefcase, FileText, X, ExternalLink, MoreHorizontal,
  CheckCircle2, Upload, MessageSquare, Send, Users,
  UserPlus, ArrowRight, Clock, Trash2, Edit2, Sparkles,
  Copy, Lock, Search, LogOut, Shield, ChevronRight,
  Mail, Phone, Calendar, Check, Layers, Eye, EyeOff,
  Bell, BellRing, ListTodo, CircleDot, CircleCheck, CirclePause, AlertTriangle, ChevronDown,
  UserCheck, UserMinus, DollarSign, Rocket, Laptop, Building2, FileSpreadsheet
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../src/components/Header";
import Footer from "../../src/components/Footer";
import GlassBackground from "../../src/components/GlassBackground";
import { getAppBaseUrl } from "../../src/lib/appUrl";
import { playPleasantLoginSound } from "../../src/lib/audio";
import DigitalClock from "../../src/components/DigitalClock";
import ExcelReportViewer from "../../src/components/ExcelReportViewer";

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
interface WorkTask {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "paused" | "done";
  reminder?: string;
  created_at: string;
}

interface OnboardingTask {
  id: string;
  name: string;
  role: string;
  department: string;
  joining_date: string;
  status: "offer_sent" | "doc_verification" | "it_setup" | "induction" | "completed";
  buddy_or_hr?: string;
  notes?: string;
  created_at: string;
}

interface FnFTask {
  id: string;
  name: string;
  department: string;
  last_working_day: string;
  status: "resigned" | "clearance_pending" | "assets_collected" | "fnf_calculation" | "settled";
  settlement_amount?: string;
  notes?: string;
  created_at: string;
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
  const [jobSearch, setJobSearch] = useState("");
  const [jobDeptFilter, setJobDeptFilter] = useState("All");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("All");
  const [searchFocused, setSearchFocused] = useState(false);

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
  const [activeTab, setActiveTab] = useState<"jobs" | "cvs" | "users" | "panel">("jobs");

  /* Work Panel state */
  const [panelSession, setPanelSession] = useState<"tasks" | "onboarding" | "fnf" | "reports">("tasks");
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [onboardingList, setOnboardingList] = useState<OnboardingTask[]>([]);
  const [fnfList, setFnfList] = useState<FnFTask[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelFilter, setPanelFilter] = useState<"all" | "todo" | "in-progress" | "paused" | "done">("all");
  const [onboardingFilter, setOnboardingFilter] = useState<"all" | "offer_sent" | "doc_verification" | "it_setup" | "induction" | "completed">("all");
  const [fnfFilter, setFnfFilter] = useState<"all" | "resigned" | "clearance_pending" | "assets_collected" | "fnf_calculation" | "settled">("all");
  const [taskSearch, setTaskSearch] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkTask | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [taskReminder, setTaskReminder] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [firedReminders, setFiredReminders] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /* Onboarding modal state */
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [editingOnboarding, setEditingOnboarding] = useState<OnboardingTask | null>(null);
  const [onboardName, setOnboardName] = useState("");
  const [onboardRole, setOnboardRole] = useState("");
  const [onboardDept, setOnboardDept] = useState("Engineering");
  const [onboardDate, setOnboardDate] = useState("");
  const [onboardStage, setOnboardStage] = useState<OnboardingTask["status"]>("offer_sent");
  const [onboardBuddy, setOnboardBuddy] = useState("");
  const [onboardNotes, setOnboardNotes] = useState("");
  const [savingOnboard, setSavingOnboard] = useState(false);

  /* FnF modal state */
  const [showFnFModal, setShowFnFModal] = useState(false);
  const [editingFnF, setEditingFnF] = useState<FnFTask | null>(null);
  const [fnfName, setFnfName] = useState("");
  const [fnfDept, setFnfDept] = useState("Engineering");
  const [fnfLwd, setFnfLwd] = useState("");
  const [fnfStatus, setFnfStatus] = useState<FnFTask["status"]>("resigned");
  const [fnfAmount, setFnfAmount] = useState("");
  const [fnfNotes, setFnfNotes] = useState("");
  const [savingFnF, setSavingFnF] = useState(false);

  /* Auth state */
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
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
    if (activeTab === "jobs") {
      loadJobs();
      loadStats();
    } else if (activeTab === "cvs") {
      loadCvs();
      loadStats();
    } else if (activeTab === "panel") {
      loadTasks();
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
      if (tab === "jobs" || tab === "cvs" || tab === "users" || tab === "panel") {
        setActiveTab(tab);
      } else {
        setActiveTab("jobs");
      }
    }
  }, []);

  /* Reminder checker — fires every 60 s */
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      tasks.forEach((t) => {
        if (!t.reminder || firedReminders.has(t.id) || t.status === "done") return;
        const due = new Date(t.reminder).getTime();
        if (due <= now) {
          setFiredReminders((prev) => new Set(prev).add(t.id));
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification(`⏰ Reminder: ${t.title}`, {
              body: t.description || "Task is due now!",
              icon: "/favicon.ico",
            });
          }
        }
      });
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

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

  async function loadTasks() {
    setPanelLoading(true);
    try {
      const res = await fetch("/api/work-panel");
      const json = await res.json();
      if (json.tasks) setTasks(json.tasks.map((t: any) => ({ ...t, status: (["todo", "in-progress", "paused", "done"].includes(t.status) ? t.status : "todo") as WorkTask["status"] })));
      if (json.onboarding) setOnboardingList(json.onboarding);
      if (json.fnf) setFnfList(json.fnf);
    } catch { /* silently fail */ }
    finally { setPanelLoading(false); }
  }

  async function handleAddTask() {
    if (!taskTitle.trim()) return;
    setSavingTask(true);
    try {
      const res = await fetch("/api/work-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "task", title: taskTitle, description: taskDesc, priority: taskPriority, reminder: taskReminder || undefined, status: "todo" }),
      });
      const json = await res.json();
      if (res.ok) {
        setTasks((prev) => [json, ...prev]);
        setTaskTitle(""); setTaskDesc(""); setTaskPriority("medium"); setTaskReminder("");
        setShowAddTask(false);
      }
    } finally { setSavingTask(false); }
  }

  async function handleSaveEdit() {
    if (!editingTask || !taskTitle.trim()) return;
    setSavingTask(true);
    try {
      const updates = { title: taskTitle, description: taskDesc, priority: taskPriority, reminder: taskReminder || undefined };
      const res = await fetch("/api/work-panel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTask.id, type: "task", ...updates }),
      });
      const json = await res.json();
      if (res.ok) {
        setTasks((prev) => prev.map((t) => t.id === editingTask.id ? json : t));
        setEditingTask(null); setShowAddTask(false);
        setTaskTitle(""); setTaskDesc(""); setTaskPriority("medium"); setTaskReminder("");
      }
    } finally { setSavingTask(false); }
  }

  function openAddTask() {
    setEditingTask(null);
    setTaskTitle(""); setTaskDesc(""); setTaskPriority("medium"); setTaskReminder("");
    setShowAddTask(true);
    requestNotificationPermission();
  }

  function openEditTask(task: WorkTask) {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description || "");
    setTaskPriority(task.priority);
    setTaskReminder(task.reminder
      ? new Date(task.reminder).toISOString().slice(0, 16)
      : ""
    );
    setShowAddTask(true);
  }

  async function handleTaskStatus(id: string, status: WorkTask["status"]) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    await fetch("/api/work-panel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "task", status }),
    });
  }

  async function handleDeleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/work-panel?id=${id}&type=task`, { method: "DELETE" });
  }

  /* Onboarding Handlers */
  async function handleAddOnboarding() {
    if (!onboardName.trim()) return;
    setSavingOnboard(true);
    try {
      const res = await fetch("/api/work-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "onboarding",
          name: onboardName,
          role: onboardRole,
          department: onboardDept,
          joining_date: onboardDate || new Date().toISOString().slice(0, 10),
          status: onboardStage,
          buddy_or_hr: onboardBuddy || undefined,
          notes: onboardNotes || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setOnboardingList((prev) => [json, ...prev]);
        setShowOnboardingModal(false);
      }
    } finally { setSavingOnboard(false); }
  }

  async function handleSaveEditOnboarding() {
    if (!editingOnboarding || !onboardName.trim()) return;
    setSavingOnboard(true);
    try {
      const updates = {
        name: onboardName,
        role: onboardRole,
        department: onboardDept,
        joining_date: onboardDate,
        status: onboardStage,
        buddy_or_hr: onboardBuddy || undefined,
        notes: onboardNotes || undefined,
      };
      const res = await fetch("/api/work-panel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingOnboarding.id, type: "onboarding", ...updates }),
      });
      const json = await res.json();
      if (res.ok) {
        setOnboardingList((prev) => prev.map((item) => item.id === editingOnboarding.id ? json : item));
        setEditingOnboarding(null);
        setShowOnboardingModal(false);
      }
    } finally { setSavingOnboard(false); }
  }

  async function handleOnboardingStage(id: string, status: OnboardingTask["status"]) {
    setOnboardingList((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));
    await fetch("/api/work-panel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "onboarding", status }),
    });
  }

  async function handleDeleteOnboarding(id: string) {
    setOnboardingList((prev) => prev.filter((item) => item.id !== id));
    await fetch(`/api/work-panel?id=${id}&type=onboarding`, { method: "DELETE" });
  }

  function openAddOnboarding() {
    setEditingOnboarding(null);
    setOnboardName(""); setOnboardRole(""); setOnboardDept("Engineering");
    setOnboardDate(new Date().toISOString().slice(0, 10));
    setOnboardStage("offer_sent"); setOnboardBuddy(""); setOnboardNotes("");
    setShowOnboardingModal(true);
  }

  function openEditOnboarding(record: OnboardingTask) {
    setEditingOnboarding(record);
    setOnboardName(record.name);
    setOnboardRole(record.role);
    setOnboardDept(record.department);
    setOnboardDate(record.joining_date);
    setOnboardStage(record.status);
    setOnboardBuddy(record.buddy_or_hr || "");
    setOnboardNotes(record.notes || "");
    setShowOnboardingModal(true);
  }

  /* FnF Handlers */
  async function handleAddFnF() {
    if (!fnfName.trim()) return;
    setSavingFnF(true);
    try {
      const res = await fetch("/api/work-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "fnf",
          name: fnfName,
          department: fnfDept,
          last_working_day: fnfLwd || new Date().toISOString().slice(0, 10),
          status: fnfStatus,
          settlement_amount: fnfAmount || undefined,
          notes: fnfNotes || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setFnfList((prev) => [json, ...prev]);
        setShowFnFModal(false);
      }
    } finally { setSavingFnF(false); }
  }

  async function handleSaveEditFnF() {
    if (!editingFnF || !fnfName.trim()) return;
    setSavingFnF(true);
    try {
      const updates = {
        name: fnfName,
        department: fnfDept,
        last_working_day: fnfLwd,
        status: fnfStatus,
        settlement_amount: fnfAmount || undefined,
        notes: fnfNotes || undefined,
      };
      const res = await fetch("/api/work-panel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingFnF.id, type: "fnf", ...updates }),
      });
      const json = await res.json();
      if (res.ok) {
        setFnfList((prev) => prev.map((item) => item.id === editingFnF.id ? json : item));
        setEditingFnF(null);
        setShowFnFModal(false);
      }
    } finally { setSavingFnF(false); }
  }

  async function handleFnFStatus(id: string, status: FnFTask["status"]) {
    setFnfList((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));
    await fetch("/api/work-panel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "fnf", status }),
    });
  }

  async function handleDeleteFnF(id: string) {
    setFnfList((prev) => prev.filter((item) => item.id !== id));
    await fetch(`/api/work-panel?id=${id}&type=fnf`, { method: "DELETE" });
  }

  function openAddFnF() {
    setEditingFnF(null);
    setFnfName(""); setFnfDept("Engineering");
    setFnfLwd(new Date().toISOString().slice(0, 10));
    setFnfStatus("resigned"); setFnfAmount(""); setFnfNotes("");
    setShowFnFModal(true);
  }

  function openEditFnF(record: FnFTask) {
    setEditingFnF(record);
    setFnfName(record.name);
    setFnfDept(record.department);
    setFnfLwd(record.last_working_day);
    setFnfStatus(record.status);
    setFnfAmount(record.settlement_amount || "");
    setFnfNotes(record.notes || "");
    setShowFnFModal(true);
  }

  async function requestNotificationPermission() {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
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
    setAdminUsers(prev => prev.filter(u => u.id !== id));
    try {
      const res = await fetch(`/api/create-admin?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Failed to delete user.");
        loadAdminUsers();
        return;
      }
      if (json.users) {
        setAdminUsers(json.users);
      } else {
        loadAdminUsers();
      }
    } catch {
      alert("Failed to delete user due to network error.");
      loadAdminUsers();
    }
  }

  async function handleToggleRole(userId: string, currentRole: string) {
    if (!isSuperuser) { alert("Only superusers can change roles."); return; }
    const targetRole = currentRole === "superuser" ? "admin" : "superuser";
    if (!confirm(`Are you sure you want to change this user's role to ${targetRole}?`)) return;
    setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, role: targetRole as "admin" | "superuser" } : u));
    try {
      const res = await fetch("/api/create-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: targetRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Failed to update role.");
        loadAdminUsers();
        return;
      }
      if (json.users) {
        setAdminUsers(json.users);
      } else {
        loadAdminUsers();
      }
    } catch {
      alert("Failed to update role due to network error.");
      loadAdminUsers();
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
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    } else {
      playPleasantLoginSound();
      setLoginSuccess(true);
      setAuthLoading(false);
      setTimeout(() => setLoginSuccess(false), 1500);
    }
  }
  async function handleLogout() {
    setSession(null);
    await supabase.auth.signOut();
  }

  /* ── Spinner loading state ── */
  if ((!mounted || authLoading) && !loginSuccess) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-transparent text-white relative overflow-hidden">
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
      <main className="min-h-screen flex flex-col items-center justify-center bg-transparent text-white relative overflow-hidden">
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

  /* ── Redesigned Glassmorphic Login screen matching Front Page UI/UX ── */
  if (!session) {
    return (
      <main className="relative flex flex-col min-h-screen bg-transparent text-white">
        <GlassBackground />
        <Header session={session} handleLogout={handleLogout} />

        <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12">
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.02] blur-[140px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md relative z-10"
          >
            <div className="relative rounded-[28px] bg-[rgba(15,15,17,0.92)] border border-white/10 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.8)] backdrop-blur-2xl p-8 sm:p-10 overflow-hidden flex flex-col gap-7">
              {/* Sheen sweeping light effect across card */}
              <motion.div
                animate={{ x: ["-200%", "300%"] }}
                transition={{ duration: 6, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
                className="absolute inset-0 z-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent skew-x-12 pointer-events-none"
              />

              {/* Status pill badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-zinc-400 text-xs font-semibold self-start relative z-10"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Supervisor Console
              </motion.div>

              {/* Header Title & Brand Icon */}
              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center relative overflow-hidden group shadow-lg shrink-0">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] opacity-30"
                    />
                    <div className="w-4 h-4 bg-white rounded-[4px] rotate-45 relative z-10" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                      Recruiter Desk
                    </h1>
                  </div>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Sign in to access your administrative workspace and candidate pipeline.
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="relative z-10 flex flex-col gap-5">
                {/* Email input field */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative flex items-center rounded-2xl bg-zinc-900/60 border border-white/10 focus-within:border-white/40 focus-within:ring-1 focus-within:ring-white/20 transition-all px-3.5 py-3">
                    <Mail className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      required
                      className="w-full bg-transparent text-white text-sm outline-none placeholder:text-zinc-500 font-medium"
                      placeholder="recruiter@company.com"
                    />
                  </div>
                </div>

                {/* Password input field */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative flex items-center rounded-2xl bg-zinc-900/60 border border-white/10 focus-within:border-white/40 focus-within:ring-1 focus-within:ring-white/20 transition-all px-3.5 py-3">
                    <Lock className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      required
                      className="w-full bg-transparent text-white text-sm outline-none placeholder:text-zinc-500 font-medium pr-2"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="text-zinc-400 hover:text-white transition-colors p-1 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {authError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-2xl px-4 py-3 text-center"
                  >
                    {authError}
                  </motion.div>
                )}

                {/* Submit Button matching front page CTA */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-2"
                >
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3.5 px-6 rounded-full font-bold text-xs sm:text-sm text-black bg-white hover:bg-zinc-200 active:bg-zinc-300 transition-all duration-200 cursor-pointer shadow-md disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {authLoading ? (
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Sign In to Workspace</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </motion.div>
              </form>
            </div>
          </motion.div>
        </section>

        <Footer />
      </main>
    );
  }



  if (session && !isRecruiter) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-transparent relative overflow-hidden p-4">
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
    <main className="relative flex flex-col min-h-screen bg-transparent text-white">
      <GlassBackground />
      <Header
        session={session}
        handleLogout={handleLogout}
        activeAdminTab={activeTab}
        onAdminTabChange={(t) => {
          setActiveTab(t as any);
          setActivePreviewCandidate(null);
        }}
      />

      {/* Hero section matching portal */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 pt-16 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {activeTab === "jobs"
              ? "Openings & Reviews."
              : activeTab === "cvs"
              ? "Talent index."
              : activeTab === "panel"
              ? "Work Panel."
              : "Supervisor accounts."}
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-lg">
            {activeTab === "jobs"
              ? "Publish job openings, review candidate applications per job, and manage active roles."
              : activeTab === "cvs"
              ? "Browse talent pool, evaluate submitted CVs, and manage recruitment notes."
              : activeTab === "panel"
              ? "Manage your tasks, set reminders, and track progress across your workflow."
              : "Configure administrator permissions and supervisor account credentials."}
          </p>

          {/* Minimal Info Row */}
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">
            {activeTab === "jobs" && (
              <>
                <span>ROLES: {stats.totalJobs}</span>
                <span>•</span>
                <span>APPLICATIONS: {stats.totalApps}</span>
                <span>•</span>
                <span>PENDING: {stats.pendingApps}</span>
              </>
            )}
            {activeTab === "cvs" && (
              <>
                <span>CANDIDATES: {stats.totalCVs}</span>
                <span>•</span>
                <span>INTERVIEWING: {cvs.filter((c) => c.status === "Interviewing").length}</span>
              </>
            )}
            {activeTab === "users" && (
              <>
                <span>SUPERVISORS: {adminUsers.length}</span>
                <span>•</span>
                <span>SUPERUSERS: {adminUsers.filter((u) => u.role === "superuser").length}</span>
              </>
            )}
            {activeTab === "panel" && (
              <>
                <span>TASKS: {tasks.length}</span>
                <span>•</span>
                <span>TODO: {tasks.filter((t) => t.status === "todo").length}</span>
                <span>•</span>
                <span>DONE: {tasks.filter((t) => t.status === "done").length}</span>
              </>
            )}
          </div>
        </motion.div>
      </section>

      {/* Search & Filter Bar Section */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-4"
        >
          {/* Top Control Bar: Search Input + Primary CTA */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Minimal Search Field */}
            <div
              className={`flex-1 relative flex items-center bg-zinc-950/80 rounded-xl border px-3.5 py-2.5 transition-all duration-200 ${
                searchFocused ? "border-zinc-700 bg-zinc-950" : "border-zinc-900 bg-zinc-950/50"
              }`}
            >
              <Search className={`w-4 h-4 mr-2.5 transition-colors ${searchFocused ? "text-zinc-300" : "text-zinc-600"}`} />
              <input
                type="text"
                placeholder={
                  activeTab === "jobs"
                    ? "Search job titles, departments, or locations..."
                    : activeTab === "cvs"
                    ? "Search candidate names or emails..."
                    : activeTab === "panel"
                    ? "Search tasks..."
                    : "Search supervisor accounts..."
                }
                value={activeTab === "jobs" ? jobSearch : activeTab === "cvs" ? cvSearch : activeTab === "panel" ? taskSearch : userSearch}
                onChange={(e) => {
                  if (activeTab === "jobs") setJobSearch(e.target.value);
                  else if (activeTab === "cvs") setCvSearch(e.target.value);
                  else if (activeTab === "panel") setTaskSearch(e.target.value);
                  else setUserSearch(e.target.value);
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full bg-transparent border-none outline-none text-xs text-zinc-200 placeholder-zinc-650 font-semibold"
              />
              {(activeTab === "jobs" ? jobSearch : activeTab === "cvs" ? cvSearch : activeTab === "panel" ? taskSearch : userSearch) && (
                <button
                  onClick={() => {
                    if (activeTab === "jobs") setJobSearch("");
                    else if (activeTab === "cvs") setCvSearch("");
                    else if (activeTab === "panel") setTaskSearch("");
                    else setUserSearch("");
                  }}
                  className="ml-2 p-1 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Primary Action Button */}
            {activeTab === "jobs" && (
              <button
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" /> Publish New Role
              </button>
            )}
            {activeTab === "cvs" && (
              <button
                onClick={() => setShowCvModal(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm shrink-0"
              >
                <Upload className="w-4 h-4" /> Upload CV File
              </button>
            )}
            {activeTab === "users" && isSuperuser && (
              <button
                onClick={() => setShowUserModal(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm shrink-0"
              >
                <UserPlus className="w-4 h-4" /> Provision Account
              </button>
            )}
            {activeTab === "panel" && (
              <button
                onClick={panelSession === "tasks" ? openAddTask : panelSession === "onboarding" ? openAddOnboarding : openAddFnF}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                {panelSession === "tasks" ? "Add Task" : panelSession === "onboarding" ? "Add Onboarding" : "Add FnF Record"}
              </button>
            )}
          </div>

          {/* Faint Category selector row */}
          <div className="flex items-center gap-2 flex-wrap pb-2">
            {activeTab === "panel" && (
              <div className="flex items-center gap-1.5 p-1 bg-zinc-950/80 border border-zinc-850 rounded-xl mr-2">
                <button
                  onClick={() => setPanelSession("tasks")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelSession === "tasks"
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5" /> Tasks
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 font-mono">
                    {tasks.length}
                  </span>
                </button>

                <button
                  onClick={() => setPanelSession("onboarding")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelSession === "onboarding"
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                  }`}
                >
                  <Rocket className="w-3.5 h-3.5 text-indigo-400" /> Onboarding
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 font-mono">
                    {onboardingList.length}
                  </span>
                </button>

                <button
                  onClick={() => setPanelSession("fnf")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelSession === "fnf"
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                  }`}
                >
                  <UserMinus className="w-3.5 h-3.5 text-amber-400" /> FnF Settlement
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 font-mono">
                    {fnfList.length}
                  </span>
                </button>

                <button
                  onClick={() => setPanelSession("reports")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    panelSession === "reports"
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Excel & Reports
                </button>
              </div>
            )}
            {activeTab === "jobs" &&
              ["All", ...Array.from(new Set(jobs.map((j) => j.department).filter(Boolean)))].map((dept) => {
                const isActive = jobDeptFilter === dept;
                return (
                  <button
                    key={dept}
                    onClick={() => setJobDeptFilter(dept)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-black border-transparent"
                        : "bg-zinc-950/50 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}

            {activeTab === "cvs" &&
              ["All", "Not Called", "Called", "Interviewing", "Rejected"].map((status) => {
                const isActive = cvFilter === status;
                return (
                  <button
                    key={status}
                    onClick={() => setCvFilter(status)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-black border-transparent"
                        : "bg-zinc-950/50 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    {status}
                  </button>
                );
              })}

            {activeTab === "users" &&
              ["All", "Superuser", "Admin"].map((role) => {
                const isActive = userRoleFilter === role;
                return (
                  <button
                    key={role}
                    onClick={() => setUserRoleFilter(role)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-black border-transparent"
                        : "bg-zinc-950/50 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    {role}
                  </button>
                );
              })}

            {activeTab === "panel" && panelSession === "tasks" &&
              (["all", "todo", "in-progress", "paused", "done"] as const).map((f) => {
                const isActive = panelFilter === f;
                const labels: Record<string, string> = { all: "All", todo: "To Do", "in-progress": "In Progress", paused: "Paused", done: "Done" };
                return (
                  <button
                    key={f}
                    onClick={() => setPanelFilter(f)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-black border-transparent"
                        : "bg-zinc-950/50 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    {labels[f]}
                  </button>
                );
              })}

            {activeTab === "panel" && panelSession === "onboarding" &&
              (["all", "offer_sent", "doc_verification", "it_setup", "induction", "completed"] as const).map((f) => {
                const isActive = onboardingFilter === f;
                const labels: Record<string, string> = {
                  all: "All",
                  offer_sent: "Offer Sent",
                  doc_verification: "Doc Verification",
                  it_setup: "IT Setup",
                  induction: "Induction",
                  completed: "Onboarded",
                };
                return (
                  <button
                    key={f}
                    onClick={() => setOnboardingFilter(f)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-black border-transparent"
                        : "bg-zinc-950/50 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    {labels[f]}
                  </button>
                );
              })}

            {activeTab === "panel" && panelSession === "fnf" &&
              (["all", "resigned", "clearance_pending", "assets_collected", "fnf_calculation", "settled"] as const).map((f) => {
                const isActive = fnfFilter === f;
                const labels: Record<string, string> = {
                  all: "All",
                  resigned: "Resigned",
                  clearance_pending: "Clearance Pending",
                  assets_collected: "Assets Collected",
                  fnf_calculation: "FnF Calculation",
                  settled: "Settled",
                };
                return (
                  <button
                    key={f}
                    onClick={() => setFnfFilter(f)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-black border-transparent"
                        : "bg-zinc-950/50 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    {labels[f]}
                  </button>
                );
              })}
          </div>
        </motion.div>
      </section>

      {/* Main Content Section */}
      <section className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 pb-24">

        {/* Job Openings Tab */}
        {activeTab === "jobs" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {jobs.filter((j) => {
              const matchesDept = jobDeptFilter === "All" || j.department === jobDeptFilter;
              const matchesSearch =
                !jobSearch.trim() ||
                j.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
                j.department.toLowerCase().includes(jobSearch.toLowerCase()) ||
                j.location.toLowerCase().includes(jobSearch.toLowerCase());
              return matchesDept && matchesSearch;
            }).length === 0 ? (
              <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
                <Briefcase className="w-8 h-8 text-zinc-600 mb-1" />
                <p className="text-zinc-400 text-xs font-semibold">
                  {jobs.length === 0 ? "No active job openings published." : "No job roles match your search or department filter."}
                </p>
                {jobs.length === 0 && (
                  <button
                    onClick={openCreate}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Publish First Opening
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {jobs
                  .filter((j) => {
                    const matchesDept = jobDeptFilter === "All" || j.department === jobDeptFilter;
                    const matchesSearch =
                      !jobSearch.trim() ||
                      j.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
                      j.department.toLowerCase().includes(jobSearch.toLowerCase()) ||
                      j.location.toLowerCase().includes(jobSearch.toLowerCase());
                    return matchesDept && matchesSearch;
                  })
                  .map((job) => {
                    return (
                      <div
                        key={job.id}
                        className="group relative border border-zinc-900 bg-zinc-950/30 hover:bg-zinc-900/40 rounded-2xl p-6 transition-all duration-300 flex flex-col sm:flex-row justify-between sm:items-center gap-4"
                      >
                        <div className="flex flex-col gap-2.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white/10 text-white/90 border border-white/10">
                              {job.department}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {job.location}
                            </span>
                          </div>
                          <h2
                            onClick={() => router.push(`/admin/jobs/${job.id}`)}
                            className="text-base sm:text-lg font-bold text-white group-hover:text-zinc-200 transition-colors cursor-pointer truncate"
                          >
                            {job.title}
                          </h2>
                          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                            {job.description.replace(/[*#]/g, "").slice(0, 160)}...
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-900">
                          <button
                            onClick={() => router.push(`/admin/jobs/${job.id}`)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer"
                          >
                            Screen Applications <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => openEdit(job)}
                            className="p-2 bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer"
                            title="Edit Listing"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(job.id)}
                            className="p-2 bg-rose-955/10 hover:bg-rose-955/25 border border-rose-900/40 hover:border-rose-900/80 text-rose-450 rounded-xl transition-all cursor-pointer"
                            title="Delete Opening"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </motion.div>
        )}

        {/* Talent Index Tab */}
        {activeTab === "cvs" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {cvs.filter((c) => {
              const matchesFilter = cvFilter === "All" || c.status === cvFilter;
              const matchesSearch =
                !cvSearch.trim() ||
                c.name.toLowerCase().includes(cvSearch.toLowerCase()) ||
                (c.email && c.email.toLowerCase().includes(cvSearch.toLowerCase()));
              return matchesFilter && matchesSearch;
            }).length === 0 ? (
              <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-12 text-center">
                <p className="text-zinc-500 text-xs font-semibold">
                  {cvs.length === 0 ? "No candidate profile files indexed." : "No candidates match your search or filter."}
                </p>
              </div>
            ) : (
              <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden">
                {cvs
                  .filter((c) => {
                    const matchesFilter = cvFilter === "All" || c.status === cvFilter;
                    const matchesSearch =
                      !cvSearch.trim() ||
                      c.name.toLowerCase().includes(cvSearch.toLowerCase()) ||
                      (c.email && c.email.toLowerCase().includes(cvSearch.toLowerCase()));
                    return matchesFilter && matchesSearch;
                  })
                  .map((cv) => {
                    const statusStyle = getStatusStyle(cv.status);
                    const initials = cv.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

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

                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                              className="p-2 bg-rose-955/10 hover:bg-rose-955/25 border border-rose-900/40 hover:border-rose-900/80 text-rose-450 rounded-lg transition-all cursor-pointer"
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
          </motion.div>
        )}

        {/* Supervisors Tab */}
        {activeTab === "users" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!isSuperuser && (
              <div className="p-4 border border-zinc-900 bg-zinc-950/20 rounded-2xl text-center text-xs text-zinc-500 font-semibold mb-4">
                Only superusers are authorized to provision new accounts, revoke access, or modify roles.
              </div>
            )}
            {adminUsers.filter((u) => {
              const matchesSearch =
                !userSearch.trim() ||
                (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) ||
                (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()));
              const matchesRole =
                userRoleFilter === "All" ||
                (userRoleFilter === "Superuser" ? u.role === "superuser" : u.role !== "superuser");
              return matchesSearch && matchesRole;
            }).length === 0 ? (
              <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-12 text-center">
                <p className="text-zinc-500 text-xs font-semibold">
                  {adminUsers.length === 0 ? "Loading supervisory accounts list..." : "No supervisor accounts match your search query."}
                </p>
              </div>
            ) : (
              <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden">
                {adminUsers
                  .filter((u) => {
                    const matchesSearch =
                      !userSearch.trim() ||
                      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) ||
                      (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()));
                    const matchesRole =
                      userRoleFilter === "All" ||
                      (userRoleFilter === "Superuser" ? u.role === "superuser" : u.role !== "superuser");
                    return matchesSearch && matchesRole;
                  })
                  .map((u) => {
                    const initials = (u.name ?? u.email ?? "?")[0].toUpperCase();
                    return (
                      <div
                        key={u.id}
                        className="w-full flex justify-between items-center py-5 px-6 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/30 transition-colors group"
                      >
                        <div className="flex items-center gap-4 min-w-0 pr-4">
                          <div className="w-9 h-9 rounded-xl bg-zinc-950/40 border border-zinc-900 flex items-center justify-center text-zinc-300 font-extrabold text-[11px] shrink-0">
                            {initials}
                          </div>
                          <div className="flex flex-col gap-1 min-w-0">
                            <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-zinc-300 transition-colors truncate">
                              {u.name || "Unnamed Admin"}
                            </h2>
                            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                              <span>{u.email}</span>
                              <span>•</span>
                              <span>Created {new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-[10px] font-semibold px-3 py-1 rounded-md border ${
                              u.role === "superuser"
                                ? "bg-violet-955/20 border-violet-900/60 text-violet-400"
                                : "bg-zinc-950/40 border-zinc-900 text-zinc-400"
                            }`}
                          >
                            {u.role === "superuser" ? "Superuser" : "Admin"}
                          </span>

                          {isSuperuser && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleToggleRole(u.id, u.role)}
                                className="p-2 bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="Toggle privileges"
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAdminUser(u.id)}
                                className="p-2 bg-rose-955/10 hover:bg-rose-955/25 border border-rose-900/40 hover:border-rose-900/80 text-rose-450 rounded-lg transition-all cursor-pointer"
                                title="Revoke access key"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </motion.div>
        )}

        {/* Work Panel Tab */}
        {activeTab === "panel" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {panelLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                <p className="text-xs text-zinc-500 font-semibold">Loading work panel...</p>
              </div>
            ) : panelSession === "reports" ? (
              <ExcelReportViewer
                tasks={tasks}
                onboardingList={onboardingList}
                fnfList={fnfList}
                jobs={jobs}
                cvs={cvs}
              />
            ) : panelSession === "tasks" ? (() => {
              const filteredTasks = tasks
                .filter((t) => {
                  const matchesFilter = panelFilter === "all" ? true : t.status === panelFilter;
                  const matchesSearch = !taskSearch.trim() ||
                    t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
                    (t.description && t.description.toLowerCase().includes(taskSearch.toLowerCase()));
                  return matchesFilter && matchesSearch;
                })
                .sort((a, b) => {
                  // Completed tasks go down to the bottom
                  if (a.status === "done" && b.status !== "done") return 1;
                  if (a.status !== "done" && b.status === "done") return -1;
                  return 0;
                });

              const priorityConfig = {
                high:   { label: "High",   color: "text-rose-400",    bg: "bg-rose-950/30",    border: "border-rose-900/50",   dot: "bg-rose-500"    },
                medium: { label: "Medium", color: "text-amber-400",   bg: "bg-amber-950/30",   border: "border-amber-900/50",  dot: "bg-amber-500"   },
                low:    { label: "Low",    color: "text-emerald-400", bg: "bg-emerald-950/30", border: "border-emerald-900/50", dot: "bg-emerald-500" },
              };

              const statusConfig: Record<WorkTask["status"], { label: string; icon: React.ReactNode; color: string; ring: string }> = {
                "todo":        { label: "To Do",       icon: <ListTodo className="w-3.5 h-3.5" />,     color: "text-zinc-400",    ring: "border-zinc-700"    },
                "in-progress": { label: "In Progress", icon: <CircleDot className="w-3.5 h-3.5" />,    color: "text-blue-400",    ring: "border-blue-700"    },
                "paused":      { label: "Paused",      icon: <CirclePause className="w-3.5 h-3.5" />,  color: "text-amber-400",   ring: "border-amber-700"   },
                "done":        { label: "Done",        icon: <CircleCheck className="w-3.5 h-3.5" />,  color: "text-emerald-400", ring: "border-emerald-700" },
              };

              function getReminderState(reminder?: string, status?: string) {
                if (!reminder || status === "done") return null;
                const diff = new Date(reminder).getTime() - Date.now();
                const hours = diff / 3_600_000;
                if (diff < 0)   return { label: "Overdue",  urgent: true,  cls: "bg-rose-950/60 border-rose-700 text-rose-300" };
                if (hours < 1)  return { label: "Due in <1h",urgent: true, cls: "bg-amber-950/60 border-amber-700 text-amber-300" };
                if (hours < 24) return { label: `Due in ${Math.round(hours)}h`, urgent: false, cls: "bg-blue-950/50 border-blue-800 text-blue-300" };
                return {
                  label: new Date(reminder).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
                  urgent: false,
                  cls: "bg-zinc-900 border-zinc-700 text-zinc-400"
                };
              }

              if (filteredTasks.length === 0) {
                return (
                  <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-16 text-center flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center">
                      <ListTodo className="w-6 h-6 text-zinc-600" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-white text-sm font-bold">
                        {tasks.length === 0 ? "Your task panel is empty" : "No tasks match this filter"}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        {tasks.length === 0 ? "Add your first task to start tracking your work." : "Try selecting a different status filter."}
                      </p>
                    </div>
                    {tasks.length === 0 && (
                      <button
                        onClick={openAddTask}
                        className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add First Task
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="flex flex-col divide-y divide-zinc-900 border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950/30">
                  {filteredTasks.map((task, index) => {
                    const pri    = priorityConfig[task.priority];
                    const st     = statusConfig[task.status];
                    const chip   = getReminderState(task.reminder, task.status);
                    const isDone   = task.status === "done";
                    const isPaused = task.status === "paused";
                    const menuOpen = openMenuId === task.id;

                    const menuActions: { label: string; icon: React.ReactNode; onClick: () => void; cls: string }[] = [
                      task.status === "todo"
                        ? { label: "Start",    icon: <CircleDot className="w-3.5 h-3.5" />,    onClick: () => handleTaskStatus(task.id, "in-progress"), cls: "text-blue-400" }
                        : task.status === "in-progress"
                        ? { label: "Pause",    icon: <CirclePause className="w-3.5 h-3.5" />,  onClick: () => handleTaskStatus(task.id, "paused"),      cls: "text-amber-400" }
                        : task.status === "paused"
                        ? { label: "Resume",   icon: <CircleDot className="w-3.5 h-3.5" />,    onClick: () => handleTaskStatus(task.id, "in-progress"), cls: "text-blue-400" }
                        : { label: "Reopen",   icon: <ListTodo className="w-3.5 h-3.5" />,     onClick: () => handleTaskStatus(task.id, "todo"),        cls: "text-zinc-400" },
                      ...(task.status === "in-progress" || task.status === "paused"
                        ? [{ label: "Complete", icon: <CircleCheck className="w-3.5 h-3.5" />, onClick: () => handleTaskStatus(task.id, "done"),        cls: "text-emerald-400" }]
                        : []),
                      { label: "Edit",    icon: <Edit2 className="w-3.5 h-3.5" />,   onClick: () => { openEditTask(task); setOpenMenuId(null); }, cls: "text-zinc-300" },
                      { label: "Delete",  icon: <Trash2 className="w-3.5 h-3.5" />,  onClick: () => { handleDeleteTask(task.id); setOpenMenuId(null); }, cls: "text-rose-400" },
                    ];

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className={`group relative flex items-center gap-3 px-4 py-2.5 transition-all duration-150 ${
                          isDone ? "opacity-50 hover:opacity-70" : isPaused ? "bg-amber-950/5 hover:bg-amber-950/10" : "hover:bg-zinc-900/60"
                        }`}
                      >
                        {/* Priority dot */}
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pri.dot} ${isDone ? "opacity-30" : ""}`} />

                        {/* Status icon */}
                        <span className={`shrink-0 ${st.color}`}>{st.icon}</span>

                        {/* Title */}
                        <span className={`text-xs font-semibold truncate flex-1 min-w-0 ${
                          isDone ? "line-through text-zinc-500" : isPaused ? "text-amber-200/80" : "text-white"
                        }`}>
                          {task.title}
                        </span>

                        {/* Description */}
                        {task.description && (
                          <span className="hidden md:block text-[11px] text-zinc-600 truncate max-w-[180px] shrink-0">
                            {task.description}
                          </span>
                        )}

                        {/* Priority + reminder chips + interactive status selector */}
                        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${pri.bg} ${pri.border} ${pri.color}`}>
                            {pri.label}
                          </span>
                          {chip && (
                            <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${chip.cls}`}>
                              {chip.urgent ? <BellRing className="w-2.5 h-2.5" /> : <Bell className="w-2.5 h-2.5" />}
                              {chip.label}
                            </span>
                          )}
                          <div className="relative shrink-0">
                            <select
                              value={task.status}
                              onChange={(e) => handleTaskStatus(task.id, e.target.value as WorkTask["status"])}
                              className={`text-[9px] font-bold px-2 py-0.5 rounded border appearance-none pr-4 cursor-pointer outline-none transition-all bg-zinc-900 border-zinc-800 ${st.color} hover:border-zinc-700`}
                            >
                              <option value="todo" className="bg-zinc-950 text-zinc-400">To Do</option>
                              <option value="in-progress" className="bg-zinc-950 text-blue-400">In Progress</option>
                              <option value="paused" className="bg-zinc-950 text-amber-400">Paused</option>
                              <option value="done" className="bg-zinc-950 text-emerald-400">Done</option>
                            </select>
                            <ChevronDown className={`w-2 h-2 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none ${st.color} opacity-60`} />
                          </div>
                        </div>

                        {/* Single ⋯ menu button */}
                        <div className="relative shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : task.id); }}
                            className="p-1.5 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-900 text-zinc-600 hover:text-zinc-300 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Actions"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {/* Dropdown */}
                          {menuOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1">
                                {menuActions.map((action) => (
                                  <button
                                    key={action.label}
                                    onClick={(e) => { e.stopPropagation(); action.onClick(); setOpenMenuId(null); }}
                                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold hover:bg-zinc-900 transition-colors cursor-pointer text-left ${action.cls}`}
                                  >
                                    {action.icon}
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })() : panelSession === "onboarding" ? (() => {
              const stageConfig: Record<OnboardingTask["status"], { label: string; color: string; bg: string; border: string }> = {
                offer_sent:        { label: "Offer Sent",        color: "text-blue-400",    bg: "bg-blue-950/40",    border: "border-blue-900/60" },
                doc_verification:  { label: "Doc Verification",  color: "text-amber-400",   bg: "bg-amber-950/40",   border: "border-amber-900/60" },
                it_setup:          { label: "IT Setup",          color: "text-purple-400",  bg: "bg-purple-950/40",  border: "border-purple-900/60" },
                induction:         { label: "Induction",         color: "text-cyan-400",    bg: "bg-cyan-950/40",    border: "border-cyan-900/60" },
                completed:         { label: "Onboarded",         color: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-900/60" },
              };

              const filteredOnboarding = onboardingList
                .filter((item) => {
                  const matchesFilter = onboardingFilter === "all" ? true : item.status === onboardingFilter;
                  const matchesSearch = !taskSearch.trim() ||
                    item.name.toLowerCase().includes(taskSearch.toLowerCase()) ||
                    item.role.toLowerCase().includes(taskSearch.toLowerCase()) ||
                    item.department.toLowerCase().includes(taskSearch.toLowerCase());
                  return matchesFilter && matchesSearch;
                })
                .sort((a, b) => {
                  if (a.status === "completed" && b.status !== "completed") return 1;
                  if (a.status !== "completed" && b.status === "completed") return -1;
                  return new Date(a.joining_date).getTime() - new Date(b.joining_date).getTime();
                });

              if (filteredOnboarding.length === 0) {
                return (
                  <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-16 text-center flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center">
                      <Rocket className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-white text-sm font-bold">
                        {onboardingList.length === 0 ? "No active onboarding records" : "No candidates match this filter"}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        {onboardingList.length === 0 ? "Track candidate join dates, doc verification, and induction here." : "Try selecting a different filter."}
                      </p>
                    </div>
                    {onboardingList.length === 0 && (
                      <button
                        onClick={openAddOnboarding}
                        className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add First Onboarding
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="flex flex-col divide-y divide-zinc-900 border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950/30">
                  {filteredOnboarding.map((item, index) => {
                    const st = stageConfig[item.status] || stageConfig.offer_sent;
                    const isDone = item.status === "completed";
                    const menuOpen = openMenuId === item.id;

                    const stagesList: OnboardingTask["status"][] = ["offer_sent", "doc_verification", "it_setup", "induction", "completed"];
                    const currentStageIdx = stagesList.indexOf(item.status);
                    const nextStage = currentStageIdx < stagesList.length - 1 ? stagesList[currentStageIdx + 1] : null;

                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className={`group relative flex items-center gap-3 px-4 py-2.5 transition-all duration-150 ${
                          isDone ? "opacity-60 hover:opacity-80" : "hover:bg-zinc-900/60"
                        }`}
                      >
                        {/* Avatar initials */}
                        <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-extrabold text-white shrink-0">
                          {item.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>

                        {/* Name + Role */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className={`text-xs font-semibold truncate ${isDone ? "text-zinc-400" : "text-white"}`}>
                            {item.name}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium truncate hidden sm:inline">
                            · {item.role} ({item.department})
                          </span>
                        </div>

                        {/* Joining date */}
                        <div className="hidden md:flex items-center gap-1 text-[11px] text-zinc-500 shrink-0">
                          <Calendar className="w-3 h-3 text-zinc-600" />
                          <span>Joins {new Date(item.joining_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                        </div>

                        {/* Buddy/HR */}
                        {item.buddy_or_hr && (
                          <span className="hidden lg:inline text-[10px] text-zinc-500 bg-zinc-900/70 border border-zinc-800/80 px-2 py-0.5 rounded-md truncate max-w-[130px]">
                            HR: {item.buddy_or_hr}
                          </span>
                        )}

                        {/* Interactive Stage Selector Badge */}
                        <div className="relative shrink-0">
                          <select
                            value={item.status}
                            onChange={(e) => handleOnboardingStage(item.id, e.target.value as OnboardingTask["status"])}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-md border appearance-none pr-5 cursor-pointer outline-none transition-all ${st.bg} ${st.border} ${st.color} hover:brightness-125 focus:ring-1 focus:ring-indigo-500`}
                            title="Click to change candidate stage"
                          >
                            <option value="offer_sent" className="bg-zinc-950 text-blue-400">Offer Sent</option>
                            <option value="doc_verification" className="bg-zinc-950 text-amber-400">Doc Verification</option>
                            <option value="it_setup" className="bg-zinc-950 text-purple-400">IT Setup</option>
                            <option value="induction" className="bg-zinc-950 text-cyan-400">Induction</option>
                            <option value="completed" className="bg-zinc-950 text-emerald-400">Onboarded</option>
                          </select>
                          <ChevronDown className={`w-2.5 h-2.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${st.color} opacity-70`} />
                        </div>

                        {/* Single ⋯ Menu */}
                        <div className="relative shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : item.id); }}
                            className="p-1.5 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-900 text-zinc-600 hover:text-zinc-300 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Actions"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {menuOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1">
                                {nextStage && (
                                  <button
                                    onClick={() => { handleOnboardingStage(item.id, nextStage); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-400 hover:bg-zinc-900 transition-colors text-left cursor-pointer"
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                    Move to {stageConfig[nextStage].label}
                                  </button>
                                )}
                                {item.status !== "completed" && (
                                  <button
                                    onClick={() => { handleOnboardingStage(item.id, "completed"); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-zinc-900 transition-colors text-left cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Onboarded
                                  </button>
                                )}
                                <button
                                  onClick={() => { openEditOnboarding(item); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors text-left cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" /> Edit Record
                                </button>
                                <button
                                  onClick={() => { handleDeleteOnboarding(item.id); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-zinc-900 transition-colors text-left cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })() : (() => {
              /* FnF Session */
              const fnfStatusConfig: Record<FnFTask["status"], { label: string; color: string; bg: string; border: string }> = {
                resigned:           { label: "Resigned",            color: "text-zinc-400",    bg: "bg-zinc-900",       border: "border-zinc-800" },
                clearance_pending:  { label: "Clearance Pending",   color: "text-amber-400",   bg: "bg-amber-950/40",   border: "border-amber-900/60" },
                assets_collected:   { label: "Assets Collected",    color: "text-purple-400",  bg: "bg-purple-950/40",  border: "border-purple-900/60" },
                fnf_calculation:    { label: "FnF Calculation",     color: "text-blue-400",    bg: "bg-blue-950/40",    border: "border-blue-900/60" },
                settled:            { label: "Settled & Closed",    color: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-900/60" },
              };

              const filteredFnf = fnfList
                .filter((item) => {
                  const matchesFilter = fnfFilter === "all" ? true : item.status === fnfFilter;
                  const matchesSearch = !taskSearch.trim() ||
                    item.name.toLowerCase().includes(taskSearch.toLowerCase()) ||
                    item.department.toLowerCase().includes(taskSearch.toLowerCase()) ||
                    (item.notes && item.notes.toLowerCase().includes(taskSearch.toLowerCase()));
                  return matchesFilter && matchesSearch;
                })
                .sort((a, b) => {
                  if (a.status === "settled" && b.status !== "settled") return 1;
                  if (a.status !== "settled" && b.status === "settled") return -1;
                  return new Date(a.last_working_day).getTime() - new Date(b.last_working_day).getTime();
                });

              if (filteredFnf.length === 0) {
                return (
                  <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl p-16 text-center flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center">
                      <UserMinus className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-white text-sm font-bold">
                        {fnfList.length === 0 ? "No active FnF records" : "No records match this filter"}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        {fnfList.length === 0 ? "Track employee exit clearance, asset recovery, and FnF payouts here." : "Try selecting a different filter."}
                      </p>
                    </div>
                    {fnfList.length === 0 && (
                      <button
                        onClick={openAddFnF}
                        className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add First FnF Record
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="flex flex-col divide-y divide-zinc-900 border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950/30">
                  {filteredFnf.map((item, index) => {
                    const st = fnfStatusConfig[item.status] || fnfStatusConfig.resigned;
                    const isDone = item.status === "settled";
                    const menuOpen = openMenuId === item.id;

                    const statusSequence: FnFTask["status"][] = ["resigned", "clearance_pending", "assets_collected", "fnf_calculation", "settled"];
                    const currentIdx = statusSequence.indexOf(item.status);
                    const nextStatus = currentIdx < statusSequence.length - 1 ? statusSequence[currentIdx + 1] : null;

                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className={`group relative flex items-center gap-3 px-4 py-2.5 transition-all duration-150 ${
                          isDone ? "opacity-60 hover:opacity-80" : "hover:bg-zinc-900/60"
                        }`}
                      >
                        {/* Avatar initials */}
                        <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-extrabold text-amber-300 shrink-0">
                          {item.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>

                        {/* Name + Dept */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className={`text-xs font-semibold truncate ${isDone ? "text-zinc-400" : "text-white"}`}>
                            {item.name}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium truncate hidden sm:inline">
                            · {item.department}
                          </span>
                        </div>

                        {/* Last working day */}
                        <div className="hidden md:flex items-center gap-1 text-[11px] text-zinc-500 shrink-0">
                          <Calendar className="w-3 h-3 text-zinc-600" />
                          <span>LWD: {new Date(item.last_working_day).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                        </div>

                        {/* Settlement note/amount */}
                        {item.settlement_amount && (
                          <span className="hidden lg:inline text-[10px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-md truncate max-w-[130px]">
                            {item.settlement_amount}
                          </span>
                        )}

                        {/* Interactive Status Selector Badge */}
                        <div className="relative shrink-0">
                          <select
                            value={item.status}
                            onChange={(e) => handleFnFStatus(item.id, e.target.value as FnFTask["status"])}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-md border appearance-none pr-5 cursor-pointer outline-none transition-all ${st.bg} ${st.border} ${st.color} hover:brightness-125 focus:ring-1 focus:ring-amber-500`}
                            title="Click to change FnF clearance status"
                          >
                            <option value="resigned" className="bg-zinc-950 text-zinc-300">Resigned</option>
                            <option value="clearance_pending" className="bg-zinc-950 text-amber-400">Clearance Pending</option>
                            <option value="assets_collected" className="bg-zinc-950 text-purple-400">Assets Collected</option>
                            <option value="fnf_calculation" className="bg-zinc-950 text-blue-400">FnF Calculation</option>
                            <option value="settled" className="bg-zinc-950 text-emerald-400">Settled</option>
                          </select>
                          <ChevronDown className={`w-2.5 h-2.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${st.color} opacity-70`} />
                        </div>

                        {/* Single ⋯ Menu */}
                        <div className="relative shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : item.id); }}
                            className="p-1.5 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-900 text-zinc-600 hover:text-zinc-300 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Actions"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {menuOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1">
                                {nextStatus && (
                                  <button
                                    onClick={() => { handleFnFStatus(item.id, nextStatus); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-400 hover:bg-zinc-900 transition-colors text-left cursor-pointer"
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                    Move to {fnfStatusConfig[nextStatus].label}
                                  </button>
                                )}
                                {item.status !== "settled" && (
                                  <button
                                    onClick={() => { handleFnFStatus(item.id, "settled"); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-zinc-900 transition-colors text-left cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Settled & Closed
                                  </button>
                                )}
                                <button
                                  onClick={() => { openEditFnF(item); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors text-left cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" /> Edit Record
                                </button>
                                <button
                                  onClick={() => { handleDeleteFnF(item.id); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-zinc-900 transition-colors text-left cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()}
          </motion.div>
        )}

      </section>
      <Footer />


      {/* ─── Add / Edit Task Modal ─── */}
      <AnimatePresence>
        {showAddTask && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
              onClick={() => { setShowAddTask(false); setEditingTask(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-[28px] p-7 shadow-2xl flex flex-col gap-5 z-10 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-lg font-bold text-white">
                    {editingTask ? "Edit Task" : "New Task"}
                  </h2>
                  <p className="text-xs text-zinc-500 font-semibold">
                    {editingTask ? "Update the task details below." : "Add a task to your work panel."}
                  </p>
                </div>
                <button
                  onClick={() => { setShowAddTask(false); setEditingTask(null); }}
                  className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Task Title *</label>
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { editingTask ? handleSaveEdit() : handleAddTask(); } }}
                    placeholder="e.g. Review Q3 candidate shortlist"
                    className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Description</label>
                  <textarea
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    placeholder="Add details, context, or notes for this task..."
                    rows={3}
                    className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600 resize-none leading-relaxed"
                  />
                </div>

                {/* Priority */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Priority</label>
                  <div className="flex gap-2">
                    {(["low", "medium", "high"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setTaskPriority(p)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border capitalize transition-all cursor-pointer ${
                          taskPriority === p
                            ? p === "high"   ? "bg-rose-950/70 border-rose-700 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.15)]"
                              : p === "medium" ? "bg-amber-950/70 border-amber-700 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                              : "bg-emerald-950/70 border-emerald-700 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                            : "bg-zinc-900/40 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reminder */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5" /> Reminder
                    <span className="text-zinc-700 font-normal normal-case tracking-normal">— optional</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={taskReminder}
                    onChange={(e) => setTaskReminder(e.target.value)}
                    className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-zinc-300 outline-none [color-scheme:dark]"
                  />
                  {taskReminder && (
                    <p className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      Browser notification will fire at this time.
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAddTask(false); setEditingTask(null); }}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-900 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={editingTask ? handleSaveEdit : handleAddTask}
                  disabled={savingTask || !taskTitle.trim()}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {savingTask
                    ? <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    : editingTask
                    ? <><Check className="w-3.5 h-3.5" /> Save Changes</>
                    : <><Plus className="w-3.5 h-3.5" /> Add Task</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Add / Edit Onboarding Modal ─── */}
      <AnimatePresence>
        {showOnboardingModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
              onClick={() => { setShowOnboardingModal(false); setEditingOnboarding(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-[28px] p-7 shadow-2xl flex flex-col gap-5 z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-indigo-400" />
                    {editingOnboarding ? "Edit Onboarding Candidate" : "New Onboarding Candidate"}
                  </h2>
                  <p className="text-xs text-zinc-500 font-semibold">
                    {editingOnboarding ? "Update candidate onboarding tracking details." : "Track a new hire through offer, doc verification, IT & induction."}
                  </p>
                </div>
                <button
                  onClick={() => { setShowOnboardingModal(false); setEditingOnboarding(null); }}
                  className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Candidate Name *</label>
                  <input
                    value={onboardName}
                    onChange={(e) => setOnboardName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Designation / Role</label>
                    <input
                      value={onboardRole}
                      onChange={(e) => setOnboardRole(e.target.value)}
                      placeholder="e.g. Senior Frontend Engineer"
                      className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Department</label>
                    <input
                      value={onboardDept}
                      onChange={(e) => setOnboardDept(e.target.value)}
                      placeholder="e.g. Engineering"
                      className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Joining Date</label>
                    <input
                      type="date"
                      value={onboardDate}
                      onChange={(e) => setOnboardDate(e.target.value)}
                      className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-zinc-300 outline-none [color-scheme:dark]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Assigned HR / Buddy</label>
                    <input
                      value={onboardBuddy}
                      onChange={(e) => setOnboardBuddy(e.target.value)}
                      placeholder="e.g. Priya M."
                      className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Current Stage</label>
                  <select
                    value={onboardStage}
                    onChange={(e) => setOnboardStage(e.target.value as OnboardingTask["status"])}
                    className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900 rounded-xl p-3 text-sm font-medium text-white outline-none"
                  >
                    <option value="offer_sent">📩 Offer Sent</option>
                    <option value="doc_verification">📑 Document Verification</option>
                    <option value="it_setup">💻 IT & Laptop Setup</option>
                    <option value="induction">🎓 Induction & Training</option>
                    <option value="completed">✅ Onboarded & Active</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Notes / Checklist Details</label>
                  <textarea
                    value={onboardNotes}
                    onChange={(e) => setOnboardNotes(e.target.value)}
                    placeholder="e.g. Laptop shipped, background verification pending, welcome kit delivered..."
                    rows={2}
                    className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600 resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowOnboardingModal(false); setEditingOnboarding(null); }}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-900 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={editingOnboarding ? handleSaveEditOnboarding : handleAddOnboarding}
                  disabled={savingOnboard || !onboardName.trim()}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {savingOnboard
                    ? <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    : editingOnboarding
                    ? <><Check className="w-3.5 h-3.5" /> Save Changes</>
                    : <><Plus className="w-3.5 h-3.5" /> Add Candidate</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Add / Edit FnF Modal ─── */}
      <AnimatePresence>
        {showFnFModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
              onClick={() => { setShowFnFModal(false); setEditingFnF(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-[28px] p-7 shadow-2xl flex flex-col gap-5 z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <UserMinus className="w-5 h-5 text-amber-400" />
                    {editingFnF ? "Edit FnF Settlement" : "New FnF Settlement Record"}
                  </h2>
                  <p className="text-xs text-zinc-500 font-semibold">
                    {editingFnF ? "Update employee clearance & settlement progress." : "Track employee exit, department clearances, asset recovery, and FnF payout."}
                  </p>
                </div>
                <button
                  onClick={() => { setShowFnFModal(false); setEditingFnF(null); }}
                  className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Exiting Employee Name *</label>
                  <input
                    value={fnfName}
                    onChange={(e) => setFnfName(e.target.value)}
                    placeholder="e.g. David Miller"
                    className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Department</label>
                    <input
                      value={fnfDept}
                      onChange={(e) => setFnfDept(e.target.value)}
                      placeholder="e.g. Product Design"
                      className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Last Working Day (LWD)</label>
                    <input
                      type="date"
                      value={fnfLwd}
                      onChange={(e) => setFnfLwd(e.target.value)}
                      className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-zinc-300 outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Clearance Status</label>
                    <select
                      value={fnfStatus}
                      onChange={(e) => setFnfStatus(e.target.value as FnFTask["status"])}
                      className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900 rounded-xl p-3 text-sm font-medium text-white outline-none"
                    >
                      <option value="resigned">✉️ Resigned / Notice Period</option>
                      <option value="clearance_pending">📋 Dept Clearance Pending</option>
                      <option value="assets_collected">💻 Assets Collected (IT/ID)</option>
                      <option value="fnf_calculation">🧮 FnF Payout Calculation</option>
                      <option value="settled">💵 Settled & Relieving Issued</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Settlement Note / Amount</label>
                    <input
                      value={fnfAmount}
                      onChange={(e) => setFnfAmount(e.target.value)}
                      placeholder="e.g. ₹68,500 or All Cleared"
                      className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Exit Notes / Clearance Checklist</label>
                  <textarea
                    value={fnfNotes}
                    onChange={(e) => setFnfNotes(e.target.value)}
                    placeholder="e.g. Handover done to Alex, MacBook returned, gratuity calculated..."
                    rows={2}
                    className="w-full border border-zinc-800 focus:border-zinc-600 transition-colors bg-zinc-900/60 rounded-xl p-3 text-sm font-medium text-white outline-none placeholder-zinc-600 resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowFnFModal(false); setEditingFnF(null); }}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-900 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={editingFnF ? handleSaveEditFnF : handleAddFnF}
                  disabled={savingFnF || !fnfName.trim()}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {savingFnF
                    ? <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    : editingFnF
                    ? <><Check className="w-3.5 h-3.5" /> Save Changes</>
                    : <><Plus className="w-3.5 h-3.5" /> Add FnF Record</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
