"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";
import { playPleasantLoginSound } from "../../../src/lib/audio";
import {
  X, ChevronRight, Check,
  UserPlus, Trash2, Plus, Clock,
  Shield, ClipboardList, Search,
  List, Kanban, ChevronDown, CheckCircle2,
  AlertCircle, Sparkles, RefreshCw, UserCheck,
  Play, RotateCcw, CheckSquare, Square,
  Bell, BellRing, Volume2
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
  dueTime?: string;
  notified?: boolean;
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
  dueTime?: string;
  notified?: boolean;
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
  dueTime?: string;
  notified?: boolean;
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
  const todayStr = new Date().toISOString().split("T")[0];
  const [fnfForm, setFnfForm] = useState({
    employeeName: "", department: "", resignationDate: todayStr, lastWorkingDay: todayStr, dueTime: "12:00", amount: "", remarks: ""
  });
  const [onbForm, setOnbForm] = useState({
    candidateName: "", role: "", startDate: todayStr, dueTime: "10:00", mentor: "", email: ""
  });
  const [taskForm, setTaskForm] = useState({
    title: "", assignedTo: "", dueDate: todayStr, dueTime: "17:00", priority: "Medium" as WorkspaceTask["priority"], category: "General" as WorkspaceTask["category"]
  });

  /* Tasks Filtering & UX States */
  const [taskViewMode, setTaskViewMode] = useState<"list" | "board">("list");
  const [taskStatusTab, setTaskStatusTab] = useState<"all" | "To Do" | "In Progress" | "Done">("all");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskCategory, setQuickTaskCategory] = useState<WorkspaceTask["category"]>("General");
  const [quickTaskPriority, setQuickTaskPriority] = useState<WorkspaceTask["priority"]>("Medium");
  const [quickTaskDueDate, setQuickTaskDueDate] = useState(todayStr);
  const [quickTaskDueTime, setQuickTaskDueTime] = useState("17:00");
  const [taskFilterCategory, setTaskFilterCategory] = useState<string>("All");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");

  /* Onboardings Filter */
  const [onbFilterStatus, setOnbFilterStatus] = useState<"all" | "Not Started" | "In Progress" | "Completed">("all");

  /* Notification & Push Reminders Engine State */
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [activeToast, setActiveToast] = useState<{
    id: string;
    type: "task" | "onboarding" | "fnf";
    title: string;
    subtitle: string;
    timeStr: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm === "granted") {
          new Notification("🔔 Push Notifications Enabled", {
            body: "You will receive real-time push alerts for scheduled Tasks, Onboarding, and FNF items.",
          });
          playPleasantLoginSound();
        }
      } catch (err) {
        console.error("Error requesting notification permission:", err);
      }
    }
  };

  /* Format HH:MM to 12-hour AM/PM */
  const formatTime12 = (timeStr?: string) => {
    if (!timeStr) return "12:00 PM";
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m < 10 ? "0" + m : m} ${period}`;
  };

  const LOCAL_STORAGE_KEY = "career_portal_workspace_v3";

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

  async function loadWorkspace() {
    try {
      setLoadingWorkspace(true);
      const res = await fetch("/api/workspace");
      if (res.ok) {
        const apiData: WorkspaceData = await res.json();
        setWorkspace(apiData);
        saveWorkspaceToCache(apiData);
      } else {
        const cached = getWorkspaceFromCache();
        if (cached) setWorkspace(cached);
      }
    } catch (err) {
      console.error("Error fetching workspace data:", err);
      const cached = getWorkspaceFromCache();
      if (cached) setWorkspace(cached);
    } finally {
      setLoadingWorkspace(false);
    }
  }

  /* Effects */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        setSession(null);
        setAuthLoading(false);
        router.replace("/admin");
        return;
      }
      setSession(session);
      setAuthLoading(false);
      loadWorkspace();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setAuthLoading(false);
        router.replace("/admin");
      } else {
        loadWorkspace();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleLogout() {
    setSession(null);
    await supabase.auth.signOut();
    router.replace("/admin");
  }

  /* Interval checker for time-based reminders */
  useEffect(() => {
    if (loadingWorkspace || !workspace) return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentDateStr = now.toISOString().split("T")[0];
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTotalMin = currentHours * 60 + currentMinutes;

      // 1. Check Tasks
      workspace.tasks.forEach((t) => {
        if (t.status === "Done" || t.notified) return;
        const [th, tm] = (t.dueTime || "17:00").split(":").map(Number);
        const taskTotalMin = (isNaN(th) ? 17 : th) * 60 + (isNaN(tm) ? 0 : tm);

        if (t.dueDate <= currentDateStr && currentTotalMin >= taskTotalMin) {
          triggerTimeNotification({
            id: t.id,
            type: "task",
            title: `⏰ Task Reminder: ${t.title}`,
            subtitle: `Assigned: ${t.assignedTo} • Due: ${t.dueDate} at ${formatTime12(t.dueTime)}`,
            timeStr: formatTime12(t.dueTime)
          });
        }
      });

      // 2. Check Onboarding
      workspace.onboardings.forEach((o) => {
        if (o.status === "Completed" || o.notified) return;
        const [oh, om] = (o.dueTime || "10:00").split(":").map(Number);
        const onbTotalMin = (isNaN(oh) ? 10 : oh) * 60 + (isNaN(om) ? 0 : om);

        if (o.startDate <= currentDateStr && currentTotalMin >= onbTotalMin) {
          triggerTimeNotification({
            id: o.id,
            type: "onboarding",
            title: `📋 Onboarding Reminder: ${o.candidateName}`,
            subtitle: `Role: ${o.role} • Start Date: ${o.startDate} at ${formatTime12(o.dueTime)}`,
            timeStr: formatTime12(o.dueTime)
          });
        }
      });

      // 3. Check FNF Records
      workspace.fnf.forEach((f) => {
        if (f.settlementStatus === "Paid" || f.settlementStatus === "Completed" || f.notified) return;
        const [fh, fm] = (f.dueTime || "12:00").split(":").map(Number);
        const fnfTotalMin = (isNaN(fh) ? 12 : fh) * 60 + (isNaN(fm) ? 0 : fm);

        if (f.lastWorkingDay <= currentDateStr && currentTotalMin >= fnfTotalMin) {
          triggerTimeNotification({
            id: f.id,
            type: "fnf",
            title: `💼 FNF Settlement Reminder: ${f.employeeName}`,
            subtitle: `Dept: ${f.department} • Last Day: ${f.lastWorkingDay} at ${formatTime12(f.dueTime)}`,
            timeStr: formatTime12(f.dueTime)
          });
        }
      });
    }, 12000);

    return () => clearInterval(interval);
  }, [workspace, loadingWorkspace]);

  const triggerTimeNotification = (item: {
    id: string;
    type: "task" | "onboarding" | "fnf";
    title: string;
    subtitle: string;
    timeStr: string;
  }) => {
    // 1. Play chime audio sound
    playPleasantLoginSound();

    // 2. Desktop Push Notification
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(item.title, {
          body: item.subtitle,
          tag: `${item.type}-${item.id}`,
        });
      } catch (e) {
        console.warn("Desktop notification trigger issue:", e);
      }
    }

    // 3. Set UI Toast Banner
    setActiveToast(item);

    // 4. Mark item as notified
    setWorkspace((prev) => {
      let nextState = { ...prev };
      if (item.type === "task") {
        nextState.tasks = prev.tasks.map((t) => (t.id === item.id ? { ...t, notified: true } : t));
      } else if (item.type === "onboarding") {
        nextState.onboardings = prev.onboardings.map((o) => (o.id === item.id ? { ...o, notified: true } : o));
      } else if (item.type === "fnf") {
        nextState.fnf = prev.fnf.map((f) => (f.id === item.id ? { ...f, notified: true } : f));
      }
      saveWorkspaceToCache(nextState);
      return nextState;
    });

    const updateAction = item.type === "task" ? "update_task" : item.type === "onboarding" ? "update_onboarding" : "update_fnf";
    triggerWorkspaceAction(updateAction, { id: item.id, notified: true });
  };

  const handleSnoozeReminder = async (id: string, type: "task" | "onboarding" | "fnf", snoozeMinutes: number = 15) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + snoozeMinutes);
    const newDateStr = now.toISOString().split("T")[0];
    const newHours = now.getHours().toString().padStart(2, "0");
    const newMins = now.getMinutes().toString().padStart(2, "0");
    const newTimeStr = `${newHours}:${newMins}`;

    setActiveToast(null);

    if (type === "task") {
      setWorkspace(prev => {
        const nextTasks = prev.tasks.map(t => String(t.id) === String(id) ? { ...t, dueDate: newDateStr, dueTime: newTimeStr, notified: false } : t);
        const nextWorkspace = { ...prev, tasks: nextTasks };
        saveWorkspaceToCache(nextWorkspace);
        return nextWorkspace;
      });
      await triggerWorkspaceAction("update_task", { id, dueDate: newDateStr, dueTime: newTimeStr, notified: false });
    } else if (type === "onboarding") {
      setWorkspace(prev => {
        const nextOnb = prev.onboardings.map(o => String(o.id) === String(id) ? { ...o, startDate: newDateStr, dueTime: newTimeStr, notified: false } : o);
        const nextWorkspace = { ...prev, onboardings: nextOnb };
        saveWorkspaceToCache(nextWorkspace);
        return nextWorkspace;
      });
      await triggerWorkspaceAction("update_onboarding", { id, startDate: newDateStr, dueTime: newTimeStr, notified: false });
    } else if (type === "fnf") {
      setWorkspace(prev => {
        const nextFnf = prev.fnf.map(f => String(f.id) === String(id) ? { ...f, lastWorkingDay: newDateStr, dueTime: newTimeStr, notified: false } : f);
        const nextWorkspace = { ...prev, fnf: nextFnf };
        saveWorkspaceToCache(nextWorkspace);
        return nextWorkspace;
      });
      await triggerWorkspaceAction("update_fnf", { id, lastWorkingDay: newDateStr, dueTime: newTimeStr, notified: false });
    }
  };

  /* API mutator helper with optimistic support */
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
        loadWorkspace(); // Re-fetch on error to revert optimistic state
      }
    } catch (err) {
      console.error("API error:", err);
      alert("Failed to connect to API.");
      loadWorkspace();
    }
  }

  /* ─── FNF CRUD Handlers ─── */
  const handleAddFnf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fnfForm.employeeName.trim() || !fnfForm.department.trim()) {
      alert("Employee Name and Department are required");
      return;
    }
    await triggerWorkspaceAction("add_fnf", fnfForm);
    setShowFnfModal(false);
    setFnfForm({ employeeName: "", department: "", resignationDate: todayStr, lastWorkingDay: todayStr, dueTime: "12:00", amount: "", remarks: "" });
  };

  const handleUpdateFnfStatus = async (id: string, status: FnfRecord["settlementStatus"]) => {
    setWorkspace(prev => {
      const nextFnf = prev.fnf.map(f => String(f.id) === String(id) ? { ...f, settlementStatus: status } : f);
      const nextWorkspace = { ...prev, fnf: nextFnf };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("update_fnf", { id, settlementStatus: status });
  };

  const handleUpdateFnfAmount = async (id: string, amount: string) => {
    const numAmount = parseFloat(amount) || 0;
    setWorkspace(prev => {
      const nextFnf = prev.fnf.map(f => String(f.id) === String(id) ? { ...f, amount: numAmount } : f);
      const nextWorkspace = { ...prev, fnf: nextFnf };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("update_fnf", { id, amount });
  };

  const handleToggleFnfTask = async (fnfId: string, taskId: string, completed: boolean) => {
    setWorkspace(prev => {
      const nextFnf = prev.fnf.map(f => {
        if (String(f.id) !== String(fnfId)) return f;
        const nextTasks = f.tasks.map(t => String(t.id) === String(taskId) ? { ...t, completed } : t);
        const allDone = nextTasks.every(t => t.completed);
        let settlementStatus = f.settlementStatus;
        if (allDone && f.settlementStatus === "Draft") settlementStatus = "Approved";
        else if (!allDone && f.settlementStatus === "Approved") settlementStatus = "Draft";
        return { ...f, tasks: nextTasks, settlementStatus };
      });
      const nextWorkspace = { ...prev, fnf: nextFnf };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
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
    if (String(expandedFnf) === String(id)) setExpandedFnf(null);
  };

  /* ─── Onboarding CRUD Handlers ─── */
  const handleAddOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onbForm.candidateName.trim() || !onbForm.role.trim()) {
      alert("Candidate Name and Job Role are required");
      return;
    }
    await triggerWorkspaceAction("add_onboarding", onbForm);
    setShowOnboardingModal(false);
    setOnbForm({ candidateName: "", role: "", startDate: todayStr, dueTime: "10:00", mentor: "", email: "" });
  };

  const handleUpdateOnbStatus = async (id: string, status: OnboardingRecord["status"]) => {
    setWorkspace(prev => {
      const nextOnb = prev.onboardings.map(o => String(o.id) === String(id) ? { ...o, status } : o);
      const nextWorkspace = { ...prev, onboardings: nextOnb };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("update_onboarding", { id, status });
  };

  /* Custom Checkpoint state */
  const [newOnbTaskInputs, setNewOnbTaskInputs] = useState<Record<string, string>>({});

  const handleAddOnbTask = async (onboardingId: string) => {
    const taskName = newOnbTaskInputs[onboardingId]?.trim();
    if (!taskName) return;
    const newTaskId = `ot-${Date.now()}`;
    setNewOnbTaskInputs((prev) => ({ ...prev, [onboardingId]: "" }));
    setWorkspace(prev => {
      const nextOnb = prev.onboardings.map(o => {
        if (String(o.id) !== String(onboardingId)) return o;
        return { ...o, tasks: [...o.tasks, { id: newTaskId, name: taskName, completed: false }] };
      });
      const nextWorkspace = { ...prev, onboardings: nextOnb };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("add_onboarding_task", { onboardingId, taskName });
  };

  const handleDeleteOnbTask = async (onboardingId: string, taskId: string) => {
    setWorkspace(prev => {
      const nextOnb = prev.onboardings.map(o => {
        if (String(o.id) !== String(onboardingId)) return o;
        return { ...o, tasks: o.tasks.filter(t => String(t.id) !== String(taskId)) };
      });
      const nextWorkspace = { ...prev, onboardings: nextOnb };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("delete_onboarding_task", { onboardingId, taskId });
  };

  const handleToggleOnbTask = async (onboardingId: string, taskId: string, completed: boolean) => {
    setWorkspace(prev => {
      const nextOnb = prev.onboardings.map(o => {
        if (String(o.id) !== String(onboardingId)) return o;
        const nextTasks = o.tasks.map(t => String(t.id) === String(taskId) ? { ...t, completed } : t);
        const doneCount = nextTasks.filter(t => t.completed).length;
        const total = nextTasks.length;
        let status = o.status;
        if (doneCount === total && total > 0) status = "Completed";
        else if (doneCount > 0) status = "In Progress";
        else status = "Not Started";
        return { ...o, tasks: nextTasks, status };
      });
      const nextWorkspace = { ...prev, onboardings: nextOnb };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("toggle_onboarding_task", { onboardingId, taskId, completed });
  };

  const handleDeleteOnboarding = async (id: string) => {
    if (typeof window !== "undefined" && window.confirm) {
      if (!window.confirm("Are you sure you want to permanently delete this onboarding process?")) return;
    }
    setWorkspace(prev => {
      const nextOnb = prev.onboardings.filter(o => String(o.id) !== String(id));
      const nextWorkspace = { ...prev, onboardings: nextOnb };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("delete_onboarding", { id });
    if (String(expandedOnb) === String(id)) setExpandedOnb(null);
  };

  /* ─── Task CRUD Handlers ─── */
  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    const payload = {
      title: quickTaskTitle.trim(),
      assignedTo: session?.user?.email?.split("@")[0] || "Admin",
      dueDate: quickTaskDueDate || todayStr,
      dueTime: quickTaskDueTime || "17:00",
      priority: quickTaskPriority,
      category: quickTaskCategory
    };
    setQuickTaskTitle("");
    await triggerWorkspaceAction("add_task", payload);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      alert("Task Title is required");
      return;
    }
    await triggerWorkspaceAction("add_task", taskForm);
    setShowTaskModal(false);
    setTaskForm({ title: "", assignedTo: "", dueDate: todayStr, dueTime: "17:00", priority: "Medium", category: "General" });
  };

  const handleUpdateTaskStatus = async (id: string, status: WorkspaceTask["status"]) => {
    setWorkspace(prev => {
      const nextTasks = prev.tasks.map(t => {
        if (String(t.id) !== String(id)) return t;
        return { ...t, status };
      });
      const nextWorkspace = { ...prev, tasks: nextTasks };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
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

  const handleClearCompletedTasks = async () => {
    if (typeof window !== "undefined" && window.confirm) {
      if (!window.confirm("Clear all completed tasks?")) return;
    }
    setWorkspace(prev => {
      const nextTasks = prev.tasks.filter(t => t.status !== "Done");
      const nextWorkspace = { ...prev, tasks: nextTasks };
      saveWorkspaceToCache(nextWorkspace);
      return nextWorkspace;
    });
    await triggerWorkspaceAction("clear_completed_tasks", {});
  };

  const isRecruiter =
    session?.user?.app_metadata?.role === "admin" ||
    session?.user?.user_metadata?.role === "admin" ||
    session?.user?.app_metadata?.role === "superuser" ||
    session?.user?.user_metadata?.role === "superuser" ||
    session?.user?.email === "williammark3312@gmail.com" ||
    session?.user?.email === "anandugirish3312@gmail.com";

  if (!mounted || authLoading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#000000] text-white relative overflow-hidden font-sans">
        <GlassBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="admin-logo-mark w-9 h-9" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-slow" style={{ animationDelay: `${i * 0.18}s` }} />
            ))}
          </div>
          <p className="text-[10px] font-semibold text-zinc-500 tracking-widest uppercase">Loading Workspace</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#000000] text-white relative overflow-hidden p-4 font-sans">
        <GlassBackground />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-3xl p-8 relative z-10 text-center flex flex-col items-center gap-5 shadow-2xl"
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-400 bg-indigo-950/30 border border-indigo-900/50">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight mb-1">Authentication Required</h1>
            <p className="text-xs text-zinc-400 font-medium leading-relaxed">
              You must be signed in as an administrator to access the workspace desk.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => router.push("/admin")}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-black bg-white hover:bg-zinc-200 cursor-pointer transition-all active:scale-[0.98]"
            >
              Sign In to Admin
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-all cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  if (!isRecruiter) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#000000] text-white relative overflow-hidden p-4 font-sans">
        <GlassBackground />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-3xl p-8 relative z-10 text-center flex flex-col items-center gap-5 shadow-2xl"
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-rose-450 animate-pulse-slow"
            style={{ background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.15)" }}
          >
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight mb-1">Access Denied</h1>
            <p className="text-xs text-zinc-400 font-medium leading-relaxed">
              Signed in as <span className="text-indigo-400 font-semibold">{session.user.email}</span>. Only supervisors may access this workspace.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <button onClick={handleLogout} className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-rose-500 hover:bg-rose-600 cursor-pointer transition-all active:scale-[0.98]">
              Sign Out & Try Again
            </button>
            <button onClick={() => router.push("/")} className="w-full py-2.5 px-4 rounded-xl font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-all cursor-pointer">
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
    <main className="relative flex flex-col min-h-screen bg-[#000000] text-white">
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                Workspace desk.
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Store
                </span>
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-lg mt-1">
                Manage employee onboarding, F&F settlements, and operational directives with instant deletion and addition.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={requestNotificationPermission}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  notificationPermission === "granted"
                    ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-400"
                    : notificationPermission === "denied"
                    ? "bg-rose-950/40 border-rose-800/60 text-rose-400"
                    : "bg-indigo-950/40 border-indigo-800/60 text-indigo-400 hover:bg-indigo-900/50"
                }`}
                title={notificationPermission === "granted" ? "Push Notifications Active" : "Click to enable Push Notifications for scheduled times"}
              >
                <Bell className="w-3.5 h-3.5" />
                {notificationPermission === "granted" ? "Push Active" : "Enable Reminders"}
              </button>

              <button
                onClick={() => loadWorkspace()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
                title="Refresh workspace from cloud"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>

          {/* Minimal Info Row */}
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2 flex-wrap">
            <span>SETTLEMENTS: {totalFnf}</span>
            <span>•</span>
            <span>ONBOARDINGS: {activeOnboardings} ACTIVE ({workspace.onboardings.length} TOTAL)</span>
            <span>•</span>
            <span>OPEN TASKS: {pendingTasks} ({workspace.tasks.length} TOTAL)</span>
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
                { id: "fnf", label: `FNF Settlement (${totalFnf})` },
                { id: "onboarding", label: `Onboardings (${workspace.onboardings.length})` },
                { id: "tasks", label: `Tasks Desk (${workspace.tasks.length})` },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as "overview" | "fnf" | "onboarding" | "tasks")}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-black border-transparent shadow-md"
                        : "bg-zinc-950/50 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-900 hover:border-zinc-800"
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
            <p className="text-xs text-zinc-500 font-semibold">Loading workspace desk...</p>
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
                    { label: "Active Onboardings", value: activeOnboardings, desc: `${workspace.onboardings.length} total tracks` },
                    { label: "Settlements Handled", value: totalFnf, desc: "Lifecycle logs" },
                    { label: "Pending Clearance", value: pendingClearances, desc: "Needs evaluation" },
                    { label: "Operational Tasks", value: pendingTasks, desc: `${workspace.tasks.length} total tasks` }
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-zinc-950/80 border border-zinc-850 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-2">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{stat.label}</span>
                      <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stat.value}</span>
                      <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{stat.desc}</span>
                    </div>
                  ))}

                  {/* Summary lists on Overview page */}
                  <div className="col-span-1 md:col-span-2 border border-zinc-850 bg-zinc-950/80 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" /> Recent FNF Clearances
                      </h3>
                      <button
                        onClick={() => setActiveTab("fnf")}
                        className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        View All FNF
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
                              <p className="text-[10px] font-medium text-zinc-400 mt-0.5">{f.department} • LWD: {f.lastWorkingDay}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-md">
                                {cleared}/{total} cleared
                              </span>
                              <button
                                onClick={() => handleDeleteFnf(f.id)}
                                className="text-zinc-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                                title="Delete settlement"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {workspace.fnf.length === 0 && (
                        <p className="text-xs text-zinc-500 italic py-6 text-center">No resignation clearances recorded. Click &quot;Start FNF&quot; to add one.</p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 border border-zinc-850 bg-zinc-950/80 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                        <UserPlus className="w-3.5 h-3.5 text-indigo-400" /> Onboarding Trackers
                      </h3>
                      <button
                        onClick={() => setActiveTab("onboarding")}
                        className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        View All Onboardings
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
                              <p className="text-[10px] font-medium text-zinc-400 mt-0.5">{o.role} • Start: {o.startDate}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-md">
                                {o.status} ({done}/{total})
                              </span>
                              <button
                                onClick={() => handleDeleteOnboarding(o.id)}
                                className="text-zinc-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                                title="Delete onboarding"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {workspace.onboardings.length === 0 && (
                        <p className="text-xs text-zinc-500 italic py-6 text-center">No onboarding tracks recorded. Click &quot;Start Onboarding&quot; to add one.</p>
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
                      const isExpanded = String(expandedFnf) === String(f.id);
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

                            <div className="flex items-center gap-4">
                              <span className="text-xs font-bold text-zinc-300">
                                {completedCount}/{totalCount} Cleared
                              </span>
                              
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5">
                                  <span style={{ backgroundColor: dotColor }} className="w-1.5 h-1.5 rounded-full" />
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{f.settlementStatus}</span>
                                </span>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFnf(f.id);
                                }}
                                className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg border border-transparent hover:border-rose-900/40 transition-all cursor-pointer"
                                title="Delete FNF settlement"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              <ChevronRight className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
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
                      <div className="text-center py-16 flex flex-col items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-zinc-600" />
                        <p className="text-xs text-zinc-500 font-medium">No resignation clearances active.</p>
                        <button
                          onClick={() => setShowFnfModal(true)}
                          className="mt-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Initiate a new F&F settlement
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── ONBOARDINGS TAB ─── */}
              {activeTab === "onboarding" && (() => {
                const filteredOnb = workspace.onboardings.filter(o => {
                  if (onbFilterStatus === "all") return true;
                  return o.status === onbFilterStatus;
                });

                return (
                  <motion.div
                    key="onboarding"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-4"
                  >
                    {/* Status Tabs for Onboardings */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-900 p-1 rounded-xl">
                        {[
                          { id: "all", label: `All (${workspace.onboardings.length})` },
                          { id: "Not Started", label: `Not Started (${workspace.onboardings.filter(o => o.status === "Not Started").length})` },
                          { id: "In Progress", label: `In Progress (${workspace.onboardings.filter(o => o.status === "In Progress").length})` },
                          { id: "Completed", label: `Completed (${workspace.onboardings.filter(o => o.status === "Completed").length})` },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setOnbFilterStatus(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              onbFilterStatus === tab.id
                                ? "bg-white text-black shadow-sm"
                                : "text-zinc-400 hover:text-white"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden">
                      {filteredOnb.map((o) => {
                        const doneCount = o.tasks.filter((t) => t.completed).length;
                        const totalCount = o.tasks.length;
                        const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                        const dotColor = o.status === "Completed" ? "#10b981" : o.status === "In Progress" ? "#3b82f6" : "#71717a";

                        return (
                          <div
                            key={o.id}
                            className="py-4 px-6 border-b border-zinc-900 last:border-b-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-zinc-900/30 transition-colors group"
                          >
                            <div 
                              onClick={() => setExpandedOnb(o.id)}
                              className="flex flex-col gap-1 min-w-0 flex-1 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-zinc-200 transition-colors">
                                  {o.candidateName}
                                </h4>
                                <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-950/60 border border-zinc-800 px-2 py-0.5 rounded">
                                  {o.role}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-500 font-semibold flex items-center gap-2 mt-0.5 flex-wrap">
                                <span>Start: {o.startDate}</span>
                                <span>•</span>
                                <span>Mentor: {o.mentor}</span>
                                {o.email && (
                                  <>
                                    <span>•</span>
                                    <span className="text-zinc-400">{o.email}</span>
                                  </>
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-xs font-bold text-zinc-300">
                                  {doneCount}/{totalCount} Done ({pct}%)
                                </span>
                                <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                                  <div 
                                    className={`h-full transition-all duration-300 ${o.status === "Completed" ? "bg-emerald-400" : "bg-blue-400"}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-900 px-2.5 py-1 rounded-lg">
                                <span style={{ backgroundColor: dotColor }} className="w-1.5 h-1.5 rounded-full" />
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{o.status}</span>
                              </div>

                              {/* Direct Delete button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteOnboarding(o.id);
                                }}
                                className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl border border-zinc-900/40 hover:border-rose-900/60 transition-all cursor-pointer"
                                title="Delete onboarding candidate"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setExpandedOnb(o.id)}
                                className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                                title="View checklist details"
                              >
                                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {filteredOnb.length === 0 && (
                        <div className="p-16 text-center flex flex-col items-center gap-2">
                          <UserCheck className="w-6 h-6 text-zinc-600" />
                          <p className="text-zinc-500 text-xs font-semibold">
                            {workspace.onboardings.length === 0 ? "No candidate onboarding guides active." : "No candidates found matching filter."}
                          </p>
                          {workspace.onboardings.length === 0 && (
                            <button
                              onClick={() => setShowOnboardingModal(true)}
                              className="mt-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                            >
                              Start candidate onboarding
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })()}

              {/* ─── TASKS DESK TAB (GOOGLE TASKS HYPER-EFFICIENT UX) ─── */}
              {activeTab === "tasks" && (() => {
                const filteredTasks = workspace.tasks.filter(t => {
                  const matchCat = taskFilterCategory === "All" || t.category === taskFilterCategory;
                  const matchStatus = taskStatusTab === "all" || t.status === taskStatusTab;
                  const matchQuery = !taskSearchQuery.trim() || 
                    t.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) || 
                    t.assignedTo.toLowerCase().includes(taskSearchQuery.toLowerCase());
                  return matchCat && matchStatus && matchQuery;
                });

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
                        <Search className="w-4 h-4 mr-2.5 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Search tasks or assignees..."
                          value={taskSearchQuery}
                          onChange={(e) => setTaskSearchQuery(e.target.value)}
                          className="w-full bg-transparent border-none outline-none text-xs text-zinc-200 placeholder-zinc-500 font-medium"
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
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
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

                    {/* Status Tabs for Task List View */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-1 bg-zinc-950/80 border border-zinc-900 p-1 rounded-xl">
                        {[
                          { id: "all", label: `All Tasks (${workspace.tasks.length})` },
                          { id: "To Do", label: `To Do (${workspace.tasks.filter(t => t.status === "To Do").length})` },
                          { id: "In Progress", label: `In Progress (${workspace.tasks.filter(t => t.status === "In Progress").length})` },
                          { id: "Done", label: `Completed (${workspace.tasks.filter(t => t.status === "Done").length})` },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setTaskStatusTab(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              taskStatusTab === tab.id
                                ? "bg-white text-black shadow-sm"
                                : "text-zinc-400 hover:text-white"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {workspace.tasks.some(t => t.status === "Done") && (
                        <button
                          onClick={handleClearCompletedTasks}
                          className="text-[11px] font-semibold text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          Clear completed tasks
                        </button>
                      )}
                    </div>

                    {/* Inline Quick Task Creator Form */}
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

                      <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-900 flex-wrap">
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

                        <input
                          type="time"
                          value={quickTaskDueTime}
                          onChange={(e) => setQuickTaskDueTime(e.target.value)}
                          className="bg-zinc-900/60 border border-zinc-800 text-[10px] font-bold text-zinc-300 px-2 py-1 rounded-xl outline-none cursor-pointer"
                          title="Reminder Time"
                        />

                        <button
                          type="submit"
                          disabled={!quickTaskTitle.trim()}
                          className="bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white text-black text-xs font-bold px-4 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          Add Task
                        </button>
                      </div>
                    </form>

                    {/* View Render: List View vs Board View */}
                    {taskViewMode === "list" ? (
                      <div className="flex flex-col gap-4">
                        <div className="border border-zinc-900 bg-zinc-950/20 rounded-2xl overflow-hidden">
                          {filteredTasks.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500 text-xs font-semibold">
                              {workspace.tasks.length === 0 ? "No tasks recorded yet. Click above to add a new task." : "No tasks found matching this filter."}
                            </div>
                          ) : (
                            filteredTasks.map((t) => (
                              <div
                                key={t.id}
                                className="px-6 py-4 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                              >
                                <div className="flex items-center gap-3.5 min-w-0 pr-4 flex-1">
                                  {/* Status Icon Button */}
                                  <button
                                    onClick={() => handleUpdateTaskStatus(t.id, t.status === "Done" ? "To Do" : "Done")}
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                      t.status === "Done"
                                        ? "bg-emerald-500 border-emerald-500 text-black"
                                        : "border-zinc-700 hover:border-white bg-zinc-950"
                                    }`}
                                    title={t.status === "Done" ? "Reopen task" : "Mark as completed"}
                                  >
                                    {t.status === "Done" ? (
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    ) : (
                                      <Check className="w-3 h-3 text-transparent group-hover:text-zinc-600 transition-colors" />
                                    )}
                                  </button>

                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-sm font-bold transition-colors ${t.status === "Done" ? "line-through text-zinc-500" : "text-white"}`}>
                                        {t.title}
                                      </span>
                                      
                                      {/* Status Badge */}
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                        t.status === "In Progress" 
                                          ? "bg-blue-950/60 border border-blue-800/60 text-blue-400" 
                                          : t.status === "Done" 
                                          ? "bg-emerald-950/60 border border-emerald-800/60 text-emerald-400"
                                          : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                                      }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                          t.status === "In Progress" ? "bg-blue-400 animate-pulse" : t.status === "Done" ? "bg-emerald-400" : "bg-zinc-500"
                                        }`} />
                                        {t.status}
                                      </span>

                                      <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-950/40 border border-zinc-900 px-2 py-0.5 rounded">
                                        {t.category}
                                      </span>
                                      {t.status === "In Progress" && (
                                        <span className="text-[10px] font-semibold text-blue-400 bg-blue-950/30 border border-blue-900/40 px-2 py-0.5 rounded">
                                          In Progress
                                        </span>
                                      )}
                                      {t.priority === "High" && (
                                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded">
                                          High Priority
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-semibold flex items-center gap-2 flex-wrap">
                                      <span>Assigned: <span className="text-zinc-400">{t.assignedTo}</span></span>
                                      <span>•</span>
                                      <span>Due: {t.dueDate} at <span className="text-indigo-400 font-bold">{formatTime12(t.dueTime)}</span></span>
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  {t.status === "To Do" && (
                                    <button
                                      onClick={() => handleUpdateTaskStatus(t.id, "In Progress")}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-900/60 hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                    >
                                      <Play className="w-3 h-3" /> Start
                                    </button>
                                  )}

                                  {t.status === "In Progress" && (
                                    <>
                                      <button
                                        onClick={() => handleUpdateTaskStatus(t.id, "To Do")}
                                        className="text-[10px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                        title="Move back to To Do"
                                      >
                                        To Do
                                      </button>
                                      <button
                                        onClick={() => handleUpdateTaskStatus(t.id, "Done")}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                      >
                                        <Check className="w-3 h-3" /> Finish
                                      </button>
                                    </>
                                  )}

                                  {t.status === "Done" && (
                                    <button
                                      onClick={() => handleUpdateTaskStatus(t.id, "To Do")}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-white hover:bg-zinc-800 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                    >
                                      <RotateCcw className="w-3 h-3" /> Reopen
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTask(t.id);
                                    }}
                                    className="text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer transition-all p-1.5 rounded-lg border border-transparent hover:border-rose-900/40"
                                    title="Delete task"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
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
                              <span className="text-zinc-300 font-bold">{workspace.tasks.filter((t) => t.status === col.key).length}</span>
                            </div>

                            <div className="flex flex-col gap-2">
                              {workspace.tasks.filter((t) => t.status === col.key).map((t) => (
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
                                          className="text-[10px] font-bold text-blue-400 hover:bg-blue-950/30 border border-blue-900/40 px-2 py-0.5 rounded cursor-pointer"
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
                                        className="text-zinc-500 hover:text-rose-400 cursor-pointer transition-colors p-1"
                                        title="Delete task"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {workspace.tasks.filter((t) => t.status === col.key).length === 0 && (
                                <div className="text-center py-8">
                                  <p className="text-xs text-zinc-600 font-medium">No tasks in {col.title}</p>
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
          const o = workspace.onboardings.find((item) => String(item.id) === String(expandedOnb));
          if (!o) return null;
          const doneCount = o.tasks.filter((t) => t.completed).length;
          const totalCount = o.tasks.length;
          const isAllDone = doneCount === totalCount && totalCount > 0;

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
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        o.status === "Completed" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60" : "bg-blue-950/80 text-blue-400 border border-blue-800/60"
                      }`}>
                        {o.status}
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

                {isAllDone && (
                  <div className="bg-emerald-950/30 border border-emerald-900/60 p-3.5 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>All onboarding checkpoints completed! Candidate is ready.</span>
                  </div>
                )}

                {/* Checklist Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Onboarding checklist</span>
                    <span className="text-[10px] font-semibold text-zinc-300">{doneCount} of {totalCount} Checkpoints Done</span>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {o.tasks.map((t) => (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                          t.completed
                            ? "bg-zinc-900/90 border-zinc-700 text-white font-bold"
                            : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 font-medium"
                        }`}
                      >
                        <button
                          onClick={() => handleToggleOnbTask(o.id, t.id, !t.completed)}
                          className="flex items-center gap-3 flex-1 text-left cursor-pointer"
                        >
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition-all ${
                              t.completed ? "bg-emerald-500 border-emerald-500 text-black" : "border-zinc-700 bg-zinc-950"
                            }`}
                          >
                            {t.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className={`text-xs ${t.completed ? "line-through text-zinc-300" : "text-white"}`}>{t.name}</span>
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
                    <Trash2 className="w-3.5 h-3.5" /> Permanently Delete Tracker
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
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Start FNF Process
              </h3>
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

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Resignation</label>
                  <input
                    type="date"
                    required
                    value={fnfForm.resignationDate}
                    onChange={(e) => setFnfForm({ ...fnfForm, resignationDate: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-2.5 py-2.5 text-xs text-white outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Last Day</label>
                  <input
                    type="date"
                    required
                    value={fnfForm.lastWorkingDay}
                    onChange={(e) => setFnfForm({ ...fnfForm, lastWorkingDay: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-2.5 py-2.5 text-xs text-white outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Reminder Time</label>
                  <input
                    type="time"
                    required
                    value={fnfForm.dueTime}
                    onChange={(e) => setFnfForm({ ...fnfForm, dueTime: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-2.5 py-2.5 text-xs text-white outline-none transition-all"
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
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" /> Start Onboarding
              </h3>
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
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Corporate / Personal Email</label>
                <input
                  type="email"
                  placeholder="alice@company.com"
                  value={onbForm.email}
                  onChange={(e) => setOnbForm({ ...onbForm, email: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Start Date</label>
                  <input
                    type="date"
                    required
                    value={onbForm.startDate}
                    onChange={(e) => setOnbForm({ ...onbForm, startDate: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-2.5 py-2.5 text-xs text-white outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Reminder Time</label>
                  <input
                    type="time"
                    required
                    value={onbForm.dueTime}
                    onChange={(e) => setOnbForm({ ...onbForm, dueTime: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-2.5 py-2.5 text-xs text-white outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mentor</label>
                  <input
                    type="text"
                    placeholder="Emma Watson"
                    value={onbForm.mentor}
                    onChange={(e) => setOnbForm({ ...onbForm, mentor: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-2.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
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
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> Create Task
              </h3>
              <button onClick={() => setShowTaskModal(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddTask} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="Revoke credentials, Setup workspace..."
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Assignee</label>
                <input
                  type="text"
                  placeholder="IT Team, Admin, HR..."
                  value={taskForm.assignedTo}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all placeholder-zinc-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-2.5 py-2.5 text-xs text-white outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Reminder Time</label>
                  <input
                    type="time"
                    required
                    value={taskForm.dueTime}
                    onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-2.5 py-2.5 text-xs text-white outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Category</label>
                  <select
                    value={taskForm.category}
                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value as WorkspaceTask["category"] })}
                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 rounded-xl px-2.5 py-2.5 text-xs text-white outline-none cursor-pointer"
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
                  <option value="High">High Priority</option>
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

      {/* ─── FLOATING REAL-TIME PUSH NOTIFICATION TOAST BANNER ─── */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[200] w-full max-w-sm bg-zinc-950/95 border border-indigo-500/50 shadow-2xl shadow-indigo-500/20 rounded-2xl p-4 text-white flex flex-col gap-3 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 animate-pulse">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-snug">{activeToast.title}</h4>
                  <p className="text-[10px] text-zinc-400 font-medium mt-0.5">{activeToast.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveToast(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg cursor-pointer transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-zinc-900">
              <button
                onClick={() => handleSnoozeReminder(activeToast.id, activeToast.type, 15)}
                className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-bold text-zinc-300 transition-colors cursor-pointer text-center"
              >
                Snooze 15m
              </button>
              <button
                onClick={() => {
                  if (activeToast.type === "task") handleUpdateTaskStatus(activeToast.id, "Done");
                  else if (activeToast.type === "onboarding") handleUpdateOnbStatus(activeToast.id, "Completed");
                  else if (activeToast.type === "fnf") handleUpdateFnfStatus(activeToast.id, "Completed");
                  setActiveToast(null);
                }}
                className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-[10px] font-bold text-white transition-colors cursor-pointer text-center"
              >
                Mark Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
