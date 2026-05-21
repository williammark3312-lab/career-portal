import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return Response.json({ error: "Email and password are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name ?? "" },
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at,
    });
  } catch (err) {
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({
      users: data.users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.full_name ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })),
    });
  } catch {
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ error: "User ID is required." }, { status: 400 });
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}

