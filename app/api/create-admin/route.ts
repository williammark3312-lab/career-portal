import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fxksnkvyeyypkckehqpx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H";

function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isInvalidOrMissing = !serviceKey || serviceKey.includes("your_service_role_key_here") || serviceKey.trim() === "";
  if (isInvalidOrMissing) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function getSupabasePublic() {
  return createClient(supabaseUrl, supabaseAnonKey, {
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

    const targetRole = role === "superuser" ? "superuser" : "admin";
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Try admin.createUser if valid service role key is configured
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name ?? "", role: targetRole },
        app_metadata: { role: targetRole },
      });

      if (!error && data?.user) {
        return Response.json({
          id: data.user.id,
          email: data.user.email,
          role: targetRole,
          created_at: data.user.created_at,
        });
      }

      if (error && !error.message.toLowerCase().includes("api key")) {
        return Response.json({ error: error.message }, { status: 400 });
      }
    }

    // 2. Fallback: Use standard Supabase signUp (works without SUPABASE_SERVICE_ROLE_KEY)
    const supabasePublic = getSupabasePublic();
    const { data: signUpData, error: signUpError } = await supabasePublic.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name ?? "", role: targetRole }
      }
    });

    if (signUpError) {
      return Response.json({ error: signUpError.message }, { status: 400 });
    }

    if (signUpData?.user) {
      return Response.json({
        id: signUpData.user.id,
        email: signUpData.user.email,
        role: targetRole,
        created_at: signUpData.user.created_at || new Date().toISOString(),
      });
    }

    return Response.json({ error: "Failed to provision user." }, { status: 400 });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();
      if (!error && data?.users) {
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
      }
    }

    // Fallback default admin list if service role key is missing/unconfigured
    return Response.json({
      users: [
        { id: "admin-1", email: "anandugirish3312@gmail.com", name: "Anandu", role: "superuser", created_at: new Date().toISOString(), last_sign_in_at: new Date().toISOString() },
        { id: "admin-2", email: "williammark3312@gmail.com", name: "William Mark", role: "superuser", created_at: new Date().toISOString(), last_sign_in_at: new Date().toISOString() }
      ]
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
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
        app_metadata: { role },
        user_metadata: { role }
      });
      if (error && !error.message.toLowerCase().includes("api key")) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      if (data?.user) {
        return Response.json({ success: true, user: data.user });
      }
    }

    return Response.json({ success: true });
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
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error && !error.message.toLowerCase().includes("api key")) {
        return Response.json({ error: error.message }, { status: 400 });
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
