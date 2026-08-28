import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

interface FnfTaskItem { id: string; name: string; completed: boolean; section: string; }
interface FnfRecordItem { id: string; employeeName: string; department: string; resignationDate: string; lastWorkingDay: string; settlementStatus: string; amount: number; remarks: string; tasks: FnfTaskItem[]; createdAt: string; dueTime?: string; notified?: boolean; }
interface OnboardingTaskItem { id: string; name: string; completed: boolean; }
interface OnboardingRecordItem { id: string; candidateName: string; role: string; startDate: string; status: string; mentor: string; email: string; tasks: OnboardingTaskItem[]; createdAt: string; dueTime?: string; notified?: boolean; }
interface TaskItemRecord { id: string; title: string; assignedTo: string; dueDate: string; priority: string; status: string; category: string; createdAt: string; dueTime?: string; notified?: boolean; }
interface WorkspaceStore { fnf: FnfRecordItem[]; onboardings: OnboardingRecordItem[]; tasks: TaskItemRecord[]; }

const projectJsonPath = path.join(process.cwd(), "data", "workspace.json");
const WORKSPACE_KEY = "main";
const WORKSPACE_STORE_NAME = "__WORKSPACE_SYSTEM_STORE__";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fxksnkvyeyypkckehqpx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H";

function getSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isPlaceholder = !serviceKey || serviceKey.includes("your_service_role_key_here");
  const key = isPlaceholder ? supabaseAnonKey : serviceKey;
  return createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// ─── DEDICATED workspace_store TABLE ────────────────────────────────────────
// Workspace data is stored in its own Supabase table to avoid NOT NULL
// constraint violations from the `applications` table (which requires
// email, phone, resume_url, job_id etc.) that caused silent write failures
// and data loss on every serverless cold start.
//
// Run this ONE TIME in your Supabase SQL Editor:
//
//   create table if not exists workspace_store (
//     key   text primary key,
//     data  jsonb not null default '{}'::jsonb
//   );
//   alter table workspace_store enable row level security;
//   create policy "allow_all" on workspace_store for all using (true) with check (true);
//
// ─────────────────────────────────────────────────────────────────────────────

let inMemoryStore: WorkspaceStore | null = null;

function emptyStore(): WorkspaceStore {
  return { fnf: [], onboardings: [], tasks: [] };
}

function parseStore(raw: unknown): WorkspaceStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const r = raw as Record<string, unknown>;
  return {
    fnf: Array.isArray(r.fnf) ? r.fnf as FnfRecordItem[] : [],
    onboardings: Array.isArray(r.onboardings) ? r.onboardings as OnboardingRecordItem[] : [],
    tasks: Array.isArray(r.tasks) ? r.tasks as TaskItemRecord[] : [],
  };
}

function storeTotalItems(store: WorkspaceStore): number {
  return store.fnf.length + store.onboardings.length + store.tasks.length;
}

// Helper to read workspace data.
// Priority: Dedicated workspace_store table -> In-Memory cache -> legacy applications table -> local workspace.json
async function readData(): Promise<WorkspaceStore> {
  const supabase = getSupabaseClient();

  // 1. Try the dedicated workspace_store table (Primary Source of Truth)
  try {
    const { data, error } = await supabase
      .from("workspace_store")
      .select("data")
      .eq("key", WORKSPACE_KEY)
      .limit(1)
      .maybeSingle();

    if (!error && data && data.data !== undefined && data.data !== null) {
      const store = parseStore(data.data);
      inMemoryStore = store;
      return store;
    }
  } catch (err) {
    console.error("[workspace] Unexpected Supabase workspace_store read error:", err);
  }

  // 2. Return in-memory cache if available (e.g. transient DB glitch)
  if (inMemoryStore !== null) {
    return inMemoryStore;
  }

  // 3. Legacy fallback: check applications table ONLY if workspace_store row was not found
  try {
    const { data, error } = await supabase
      .from("applications")
      .select("id, notes")
      .or(`name.eq.${WORKSPACE_STORE_NAME},status.eq.WORKSPACE_STORE`)
      .limit(1);

    if (!error && data && data.length > 0 && data[0].notes) {
      try {
        const parsed = JSON.parse(data[0].notes);
        const store = parseStore(parsed);
        inMemoryStore = store;
        // Seed dedicated workspace_store table for future reads
        await writeData(store);
        return store;
      } catch (pErr) {
        console.error("[workspace] JSON parse error for legacy applications store:", pErr);
      }
    }
  } catch (err) {
    console.error("[workspace] Legacy applications store read error:", err);
  }

  // 4. Fallback: read from local workspace.json
  try {
    const fileContent = await fs.readFile(projectJsonPath, "utf-8");
    const parsed = JSON.parse(fileContent);
    const store = parseStore(parsed);
    inMemoryStore = store;
    await writeData(store);
    return store;
  } catch {
    /* file missing or unreadable — return empty */
  }

  inMemoryStore = emptyStore();
  await writeData(inMemoryStore);
  return inMemoryStore;
}

// Helper to write workspace data.
// Writes to: inMemoryStore -> workspace_store table -> legacy applications table -> local workspace.json
async function writeData(data: WorkspaceStore) {
  inMemoryStore = data;
  const supabase = getSupabaseClient();
  const notesStr = JSON.stringify(data);

  // 1. Upsert to dedicated workspace_store table
  try {
    const { error } = await supabase
      .from("workspace_store")
      .upsert({ key: WORKSPACE_KEY, data }, { onConflict: "key" });

    if (error) {
      console.error("[workspace] Supabase workspace_store write error:", error);
    }
  } catch (err) {
    console.error("[workspace] Unexpected Supabase write error:", err);
  }

  // 2. Dual-write to legacy applications table for backwards compatibility
  try {
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .or(`name.eq.${WORKSPACE_STORE_NAME},status.eq.WORKSPACE_STORE`)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from("applications")
        .update({ notes: notesStr })
        .eq("id", existing[0].id);
    } else {
      await supabase
        .from("applications")
        .insert([{
          name: WORKSPACE_STORE_NAME,
          status: "WORKSPACE_STORE",
          notes: notesStr
        }]);
    }
  } catch (err) {
    console.error("[workspace] Legacy applications store write error:", err);
  }

  // 3. Mirror to local workspace.json
  try {
    const dir = path.dirname(projectJsonPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(projectJsonPath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    /* ignore in read-only serverless environments */
  }
}

export async function GET() {
  try {
    const data = await readData();
    return Response.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load workspace data";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, payload } = await request.json();
    if (!action) {
      return Response.json({ error: "Action is required" }, { status: 400 });
    }

    const data = await readData();
    const timestamp = new Date().toISOString();

    switch (action) {
      /* ──────────────── FNF Operations ──────────────── */
      case "add_fnf": {
        const { employeeName, department, resignationDate, lastWorkingDay, amount, remarks, dueTime } = payload || {};
        const newFnf: FnfRecordItem = {
          id: `fnf-${Date.now()}`,
          employeeName: employeeName || "Unknown Employee",
          department: department || "General",
          resignationDate: resignationDate || timestamp.split("T")[0],
          lastWorkingDay: lastWorkingDay || timestamp.split("T")[0],
          settlementStatus: "Draft",
          amount: parseFloat(amount) || 0,
          remarks: remarks || "",
          dueTime: dueTime || "12:00",
          notified: false,
          tasks: [
            { id: "t1", name: "IT Asset Return Check", completed: false, section: "Assets" },
            { id: "t2", name: "Revoke Email & Slack Accounts", completed: false, section: "IT" },
            { id: "t3", name: "Verify Pending Gratuity / Leaves", completed: false, section: "HR" },
            { id: "t4", name: "Final Salary & Tax Calculation", completed: false, section: "Finance" }
          ],
          createdAt: timestamp
        };
        data.fnf.unshift(newFnf);
        break;
      }

      case "update_fnf": {
        const { id, settlementStatus, amount, remarks, resignationDate, lastWorkingDay, employeeName, department, dueTime, notified } = payload || {};
        const index = data.fnf.findIndex((f: FnfRecordItem) => String(f.id) === String(id));
        if (index !== -1) {
          data.fnf[index] = {
            ...data.fnf[index],
            employeeName: employeeName !== undefined ? employeeName : data.fnf[index].employeeName,
            department: department !== undefined ? department : data.fnf[index].department,
            settlementStatus: settlementStatus || data.fnf[index].settlementStatus,
            amount: amount !== undefined ? (parseFloat(amount) || 0) : data.fnf[index].amount,
            remarks: remarks !== undefined ? remarks : data.fnf[index].remarks,
            resignationDate: resignationDate || data.fnf[index].resignationDate,
            lastWorkingDay: lastWorkingDay || data.fnf[index].lastWorkingDay,
            dueTime: dueTime !== undefined ? dueTime : data.fnf[index].dueTime,
            notified: notified !== undefined ? Boolean(notified) : data.fnf[index].notified,
          };
        }
        break;
      }

      case "delete_fnf": {
        const { id } = (payload || {}) as { id: string };
        data.fnf = data.fnf.filter((f: FnfRecordItem) => String(f.id) !== String(id));
        break;
      }

      case "clear_fnf": {
        data.fnf = [];
        break;
      }

      case "toggle_fnf_task": {
        const { fnfId, taskId, completed } = payload || {};
        const fnf = data.fnf.find((f: FnfRecordItem) => String(f.id) === String(fnfId));
        if (fnf) {
          const task = fnf.tasks.find((t: FnfTaskItem) => String(t.id) === String(taskId));
          if (task) {
            task.completed = Boolean(completed);
            const allDone = fnf.tasks.every((t: FnfTaskItem) => t.completed);
            if (allDone && fnf.settlementStatus === "Draft") {
              fnf.settlementStatus = "Approved";
            } else if (!allDone && fnf.settlementStatus === "Approved") {
              fnf.settlementStatus = "Draft";
            }
          }
        }
        break;
      }

      case "add_fnf_task": {
        const { fnfId, taskName, section } = payload || {};
        const fnf = data.fnf.find((f: FnfRecordItem) => String(f.id) === String(fnfId));
        if (fnf && taskName && taskName.trim()) {
          fnf.tasks.push({
            id: `ft-${Date.now()}`,
            name: taskName.trim(),
            completed: false,
            section: section || "General"
          });
        }
        break;
      }

      case "delete_fnf_task": {
        const { fnfId, taskId } = payload || {};
        const fnf = data.fnf.find((f: FnfRecordItem) => String(f.id) === String(fnfId));
        if (fnf) {
          fnf.tasks = fnf.tasks.filter((t: FnfTaskItem) => String(t.id) !== String(taskId));
        }
        break;
      }

      /* ────────────── Onboarding Operations ────────────── */
      case "add_onboarding": {
        const { candidateName, role, startDate, mentor, email, dueTime } = payload || {};
        const newOnboarding: OnboardingRecordItem = {
          id: `onb-${Date.now()}`,
          candidateName: candidateName || "New Hire",
          role: role || "General",
          startDate: startDate || timestamp.split("T")[0],
          status: "Not Started",
          mentor: mentor || "Unassigned",
          email: email || "",
          dueTime: dueTime || "10:00",
          notified: false,
          tasks: [
            { id: "o1", name: "Educational Document Verification", completed: false },
            { id: "o2", name: "Laptop & IT Hardware Delivery", completed: false },
            { id: "o3", name: "Generate Corporate Email Address", completed: false },
            { id: "o4", name: "Send Welcome Mail & Agenda", completed: false },
            { id: "o5", name: "Conduct Day 1 Orientation Session", completed: false }
          ],
          createdAt: timestamp
        };
        data.onboardings.unshift(newOnboarding);
        break;
      }

      case "update_onboarding": {
        const { id, candidateName, status, mentor, email, startDate, role, dueTime, notified } = payload || {};
        const index = data.onboardings.findIndex((o: OnboardingRecordItem) => String(o.id) === String(id));
        if (index !== -1) {
          data.onboardings[index] = {
            ...data.onboardings[index],
            candidateName: candidateName !== undefined ? candidateName : data.onboardings[index].candidateName,
            status: status || data.onboardings[index].status,
            mentor: mentor !== undefined ? mentor : data.onboardings[index].mentor,
            email: email !== undefined ? email : data.onboardings[index].email,
            startDate: startDate || data.onboardings[index].startDate,
            role: role || data.onboardings[index].role,
            dueTime: dueTime !== undefined ? dueTime : data.onboardings[index].dueTime,
            notified: notified !== undefined ? Boolean(notified) : data.onboardings[index].notified,
          };
        }
        break;
      }

      case "delete_onboarding": {
        const { id } = (payload || {}) as { id: string };
        data.onboardings = data.onboardings.filter((o: OnboardingRecordItem) => String(o.id) !== String(id));
        break;
      }

      case "clear_onboardings": {
        data.onboardings = [];
        break;
      }

      case "toggle_onboarding_task": {
        const { onboardingId, taskId, completed } = payload || {};
        const onboarding = data.onboardings.find((o: OnboardingRecordItem) => String(o.id) === String(onboardingId));
        if (onboarding) {
          const task = onboarding.tasks.find((t: OnboardingTaskItem) => String(t.id) === String(taskId));
          if (task) {
            task.completed = Boolean(completed);
            const doneCount = onboarding.tasks.filter((t: OnboardingTaskItem) => t.completed).length;
            const total = onboarding.tasks.length;
            if (doneCount === total && total > 0) {
              onboarding.status = "Completed";
            } else if (doneCount > 0) {
              onboarding.status = "In Progress";
            } else {
              onboarding.status = "Not Started";
            }
          }
        }
        break;
      }

      case "add_onboarding_task": {
        const { onboardingId, taskName } = payload || {};
        const onboarding = data.onboardings.find((o: OnboardingRecordItem) => String(o.id) === String(onboardingId));
        if (onboarding && taskName && taskName.trim()) {
          onboarding.tasks.push({
            id: `ot-${Date.now()}`,
            name: taskName.trim(),
            completed: false
          });
        }
        break;
      }

      case "delete_onboarding_task": {
        const { onboardingId, taskId } = payload || {};
        const onboarding = data.onboardings.find((o: OnboardingRecordItem) => String(o.id) === String(onboardingId));
        if (onboarding) {
          onboarding.tasks = onboarding.tasks.filter((t: OnboardingTaskItem) => String(t.id) !== String(taskId));
        }
        break;
      }

      /* ──────────────── Task Operations ──────────────── */
      case "add_task": {
        const { title, assignedTo, dueDate, priority, category, dueTime } = payload || {};
        const normalizedPriority = priority === "High Priority" ? "High" : (priority || "Medium");
        const newTask: TaskItemRecord = {
          id: `tsk-${Date.now()}`,
          title: title || "New Task",
          assignedTo: assignedTo || "Admin",
          dueDate: dueDate || timestamp.split("T")[0],
          dueTime: dueTime || "17:00",
          priority: normalizedPriority,
          status: "To Do",
          category: category || "General",
          notified: false,
          createdAt: timestamp
        };
        data.tasks.unshift(newTask);
        break;
      }

      case "update_task": {
        const { id, title, assignedTo, dueDate, priority, status, category, dueTime, notified } = payload || {};
        const index = data.tasks.findIndex((t: TaskItemRecord) => String(t.id) === String(id));
        if (index !== -1) {
          const normalizedPriority = priority === "High Priority" ? "High" : (priority || data.tasks[index].priority);
          data.tasks[index] = {
            ...data.tasks[index],
            title: title !== undefined ? title : data.tasks[index].title,
            assignedTo: assignedTo !== undefined ? assignedTo : data.tasks[index].assignedTo,
            dueDate: dueDate !== undefined ? dueDate : data.tasks[index].dueDate,
            dueTime: dueTime !== undefined ? dueTime : data.tasks[index].dueTime,
            priority: normalizedPriority,
            status: status !== undefined ? status : data.tasks[index].status,
            category: category !== undefined ? category : data.tasks[index].category,
            notified: notified !== undefined ? Boolean(notified) : data.tasks[index].notified,
          };
        }
        break;
      }

      case "delete_task": {
        const { id } = (payload || {}) as { id: string };
        data.tasks = data.tasks.filter((t: TaskItemRecord) => String(t.id) !== String(id));
        break;
      }

      case "clear_completed_tasks": {
        data.tasks = data.tasks.filter((t: TaskItemRecord) => t.status !== "Done");
        break;
      }

      case "clear_tasks": {
        data.tasks = [];
        break;
      }

      case "sync_workspace": {
        if (payload && typeof payload === "object") {
          const sync = payload as Partial<WorkspaceStore>;
          if (Array.isArray(sync.fnf)) data.fnf = sync.fnf;
          if (Array.isArray(sync.onboardings)) data.onboardings = sync.onboardings;
          if (Array.isArray(sync.tasks)) data.tasks = sync.tasks;
        }
        break;
      }

      case "reset_workspace": {
        data.fnf = [];
        data.onboardings = [];
        data.tasks = [];
        break;
      }

      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    await writeData(data);
    return Response.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to execute workspace action";
    return Response.json({ error: msg }, { status: 500 });
  }
}
