import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    const { data, error } = await supabase
      .from("otp_verifications")
      .select("otp, expires_at, verified")
      .eq("email", email)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "OTP not found. Please request a new code." }, { status: 404 });
    }

    if (data.verified) {
      return NextResponse.json({ error: "OTP already used." }, { status: 400 });
    }

    if (new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: "OTP expired. Please request a new code." }, { status: 400 });
    }

    if (data.otp !== otp) {
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
    }

    // Mark as verified
    await supabase
      .from("otp_verifications")
      .update({ verified: true })
      .eq("email", email);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
