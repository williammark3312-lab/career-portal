import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fxksnkvyeyypkckehqpx.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isPlaceholder = !serviceKey || serviceKey.includes("your_service_role_key_here");
  const key = isPlaceholder
    ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H")
    : serviceKey;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}


interface Comment {
  id: string; text: string; created_at: string; author: string;
}
interface InterviewData {
  proposed_slots: string[];
  selected_slot: string | null;
  status: "pending" | "scheduled";
}
interface NotesData {
  comments: Comment[];
  interview: InterviewData | null;
}

function parseNotes(raw: string | null | undefined): NotesData {
  if (!raw) return { comments: [], interview: null };
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) {
      return { comments: p, interview: null };
    }
    if (p && typeof p === "object") {
      return {
        comments: Array.isArray(p.comments) ? p.comments : [],
        interview: p.interview || null
      };
    }
  } catch { /* fallback */ }
  return {
    comments: [{ id: "legacy", text: raw, created_at: new Date().toISOString(), author: "Admin" }],
    interview: null
  };
}

// GET /api/schedule/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid invitation link." }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. Try fetching from applications table
    const { data: appData, error: appError } = await supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    // Surface RLS/auth errors directly so they're visible in the response
    if (appError && appError.code !== "PGRST116") {
      console.error("[schedule GET] applications query error:", appError);
      return NextResponse.json(
        { error: `Database error: ${appError.message} (code: ${appError.code})` },
        { status: 500 }
      );
    }

    if (appData) {
      let jobData = null;
      if (appData.job_id) {
        const { data } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", appData.job_id)
          .maybeSingle();
        jobData = data;
      }
      return NextResponse.json({
        app: appData,
        job: jobData,
        isCvDb: false
      });
    }

    // 2. Try fetching from cv_database table
    const { data: cvData, error: cvError } = await supabase
      .from("cv_database")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (cvError && cvError.code !== "PGRST116") {
      console.error("[schedule GET] cv_database query error:", cvError);
      return NextResponse.json(
        { error: `Database error: ${cvError.message} (code: ${cvError.code})` },
        { status: 500 }
      );
    }

    if (cvData) {
      return NextResponse.json({
        app: cvData,
        job: null,
        isCvDb: true
      });
    }

    return NextResponse.json({ error: "We couldn't find this scheduling invitation." }, { status: 404 });
  } catch (err) {
    console.error("[schedule GET] unexpected error:", err);
    const errMsg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// POST /api/schedule/[id]
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { selectedSlot } = await request.json();

    if (!selectedSlot) {
      return NextResponse.json({ error: "Selected slot is required." }, { status: 400 });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid invitation link." }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. Check applications first
    const { data: appData, error: appError } = await supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (appError && appError.code !== "PGRST116") {
      console.error("[schedule POST] applications query error:", appError);
      return NextResponse.json({ error: appError.message }, { status: 500 });
    }

    if (appData) {
      const parsed = parseNotes(appData.notes || appData.comments);
      const updatedInterview: InterviewData = {
        proposed_slots: parsed.interview?.proposed_slots || [],
        selected_slot: selectedSlot,
        status: "scheduled"
      };

      const notesPayload = JSON.stringify({
        comments: parsed.comments,
        interview: updatedInterview
      });

      const { error: updateError } = await supabase
        .from("applications")
        .update({ notes: notesPayload })
        .eq("id", id);

      if (updateError) {
        console.error("[schedule POST] applications update error:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // 2. Check cv_database
    const { data: cvData, error: cvError } = await supabase
      .from("cv_database")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (cvError && cvError.code !== "PGRST116") {
      console.error("[schedule POST] cv_database query error:", cvError);
      return NextResponse.json({ error: cvError.message }, { status: 500 });
    }

    if (cvData) {
      const parsed = parseNotes(cvData.notes || cvData.comments);
      const updatedInterview: InterviewData = {
        proposed_slots: parsed.interview?.proposed_slots || [],
        selected_slot: selectedSlot,
        status: "scheduled"
      };

      const notesPayload = JSON.stringify({
        comments: parsed.comments,
        interview: updatedInterview
      });

      const { error: updateError } = await supabase
        .from("cv_database")
        .update({ comments: notesPayload })
        .eq("id", id);

      if (updateError) {
        console.error("[schedule POST] cv_database update error:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  } catch (err) {
    console.error("[schedule POST] unexpected error:", err);
    const errMsg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
