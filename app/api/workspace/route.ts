import { promises as fs } from "fs";
import path from "path";
import os from "os";

interface FnfTaskItem { id: string; name: string; completed: boolean; section: string; }
interface FnfRecordItem { id: string; employeeName: string; department: string; resignationDate: string; lastWorkingDay: string; settlementStatus: string; amount: number; remarks: string; tasks: FnfTaskItem[]; createdAt: string; }
interface OnboardingTaskItem { id: string; name: string; completed: boolean; }
interface OnboardingRecordItem { id: string; candidateName: string; role: string; startDate: string; status: string; mentor: string; email: string; tasks: OnboardingTaskItem[]; createdAt: string; }
interface TaskItemRecord { id: string; title: string; assignedTo: string; dueDate: string; priority: string; status: string; category: string; createdAt: string; }
interface WorkspaceStore { fnf: FnfRecordItem[]; onboardings: OnboardingRecordItem[]; tasks: TaskItemRecord[]; }

const projectJsonPath = path.join(process.cwd(), "data", "workspace.json");
const tmpJsonPath = path.join(os.tmpdir(), "workspace.json");

let inMemoryStore: WorkspaceStore | null = null;

// Helper to read data from workspace.json or /tmp in serverless
async function readData(): Promise<WorkspaceStore> {
  if (inMemoryStore) {
    return inMemoryStore;
  }

  // 1. Try reading from /tmp/workspace.json (modified state in serverless)
  try {
    const tmpContent = await fs.readFile(tmpJsonPath, "utf-8");
    inMemoryStore = JSON.parse(tmpContent);
    return inMemoryStore!;
  } catch {
    // 2. Fallback to initial seed data from project data folder
    try {
      const fileContent = await fs.readFile(projectJsonPath, "utf-8");
      inMemoryStore = JSON.parse(fileContent);
      return inMemoryStore!;
    } catch {
      inMemoryStore = { fnf: [], onboardings: [], tasks: [] };
      return inMemoryStore;
    }
  }
}

// Helper to write data back safely in both local and serverless Vercel environments
async function writeData(data: WorkspaceStore) {
  inMemoryStore = data;

  // 1. Attempt writing to project path (local dev environment)
  try {
    const dir = path.dirname(projectJsonPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(projectJsonPath, JSON.stringify(data, null, 2), "utf-8");
    return;
  } catch {
    // 2. If project dir is read-only (e.g. Vercel serverless /var/task), write to /tmp
    try {
      await fs.writeFile(tmpJsonPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (tmpErr) {
      console.error("Serverless storage write warning:", tmpErr);
    }
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
        const { employeeName, department, resignationDate, lastWorkingDay, amount, remarks } = payload;
        const newFnf = {
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
        const { id, settlementStatus, amount, remarks, resignationDate, lastWorkingDay } = payload;
        const index = data.fnf.findIndex((f: FnfRecordItem) => f.id === id);
        if (index !== -1) {
          data.fnf[index] = {
            ...data.fnf[index],
            settlementStatus: settlementStatus || data.fnf[index].settlementStatus,
            amount: amount !== undefined ? parseFloat(amount) : data.fnf[index].amount,
            remarks: remarks !== undefined ? remarks : data.fnf[index].remarks,
            resignationDate: resignationDate || data.fnf[index].resignationDate,
            lastWorkingDay: lastWorkingDay || data.fnf[index].lastWorkingDay,
          };
        }
        break;
      }

      case "delete_fnf": {
        const { id } = payload as { id: string };
        data.fnf = data.fnf.filter((f: FnfRecordItem) => String(f.id) !== String(id));
        break;
      }

      case "toggle_fnf_task": {
        const { fnfId, taskId, completed } = payload;
        const fnf = data.fnf.find((f: FnfRecordItem) => f.id === fnfId);
        if (fnf) {
          const task = fnf.tasks.find((t: FnfTaskItem) => t.id === taskId);
          if (task) {
            task.completed = completed;
            
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

      /* ────────────── Onboarding Operations ────────────── */
      case "add_onboarding": {
        const { candidateName, role, startDate, mentor, email } = payload;
        const newOnboarding = {
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
        const { id, status, mentor, email, startDate, role } = payload;
        const index = data.onboardings.findIndex((o: OnboardingRecordItem) => o.id === id);
        if (index !== -1) {
          data.onboardings[index] = {
            ...data.onboardings[index],
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
        const { id } = payload as { id: string };
        data.onboardings = data.onboardings.filter((o: OnboardingRecordItem) => String(o.id) !== String(id));
        break;
      }

      case "toggle_onboarding_task": {
        const { onboardingId, taskId, completed } = payload;
        const onboarding = data.onboardings.find((o: OnboardingRecordItem) => o.id === onboardingId);
        if (onboarding) {
          const task = onboarding.tasks.find((t: OnboardingTaskItem) => t.id === taskId);
          if (task) {
            task.completed = completed;

            // Auto update status based on checklist progression
            const doneCount = onboarding.tasks.filter((t: OnboardingTaskItem) => t.completed).length;
            const total = onboarding.tasks.length;
            if (doneCount === total) {
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

      /* ──────────────── Task Operations ──────────────── */
      case "add_task": {
        const { title, assignedTo, dueDate, priority, category } = payload;
        const newTask = {
          id: `tsk-${Date.now()}`,
          title: title || "New Task",
          assignedTo: assignedTo || "Admin",
          dueDate: dueDate || timestamp.split("T")[0],
          priority: priority || "Medium",
          status: "To Do",
          category: category || "General",
          createdAt: timestamp
        };
        data.tasks.unshift(newTask);
        break;
      }

      case "update_task": {
        const { id, title, assignedTo, dueDate, priority, status, category } = payload;
        const index = data.tasks.findIndex((t: TaskItemRecord) => t.id === id);
        if (index !== -1) {
          data.tasks[index] = {
            ...data.tasks[index],
            title: title || data.tasks[index].title,
            assignedTo: assignedTo !== undefined ? assignedTo : data.tasks[index].assignedTo,
            dueDate: dueDate || data.tasks[index].dueDate,
            priority: priority || data.tasks[index].priority,
            status: status || data.tasks[index].status,
            category: category || data.tasks[index].category,
          };
        }
        break;
      }

      case "delete_task": {
        const { id } = payload as { id: string };
        data.tasks = data.tasks.filter((t: TaskItemRecord) => String(t.id) !== String(id));
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
