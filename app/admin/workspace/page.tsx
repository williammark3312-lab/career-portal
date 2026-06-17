"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";
import {
  Briefcase, FileText, X, ExternalLink, CheckCircle2, Users, UserPlus,
  ArrowRight, Clock, Trash2, Sparkles, Lock, Search, LogOut, Shield,
  ChevronRight, Mail, Calendar, Check, Layers, AlertCircle, DollarSign,
  Activity, ClipboardList, Plus, Edit2
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

  /* Verification of Recruiter Status */
  const isRecruiter =
    session?.user?.app_metadata?.role === "admin" ||
    session?.user?.user_metadata?.role === "admin" ||
    session?.user?.email === "williammark3312@gmail.com";

  if ((!mounted || authLoading) && !session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white relative overflow-hidden">
        <GlassBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm font-bold text-zinc-400 tracking-wide">Initializing Supervisor Workspace...</p>
        </div>
      </main>
    );
  }

  if (session && !isRecruiter) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#09090b] relative overflow-hidden p-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md border border-rose-955 rounded-[32px] p-10 sm:p-12 bg-zinc-950/80 backdrop-blur-3xl shadow-2xl relative z-10 text-center flex flex-col items-center"
        >
          <div className="w-14 h-14 bg-rose-955/30 border border-rose-900 text-rose-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-3">Access Denied</h1>
          <p className="text-sm text-zinc-400 font-semibold leading-relaxed mb-8">
            You are signed in as <span className="text-blue-400">{session.user.email}</span>. Only supervisor accounts are authorized to access the Workspace.
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

  // Calculate stats values for overview
  const totalFnf = workspace.fnf.length;
  const activeOnboardings = workspace.onboardings.filter(o => o.status !== "Completed").length;
  const pendingClearances = workspace.fnf.filter(f => f.settlementStatus !== "Completed").length;
  const pendingTasks = workspace.tasks.filter(t => t.status !== "Done").length;

  return (
    <main className="min-h-screen bg-[#09090b] text-white relative z-10 flex flex-col lg:flex-row overflow-hidden">
      <GlassBackground />

      {/* ── Desktop Sidebar ── */}
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

          {/* User Profile Info */}
          <div className="bg-zinc-900/40 rounded-xl p-3 border border-zinc-850 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-extrabold text-xs">
              {session?.user?.email?.[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Signed In</p>
              <p className="text-xs font-bold text-zinc-300 truncate" title={session?.user?.email}>{session?.user?.email}</p>
            </div>
          </div>

          {/* Navigation links targeting /admin sub-areas */}
          <nav className="flex flex-col gap-1">
            {([
              { key: "jobs", label: "Openings & Reviews", icon: <Briefcase className="w-4 h-4" />, count: stats.totalJobs, route: "/admin?tab=jobs" },
              { key: "cvs", label: "Talent Index", icon: <FileText className="w-4 h-4" />, count: stats.totalCVs, route: "/admin?tab=cvs" },
              { key: "workspace", label: "Workspace", icon: <Layers className="w-4 h-4" />, count: undefined, route: "/admin/workspace" },
              { key: "users", label: "Supervisor Accounts", icon: <Users className="w-4 h-4" />, count: stats.totalUsers, route: "/admin?tab=users" },
            ] as const).map(t => {
              const isActive = t.key === "workspace";
              return (
                <button
                  key={t.key}
                  onClick={() => router.push(t.route)}
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

        <div className="flex flex-col gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-rose-450 hover:bg-rose-955/20 border border-transparent hover:border-rose-950 transition-all cursor-pointer"
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
            { key: "jobs", label: "Openings", icon: <Briefcase className="w-3.5 h-3.5" />, route: "/admin?tab=jobs" },
            { key: "cvs", label: "Talent Index", icon: <FileText className="w-3.5 h-3.5" />, route: "/admin?tab=cvs" },
            { key: "workspace", label: "Workspace", icon: <Layers className="w-3.5 h-3.5" />, route: "/admin/workspace" },
            { key: "users", label: "Supervisors", icon: <Users className="w-3.5 h-3.5" />, route: "/admin?tab=users" },
          ] as const).map(t => {
            const isActive = t.key === "workspace";
            return (
              <button
                key={t.key}
                onClick={() => router.push(t.route)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all duration-200 ${
                  isActive
                    ? "bg-white text-zinc-955 shadow-sm"
                    : "text-zinc-400 bg-zinc-900 hover:bg-zinc-800"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
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
                <span className="text-zinc-400 font-semibold">Workspace</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-none">
                HR Operations desk
              </h1>
            </div>

            {/* Quick Header buttons based on Active Tab */}
            <div className="flex items-center gap-2">
              {activeTab === "fnf" && (
                <button
                  onClick={() => setShowFnfModal(true)}
                  className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-zinc-950 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Start FNF Process
                </button>
              )}
              {activeTab === "onboarding" && (
                <button
                  onClick={() => setShowOnboardingModal(true)}
                  className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-zinc-950 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" /> Start Onboarding
                </button>
              )}
              {activeTab === "tasks" && (
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-zinc-950 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Create Task
                </button>
              )}
            </div>
          </div>

          {/* Sub Tab selection bar */}
          <div className="flex gap-2 border-b border-zinc-900 pb-3">
            {([
              { id: "overview", label: "Overview", icon: <Activity className="w-3.5 h-3.5" /> },
              { id: "fnf", label: "FNF Settlement", icon: <DollarSign className="w-3.5 h-3.5" /> },
              { id: "onboarding", label: "Onboardings", icon: <UserPlus className="w-3.5 h-3.5" /> },
              { id: "tasks", label: "Tasks Desk", icon: <ClipboardList className="w-3.5 h-3.5" /> },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-zinc-900 text-white border border-zinc-800"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {loadingWorkspace ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-xs text-zinc-500 font-bold">Synchronizing workspace files...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* ─── OVERVIEW TAB ─── */}
              {activeTab === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  <div className="border border-zinc-850/80 rounded-2xl p-5 bg-zinc-950/40 backdrop-blur-md relative overflow-hidden flex flex-col gap-2">
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">Active Onboardings</span>
                    <span className="text-3xl font-extrabold tracking-tight text-white">{activeOnboardings}</span>
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 mt-2">
                      <CheckCircle2 className="w-3 h-3" /> Ready to engage
                    </span>
                  </div>

                  <div className="border border-zinc-850/80 rounded-2xl p-5 bg-zinc-950/40 backdrop-blur-md relative overflow-hidden flex flex-col gap-2">
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">Settlements Handled</span>
                    <span className="text-3xl font-extrabold tracking-tight text-white">{totalFnf}</span>
                    <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3" /> FNF Lifecycle
                    </span>
                  </div>

                  <div className="border border-zinc-850/80 rounded-2xl p-5 bg-zinc-950/40 backdrop-blur-md relative overflow-hidden flex flex-col gap-2">
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">Pending Clearance</span>
                    <span className="text-3xl font-extrabold tracking-tight text-rose-400">{pendingClearances}</span>
                    <span className="text-[10px] font-bold text-rose-400/80 flex items-center gap-1 mt-2">
                      <AlertCircle className="w-3 h-3" /> Action required
                    </span>
                  </div>

                  <div className="border border-zinc-850/80 rounded-2xl p-5 bg-zinc-950/40 backdrop-blur-md relative overflow-hidden flex flex-col gap-2">
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">Operational Tasks</span>
                    <span className="text-3xl font-extrabold tracking-tight text-amber-400">{pendingTasks}</span>
                    <span className="text-[10px] font-bold text-amber-400/85 flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3" /> Assigned to teams
                    </span>
                  </div>

                  {/* Summary lists on Overview page */}
                  <div className="col-span-1 md:col-span-2 border border-zinc-850/60 rounded-3xl p-6 bg-zinc-950/30 backdrop-blur-sm mt-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" /> Recent FNF Clearances
                    </h3>
                    <div className="flex flex-col gap-3">
                      {workspace.fnf.slice(0, 3).map(f => {
                        const cleared = f.tasks.filter(t => t.completed).length;
                        const total = f.tasks.length;
                        return (
                          <div key={f.id} className="flex justify-between items-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-900">
                            <div>
                              <h4 className="text-xs font-bold text-white">{f.employeeName}</h4>
                              <p className="text-[10px] text-zinc-500">{f.department} • Last Day: {f.lastWorkingDay}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-extrabold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                                {cleared}/{total} cleared
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {workspace.fnf.length === 0 && (
                        <p className="text-xs text-zinc-500 py-4 text-center">No resignation clearances recorded.</p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 border border-zinc-850/60 rounded-3xl p-6 bg-zinc-950/30 backdrop-blur-sm mt-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-indigo-400" /> Onboarding Trackers
                    </h3>
                    <div className="flex flex-col gap-3">
                      {workspace.onboardings.slice(0, 3).map(o => {
                        const done = o.tasks.filter(t => t.completed).length;
                        const total = o.tasks.length;
                        return (
                          <div key={o.id} className="flex justify-between items-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-900">
                            <div>
                              <h4 className="text-xs font-bold text-white">{o.candidateName}</h4>
                              <p className="text-[10px] text-zinc-500">{o.role} • Start: {o.startDate}</p>
                            </div>
                            <div className="text-right">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                o.status === "Completed" ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900" : "bg-blue-950/50 text-blue-400 border border-blue-900"
                              }`}>
                                {o.status} ({done}/{total})
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {workspace.onboardings.length === 0 && (
                        <p className="text-xs text-zinc-500 py-4 text-center">No onboarding tracks recorded.</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── FNF SETTLEMENT TAB ─── */}
              {activeTab === "fnf" && (
                <motion.div
                  key="fnf"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold tracking-wider text-zinc-400 uppercase">Resignee Lifecycle</h3>
                  </div>

                  <div className="flex flex-col gap-3">
                    {workspace.fnf.map(f => {
                      const isExpanded = expandedFnf === f.id;
                      const completedCount = f.tasks.filter(t => t.completed).length;
                      const progressPercentage = Math.round((completedCount / f.tasks.length) * 100) || 0;

                      return (
                        <div key={f.id} className="border border-zinc-850 rounded-2xl bg-zinc-950/20 overflow-hidden transition-all duration-300">
                          {/* Main Row summary card */}
                          <div
                            onClick={() => setExpandedFnf(isExpanded ? null : f.id)}
                            className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/40 transition-colors"
                          >
                            <div className="flex flex-col gap-1">
                              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                {f.employeeName}
                                <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                  {f.department}
                                </span>
                              </h4>
                              <p className="text-xs text-zinc-400 flex items-center gap-3">
                                <span>Resigned: {f.resignationDate}</span>
                                <span className="text-zinc-650">•</span>
                                <span>Last Day: {f.lastWorkingDay}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-6">
                              {/* Progress bar */}
                              <div className="flex flex-col gap-1 w-28 md:w-36">
                                <div className="flex justify-between text-[10px] font-bold text-zinc-400">
                                  <span>Clearance</span>
                                  <span>{progressPercentage}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercentage}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                                  f.settlementStatus === "Completed"
                                    ? "bg-emerald-950/40 border-emerald-900 text-emerald-400"
                                    : f.settlementStatus === "Paid"
                                    ? "bg-blue-950/40 border-blue-900 text-blue-400"
                                    : "bg-zinc-900/60 border-zinc-800 text-zinc-400"
                                }`}>
                                  {f.settlementStatus}
                                </span>
                                <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </div>
                            </div>
                          </div>

                          {/* Expanded detail panel */}
                          {isExpanded && (
                            <div className="px-5 pb-5 border-t border-zinc-900 bg-zinc-950/50 flex flex-col gap-6 pt-5 animate-slide-down">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Details & Info */}
                                <div className="flex flex-col gap-4">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Calculated Amount</label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-zinc-400 text-xs">$</span>
                                      <input
                                        type="number"
                                        defaultValue={f.amount}
                                        onBlur={(e) => handleUpdateFnfAmount(f.id, e.target.value)}
                                        className="bg-zinc-900/80 border border-zinc-800 rounded-lg text-white text-sm px-2.5 py-1.5 outline-none focus:border-blue-500 w-28 font-bold"
                                      />
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-1">Updates on blur</p>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Remarks & Notes</label>
                                    <p className="text-xs text-zinc-300 bg-zinc-900/40 border border-zinc-900 rounded-lg p-3 italic">
                                      {f.remarks || "No remarks provided."}
                                    </p>
                                  </div>

                                  <div className="flex flex-col gap-2 mt-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Lifecycle Status</label>
                                    <select
                                      value={f.settlementStatus}
                                      onChange={(e) => handleUpdateFnfStatus(f.id, e.target.value as any)}
                                      className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-white p-2.5 outline-none focus:border-blue-500 w-full"
                                    >
                                      <option value="Draft">Draft (Clearances pending)</option>
                                      <option value="Approved">Approved (Clearances ok)</option>
                                      <option value="Paid">Paid (Finance executed)</option>
                                      <option value="Completed">Completed (Final settlement closed)</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Checklist details */}
                                <div className="md:col-span-2 flex flex-col gap-3">
                                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Clearance checklist</label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                    {f.tasks.map(t => (
                                      <button
                                        key={t.id}
                                        onClick={() => handleToggleFnfTask(f.id, t.id, !t.completed)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                                          t.completed
                                            ? "bg-emerald-950/10 border-emerald-900/40 text-white"
                                            : "bg-zinc-900/30 border-zinc-850 text-zinc-400 hover:border-zinc-700"
                                        }`}
                                      >
                                        <div className={`w-4.5 h-4.5 rounded flex items-center justify-center border ${
                                          t.completed ? "bg-emerald-500 border-emerald-400 text-zinc-950" : "border-zinc-700"
                                        }`}>
                                          {t.completed && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold leading-tight">{t.name}</p>
                                          <span className="text-[9px] font-bold text-zinc-500 uppercase">{t.section}</span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex justify-end mt-4">
                                    <button
                                      onClick={() => handleDeleteFnf(f.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-950 transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete Clearance Lifecycle
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
                      <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                        <p className="text-sm text-zinc-500">No resignation clearances started. Click "Start FNF Process" above to launch one.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── ONBOARDINGS TAB ─── */}
              {activeTab === "onboarding" && (
                <motion.div
                  key="onboarding"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold tracking-wider text-zinc-400 uppercase">Onboarding Trackers</h3>
                  </div>

                  <div className="flex flex-col gap-3">
                    {workspace.onboardings.map(o => {
                      const isExpanded = expandedOnb === o.id;
                      const doneCount = o.tasks.filter(t => t.completed).length;
                      const totalCount = o.tasks.length;
                      const progressPercentage = Math.round((doneCount / totalCount) * 100) || 0;

                      return (
                        <div key={o.id} className="border border-zinc-850 rounded-2xl bg-zinc-950/20 overflow-hidden transition-all duration-300">
                          {/* Title summary row */}
                          <div
                            onClick={() => setExpandedOnb(isExpanded ? null : o.id)}
                            className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/40 transition-colors"
                          >
                            <div className="flex flex-col gap-1">
                              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                {o.candidateName}
                                <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                  {o.role}
                                </span>
                              </h4>
                              <p className="text-xs text-zinc-400 flex items-center gap-3">
                                <span>Start Date: {o.startDate}</span>
                                <span className="text-zinc-650">•</span>
                                <span>Buddy: {o.mentor}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-6">
                              {/* Progress bar */}
                              <div className="flex flex-col gap-1 w-28 md:w-36">
                                <div className="flex justify-between text-[10px] font-bold text-zinc-400">
                                  <span>Task List</span>
                                  <span>{doneCount}/{totalCount}</span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercentage}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                                  o.status === "Completed"
                                    ? "bg-emerald-950/40 border-emerald-900 text-emerald-400"
                                    : o.status === "In Progress"
                                    ? "bg-blue-950/40 border-blue-900 text-blue-400"
                                    : "bg-zinc-900/60 border-zinc-800 text-zinc-400"
                                }`}>
                                  {o.status}
                                </span>
                                <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </div>
                            </div>
                          </div>

                          {/* Expanded detail section */}
                          {isExpanded && (
                            <div className="px-5 pb-5 border-t border-zinc-900 bg-zinc-950/50 flex flex-col gap-6 pt-5 animate-slide-down">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Onboarding details */}
                                <div className="flex flex-col gap-4">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Corporate Email</label>
                                    <div className="text-xs text-white font-mono bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 flex items-center gap-1.5">
                                      <Mail className="w-3.5 h-3.5 text-zinc-500" />
                                      {o.email || "Pending creation"}
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Assigned Mentor</label>
                                    <div className="text-xs text-white bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-zinc-500" />
                                      {o.mentor}
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-2 mt-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Onboarding Status</label>
                                    <select
                                      value={o.status}
                                      onChange={(e) => handleUpdateOnbStatus(o.id, e.target.value as any)}
                                      className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-white p-2.5 outline-none focus:border-blue-500 w-full"
                                    >
                                      <option value="Not Started">Not Started</option>
                                      <option value="In Progress">In Progress</option>
                                      <option value="Completed">Completed</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Task Checklist */}
                                <div className="md:col-span-2 flex flex-col gap-3">
                                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Onboarding checklist</label>
                                  <div className="flex flex-col gap-2 mt-1">
                                    {o.tasks.map(t => (
                                      <button
                                        key={t.id}
                                        onClick={() => handleToggleOnbTask(o.id, t.id, !t.completed)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                                          t.completed
                                            ? "bg-indigo-950/10 border-indigo-900/40 text-white"
                                            : "bg-zinc-900/30 border-zinc-850 text-zinc-400 hover:border-zinc-700"
                                        }`}
                                      >
                                        <div className={`w-4.5 h-4.5 rounded flex items-center justify-center border ${
                                          t.completed ? "bg-indigo-500 border-indigo-400 text-white" : "border-zinc-700"
                                        }`}>
                                          {t.completed && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <span className="text-xs font-bold">{t.name}</span>
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex justify-end mt-4">
                                    <button
                                      onClick={() => handleDeleteOnboarding(o.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-955/20 border border-transparent hover:border-rose-950 transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Remove Onboarding Record
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
                      <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                        <p className="text-sm text-zinc-500">No candidate onboardings configured. Click "Start Onboarding" above.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── TASKS DESK TAB ─── */}
              {activeTab === "tasks" && (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold tracking-wider text-zinc-400 uppercase font-mono">Operations Tasks Checklist</h3>
                  </div>

                  {/* Columns for Task Board */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* TO DO COLUMN */}
                    <div className="flex flex-col gap-3 bg-zinc-950/20 border border-zinc-900 rounded-2xl p-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-1">
                        <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-zinc-600" /> To Do
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-900 text-zinc-500">
                          {workspace.tasks.filter(t => t.status === "To Do").length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        {workspace.tasks.filter(t => t.status === "To Do").map(t => (
                          <div key={t.id} className="p-4 border border-zinc-850 rounded-xl bg-zinc-900/20 flex flex-col gap-3 hover:border-zinc-800 transition-colors">
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] font-extrabold uppercase tracking-widest text-blue-400">{t.category}</span>
                              <h4 className="text-xs font-bold text-white leading-tight">{t.title}</h4>
                            </div>
                            <div className="flex flex-col gap-1.5 border-t border-zinc-900/60 pt-2.5 text-[10px] text-zinc-400 font-semibold">
                              <p className="truncate">Assigned: {t.assignedTo}</p>
                              <p>Due: {t.dueDate}</p>
                            </div>
                            <div className="flex items-center justify-between border-t border-zinc-900/60 pt-2.5">
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                t.priority === "High" ? "bg-rose-950/50 text-rose-400 border border-rose-900" : t.priority === "Medium" ? "bg-amber-950/50 text-amber-400 border border-amber-900" : "bg-zinc-900 text-zinc-500"
                              }`}>
                                {t.priority}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleUpdateTaskStatus(t.id, "In Progress")}
                                  className="text-[9px] font-bold text-blue-400 hover:text-blue-300 bg-blue-950/40 border border-blue-900/60 px-2 py-0.5 rounded cursor-pointer"
                                >
                                  Start
                                </button>
                                <button onClick={() => handleDeleteTask(t.id)} className="text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* IN PROGRESS COLUMN */}
                    <div className="flex flex-col gap-3 bg-zinc-950/20 border border-zinc-900 rounded-2xl p-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-1">
                        <span className="text-xs font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" /> In Progress
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-900 text-zinc-500">
                          {workspace.tasks.filter(t => t.status === "In Progress").length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        {workspace.tasks.filter(t => t.status === "In Progress").map(t => (
                          <div key={t.id} className="p-4 border border-zinc-800 rounded-xl bg-zinc-900/40 flex flex-col gap-3 hover:border-zinc-750 transition-colors">
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] font-extrabold uppercase tracking-widest text-blue-400">{t.category}</span>
                              <h4 className="text-xs font-bold text-white leading-tight">{t.title}</h4>
                            </div>
                            <div className="flex flex-col gap-1.5 border-t border-zinc-900/60 pt-2.5 text-[10px] text-zinc-400 font-semibold">
                              <p className="truncate">Assigned: {t.assignedTo}</p>
                              <p>Due: {t.dueDate}</p>
                            </div>
                            <div className="flex items-center justify-between border-t border-zinc-900/60 pt-2.5">
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                t.priority === "High" ? "bg-rose-950/50 text-rose-400 border border-rose-900" : t.priority === "Medium" ? "bg-amber-950/50 text-amber-400 border border-amber-900" : "bg-zinc-900 text-zinc-500"
                              }`}>
                                {t.priority}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleUpdateTaskStatus(t.id, "Done")}
                                  className="text-[9px] font-bold text-emerald-450 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.5 rounded cursor-pointer"
                                >
                                  Complete
                                </button>
                                <button onClick={() => handleDeleteTask(t.id)} className="text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* DONE COLUMN */}
                    <div className="flex flex-col gap-3 bg-zinc-950/20 border border-zinc-900 rounded-2xl p-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-1">
                        <span className="text-xs font-extrabold text-emerald-450 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Completed
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-900 text-zinc-500">
                          {workspace.tasks.filter(t => t.status === "Done").length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        {workspace.tasks.filter(t => t.status === "Done").map(t => (
                          <div key={t.id} className="p-4 border border-zinc-900 rounded-xl bg-zinc-950/30 flex flex-col gap-3 hover:border-zinc-800 transition-colors opacity-75">
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] font-extrabold uppercase tracking-widest text-zinc-500">{t.category}</span>
                              <h4 className="text-xs font-bold text-zinc-400 line-through leading-tight">{t.title}</h4>
                            </div>
                            <div className="flex flex-col gap-1.5 border-t border-zinc-900/60 pt-2.5 text-[10px] text-zinc-500 font-semibold">
                              <p className="truncate">Assigned: {t.assignedTo}</p>
                              <p>Due: {t.dueDate}</p>
                            </div>
                            <div className="flex items-center justify-between border-t border-zinc-900/60 pt-2.5">
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-600">
                                {t.priority}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleUpdateTaskStatus(t.id, "To Do")}
                                  className="text-[9px] font-bold text-zinc-400 hover:text-zinc-350 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded cursor-pointer"
                                >
                                  Reopen
                                </button>
                                <button onClick={() => handleDeleteTask(t.id)} className="text-zinc-500 hover:text-rose-450 transition-colors cursor-pointer">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ─── FNF LAUNCH MODAL ─── */}
      {showFnfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#000]/60 backdrop-blur-sm" onClick={() => setShowFnfModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#09090b] border border-zinc-800 rounded-3xl p-8 max-w-lg w-full relative z-10 shadow-2xl flex flex-col gap-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white tracking-tight">Launch FNF Settlement</h3>
              <button onClick={() => setShowFnfModal(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddFnf} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={fnfForm.employeeName}
                  onChange={(e) => setFnfForm({ ...fnfForm, employeeName: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Department</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Technology"
                  value={fnfForm.department}
                  onChange={(e) => setFnfForm({ ...fnfForm, department: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Resignation Date</label>
                  <input
                    type="date"
                    required
                    value={fnfForm.resignationDate}
                    onChange={(e) => setFnfForm({ ...fnfForm, resignationDate: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Last Working Day</label>
                  <input
                    type="date"
                    required
                    value={fnfForm.lastWorkingDay}
                    onChange={(e) => setFnfForm({ ...fnfForm, lastWorkingDay: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Settlement Amount ($)</label>
                <input
                  type="number"
                  placeholder="Estimated settlement value"
                  value={fnfForm.amount}
                  onChange={(e) => setFnfForm({ ...fnfForm, amount: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Remarks</label>
                <textarea
                  placeholder="Notes on resignation details"
                  value={fnfForm.remarks}
                  onChange={(e) => setFnfForm({ ...fnfForm, remarks: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors h-20 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-white hover:bg-zinc-150 text-zinc-950 font-bold py-3.5 rounded-xl text-xs tracking-wide active:scale-[0.98] transition-all cursor-pointer shadow-lg mt-2"
              >
                Initiate FNF Protocol
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─── ONBOARDING LAUNCH MODAL ─── */}
      {showOnboardingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#000]/60 backdrop-blur-sm" onClick={() => setShowOnboardingModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#09090b] border border-zinc-800 rounded-3xl p-8 max-w-lg w-full relative z-10 shadow-2xl flex flex-col gap-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white tracking-tight">Initiate Onboarding Tracker</h3>
              <button onClick={() => setShowOnboardingModal(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddOnboarding} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Candidate Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alice Cooper"
                  value={onbForm.candidateName}
                  onChange={(e) => setOnbForm({ ...onbForm, candidateName: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Job Role Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior DevOps Specialist"
                  value={onbForm.role}
                  onChange={(e) => setOnbForm({ ...onbForm, role: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Corporate Email address</label>
                <input
                  type="email"
                  placeholder="e.g. alice.cooper@company.com"
                  value={onbForm.email}
                  onChange={(e) => setOnbForm({ ...onbForm, email: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Scheduled Start Date</label>
                  <input
                    type="date"
                    required
                    value={onbForm.startDate}
                    onChange={(e) => setOnbForm({ ...onbForm, startDate: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Onboarding Mentor / Buddy</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Jenkins"
                    value={onbForm.mentor}
                    onChange={(e) => setOnbForm({ ...onbForm, mentor: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-white hover:bg-zinc-150 text-zinc-950 font-bold py-3.5 rounded-xl text-xs tracking-wide active:scale-[0.98] transition-all cursor-pointer shadow-lg mt-2"
              >
                Launch Onboarding Track
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─── TASK ADD MODAL ─── */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#000]/60 backdrop-blur-sm" onClick={() => setShowTaskModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#09090b] border border-zinc-800 rounded-3xl p-8 max-w-lg w-full relative z-10 shadow-2xl flex flex-col gap-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white tracking-tight">Create Operations Task</h3>
              <button onClick={() => setShowTaskModal(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddTask} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Revoke AWS IAM credentials for resigning engineer"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Assigned To (Name)</label>
                <input
                  type="text"
                  placeholder="e.g. HR Admin / IT Team"
                  value={taskForm.assignedTo}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Category</label>
                  <select
                    value={taskForm.category}
                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value as any })}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
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
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-white hover:bg-zinc-150 text-zinc-950 font-bold py-3.5 rounded-xl text-xs tracking-wide active:scale-[0.98] transition-all cursor-pointer shadow-lg mt-2"
              >
                Provision Task Check
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </main>
  );
}
