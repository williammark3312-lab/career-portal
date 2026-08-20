import { createClient } from "@supabase/supabase-js";

interface AdminUserRecord {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "superuser";
  created_at: string;
  last_sign_in_at?: string | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fxksnkvyeyypkckehqpx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H";

const ADMIN_STORE_KEY = "admin_users";

let inMemoryAdminUsers: AdminUserRecord[] | null = null;

const DEFAULT_USERS: AdminUserRecord[] = [
  { id: "00000000-0000-4000-a000-000000000001", email: "anandugirish3312@gmail.com", name: "Anandu", role: "superuser", created_at: "2026-08-20T00:00:00.000Z" },
  { id: "00000000-0000-4000-a000-000000000002", email: "williammark3312@gmail.com", name: "William Mark", role: "superuser", created_at: "2026-08-20T00:00:00.000Z" }
];

function getSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isInvalid = !serviceKey || serviceKey.includes("your_service_role_key_here") || serviceKey.trim() === "";
  const key = isInvalid ? supabaseAnonKey : serviceKey;
  return createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isInvalidOrMissing = !serviceKey || serviceKey.includes("your_service_role_key_here") || serviceKey.trim() === "";
  if (isInvalidOrMissing) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function isValidUUID(id: string): boolean {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function isMockUUID(id: string): boolean {
  return typeof id === "string" && id.startsWith("00000000-0000-4000-a000-");
}

async function readAdminUsers(): Promise<AdminUserRecord[]> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("workspace_store")
      .select("data")
      .eq("key", ADMIN_STORE_KEY)
      .limit(1)
      .maybeSingle();

    if (!error && data && data.data && Array.isArray((data.data as Record<string, unknown>).users)) {
      const users = (data.data as Record<string, unknown>).users as AdminUserRecord[];
      if (users.length > 0) {
        inMemoryAdminUsers = users;
        return users;
      }
    }
  } catch (err) {
    console.error("[create-admin] workspace_store read error:", err);
  }

  if (inMemoryAdminUsers && inMemoryAdminUsers.length > 0) {
    return inMemoryAdminUsers;
  }

  inMemoryAdminUsers = [...DEFAULT_USERS];
  await writeAdminUsers(inMemoryAdminUsers);
  return inMemoryAdminUsers;
}

async function writeAdminUsers(users: AdminUserRecord[]) {
  inMemoryAdminUsers = users;
  const supabase = getSupabaseClient();

  try {
    await supabase
      .from("workspace_store")
      .upsert({ key: ADMIN_STORE_KEY, data: { users } }, { onConflict: "key" });
  } catch (err) {
    console.error("[create-admin] workspace_store write error:", err);
  }
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        if (!error && data?.users && data.users.length > 0) {
          const authUsers: AdminUserRecord[] = data.users.map(u => ({
            id: u.id,
            email: u.email || "",
            name: u.user_metadata?.full_name ?? null,
            role: (u.app_metadata?.role ?? u.user_metadata?.role) === "superuser" ? "superuser" : "admin",
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
          }));
          await writeAdminUsers(authUsers);
          return Response.json({ users: authUsers });
        }
      } catch (err) {
        console.warn("Supabase listUsers failed, returning persistent admin store:", err);
      }
    }

    const users = await readAdminUsers();
    return Response.json({ users });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { email, password, name, role } = await request.json();

    if (!email || !password) {
      return Response.json({ error: "Email and password are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const targetRole: "admin" | "superuser" = role === "superuser" ? "superuser" : "admin";
    let newUserId = `00000000-0000-4000-a000-${Date.now().toString().slice(-12).padStart(12, "0")}`;
    let createdAt = new Date().toISOString();

    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: name ?? "", role: targetRole },
          app_metadata: { role: targetRole },
        });

        if (!error && data?.user) {
          newUserId = data.user.id;
          createdAt = data.user.created_at;
        } else if (error && !error.message.toLowerCase().includes("api key")) {
          return Response.json({ error: error.message }, { status: 400 });
        }
      } catch (err) {
        console.warn("admin.createUser failed:", err);
      }
    } else {
      try {
        const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
        const { data: signUpData } = await supabasePublic.auth.signUp({
          email,
          password,
          options: { data: { full_name: name ?? "", role: targetRole } }
        });
        if (signUpData?.user) {
          newUserId = signUpData.user.id;
          createdAt = signUpData.user.created_at || createdAt;
        }
      } catch (e) {
        console.warn("public signUp failed:", e);
      }
    }

    const users = await readAdminUsers();
    const newUser: AdminUserRecord = {
      id: newUserId,
      email: email.trim(),
      name: name?.trim() || null,
      role: targetRole,
      created_at: createdAt
    };

    const filtered = users.filter(u => u.email.toLowerCase() !== email.trim().toLowerCase());
    filtered.unshift(newUser);
    await writeAdminUsers(filtered);

    return Response.json(newUser);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, role } = await request.json();
    if (!id) {
      return Response.json({ error: "User ID is required." }, { status: 400 });
    }
    if (role !== "admin" && role !== "superuser") {
      return Response.json({ error: "Invalid role value." }, { status: 400 });
    }

    if (isValidUUID(id) && !isMockUUID(id)) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(id, {
            app_metadata: { role },
            user_metadata: { role }
          });
        } catch (err) {
          console.warn("Supabase admin updateUserById failed:", err);
        }
      }
    }

    const users = await readAdminUsers();
    const target = users.find(u => u.id === id || u.email.toLowerCase() === String(id).toLowerCase());
    if (target) {
      target.role = role as "admin" | "superuser";
    } else {
      const index = users.findIndex(u => u.id === id);
      if (index !== -1) users[index].role = role as "admin" | "superuser";
    }
    await writeAdminUsers(users);

    return Response.json({ success: true, users });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ error: "User ID is required." }, { status: 400 });
    }

    if (isValidUUID(id) && !isMockUUID(id)) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(id);
        } catch (err) {
          console.warn("Supabase admin deleteUser failed:", err);
        }
      }
    }

    const users = await readAdminUsers();
    const updatedUsers = users.filter(u => u.id !== id && u.email.toLowerCase() !== id.toLowerCase());
    await writeAdminUsers(updatedUsers);

    return Response.json({ success: true, users: updatedUsers });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
