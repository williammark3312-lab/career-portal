import { createClient } from "@supabase/supabase-js";

export interface WorkTask {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "done";
  reminder?: string;
  created_at: string;
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fxksnkvyeyypkckehqpx.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H";

const STORE_KEY = "work_panel";

let inMemoryTasks: WorkTask[] | null = null;

function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function readTasks(): Promise<WorkTask[]> {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase
      .from("workspace_store")
      .select("data")
      .eq("key", STORE_KEY)
      .limit(1)
      .maybeSingle();

    if (!error && data && Array.isArray((data.data as Record<string, unknown>)?.tasks)) {
      inMemoryTasks = (data.data as { tasks: WorkTask[] }).tasks;
      return inMemoryTasks;
    }
  } catch (err) {
    console.error("[work-panel] read error:", err);
  }
  return inMemoryTasks ?? [];
}

async function writeTasks(tasks: WorkTask[]) {
  inMemoryTasks = tasks;
  const supabase = getSupabase();
  try {
    await supabase
      .from("workspace_store")
      .upsert({ key: STORE_KEY, data: { tasks } }, { onConflict: "key" });
  } catch (err) {
    console.error("[work-panel] write error:", err);
  }
}

export async function GET() {
  try {
    const tasks = await readTasks();
    return Response.json({ tasks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, priority, status, reminder } = body;

    if (!title?.trim()) {
      return Response.json({ error: "Title is required." }, { status: 400 });
    }

    const newTask: WorkTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      description: description?.trim() || undefined,
      priority: (["low", "medium", "high"].includes(priority) ? priority : "medium") as WorkTask["priority"],
      status: (["todo", "in-progress", "done"].includes(status) ? status : "todo") as WorkTask["status"],
      reminder: reminder || undefined,
      created_at: new Date().toISOString(),
    };

    const tasks = await readTasks();
    tasks.unshift(newTask);
    await writeTasks(tasks);

    return Response.json(newTask);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return Response.json({ error: "Task ID is required." }, { status: 400 });
    }

    const tasks = await readTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }

    tasks[idx] = { ...tasks[idx], ...updates };
    await writeTasks(tasks);

    return Response.json(tasks[idx]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Task ID is required." }, { status: 400 });
    }

    const tasks = await readTasks();
    const filtered = tasks.filter((t) => t.id !== id);
    await writeTasks(filtered);

    return Response.json({ success: true, tasks: filtered });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
