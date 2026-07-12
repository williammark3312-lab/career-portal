import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url && !key) {
    throw new Error("Both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing from your Vercel Environment Variables.");
  }
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing from your Vercel Environment Variables.");
  }
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing from your Vercel Environment Variables.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
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

    const supabaseAdmin = getSupabaseAdmin();
    const targetRole = role === "superuser" ? "superuser" : "admin";
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name ?? "", role: targetRole },
      app_metadata: { role: targetRole },
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({
      id: data.user.id,
      email: data.user.email,
      role: targetRole,
      created_at: data.user.created_at,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({
      users: data.users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.full_name ?? null,
        role: u.app_metadata?.role ?? u.user_metadata?.role ?? "admin",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })),
    });
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
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      app_metadata: { role },
      user_metadata: { role }
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ success: true, user: data.user });
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
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ success: true });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}


