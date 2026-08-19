import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

interface FnfTaskItem { id: string; name: string; completed: boolean; section: string; }
interface FnfRecordItem { id: string; employeeName: string; department: string; resignationDate: string; lastWorkingDay: string; settlementStatus: string; amount: number; remarks: string; tasks: FnfTaskItem[]; createdAt: string; }
interface OnboardingTaskItem { id: string; name: string; completed: boolean; }
interface OnboardingRecordItem { id: string; candidateName: string; role: string; startDate: string; status: string; mentor: string; email: string; tasks: OnboardingTaskItem[]; createdAt: string; }
interface TaskItemRecord { id: string; title: string; assignedTo: string; dueDate: string; priority: string; status: string; category: string; createdAt: string; }
interface WorkspaceStore { fnf: FnfRecordItem[]; onboardings: OnboardingRecordItem[]; tasks: TaskItemRecord[]; }

const projectJsonPath = path.join(process.cwd(), "data", "workspace.json");
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

let inMemoryStore: WorkspaceStore | null = null;

// Helper to read workspace data from Supabase cloud database with fallback to local workspace.json
async function readData(): Promise<WorkspaceStore> {
  const supabase = getSupabaseClient();

  // 1. Fetch persistent store from Supabase cloud database
  try {
    const { data, error } = await supabase
      .from("applications")
      .select("id, notes")
      .eq("name", WORKSPACE_STORE_NAME)
      .limit(1);

    if (!error && data && data.length > 0 && data[0].notes) {
      try {
        const parsed = JSON.parse(data[0].notes);
        if (parsed && typeof parsed === "object") {
          inMemoryStore = {
            fnf: Array.isArray(parsed.fnf) ? parsed.fnf : [],
            onboardings: Array.isArray(parsed.onboardings) ? parsed.onboardings : [],
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
          };
          return inMemoryStore;
        }
      } catch (pErr) {
        console.error("JSON parse error for Supabase workspace store:", pErr);
      }
    }
  } catch (err) {
    console.error("Supabase workspace read error:", err);
  }

  // If in-memory store is available when Supabase fails temporarily, return it
  if (inMemoryStore) {
    return inMemoryStore;
  }

  // 2. Fallback to initial seed data from project workspace.json file
  let initialData: WorkspaceStore = { fnf: [], onboardings: [], tasks: [] };
  try {
    const fileContent = await fs.readFile(projectJsonPath, "utf-8");
    const parsed = JSON.parse(fileContent);
    if (parsed && typeof parsed === "object") {
      initialData = {
        fnf: Array.isArray(parsed.fnf) ? parsed.fnf : [],
        onboardings: Array.isArray(parsed.onboardings) ? parsed.onboardings : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
      };
    }
  } catch {
    initialData = { fnf: [], onboardings: [], tasks: [] };
  }

  // 3. Seed Supabase cloud database so all future requests hit cloud database
  await writeData(initialData);
  return initialData;
}

// Helper to write workspace data back to Supabase cloud database and local fallback file
async function writeData(data: WorkspaceStore) {
  inMemoryStore = data;
  const supabase = getSupabaseClient();
  const notesStr = JSON.stringify(data);

  // 1. Persist to Supabase cloud database
  try {
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("name", WORKSPACE_STORE_NAME)
      .limit(1);

    if (existing && existing.length > 0) {
      const targetId = existing[0].id;
      const { error } = await supabase
        .from("applications")
        .update({ notes: notesStr })
        .eq("id", targetId);
      if (error) console.error("Error updating Supabase workspace store:", error);
    } else {
      const { error } = await supabase
        .from("applications")
        .insert([{
          name: WORKSPACE_STORE_NAME,
          status: "WORKSPACE_STORE",
          notes: notesStr
        }]);
      if (error) console.error("Error inserting Supabase workspace store:", error);
    }
  } catch (err) {
    console.error("Supabase workspace write error:", err);
  }

  // 2. Secondary write to local workspace.json file if filesystem allows (local dev)
  try {
    const dir = path.dirname(projectJsonPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(projectJsonPath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    /* ignore local file write errors in read-only serverless environments */
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
        const { employeeName, department, resignationDate, lastWorkingDay, amount, remarks } = payload || {};
        const newFnf: FnfRecordItem = {
          id: `fnf-${Date.now()}`,
          employeeName: employeeName || "Unknown Employee",
          department: department || "General",
          resignationDate: resignationDate || timestamp.split("T")[0],
          lastWorkingDay: lastWorkingDay || timestamp.split("T")[0],
          settlementStatus: "Draft",
          amount: parseFloat(amount) || 0,
          remarks: remarks || "",
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
        const { id, settlementStatus, amount, remarks, resignationDate, lastWorkingDay, employeeName, department } = payload || {};
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
            
            // Auto update status if all are completed
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
        const { candidateName, role, startDate, mentor, email } = payload || {};
        const newOnboarding: OnboardingRecordItem = {
          id: `onb-${Date.now()}`,
          candidateName: candidateName || "New Hire",
          role: role || "General",
          startDate: startDate || timestamp.split("T")[0],
          status: "Not Started",
          mentor: mentor || "Unassigned",
          email: email || "",
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
        const { id, candidateName, status, mentor, email, startDate, role } = payload || {};
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

            // Auto update status based on checklist progression
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
        const { title, assignedTo, dueDate, priority, category } = payload || {};
        const normalizedPriority = priority === "High Priority" ? "High" : (priority || "Medium");
        const newTask: TaskItemRecord = {
          id: `tsk-${Date.now()}`,
          title: title || "New Task",
          assignedTo: assignedTo || "Admin",
          dueDate: dueDate || timestamp.split("T")[0],
          priority: normalizedPriority,
          status: "To Do",
          category: category || "General",
          createdAt: timestamp
        };
        data.tasks.unshift(newTask);
        break;
      }

      case "update_task": {
        const { id, title, assignedTo, dueDate, priority, status, category } = payload || {};
        const index = data.tasks.findIndex((t: TaskItemRecord) => String(t.id) === String(id));
        if (index !== -1) {
          const normalizedPriority = priority === "High Priority" ? "High" : (priority || data.tasks[index].priority);
          data.tasks[index] = {
            ...data.tasks[index],
            title: title !== undefined ? title : data.tasks[index].title,
            assignedTo: assignedTo !== undefined ? assignedTo : data.tasks[index].assignedTo,
            dueDate: dueDate !== undefined ? dueDate : data.tasks[index].dueDate,
            priority: normalizedPriority,
            status: status !== undefined ? status : data.tasks[index].status,
            category: category !== undefined ? category : data.tasks[index].category,
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
