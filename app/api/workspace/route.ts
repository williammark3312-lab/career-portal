import { promises as fs } from "fs";
import path from "path";

const jsonPath = path.join(process.cwd(), "data", "workspace.json");

// Helper to read data from workspace.json
async function readData() {
  try {
    const fileContent = await fs.readFile(jsonPath, "utf-8");
    return JSON.parse(fileContent);
  } catch {
    return { fnf: [], onboardings: [], tasks: [] };
  }
}

// Helper to write data back to workspace.json
async function writeData(data: any) {
  // Ensure the directory exists
  const dir = path.dirname(jsonPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), "utf-8");
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
        const index = data.fnf.findIndex((f: any) => f.id === id);
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
        const { id } = payload;
        data.fnf = data.fnf.filter((f: any) => f.id !== id);
        break;
      }

      case "toggle_fnf_task": {
        const { fnfId, taskId, completed } = payload;
        const fnf = data.fnf.find((f: any) => f.id === fnfId);
        if (fnf) {
          const task = fnf.tasks.find((t: any) => t.id === taskId);
          if (task) {
            task.completed = completed;
            
            // Auto update status if all are completed
            const allDone = fnf.tasks.every((t: any) => t.completed);
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
        const index = data.onboardings.findIndex((o: any) => o.id === id);
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
        const { id } = payload;
        data.onboardings = data.onboardings.filter((o: any) => o.id !== id);
        break;
      }

      case "toggle_onboarding_task": {
        const { onboardingId, taskId, completed } = payload;
        const onboarding = data.onboardings.find((o: any) => o.id === onboardingId);
        if (onboarding) {
          const task = onboarding.tasks.find((t: any) => t.id === taskId);
          if (task) {
            task.completed = completed;

            // Auto update status based on checklist progression
            const doneCount = onboarding.tasks.filter((t: any) => t.completed).length;
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
        const index = data.tasks.findIndex((t: any) => t.id === id);
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
        const { id } = payload;
        data.tasks = data.tasks.filter((t: any) => t.id !== id);
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
