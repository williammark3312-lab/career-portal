"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";
import {
  Briefcase, FileText, X, ChevronRight, Check, Layers,
  DollarSign, Activity, Users, UserPlus, Trash2, Plus, Clock,
  Shield, ClipboardList, LogOut, Sparkles, Search, Filter,
  List, Kanban, ChevronDown, CheckCircle2
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../../src/components/Header";
import Footer from "../../../src/components/Footer";
import GlassBackground from "../../../src/components/GlassBackground";

/* ─── Interfaces ─── */
interface FnfTask {
  id: string;
  name: string;
  completed: boolean;
  section: "Assets" | "IT" | "HR" | "Finance";
}

interface FnfRecord {
  id: string;
  employeeName: string;
  department: string;
  resignationDate: string;
  lastWorkingDay: string;
  settlementStatus: "Draft" | "Approved" | "Paid" | "Completed";
  amount: number;
  remarks: string;
  tasks: FnfTask[];
  createdAt: string;
}

interface OnboardingTask {
  id: string;
  name: string;
  completed: boolean;
}

interface OnboardingRecord {
  id: string;
  candidateName: string;
  role: string;
  startDate: string;
  status: "Not Started" | "In Progress" | "Completed";
  mentor: string;
  email: string;
  tasks: OnboardingTask[];
  createdAt: string;
}

interface WorkspaceTask {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
  status: "To Do" | "In Progress" | "Done";
  category: "General" | "Onboarding" | "FNF" | "Recruitment";
  createdAt: string;
}

interface WorkspaceData {
  fnf: FnfRecord[];
  onboardings: OnboardingRecord[];
  tasks: WorkspaceTask[];
}

export default function WorkspacePage() {
  const router = useRouter();

  const [mounted] = useState(true);

  /* Excel Export function */
  const exportToExcel = (data: Record<string, unknown>[], filename: string) => {
    if (!data || data.length === 0) {
      alert("No data available to export.");
      return;
    }
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => 
      Object.values(row).map(val => {
        let str = String(val === null || val === undefined ? "" : val);
        str = str.replace(/"/g, '""');
        if (str.includes(",") || str.includes("\n") || str.includes('"')) {
          str = `"${str}"`;
        }
        return str;
      }).join(",")
    );
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportFnf = () => {
    if (workspace.fnf.length === 0) {
      alert("No FNF settlements data to export.");
      return;
    }
    const dataToExport = workspace.fnf.map(f => ({
      ID: f.id,
      EmployeeName: f.employeeName,
      Department: f.department,
      ResignationDate: f.resignationDate,
      LastWorkingDay: f.lastWorkingDay,
      SettlementStatus: f.settlementStatus,
      AmountINR: f.amount,
      Remarks: f.remarks,
      ClearedTasks: `${f.tasks.filter(t => t.completed).length}/${f.tasks.length}`
    }));
    exportToExcel(dataToExport, "FNF_Settlements.csv");
  };

  const handleExportOnboarding = () => {
    if (workspace.onboardings.length === 0) {
      alert("No onboarding data to export.");
      return;
    }
    const dataToExport = workspace.onboardings.map(o => ({
      ID: o.id,
      CandidateName: o.candidateName,
      Role: o.role,
      StartDate: o.startDate,
      Status: o.status,
      Mentor: o.mentor,
      Email: o.email,
      CompletedTasks: `${o.tasks.filter(t => t.completed).length}/${o.tasks.length}`
    }));
    exportToExcel(dataToExport, "Onboarding_Trackers.csv");
  };

  const handleExportTasks = () => {
    if (workspace.tasks.length === 0) {
      alert("No tasks data to export.");
      return;
    }
    const dataToExport = workspace.tasks.map(t => ({
      ID: t.id,
      Title: t.title,
      AssignedTo: t.assignedTo,
      DueDate: t.dueDate,
      Priority: t.priority,
      Status: t.status,
      Category: t.category
    }));
    exportToExcel(dataToExport, "Tasks_Desk.csv");
  };

  /* Auth state */
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* Tab states */
  const [activeTab, setActiveTab] = useState<"overview" | "fnf" | "onboarding" | "tasks">("overview");

  /* Stats counts for sidebar navigation */
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalCVs: 0,
    totalUsers: 0
  });

  /* Workspace Data state */
  const [workspace, setWorkspace] = useState<WorkspaceData>({
    fnf: [],
    onboardings: [],
    tasks: []
  });
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);

  /* Modal state */
  const [showFnfModal, setShowFnfModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  /* Expanded list items for checklist toggles */
  const [expandedFnf, setExpandedFnf] = useState<string | null>(null);
  const [expandedOnb, setExpandedOnb] = useState<string | null>(null);

  /* Form inputs */
  const [fnfForm, setFnfForm] = useState({
    employeeName: "", department: "", resignationDate: "", lastWorkingDay: "", amount: "", remarks: ""
  });
  const [onbForm, setOnbForm] = useState({
    candidateName: "", role: "", startDate: "", mentor: "", email: ""
  });
  const [taskForm, setTaskForm] = useState({
    title: "", assignedTo: "", dueDate: "", priority: "Medium" as WorkspaceTask["priority"], category: "General" as WorkspaceTask["category"]
  });

  /* Google Tasks Efficiency States */
  const [taskViewMode, setTaskViewMode] = useState<"list" | "board">("list");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskCategory, setQuickTaskCategory] = useState<WorkspaceTask["category"]>("General");
  const [quickTaskPriority, setQuickTaskPriority] = useState<WorkspaceTask["priority"]>("Medium");
  const [quickTaskDueDate, setQuickTaskDueDate] = useState("");
  const [taskFilterCategory, setTaskFilterCategory] = useState<string>("All");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [showCompletedTasks, setShowCompletedTasks] = useState(true);

  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    const payload = {
      title: quickTaskTitle.trim(),
      assignedTo: session?.user?.email?.split("@")[0] || "Admin",
      dueDate: quickTaskDueDate || new Date().toISOString().split("T")[0],
      priority: quickTaskPriority,
      category: quickTaskCategory
    };
    setQuickTaskTitle("");
    await triggerWorkspaceAction("add_task", payload);
  };

  const LOCAL_STORAGE_KEY = "career_portal_workspace_v2";

  function saveWorkspaceToCache(data: WorkspaceData) {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn("localStorage write warning:", e);
      }
    }
  }

  function getWorkspaceFromCache(): WorkspaceData | null {
    if (typeof window !== "undefined") {
      try {
        const item = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (item) return JSON.parse(item);
      } catch (e) {
        console.warn("localStorage read warning:", e);
      }
    }
    return null;
  }

  async function loadStats() {
    try {
      const { count: jobCount } = await supabase.from("jobs").select("*", { count: "exact", head: true });
      const { count: cvCount } = await supabase.from("cv_database").select("*", { count: "exact", head: true });
      
      let usersCount = 0;
      try {
        const res = await fetch("/api/create-admin");
        const json = await res.json();
        if (json.users) usersCount = json.users.length;
      } catch {}

      setStats({
        totalJobs: jobCount ?? 0,
        totalCVs: cvCount ?? 0,
        totalUsers: usersCount
      });
    } catch (err) {
      console.error("Error loading sidebar stats:", err);
    }
  }

  async function loadWorkspace() {
    try {
      setLoadingWorkspace(true);
      const cached = getWorkspaceFromCache();
      if (cached) {
        setWorkspace(cached);
      }

      const res = await fetch("/api/workspace");
      if (res.ok) {
        const apiData: WorkspaceData = await res.json();
        if (!cached) {
          setWorkspace(apiData);
          saveWorkspaceToCache(apiData);
        } else {
          // Sync local cached data (with deletions) to server API store
          fetch("/api/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sync_workspace", payload: cached })
          }).catch(console.error);
        }
      }
    } catch (err) {
      console.error("Error fetching workspace data:", err);
    } finally {
      setLoadingWorkspace(false);
    }
  }

  /* Effects */
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
        loadStats();
        loadWorkspace();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) {
        loadStats();
        loadWorkspace();
      } else {
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin");
  }

  /* API mutator helper */
  async function triggerWorkspaceAction(action: string, payload: Record<string, unknown>) {
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload })
      });
      if (res.ok) {
        const updatedData = await res.json();
        setWorkspace(updatedData);
        saveWorkspaceToCache(updatedData);
      } else {
        const errJson = await res.json();
        alert("Operation failed: " + (errJson.error || "Unknown error"));
      }
    } catch (err) {
      console.error("API error:", err);
      alert("Failed to connect to API.");
    }
  }

  /* ─── CRUD Handlers ─── */
  const handleAddFnf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fnfForm.employeeName.trim() || !fnfForm.department.trim()) {
      alert("Employee Name and Department are required");
      return;
    }
    await triggerWorkspaceAction("add_fnf", fnfForm);
    setShowFnfModal(false);
    setFnfForm({ employeeName: "", department: "", resignationDate: "", lastWorkingDay: "", amount: "", remarks: "" });
  };

  const handleUpdateFnfStatus = async (id: string, status: FnfRecord["settlementStatus"]) => {
    await triggerWorkspaceAction("update_fnf", { id, settlementStatus: status });
  };

  const handleUpdateFnfAmount = async (id: string, amount: string) => {
    await triggerWorkspaceAction("update_fnf", { id, amount });
  };

  const handleToggleFnfTask = async (fnfId: string, taskId: string, completed: boolean) => {
    await triggerWorkspaceAction("toggle_fnf_task", { fnfId, taskId, completed });
  };

  const handleDeleteFnf = async (id: string) => {
    if (typeof window !== "undefined" && window.confirm) {
      if (!window.confirm("Are you sure you want to cancel/delete this FNF record?")) return;
    }
    setWorkspace(prev => {
      const nextFnf = prev.fnf.filter(f => String(f.id) !== String(id));
      const nextWorkspace = { ...prev, fnf: nextFnf };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("delete_fnf", { id });
    if (expandedFnf === id) setExpandedFnf(null);
  };

  const handleAddOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onbForm.candidateName.trim() || !onbForm.role.trim()) {
      alert("Candidate Name and Job Role are required");
      return;
    }
    await triggerWorkspaceAction("add_onboarding", onbForm);
    setShowOnboardingModal(false);
    setOnbForm({ candidateName: "", role: "", startDate: "", mentor: "", email: "" });
  };

  const handleUpdateOnbStatus = async (id: string, status: OnboardingRecord["status"]) => {
    await triggerWorkspaceAction("update_onboarding", { id, status });
  };

  /* Custom Checkpoint state */
  const [newOnbTaskInputs, setNewOnbTaskInputs] = useState<Record<string, string>>({});

  const handleAddOnbTask = async (onboardingId: string) => {
    const taskName = newOnbTaskInputs[onboardingId]?.trim();
    if (!taskName) return;
    await triggerWorkspaceAction("add_onboarding_task", { onboardingId, taskName });
    setNewOnbTaskInputs((prev) => ({ ...prev, [onboardingId]: "" }));
  };

  const handleDeleteOnbTask = async (onboardingId: string, taskId: string) => {
    await triggerWorkspaceAction("delete_onboarding_task", { onboardingId, taskId });
  };

  const handleToggleOnbTask = async (onboardingId: string, taskId: string, completed: boolean) => {
    await triggerWorkspaceAction("toggle_onboarding_task", { onboardingId, taskId, completed });
  };

  const handleDeleteOnboarding = async (id: string) => {
    if (typeof window !== "undefined" && window.confirm) {
      if (!window.confirm("Are you sure you want to delete this onboarding process?")) return;
    }
    setWorkspace(prev => {
      const nextOnb = prev.onboardings.filter(o => String(o.id) !== String(id));
      const nextWorkspace = { ...prev, onboardings: nextOnb };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("delete_onboarding", { id });
    if (expandedOnb === id) setExpandedOnb(null);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      alert("Task Title is required");
      return;
    }
    await triggerWorkspaceAction("add_task", taskForm);
    setShowTaskModal(false);
    setTaskForm({ title: "", assignedTo: "", dueDate: "", priority: "Medium", category: "General" });
  };

  const handleUpdateTaskStatus = async (id: string, status: WorkspaceTask["status"]) => {
    await triggerWorkspaceAction("update_task", { id, status });
  };

  const handleDeleteTask = async (id: string) => {
    if (typeof window !== "undefined" && window.confirm) {
      if (!window.confirm("Delete this task?")) return;
    }
    setWorkspace(prev => {
      const nextTasks = prev.tasks.filter(t => String(t.id) !== String(id));
      const nextWorkspace = { ...prev, tasks: nextTasks };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("delete_task", { id });
  };

  const isRecruiter =
    session?.user?.app_metadata?.role === "admin" ||
    session?.user?.user_metadata?.role === "admin" ||
    session?.user?.app_metadata?.role === "superuser" ||
    session?.user?.user_metadata?.role === "superuser" ||
    session?.user?.email === "williammark3312@gmail.com" ||
    session?.user?.email === "anandugirish3312@gmail.com";

  if ((!mounted || authLoading) && !session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-white relative overflow-hidden font-sans">
        <GlassBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="admin-logo-mark w-9 h-9" />
          <div className="flex gap-1.5">
            {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-slow" style={{animationDelay:`${i*0.18}s`}} />)}
          </div>
          <p className="text-[10px] font-semibold text-zinc-500 tracking-widest uppercase">Loading Workspace</p>
        </div>
      </main>
    );
  }

  if (session && !isRecruiter) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#050505] text-white relative overflow-hidden p-4 font-sans">
        <GlassBackground />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-3xl p-8 relative z-10 text-center flex flex-col items-center gap-5 shadow-2xl"
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-rose-450 animate-pulse-slow"
            style={{background:'rgba(244,63,94,0.07)',border:'1px solid rgba(244,63,94,0.15)'}}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-700 text-white tracking-tight mb-1">Access Denied</h1>
            <p className="text-xs text-zinc-450 font-medium leading-relaxed">
              Signed in as <span className="text-indigo-400 font-semibold">{session.user.email}</span>. Only supervisors may access this workspace.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <button onClick={handleLogout} className="w-full py-2.5 px-4 rounded-xl font-700 text-xs text-white bg-rose-500 hover:bg-rose-600 cursor-pointer transition-all active:scale-[0.98]">
              Sign Out & Try Again
            </button>
            <button onClick={() => router.push("/")} className="w-full py-2.5 px-4 rounded-xl font-600 text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-all cursor-pointer">
              Back to Home
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  const totalFnf = workspace.fnf.length;
  const activeOnboardings = workspace.onboardings.filter(o => o.status !== "Completed").length;
  const pendingClearances = workspace.fnf.filter(f => f.settlementStatus !== "Completed").length;
  const pendingTasks = workspace.tasks.filter(t => t.status !== "Done").length;

  return (
    <main className="relative flex flex-col min-h-screen bg-[#050505] text-white">
      <GlassBackground />
      <Header session={session} handleLogout={handleLogout} activeAdminTab="workspace" />

      {/* Hero section matching portal */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 pt-16 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Workspace desk.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-lg">
            Manage employee onboarding, F&F settlements, and internal operational directives.
          </p>

          {/* Minimal Info Row */}
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">
            <span>SETTLEMENTS: {totalFnf}</span>
            <span>•</span>
            <span>ONBOARDINGS: {activeOnboardings}</span>
            <span>•</span>
            <span>OPEN TASKS: {pendingTasks}</span>
          </div>
        </motion.div>
      </section>

      {/* Search & Action Bar Section */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-4"
        >
          {/* Top Control Bar: Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Sub Tab bar (Filter Pills) */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: "overview", label: "Overview" },
                { id: "fnf", label: "FNF Settlement" },
                { id: "onboarding", label: "Onboardings" },
                { id: "tasks", label: "Tasks Desk" },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-black border-transparent"
                        : "bg-zinc-950/50 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Quick header action button */}
            <div className="flex items-center gap-2 shrink-0">
              {activeTab === "fnf" && (
                <>
                  <button
                    onClick={handleExportFnf}
                    className="px-4 py-2 rounded-xl border border-zinc-900 bg-zinc-950/50 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
                  >
                    Export Excel
                  </button>
                  <button
                    onClick={() => setShowFnfModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Start FNF
                  </button>
                </>
              )}
              {activeTab === "onboarding" && (
                <>
                  <button
                    onClick={handleExportOnboarding}
                    className="px-4 py-2 rounded-xl border border-zinc-900 bg-zinc-950/50 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
                  >
                    Export Excel
                  </button>
                  <button
                    onClick={() => setShowOnboardingModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                  >
                    <UserPlus className="w-4 h-4" /> Start Onboarding
                  </button>
                </>
              )}
              {activeTab === "tasks" && (
                <>
                  <button
                    onClick={handleExportTasks}
                    className="px-4 py-2 rounded-xl border border-zinc-900 bg-zinc-950/50 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
                  >
                    Export Excel
                  </button>
                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Create Task
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Main Content Section */}
      <section className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 pb-24">
        {loadingWorkspace ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 border border-zinc-900 bg-zinc-950/20 rounded-2xl">
            <div className="w-6 h-6 border-2 border-zinc-800 border-t-white rounded-full animate-spin" />
            <p className="text-xs text-zinc-500 font-semibold">Loading workspace files...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
              {/* ─── OVERVIEW TAB ─── */}
              {activeTab === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  {[
                    { label: "Active Onboardings", value: activeOnboardings, desc: "Ready to engage" },
                    { label: "Settlements Handled", value: totalFnf, desc: "Lifecycle logs" },
                    { label: "Pending Clearance", value: pendingClearances, desc: "Needs evaluation" },
                    { label: "Operational Tasks", value: pendingTasks, desc: "Open directives" }
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-zinc-950/80 border border-blue-950/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-2">
                      <span className="text-[10px] font-bold text-blue-400/90 uppercase tracking-widest">{stat.label}</span>
                      <span className="text-2xl sm:text-3xl font-bold text-blue-400 tracking-tight">{stat.value}</span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{stat.desc}</span>
                    </div>
                  ))}

                  {/* Summary lists on Overview page */}
                  <div className="col-span-1 md:col-span-2 border border-zinc-850 bg-zinc-950/80 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-blue-400" /> Recent FNF Clearances
                      </h3>
                      <button
                        onClick={handleExportFnf}
                        className="px-3 py-1.5 rounded-lg border border-blue-900/40 bg-zinc-900 text-[10px] font-bold text-blue-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Export FNF
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {workspace.fnf.slice(0, 3).map(f => {
                        const cleared = f.tasks.filter(t => t.completed).length;
                        const total = f.tasks.length;
                        return (
                          <div key={f.id} className="flex justify-between items-center py-3 px-3.5 rounded-xl border border-zinc-850/80 bg-zinc-900/40 text-xs">
                            <div>
                              <h4 className="font-bold text-white">{f.employeeName}</h4>
                              <p className="text-[10px] font-semibold text-blue-300/80 mt-0.5">{f.department} • LWD: {f.lastWorkingDay}</p>
                            </div>
                            <span className="text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-800/60 px-2.5 py-1 rounded-md">
                              {cleared}/{total} cleared
                            </span>
                          </div>
                        );
                      })}
                      {workspace.fnf.length === 0 && (
                        <p className="text-xs text-zinc-500 italic py-4 text-center">No resignation clearances recorded.</p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 border border-zinc-850 bg-zinc-950/80 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
                        <UserPlus className="w-3.5 h-3.5 text-blue-400" /> Onboarding Trackers
                      </h3>
                      <button
                        onClick={handleExportOnboarding}
                        className="px-3 py-1.5 rounded-lg border border-blue-900/40 bg-zinc-900 text-[10px] font-bold text-blue-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Export Onboarding
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {workspace.onboardings.slice(0, 3).map(o => {
                        const done = o.tasks.filter(t => t.completed).length;
                        const total = o.tasks.length;
                        return (
                          <div key={o.id} className="flex justify-between items-center py-3 px-3.5 rounded-xl border border-zinc-850/80 bg-zinc-900/40 text-xs">
                            <div>
                              <h4 className="font-bold text-white">{o.candidateName}</h4>
                              <p className="text-[10px] font-semibold text-blue-300/80 mt-0.5">{o.role} • Start: {o.startDate}</p>
                            </div>
                            <span className="text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-800/60 px-2.5 py-1 rounded-md">
                              {o.status} ({done}/{total})
                            </span>
                          </div>
                        );
                      })}
                      {workspace.onboardings.length === 0 && (
                        <p className="text-xs text-zinc-500 italic py-4 text-center">No onboarding tracks recorded.</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── FNF SETTLEMENT TAB ─── */}
              {activeTab === "fnf" && (
                <motion.div
                  key="fnf"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  <div className="border border-zinc-850 bg-zinc-950/80 rounded-2xl overflow-hidden shadow-xl">
                    {workspace.fnf.map(f => {
                      const isExpanded = expandedFnf === f.id;
                      const completedCount = f.tasks.filter(t => t.completed).length;
                      const totalCount = f.tasks.length;

                      const dotColor = f.settlementStatus === "Completed" ? "#10b981" : f.settlementStatus === "Paid" ? "#3b82f6" : "#71717a";

                      return (
                        <div key={f.id} className="w-full border-b border-zinc-850/80 last:border-b-0">
                          {/* Row Summary */}
                          <div
                            onClick={() => setExpandedFnf(isExpanded ? null : f.id)}
                            className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-zinc-900/40 transition-colors group"
                          >
                            <div className="flex flex-col">
                              <h4 className="text-xs font-bold text-white group-hover:text-zinc-300 transition-colors flex items-center gap-2">
                                {f.employeeName}
                                <span className="text-[10px] font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                                  {f.department}
                                </span>
                              </h4>
                              <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-2">
                                <span>Resigned: {f.resignationDate}</span>
                                <span>•</span>
                                <span>LWD: {f.lastWorkingDay}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-5">
                              <span className="text-xs font-bold text-zinc-300">
                                {completedCount}/{totalCount} Cleared
                              </span>
                              
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5">
                                  <span style={{ backgroundColor: dotColor }} className="w-1.5 h-1.5 rounded-full" />
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{f.settlementStatus}</span>
                                </span>
                                <ChevronRight className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </div>
                            </div>
                          </div>

                          {/* Expanded clearances */}
                          {isExpanded && (
                            <div className="px-5 pb-6 pt-4 border-t border-zinc-850 bg-zinc-900/20 flex flex-col gap-5">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="flex flex-col gap-4 text-xs">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Settlement Value (₹)</span>
                                    <input
                                      type="number"
                                      defaultValue={f.amount}
                                      onBlur={(e) => handleUpdateFnfAmount(f.id, e.target.value)}
                                      className="w-32 bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-all"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status Protocol</span>
                                    <select
                                      value={f.settlementStatus}
                                      onChange={(e) => handleUpdateFnfStatus(f.id, e.target.value as FnfRecord["settlementStatus"])}
                                      className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                    >
                                      <option value="Draft">Draft (Clearances pending)</option>
                                      <option value="Approved">Approved (Clearances ok)</option>
                                      <option value="Paid">Paid (Finance executed)</option>
                                      <option value="Completed">Completed (Settlement closed)</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="md:col-span-2 flex flex-col gap-3">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Clearance checklist</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {f.tasks.map(t => (
                                      <button
                                        key={t.id}
                                        onClick={() => handleToggleFnfTask(f.id, t.id, !t.completed)}
                                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                                          t.completed
                                            ? "bg-zinc-900 border-zinc-700 text-white font-bold"
                                            : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 font-medium"
                                        }`}
                                      >
                                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                                          t.completed ? "bg-zinc-100 border-transparent text-zinc-950" : "border-zinc-700"
                                        }`}>
                                          {t.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-[11px] font-bold truncate leading-none">{t.name}</p>
                                        </div>
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex justify-end mt-4">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteFnf(f.id);
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-950/30 border border-rose-900/40 transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Remove settlement
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {workspace.fnf.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-xs text-zinc-500">No resignation clearances initialized.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── ONBOARDINGS TAB ─── */}
              {activeTab === "onboarding" && (
                <motion.div
                  key="onboarding"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden">
                    {workspace.onboardings.map((o) => {
                      const doneCount = o.tasks.filter((t) => t.completed).length;
                      const totalCount = o.tasks.length;
                      const dotColor = o.status === "Completed" ? "#10b981" : o.status === "In Progress" ? "#3b82f6" : "#71717a";

                      return (
                        <div
                          key={o.id}
                          onClick={() => setExpandedOnb(o.id)}
                          className="py-5 px-6 border-b border-zinc-900 last:border-b-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-zinc-900/30 transition-colors group"
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-zinc-300 transition-colors flex items-center gap-2">
                              {o.candidateName}
                              <span className="text-[10px] font-semibold text-zinc-450 bg-zinc-950/40 border border-zinc-900 px-2 py-0.5 rounded">
                                {o.role}
                              </span>
                            </h4>
                            <p className="text-[10px] text-zinc-500 font-semibold flex items-center gap-2 mt-0.5">
                              <span>Start: {o.startDate}</span>
                              <span>•</span>
                              <span>Mentor: {o.mentor}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-5 shrink-0">
                            <span className="text-xs font-bold text-zinc-300">
                              {doneCount}/{totalCount} Done
                            </span>

                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5">
                                <span style={{ backgroundColor: dotColor }} className="w-1.5 h-1.5 rounded-full" />
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{o.status}</span>
                              </span>
                              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:translate-x-1 group-hover:text-white transition-all duration-200" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {workspace.onboardings.length === 0 && (
                      <div className="p-12 text-center text-zinc-500 text-xs font-semibold">
                        No candidate onboarding guides active.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
                    {/* ─── TASKS DESK TAB (GOOGLE TASKS HYPER-EFFICIENT UX) ─── */}
              {activeTab === "tasks" && (() => {
                const filteredTasks = workspace.tasks.filter(t => {
                  const matchCat = taskFilterCategory === "All" || t.category === taskFilterCategory;
                  const matchQuery = !taskSearchQuery.trim() || 
                    t.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) || 
                    t.assignedTo.toLowerCase().includes(taskSearchQuery.toLowerCase());
                  return matchCat && matchQuery;
                });

                const activeTasks = filteredTasks.filter(t => t.status !== "Done");
                const completedTasks = filteredTasks.filter(t => t.status === "Done");

                return (
                  <motion.div
                    key="tasks"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-4"
                  >
                    {/* Toolbar & View Switcher */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                      {/* Search Bar */}
                      <div className="flex-1 relative flex items-center bg-zinc-950/80 rounded-xl border border-zinc-900 focus-within:border-zinc-700 px-3.5 py-2.5 transition-all">
                        <Search className="w-4 h-4 mr-2.5 text-zinc-600" />
                        <input
                          type="text"
                          placeholder="Search tasks or assignees..."
                          value={taskSearchQuery}
                          onChange={(e) => setTaskSearchQuery(e.target.value)}
                          className="w-full bg-transparent border-none outline-none text-xs text-zinc-200 placeholder-zinc-650 font-semibold"
                        />
                        {taskSearchQuery && (
                          <button
                            onClick={() => setTaskSearchQuery("")}
                            className="ml-2 p-1 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Filter Chips & View Mode Switcher */}
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={taskFilterCategory}
                          onChange={(e) => setTaskFilterCategory(e.target.value)}
                          className="px-3.5 py-2.5 rounded-xl border border-zinc-900 bg-zinc-950/50 text-xs font-bold text-zinc-400 focus:outline-none cursor-pointer"
                        >
                          <option value="All" className="bg-zinc-950 text-white">All Categories</option>
                          <option value="General" className="bg-zinc-950 text-white">General Ops</option>
                          <option value="Onboarding" className="bg-zinc-950 text-white">Onboarding</option>
                          <option value="FNF" className="bg-zinc-950 text-white">FNF Clearance</option>
                          <option value="Recruitment" className="bg-zinc-950 text-white">Recruitment</option>
                        </select>

                        <div className="flex items-center gap-1 bg-zinc-950/80 border border-zinc-900 p-1 rounded-xl">
                          <button
                            onClick={() => setTaskViewMode("list")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              taskViewMode === "list"
                                ? "bg-white text-black shadow-sm"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            <List className="w-3.5 h-3.5" /> List
                          </button>
                          <button
                            onClick={() => setTaskViewMode("board")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              taskViewMode === "board"
                                ? "bg-white text-black shadow-sm"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            <Kanban className="w-3.5 h-3.5" /> Board
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Inline Task Creator Form */}
                    <form
                      onSubmit={handleQuickAddTask}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-zinc-950/40 border border-zinc-900 focus-within:border-zinc-700 p-2.5 rounded-2xl transition-all"
                    >
                      <div className="flex items-center gap-2 flex-1 px-2">
                        <Plus className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        <input
                          type="text"
                          placeholder="Add a task (e.g. Schedule Exit Interview, Revoke AWS Access)..."
                          value={quickTaskTitle}
                          onChange={(e) => setQuickTaskTitle(e.target.value)}
                          className="w-full bg-transparent text-xs font-medium text-white placeholder-zinc-500 outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-900">
                        <select
                          value={quickTaskCategory}
                          onChange={(e) => setQuickTaskCategory(e.target.value as WorkspaceTask["category"])}
                          className="bg-zinc-900/60 border border-zinc-800 text-[10px] font-bold text-zinc-300 px-2.5 py-1.5 rounded-xl outline-none cursor-pointer"
                        >
                          <option value="General" className="bg-zinc-950 text-white">General Ops</option>
                          <option value="Onboarding" className="bg-zinc-950 text-white">Onboarding</option>
                          <option value="FNF" className="bg-zinc-950 text-white">FNF Clearance</option>
                          <option value="Recruitment" className="bg-zinc-950 text-white">Recruitment</option>
                        </select>

                        <select
                          value={quickTaskPriority}
                          onChange={(e) => setQuickTaskPriority(e.target.value as WorkspaceTask["priority"])}
                          className="bg-zinc-900/60 border border-zinc-800 text-[10px] font-bold text-zinc-300 px-2.5 py-1.5 rounded-xl outline-none cursor-pointer"
                        >
                          <option value="Low" className="bg-zinc-950 text-white">Low Priority</option>
                          <option value="Medium" className="bg-zinc-950 text-white">Medium Priority</option>
                          <option value="High" className="bg-zinc-950 text-white">High Priority</option>
                        </select>

                        <input
                          type="date"
                          value={quickTaskDueDate}
                          onChange={(e) => setQuickTaskDueDate(e.target.value)}
                          className="bg-zinc-900/60 border border-zinc-800 text-[10px] font-bold text-zinc-300 px-2 py-1 rounded-xl outline-none cursor-pointer"
                        />

                        <button
                          type="submit"
                          disabled={!quickTaskTitle.trim()}
                          className="bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white text-black text-xs font-bold px-4 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          Add
                        </button>
                      </div>
                    </form>

                    {/* View Render: List View vs Board View */}
                    {taskViewMode === "list" ? (
                      <div className="flex flex-col gap-4">
                        {/* Active Tasks List Container */}
                        <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden">
                          <div className="px-6 py-3.5 border-b border-zinc-900 flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-950/40">
                            <span className="flex items-center gap-2">
                              <ClipboardList className="w-3.5 h-3.5 text-zinc-500" /> Active Tasks ({activeTasks.length})
                            </span>
                          </div>

                          {activeTasks.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500 text-xs font-semibold">
                              No active tasks pending. Nice work!
                            </div>
                          ) : (
                            activeTasks.map((t) => (
                              <div
                                key={t.id}
                                className="px-6 py-4 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/30 transition-colors flex items-center justify-between group"
                              >
                                <div className="flex items-center gap-3.5 min-w-0 pr-4">
                                  <button
                                    onClick={() => handleUpdateTaskStatus(t.id, "Done")}
                                    className="w-5 h-5 rounded-full border border-zinc-700 hover:border-white bg-zinc-950 flex items-center justify-center transition-all cursor-pointer shrink-0"
                                    title="Mark as completed"
                                  >
                                    <Check className="w-3 h-3 text-transparent group-hover:text-white transition-colors" />
                                  </button>

                                  <div className="flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-bold text-white group-hover:text-zinc-300 transition-colors">
                                        {t.title}
                                      </span>
                                      <span className="text-[10px] font-semibold text-zinc-450 bg-zinc-950/40 border border-zinc-900 px-2 py-0.5 rounded">
                                        {t.category}
                                      </span>
                                      {t.priority === "High" && (
                                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded">
                                          High Priority
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-semibold flex items-center gap-2">
                                      <span>Assigned: <span className="text-zinc-400">{t.assignedTo}</span></span>
                                      <span>•</span>
                                      <span>Due: {t.dueDate}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => handleUpdateTaskStatus(t.id, t.status === "To Do" ? "In Progress" : "Done")}
                                    className="text-[10px] font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                  >
                                    {t.status === "To Do" ? "Start" : "Finish"}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTask(t.id);
                                    }}
                                    className="text-zinc-500 hover:text-rose-400 cursor-pointer transition-colors p-1.5 rounded-lg opacity-0 group-hover:opacity-100"
                                    title="Delete task"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Completed Tasks Accordion */}
                        {completedTasks.length > 0 && (
                          <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden">
                            <button
                              onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                              className="w-full px-6 py-3.5 flex items-center justify-between hover:bg-zinc-900/30 transition-all text-xs font-bold text-zinc-400 cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Completed ({completedTasks.length})
                              </span>
                              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${showCompletedTasks ? "rotate-180" : ""}`} />
                            </button>

                            {showCompletedTasks && (
                              <div className="border-t border-zinc-900">
                                {completedTasks.map((t) => (
                                  <div
                                    key={t.id}
                                    className="px-6 py-3.5 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/20 transition-all flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-3.5 min-w-0 pr-4">
                                      <button
                                        onClick={() => handleUpdateTaskStatus(t.id, "To Do")}
                                        className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center transition-all cursor-pointer shrink-0"
                                        title="Reopen task"
                                      >
                                        <Check className="w-3 h-3 stroke-[3]" />
                                      </button>
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold line-through text-zinc-500">
                                          {t.title}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 font-semibold">
                                          Completed • {t.category}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        onClick={() => handleUpdateTaskStatus(t.id, "To Do")}
                                        className="text-[10px] font-bold text-zinc-400 hover:text-white px-2 py-0.5 rounded cursor-pointer"
                                      >
                                        Reopen
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTask(t.id);
                                        }}
                                        className="text-zinc-500 hover:text-rose-400 cursor-pointer transition-colors p-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Board View (Kanban) */
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { title: "To Do", key: "To Do", dot: "bg-zinc-500" },
                          { title: "In Progress", key: "In Progress", dot: "bg-blue-400" },
                          { title: "Completed", key: "Done", dot: "bg-emerald-400" },
                        ].map((col) => (
                          <div key={col.title} className="flex flex-col gap-3 bg-zinc-950/30 border border-zinc-900 rounded-2xl p-4">
                            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${col.dot}`} /> {col.title}
                              </span>
                              <span className="text-zinc-300 font-bold">{filteredTasks.filter((t) => t.status === col.key).length}</span>
                            </div>

                            <div className="flex flex-col gap-2">
                              {filteredTasks.filter((t) => t.status === col.key).map((t) => (
                                <div key={t.id} className="p-4 border border-zinc-900 bg-zinc-950/50 rounded-xl flex flex-col gap-3 hover:border-zinc-700 transition-colors group">
                                  <div>
                                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{t.category}</span>
                                    <h4 className={`text-xs font-bold text-white group-hover:text-zinc-300 transition-colors mt-0.5 leading-tight ${t.status === "Done" ? "line-through text-zinc-500" : ""}`}>
                                      {t.title}
                                    </h4>
                                  </div>

                                  <div className="text-[10px] text-zinc-500 font-semibold border-t border-zinc-900 pt-2 flex flex-col gap-0.5">
                                    <span>Assigned: <span className="text-zinc-300">{t.assignedTo}</span></span>
                                    <span>Due: {t.dueDate}</span>
                                  </div>

                                  <div className="flex items-center justify-between border-t border-zinc-900 pt-2 text-[10px] font-bold">
                                    <span className="text-zinc-500 uppercase tracking-wider">{t.priority} priority</span>
                                    <div className="flex items-center gap-1.5">
                                      {t.status === "To Do" && (
                                        <button
                                          onClick={() => handleUpdateTaskStatus(t.id, "In Progress")}
                                          className="text-[10px] font-bold text-zinc-300 hover:bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded cursor-pointer"
                                        >
                                          Start
                                        </button>
                                      )}
                                      {t.status === "In Progress" && (
                                        <button
                                          onClick={() => handleUpdateTaskStatus(t.id, "Done")}
                                          className="text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded cursor-pointer"
                                        >
                                          Finish
                                        </button>
                                      )}
                                      {t.status === "Done" && (
                                        <button
                                          onClick={() => handleUpdateTaskStatus(t.id, "To Do")}
                                          className="text-[10px] font-bold text-zinc-400 hover:bg-zinc-900 border border-transparent px-2 py-0.5 rounded cursor-pointer"
                                        >
                                          Reopen
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTask(t.id);
                                        }}
                                        className="text-zinc-500 hover:text-rose-400 cursor-pointer transition-colors p-0.5"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {filteredTasks.filter((t) => t.status === col.key).length === 0 && (
                                <div className="text-center py-8">
                                  <p className="text-xs text-zinc-600 font-medium">No tasks in column</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          )}
      </section>
      <Footer />

      {/* ─── ONBOARDING DETAILS POPUP MODAL WINDOW ─── */}
      <AnimatePresence>
        {expandedOnb && (() => {
          const o = workspace.onboardings.find((item) => item.id === expandedOnb);
          if (!o) return null;
          const doneCount = o.tasks.filter((t) => t.completed).length;
          const totalCount = o.tasks.length;

          return (
            <div className="bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-[150] fixed inset-0" onClick={() => setExpandedOnb(null)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl max-h-[88vh] overflow-y-auto border border-zinc-800 rounded-[28px] p-6 sm:p-8 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl flex flex-col gap-6 text-white"
              >
                {/* Modal Header */}
                <div className="flex justify-between items-start pb-4 border-b border-zinc-850">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-white leading-tight">{o.candidateName}</h3>
                      <span className="text-[10px] font-semibold text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        {o.role}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                      <span>Start: {o.startDate}</span>
                      <span>•</span>
                      <span>Mentor: {o.mentor}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedOnb(null)}
                    className="text-zinc-400 hover:text-white cursor-pointer p-1.5 rounded-xl hover:bg-zinc-900 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Details Info Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-850">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Email Address</span>
                    <div className="text-xs text-zinc-200 font-mono font-medium truncate mt-0.5">
                      {o.email || "Pending registration"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status Protocol</span>
                    <select
                      value={o.status}
                      onChange={(e) => handleUpdateOnbStatus(o.id, e.target.value as OnboardingRecord["status"])}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3 py-1.5 text-xs text-white outline-none cursor-pointer mt-0.5"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                {/* Checklist Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Onboarding checklist</span>
                    <span className="text-[10px] font-semibold text-zinc-400">{doneCount} / {totalCount} Checkpoints Done</span>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {o.tasks.map((t) => (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                          t.completed
                            ? "bg-zinc-900 border-zinc-700 text-white font-bold"
                            : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 font-medium"
                        }`}
                      >
                        <button
                          onClick={() => handleToggleOnbTask(o.id, t.id, !t.completed)}
                          className="flex items-center gap-3 flex-1 text-left cursor-pointer"
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              t.completed ? "bg-zinc-100 border-transparent text-zinc-950" : "border-zinc-700"
                            }`}
                          >
                            {t.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="text-xs font-semibold">{t.name}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOnbTask(o.id, t.id);
                          }}
                          className="p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ml-2"
                          title="Delete checkpoint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Separate section to add custom checkpoints */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddOnbTask(o.id);
                    }}
                    className="flex items-center gap-2 mt-2"
                  >
                    <input
                      type="text"
                      placeholder="+ Add custom checkpoint (e.g. Sign NDA, Issue Access Card)..."
                      value={newOnbTaskInputs[o.id] || ""}
                      onChange={(e) => setNewOnbTaskInputs({ ...newOnbTaskInputs, [o.id]: e.target.value })}
                      className="flex-1 bg-zinc-900/60 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!newOnbTaskInputs[o.id]?.trim()}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-40 transition-all cursor-pointer shadow-sm shrink-0 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Checkpoint
                    </button>
                  </form>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end pt-4 border-t border-zinc-850 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteOnboarding(o.id);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-950/30 border border-rose-900/40 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove tracker
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ─── FNF LAUNCH MODAL ─── */}
      {showFnfModal && (
        <div className="bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 fixed inset-0" onClick={() => setShowFnfModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-zinc-800 rounded-[28px] p-6 sm:p-8 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl flex flex-col gap-6 text-white"
          >
            <div className="flex justify-between items-center pb-3 border-b border-zinc-850">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Start FNF Process</h3>
              <button onClick={() => setShowFnfModal(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddFnf} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={fnfForm.employeeName}
                  onChange={(e) => setFnfForm({ ...fnfForm, employeeName: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Department</label>
                <input
                  type="text"
                  required
                  placeholder="Technology"
                  value={fnfForm.department}
                  onChange={(e) => setFnfForm({ ...fnfForm, department: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Resignation</label>
                  <input
                    type="date"
                    required
                    value={fnfForm.resignationDate}
                    onChange={(e) => setFnfForm({ ...fnfForm, resignationDate: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Last Day</label>
                  <input
                    type="date"
                    required
                    value={fnfForm.lastWorkingDay}
                    onChange={(e) => setFnfForm({ ...fnfForm, lastWorkingDay: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Settlement Estimate (₹)</label>
                <input
                  type="number"
                  placeholder="8500"
                  value={fnfForm.amount}
                  onChange={(e) => setFnfForm({ ...fnfForm, amount: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-6 rounded-xl font-bold text-xs text-zinc-950 bg-zinc-100 hover:bg-white active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-white/5 mt-2 flex items-center justify-center"
              >
                Initiate FNF Process
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─── ONBOARDING LAUNCH MODAL ─── */}
      {showOnboardingModal && (
        <div className="bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 fixed inset-0" onClick={() => setShowOnboardingModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-zinc-800 rounded-[28px] p-6 sm:p-8 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl flex flex-col gap-6 text-white"
          >
            <div className="flex justify-between items-center pb-3 border-b border-zinc-850">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Start Onboarding</h3>
              <button onClick={() => setShowOnboardingModal(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddOnboarding} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Candidate Name</label>
                <input
                  type="text"
                  required
                  placeholder="Alice Cooper"
                  value={onbForm.candidateName}
                  onChange={(e) => setOnbForm({ ...onbForm, candidateName: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Role Title</label>
                <input
                  type="text"
                  required
                  placeholder="DevOps Specialist"
                  value={onbForm.role}
                  onChange={(e) => setOnbForm({ ...onbForm, role: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Corporate Email</label>
                <input
                  type="email"
                  placeholder="alice@company.com"
                  value={onbForm.email}
                  onChange={(e) => setOnbForm({ ...onbForm, email: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Start Date</label>
                  <input
                    type="date"
                    required
                    value={onbForm.startDate}
                    onChange={(e) => setOnbForm({ ...onbForm, startDate: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Assigned Mentor</label>
                  <input
                    type="text"
                    placeholder="Emma Watson"
                    value={onbForm.mentor}
                    onChange={(e) => setOnbForm({ ...onbForm, mentor: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-6 rounded-xl font-bold text-xs text-zinc-950 bg-zinc-100 hover:bg-white active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-white/5 mt-2 flex items-center justify-center"
              >
                Launch Onboarding Track
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─── TASK ADD MODAL ─── */}
      {showTaskModal && (
        <div className="bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 fixed inset-0" onClick={() => setShowTaskModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-zinc-800 rounded-[28px] p-6 sm:p-8 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl flex flex-col gap-6 text-white"
          >
            <div className="flex justify-between items-center pb-3 border-b border-zinc-850">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Create Task</h3>
              <button onClick={() => setShowTaskModal(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddTask} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="Revoke credentials..."
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Assignee</label>
                <input
                  type="text"
                  placeholder="IT Team"
                  value={taskForm.assignedTo}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Category</label>
                  <select
                    value={taskForm.category}
                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value as WorkspaceTask["category"] })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="General">General Ops</option>
                    <option value="Onboarding">Onboarding</option>
                    <option value="FNF">FNF Clearance</option>
                    <option value="Recruitment">Recruitment</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Priority Level</label>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as WorkspaceTask["priority"] })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High Priority">High Priority</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-6 rounded-xl font-bold text-xs text-zinc-950 bg-zinc-100 hover:bg-white active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-white/5 mt-2 flex items-center justify-center"
              >
                Create Task
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </main>
  );
}
