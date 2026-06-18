"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";
import {
  Briefcase, FileText, X, ChevronRight, Mail, Calendar, Check, Layers,
  AlertCircle, DollarSign, Activity, Users, UserPlus, Trash2, Plus, Clock,
  Shield, ClipboardList, LogOut
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Header from "../../../src/components/Header";
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

  const [mounted, setMounted] = useState(false);

  /* Excel Export function */
  const exportToExcel = (data: any[], filename: string) => {
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

  useEffect(() => {
    setMounted(true);
  }, []);

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
    title: "", assignedTo: "", dueDate: "", priority: "Medium" as "Low" | "Medium" | "High", category: "General" as any
  });

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
      const res = await fetch("/api/workspace");
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data);
      }
    } catch (err) {
      console.error("Error fetching workspace data:", err);
    } finally {
      setLoadingWorkspace(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin");
  }

  /* API mutator helper */
  async function triggerWorkspaceAction(action: string, payload: any) {
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload })
      });
      if (res.ok) {
        const updatedData = await res.json();
        setWorkspace(updatedData);
      } else {
        const errJson = await res.json();
        alert("Operation failed: " + (errJson.error || "Unknown error"));
      }
    } catch (err) {
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

  const handleUpdateFnfStatus = async (id: string, status: any) => {
    await triggerWorkspaceAction("update_fnf", { id, settlementStatus: status });
  };

  const handleUpdateFnfAmount = async (id: string, amount: string) => {
    await triggerWorkspaceAction("update_fnf", { id, amount });
  };

  const handleToggleFnfTask = async (fnfId: string, taskId: string, completed: boolean) => {
    await triggerWorkspaceAction("toggle_fnf_task", { fnfId, taskId, completed });
  };

  const handleDeleteFnf = async (id: string) => {
    if (!confirm("Are you sure you want to cancel/delete this FNF record?")) return;
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

  const handleUpdateOnbStatus = async (id: string, status: any) => {
    await triggerWorkspaceAction("update_onboarding", { id, status });
  };

  const handleToggleOnbTask = async (onboardingId: string, taskId: string, completed: boolean) => {
    await triggerWorkspaceAction("toggle_onboarding_task", { onboardingId, taskId, completed });
  };

  const handleDeleteOnboarding = async (id: string) => {
    if (!confirm("Are you sure you want to delete this onboarding process?")) return;
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

  const handleUpdateTaskStatus = async (id: string, status: any) => {
    await triggerWorkspaceAction("update_task", { id, status });
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await triggerWorkspaceAction("delete_task", { id });
  };

  const isRecruiter =
    session?.user?.app_metadata?.role === "admin" ||
    session?.user?.user_metadata?.role === "admin" ||
    session?.user?.email === "williammark3312@gmail.com";

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
    <main className="min-h-screen bg-[#050505] text-white relative z-10 flex flex-col lg:flex-row overflow-hidden font-sans">
      <GlassBackground />
      {/* subtle dot-grid texture */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_-20%,rgba(99,102,241,0.02),transparent)] pointer-events-none z-0" />

      {/* ── Premium Sidebar ── */}
      <aside className="admin-sidebar w-[260px] hidden lg:flex flex-col justify-between py-6 px-4 fixed h-screen z-20">
        <div className="flex flex-col gap-7">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 cursor-pointer" onClick={() => router.push("/jobs")}>
            <div className="admin-logo-mark">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-[14px] font-700 text-white tracking-tight leading-none">Antigravity</h1>
              <span className="text-[9px] font-600 text-zinc-500 uppercase tracking-[0.12em] mt-0.5 block">Workspace</span>
            </div>
          </div>

          {/* User card */}
          <div className="px-2">
            <div className="rounded-xl p-3 flex items-center gap-3" style={{background:'var(--s-muted)',border:'1px solid var(--b-subtle)'}}>
              <div className="admin-avatar">{session?.user?.email?.[0].toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-600 text-zinc-500 uppercase tracking-widest">Signed in as</p>
                <p className="text-xs font-600 text-zinc-300 truncate mt-0.5" title={session?.user?.email}>{session?.user?.email}</p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:'#059669',boxShadow:'0 0 5px rgba(5,150,105,0.6)'}} />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-0.5 px-1">
            <p className="text-[9px] font-700 text-zinc-500 uppercase tracking-[0.12em] px-3 mb-2">Navigation</p>
            {([
              { key: "jobs",      label: "Openings & Reviews", icon: <Briefcase className="w-[15px] h-[15px]" />, count: stats.totalJobs,  route: "/admin?tab=jobs" },
              { key: "cvs",       label: "Talent Index",       icon: <FileText  className="w-[15px] h-[15px]" />, count: stats.totalCVs,  route: "/admin?tab=cvs" },
              { key: "workspace", label: "Workspace",           icon: <Layers    className="w-[15px] h-[15px]" />, count: undefined,       route: "/admin/workspace" },
              { key: "users",     label: "Supervisor Accounts", icon: <Users     className="w-[15px] h-[15px]" />, count: stats.totalUsers, route: "/admin?tab=users" },
            ] as const).map(t => {
              const isActive = t.key === "workspace";
              return (
                <button key={t.key} onClick={() => router.push(t.route)} className={`admin-nav-item ${isActive ? "active" : ""}`}>
                  <div className="flex items-center gap-2.5 nav-icon">{t.icon}<span>{t.label}</span></div>
                  {t.count !== undefined && <span className="nav-badge">{t.count}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-3 px-1">
          <div className="divider-glow" />
          <button onClick={handleLogout} className="admin-nav-item text-rose-500 hover:text-rose-400 hover:bg-rose-955/20">
            <div className="flex items-center gap-2.5"><LogOut className="w-[15px] h-[15px]" /><span>Sign Out</span></div>
          </button>
          <p className="text-[9px] text-zinc-650 font-600 px-3">© {new Date().getFullYear()} Antigravity</p>
        </div>
      </aside>

      {/* ── Mobile Layout header ── */}
      <div className="lg:hidden w-full relative z-30">
        <Header session={session} handleLogout={handleLogout} />
        <div className="bg-zinc-950 border-b border-zinc-900 px-4 py-2 flex gap-1 overflow-x-auto">
          {([
            { key: "jobs",      label: "Openings",   icon: <Briefcase className="w-3.5 h-3.5" />, route: "/admin?tab=jobs" },
            { key: "cvs",       label: "Talent Index",icon: <FileText  className="w-3.5 h-3.5" />, route: "/admin?tab=cvs" },
            { key: "workspace", label: "Workspace",   icon: <Layers    className="w-3.5 h-3.5" />, route: "/admin/workspace" },
            { key: "users",     label: "Supervisors", icon: <Users     className="w-3.5 h-3.5" />, route: "/admin?tab=users" },
          ] as const).map(t => {
            const isActive = t.key === "workspace";
            return (
              <button key={t.key} onClick={() => router.push(t.route)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-600 whitespace-nowrap cursor-pointer transition-all ${
                  isActive ? "bg-white text-black font-bold shadow-sm" : "text-zinc-400 bg-zinc-900/40 hover:bg-zinc-900"
                }`}>
                {t.icon}{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content pane ── */}
      <div className="flex-1 lg:ml-[260px] min-h-screen flex flex-col px-5 sm:px-8 lg:px-10 py-8 relative z-10 pt-20 lg:pt-8 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto flex flex-col gap-6 flex-grow pb-16">
          
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-5 pb-6 border-b border-zinc-900">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-600 text-zinc-500 uppercase tracking-[0.1em]">
                <span>Console</span><span>›</span><span>Workspace</span>
              </div>
              <h1 className="text-[22px] font-700 text-white tracking-tight leading-none">HR Operations Desk</h1>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === "fnf" && (
                <>
                  <button onClick={handleExportFnf} className="px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    Export to Excel
                  </button>
                  <button onClick={() => setShowFnfModal(true)} className="btn-cta">
                    <Plus className="w-3.5 h-3.5" /> Start FNF
                  </button>
                </>
              )}
              {activeTab === "onboarding" && (
                <>
                  <button onClick={handleExportOnboarding} className="px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    Export to Excel
                  </button>
                  <button onClick={() => setShowOnboardingModal(true)} className="btn-cta">
                    <UserPlus className="w-3.5 h-3.5" /> Start Onboarding
                  </button>
                </>
              )}
              {activeTab === "tasks" && (
                <>
                  <button onClick={handleExportTasks} className="px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer">
                    Export to Excel
                  </button>
                  <button onClick={() => setShowTaskModal(true)} className="btn-cta">
                    <Plus className="w-3.5 h-3.5" /> Create Task
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sub Tab bar */}
          <div className="flex gap-1 pb-1">
            {([
              { id: "overview",   label: "Overview",       icon: <Activity      className="w-3.5 h-3.5" /> },
              { id: "fnf",        label: "FNF Settlement", icon: <DollarSign    className="w-3.5 h-3.5" /> },
              { id: "onboarding", label: "Onboardings",    icon: <UserPlus      className="w-3.5 h-3.5" /> },
              { id: "tasks",      label: "Tasks Desk",     icon: <ClipboardList className="w-3.5 h-3.5" /> },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-600 transition-all cursor-pointer border ${
                  activeTab === tab.id
                    ? "bg-white text-black border-white"
                    : "text-zinc-400 hover:text-white border-zinc-900 hover:bg-zinc-900/60"
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {loadingWorkspace ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-5 h-5 border-2 border-zinc-800 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Loading files...</p>
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
                    { label: "Active Onboardings", value: activeOnboardings, desc: "Ready to engage", accent: "accent-indigo" },
                    { label: "Settlements Handled", value: totalFnf, desc: "Lifecycle logs", accent: "" },
                    { label: "Pending Clearance", value: pendingClearances, desc: "Needs evaluation", accent: "accent-rose" },
                    { label: "Operational Tasks", value: pendingTasks, desc: "Open directives", accent: "accent-amber" }
                  ].map((stat, idx) => (
                    <div key={idx} className={`stat-card ${stat.accent}`}>
                      <div className="stat-label">{stat.label}</div>
                      <div className="stat-value">{stat.value}</div>
                      <div className="text-[9px] font-bold text-zinc-500 mt-1.5 uppercase tracking-wide">{stat.desc}</div>
                    </div>
                  ))}

                  {/* Summary lists on Overview page */}
                  <div className="col-span-1 md:col-span-2 border border-zinc-900 bg-zinc-950/20 rounded-xl p-5 shadow-sm mt-2">
                    <div className="flex justify-between items-center mb-3.5">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" /> Recent FNF Clearances
                      </h3>
                      <button onClick={handleExportFnf} className="px-2 py-1 rounded border border-zinc-800 bg-zinc-950 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer">
                        Export FNF
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {workspace.fnf.slice(0, 3).map(f => {
                        const cleared = f.tasks.filter(t => t.completed).length;
                        const total = f.tasks.length;
                        return (
                          <div key={f.id} className="flex justify-between items-center py-2.5 px-3 rounded-lg border border-zinc-900 bg-zinc-900/40 text-xs">
                            <div>
                              <h4 className="font-bold text-white">{f.employeeName}</h4>
                              <p className="text-[9px] font-600 uppercase text-zinc-400 mt-0.5">{f.department} • LWD: {f.lastWorkingDay}</p>
                            </div>
                            <span className="text-[9px] font-bold text-zinc-400 bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded">
                              {cleared}/{total} cleared
                            </span>
                          </div>
                        );
                      })}
                      {workspace.fnf.length === 0 && (
                        <p className="text-[11px] text-zinc-500 italic py-4 text-center">No resignation clearances recorded.</p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 border border-zinc-900 bg-zinc-950/20 rounded-xl p-5 shadow-sm mt-2">
                    <div className="flex justify-between items-center mb-3.5">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5 text-zinc-500" /> Onboarding Trackers
                      </h3>
                      <button onClick={handleExportOnboarding} className="px-2 py-1 rounded border border-zinc-800 bg-zinc-950 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer">
                        Export Onboarding
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {workspace.onboardings.slice(0, 3).map(o => {
                        const done = o.tasks.filter(t => t.completed).length;
                        const total = o.tasks.length;
                        return (
                          <div key={o.id} className="flex justify-between items-center py-2.5 px-3 rounded-lg border border-zinc-900 bg-zinc-900/40 text-xs">
                            <div>
                              <h4 className="font-bold text-white">{o.candidateName}</h4>
                              <p className="text-[9px] font-600 uppercase text-zinc-400 mt-0.5">{o.role} • Start: {o.startDate}</p>
                            </div>
                            <span className="text-[9px] font-bold text-zinc-400 bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded">
                              {o.status} ({done}/{total})
                            </span>
                          </div>
                        );
                      })}
                      {workspace.onboardings.length === 0 && (
                        <p className="text-[11px] text-zinc-500 italic py-4 text-center">No onboarding tracks recorded.</p>
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
                  <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden shadow-sm">
                    {workspace.fnf.map(f => {
                      const isExpanded = expandedFnf === f.id;
                      const completedCount = f.tasks.filter(t => t.completed).length;
                      const totalCount = f.tasks.length;

                      const dotColor = f.settlementStatus === "Completed" ? "var(--green)" : f.settlementStatus === "Paid" ? "var(--a-500)" : "var(--t-muted)";

                      return (
                        <div key={f.id} className="w-full border-b border-zinc-900 last:border-b-0">
                          {/* Row Summary */}
                          <div
                            onClick={() => setExpandedFnf(isExpanded ? null : f.id)}
                            className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-zinc-900/40 transition-colors"
                          >
                            <div className="flex flex-col">
                              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                {f.employeeName}
                                <span className="text-[9px] font-bold text-zinc-355 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                                  {f.department}
                                </span>
                              </h4>
                              <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-2">
                                <span>Resigned: {f.resignationDate}</span>
                                <span>•</span>
                                <span>LWD: {f.lastWorkingDay}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-5">
                              <span className="text-[10px] font-semibold text-zinc-400">
                                {completedCount}/{totalCount} Cleared
                              </span>
                              
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5">
                                  <span style={{ backgroundColor: dotColor }} className="w-1.5 h-1.5 rounded-full" />
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{f.settlementStatus}</span>
                                </span>
                                <ChevronRight className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </div>
                            </div>
                          </div>

                          {/* Expanded clearances */}
                          {isExpanded && (
                            <div className="px-4 pb-5 pt-3 border-t border-zinc-900 bg-zinc-955/40 flex flex-col gap-5">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="flex flex-col gap-4 text-xs">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Settlement Value (₹)</span>
                                    <input
                                      type="number"
                                      defaultValue={f.amount}
                                      onBlur={(e) => handleUpdateFnfAmount(f.id, e.target.value)}
                                      className="admin-input mt-1 w-32"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Status Protocol</span>
                                    <select
                                      value={f.settlementStatus}
                                      onChange={(e) => handleUpdateFnfStatus(f.id, e.target.value as any)}
                                      className="admin-input mt-1"
                                    >
                                      <option value="Draft">Draft (Clearances pending)</option>
                                      <option value="Approved">Approved (Clearances ok)</option>
                                      <option value="Paid">Paid (Finance executed)</option>
                                      <option value="Completed">Completed (Settlement closed)</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="md:col-span-2 flex flex-col gap-3">
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Clearance checklist</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {f.tasks.map(t => (
                                      <button
                                        key={t.id}
                                        onClick={() => handleToggleFnfTask(f.id, t.id, !t.completed)}
                                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                                          t.completed
                                            ? "bg-indigo-955/20 border-indigo-900/50 text-indigo-400"
                                            : "bg-zinc-900/60 border-zinc-855 text-zinc-400 hover:border-zinc-700"
                                        }`}
                                      >
                                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                                          t.completed ? "bg-indigo-600 border-transparent text-white" : "border-zinc-700"
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
                                      onClick={() => handleDeleteFnf(f.id)}
                                      className="btn-danger"
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
                  <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden shadow-sm">
                    {workspace.onboardings.map(o => {
                      const isExpanded = expandedOnb === o.id;
                      const doneCount = o.tasks.filter(t => t.completed).length;
                      const totalCount = o.tasks.length;

                      const dotColor = o.status === "Completed" ? "var(--green)" : o.status === "In Progress" ? "var(--a-500)" : "var(--t-muted)";

                      return (
                        <div key={o.id} className="w-full border-b border-zinc-900 last:border-b-0">
                          {/* Row Summary */}
                          <div
                            onClick={() => setExpandedOnb(isExpanded ? null : o.id)}
                            className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-zinc-900/40 transition-colors"
                          >
                            <div className="flex flex-col">
                              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                {o.candidateName}
                                <span className="text-[9px] font-bold text-zinc-350 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                                  {o.role}
                                </span>
                              </h4>
                              <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-2">
                                <span>Start: {o.startDate}</span>
                                <span>•</span>
                                <span>Mentor: {o.mentor}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-5">
                              <span className="text-[10px] font-semibold text-zinc-400">
                                {doneCount}/{totalCount} Done
                              </span>
                              
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5">
                                  <span style={{ backgroundColor: dotColor }} className="w-1.5 h-1.5 rounded-full" />
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{o.status}</span>
                                </span>
                                <ChevronRight className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </div>
                            </div>
                          </div>

                          {/* Expanded checklists */}
                          {isExpanded && (
                            <div className="px-4 pb-5 pt-3 border-t border-zinc-900 bg-zinc-950/40 flex flex-col gap-5">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="flex flex-col gap-4 text-xs">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Email Address</span>
                                    <div className="text-[11px] text-zinc-400 font-mono mt-1 pr-2 truncate">
                                      {o.email || "Pending registration"}
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Status Select</span>
                                    <select
                                      value={o.status}
                                      onChange={(e) => handleUpdateOnbStatus(o.id, e.target.value as any)}
                                      className="admin-input mt-1"
                                    >
                                      <option value="Not Started">Not Started</option>
                                      <option value="In Progress">In Progress</option>
                                      <option value="Completed">Completed</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="md:col-span-2 flex flex-col gap-3">
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Onboarding checklist</span>
                                  <div className="flex flex-col gap-1.5">
                                    {o.tasks.map(t => (
                                      <button
                                        key={t.id}
                                        onClick={() => handleToggleOnbTask(o.id, t.id, !t.completed)}
                                        className={`flex items-center gap-3 p-2 rounded-lg border text-left transition-colors ${
                                          t.completed
                                            ? "bg-indigo-955/20 border-indigo-900/50 text-indigo-400"
                                            : "bg-zinc-900/60 border-zinc-855 text-zinc-400 hover:border-zinc-700"
                                        }`}
                                      >
                                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                                          t.completed ? "bg-indigo-600 border-transparent text-white" : "border-zinc-700"
                                        }`}>
                                          {t.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                        </div>
                                        <span className="text-[11px] font-semibold">{t.name}</span>
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex justify-end mt-4">
                                    <button
                                      onClick={() => handleDeleteOnboarding(o.id)}
                                      className="btn-danger"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Remove tracker
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {workspace.onboardings.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-xs text-zinc-500">No candidate onboarding guides active.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── TASKS DESK TAB ─── */}
              {activeTab === "tasks" && (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                  {/* Columns */}
                  {[
                    { title: "To Do", key: "To Do", dot: "bg-zinc-500" },
                    { title: "In Progress", key: "In Progress", dot: "bg-indigo-500" },
                    { title: "Completed", key: "Done", dot: "bg-emerald-500" }
                  ].map(col => (
                    <div key={col.title} className="flex flex-col gap-3 bg-zinc-950/20 border border-zinc-900 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} /> {col.title}
                        </span>
                        <span>{workspace.tasks.filter(t => t.status === col.key).length}</span>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {workspace.tasks.filter(t => t.status === col.key).map(t => (
                          <div key={t.id} className="p-3 border border-zinc-900 bg-zinc-900/40 rounded-lg flex flex-col gap-2.5 hover:border-zinc-700 transition-colors">
                            <div>
                              <span className="text-[8px] font-extrabold uppercase tracking-widest text-zinc-500">{t.category}</span>
                              <h4 className={`text-xs font-bold text-white mt-0.5 leading-tight ${t.status === "Done" ? "line-through text-zinc-500" : ""}`}>
                                {t.title}
                              </h4>
                            </div>
                            
                            <div className="text-[9px] text-zinc-400 border-t border-zinc-900 pt-2 flex flex-col gap-0.5 uppercase tracking-wide">
                              <span>User: {t.assignedTo}</span>
                              <span>Due: {t.dueDate}</span>
                            </div>

                            <div className="flex items-center justify-between border-t border-zinc-900 pt-2 text-[9px] font-bold">
                              <span className="text-zinc-500 uppercase tracking-wide">{t.priority} priority</span>
                              <div className="flex items-center gap-1.5">
                                {t.status === "To Do" && (
                                  <button
                                    onClick={() => handleUpdateTaskStatus(t.id, "In Progress")}
                                    className="text-[9px] font-bold text-indigo-400 hover:bg-indigo-950/30 border border-transparent px-1.5 py-0.5 rounded cursor-pointer"
                                  >
                                    Start
                                  </button>
                                )}
                                {t.status === "In Progress" && (
                                  <button
                                    onClick={() => handleUpdateTaskStatus(t.id, "Done")}
                                    className="text-[9px] font-bold text-emerald-400 hover:bg-emerald-955/30 border border-transparent px-1.5 py-0.5 rounded cursor-pointer"
                                  >
                                    Finish
                                  </button>
                                )}
                                {t.status === "Done" && (
                                  <button
                                    onClick={() => handleUpdateTaskStatus(t.id, "To Do")}
                                    className="text-[9px] font-bold text-zinc-450 hover:bg-zinc-900 border border-transparent px-1.5 py-0.5 rounded cursor-pointer"
                                  >
                                    Reopen
                                  </button>
                                )}
                                <button onClick={() => handleDeleteTask(t.id)} className="text-zinc-500 hover:text-rose-400 cursor-pointer transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {workspace.tasks.filter(t => t.status === col.key).length === 0 && (
                          <div className="text-center py-6 border border-dashed border-zinc-900 rounded-lg">
                            <p className="text-[10px] text-zinc-550 italic">No tasks in column</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ─── FNF LAUNCH MODAL ─── */}
      {showFnfModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowFnfModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="admin-modal p-6 max-w-sm flex flex-col gap-5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Start FNF Process</h3>
              <button onClick={() => setShowFnfModal(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddFnf} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Employee Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={fnfForm.employeeName}
                  onChange={(e) => setFnfForm({ ...fnfForm, employeeName: e.target.value })}
                  className="admin-input mt-1"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Department</label>
                <input
                  type="text"
                  required
                  placeholder="Technology"
                  value={fnfForm.department}
                  onChange={(e) => setFnfForm({ ...fnfForm, department: e.target.value })}
                  className="admin-input mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Resignation</label>
                  <input
                    type="date"
                    required
                    value={fnfForm.resignationDate}
                    onChange={(e) => setFnfForm({ ...fnfForm, resignationDate: e.target.value })}
                    className="admin-input mt-1"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Last Day</label>
                  <input
                    type="date"
                    required
                    value={fnfForm.lastWorkingDay}
                    onChange={(e) => setFnfForm({ ...fnfForm, lastWorkingDay: e.target.value })}
                    className="admin-input mt-1"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Settlement Estimate (₹)</label>
                <input
                  type="number"
                  placeholder="8500"
                  value={fnfForm.amount}
                  onChange={(e) => setFnfForm({ ...fnfForm, amount: e.target.value })}
                  className="admin-input mt-1"
                />
              </div>

              <button
                type="submit"
                className="btn-cta w-full justify-center mt-2"
              >
                Initiate FNF Process
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─── ONBOARDING LAUNCH MODAL ─── */}
      {showOnboardingModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowOnboardingModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="admin-modal p-6 max-w-sm flex flex-col gap-5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Start Onboarding</h3>
              <button onClick={() => setShowOnboardingModal(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddOnboarding} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Candidate Name</label>
                <input
                  type="text"
                  required
                  placeholder="Alice Cooper"
                  value={onbForm.candidateName}
                  onChange={(e) => setOnbForm({ ...onbForm, candidateName: e.target.value })}
                  className="admin-input mt-1"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Role Title</label>
                <input
                  type="text"
                  required
                  placeholder="DevOps Specialist"
                  value={onbForm.role}
                  onChange={(e) => setOnbForm({ ...onbForm, role: e.target.value })}
                  className="admin-input mt-1"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Corporate Email</label>
                <input
                  type="email"
                  placeholder="alice@company.com"
                  value={onbForm.email}
                  onChange={(e) => setOnbForm({ ...onbForm, email: e.target.value })}
                  className="admin-input mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    required
                    value={onbForm.startDate}
                    onChange={(e) => setOnbForm({ ...onbForm, startDate: e.target.value })}
                    className="admin-input mt-1"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Assigned Mentor</label>
                  <input
                    type="text"
                    placeholder="Emma Watson"
                    value={onbForm.mentor}
                    onChange={(e) => setOnbForm({ ...onbForm, mentor: e.target.value })}
                    className="admin-input mt-1"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-cta w-full justify-center mt-2"
              >
                Launch Onboarding Track
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─── TASK ADD MODAL ─── */}
      {showTaskModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowTaskModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="admin-modal p-6 max-w-sm flex flex-col gap-5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Create Task</h3>
              <button onClick={() => setShowTaskModal(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddTask} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="Revoke credentials..."
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="admin-input mt-1"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Assignee</label>
                <input
                  type="text"
                  placeholder="IT Team"
                  value={taskForm.assignedTo}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                  className="admin-input mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="admin-input mt-1"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Category</label>
                  <select
                    value={taskForm.category}
                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value as any })}
                    className="admin-input mt-1"
                  >
                    <option value="General">General Ops</option>
                    <option value="Onboarding">Onboarding</option>
                    <option value="FNF">FNF Clearance</option>
                    <option value="Recruitment">Recruitment</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Priority Level</label>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                  className="admin-input mt-1"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn-cta w-full justify-center mt-2"
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
