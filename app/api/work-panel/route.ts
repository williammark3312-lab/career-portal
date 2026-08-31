import { createClient } from "@supabase/supabase-js";

export interface WorkTask {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "paused" | "done";
  reminder?: string;
  created_at: string;
}

export interface OnboardingTask {
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

export interface FnFTask {
  id: string;
  name: string;
  department: string;
  last_working_day: string;
  status: "resigned" | "clearance_pending" | "assets_collected" | "fnf_calculation" | "settled";
  settlement_amount?: string;
  notes?: string;
  created_at: string;
}

export interface WorkPanelStore {
  tasks: WorkTask[];
  onboarding: OnboardingTask[];
  fnf: FnFTask[];
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fxksnkvyeyypkckehqpx.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H";

const STORE_KEY = "work_panel";

let inMemoryStore: WorkPanelStore | null = null;

function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function readStore(): Promise<WorkPanelStore> {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase
      .from("workspace_store")
      .select("data")
      .eq("key", STORE_KEY)
      .limit(1)
      .maybeSingle();

    if (!error && data && data.data && typeof data.data === "object") {
      const raw = data.data as Record<string, unknown>;
      inMemoryStore = {
        tasks: Array.isArray(raw.tasks) ? (raw.tasks as WorkTask[]) : [],
        onboarding: Array.isArray(raw.onboarding) ? (raw.onboarding as OnboardingTask[]) : [],
        fnf: Array.isArray(raw.fnf) ? (raw.fnf as FnFTask[]) : [],
      };
      return inMemoryStore;
    }
  } catch (err) {
    console.error("[work-panel] read error:", err);
  }
  return inMemoryStore ?? { tasks: [], onboarding: [], fnf: [] };
}

async function writeStore(store: WorkPanelStore) {
  inMemoryStore = store;
  const supabase = getSupabase();
  try {
    await supabase
      .from("workspace_store")
      .upsert({ key: STORE_KEY, data: store }, { onConflict: "key" });
  } catch (err) {
    console.error("[work-panel] write error:", err);
  }
}

export async function GET() {
  try {
    const store = await readStore();
    return Response.json(store);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = body.type || "task";
    const store = await readStore();

    if (type === "onboarding") {
      const { name, role, department, joining_date, status, buddy_or_hr, notes } = body;
      if (!name?.trim()) return Response.json({ error: "Candidate name is required." }, { status: 400 });

      const newOnboarding: OnboardingTask = {
        id: `onboard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim(),
        role: role?.trim() || "New Hire",
        department: department?.trim() || "General",
        joining_date: joining_date || new Date().toISOString().slice(0, 10),
        status: (["offer_sent", "doc_verification", "it_setup", "induction", "completed"].includes(status)
          ? status
          : "offer_sent") as OnboardingTask["status"],
        buddy_or_hr: buddy_or_hr?.trim() || undefined,
        notes: notes?.trim() || undefined,
        created_at: new Date().toISOString(),
      };
      store.onboarding.unshift(newOnboarding);
      await writeStore(store);
      return Response.json(newOnboarding);
    }

    if (type === "fnf") {
      const { name, department, last_working_day, status, settlement_amount, notes } = body;
      if (!name?.trim()) return Response.json({ error: "Employee name is required." }, { status: 400 });

      const newFnF: FnFTask = {
        id: `fnf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim(),
        department: department?.trim() || "General",
        last_working_day: last_working_day || new Date().toISOString().slice(0, 10),
        status: (["resigned", "clearance_pending", "assets_collected", "fnf_calculation", "settled"].includes(status)
          ? status
          : "resigned") as FnFTask["status"],
        settlement_amount: settlement_amount?.trim() || undefined,
        notes: notes?.trim() || undefined,
        created_at: new Date().toISOString(),
      };
      store.fnf.unshift(newFnF);
      await writeStore(store);
      return Response.json(newFnF);
    }

    // Default: Task
    const { title, description, priority, status, reminder } = body;
    if (!title?.trim()) {
      return Response.json({ error: "Title is required." }, { status: 400 });
    }

    const newTask: WorkTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      description: description?.trim() || undefined,
      priority: (["low", "medium", "high"].includes(priority) ? priority : "medium") as WorkTask["priority"],
      status: (["todo", "in-progress", "paused", "done"].includes(status) ? status : "todo") as WorkTask["status"],
      reminder: reminder || undefined,
      created_at: new Date().toISOString(),
    };

    store.tasks.unshift(newTask);
    await writeStore(store);

    return Response.json(newTask);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, type, ...updates } = body;

    if (!id) {
      return Response.json({ error: "ID is required." }, { status: 400 });
    }

    const store = await readStore();

    if (type === "onboarding" || id.startsWith("onboard-")) {
      const idx = store.onboarding.findIndex((item) => item.id === id);
      if (idx === -1) return Response.json({ error: "Onboarding record not found." }, { status: 404 });
      store.onboarding[idx] = { ...store.onboarding[idx], ...updates };
      await writeStore(store);
      return Response.json(store.onboarding[idx]);
    }

    if (type === "fnf" || id.startsWith("fnf-")) {
      const idx = store.fnf.findIndex((item) => item.id === id);
      if (idx === -1) return Response.json({ error: "FnF record not found." }, { status: 404 });
      store.fnf[idx] = { ...store.fnf[idx], ...updates };
      await writeStore(store);
      return Response.json(store.fnf[idx]);
    }

    // Default: Task
    const idx = store.tasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }

    store.tasks[idx] = { ...store.tasks[idx], ...updates };
    await writeStore(store);

    return Response.json(store.tasks[idx]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");

    if (!id) {
      return Response.json({ error: "ID is required." }, { status: 400 });
    }

    const store = await readStore();

    if (type === "onboarding" || id.startsWith("onboard-")) {
      store.onboarding = store.onboarding.filter((o) => o.id !== id);
    } else if (type === "fnf" || id.startsWith("fnf-")) {
      store.fnf = store.fnf.filter((f) => f.id !== id);
    } else {
      store.tasks = store.tasks.filter((t) => t.id !== id);
      store.onboarding = store.onboarding.filter((o) => o.id !== id);
      store.fnf = store.fnf.filter((f) => f.id !== id);
    }

    await writeStore(store);
    return Response.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
