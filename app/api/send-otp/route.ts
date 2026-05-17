import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role for server-side writes
);

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Upsert OTP (one active OTP per email at a time)
    await supabase.from("otp_verifications").upsert(
      { email, otp, expires_at: expiresAt, verified: false },
      { onConflict: "email" }
    );

    // Send OTP email
    const { error } = await resend.emails.send({
      from: "Careers Portal <onboarding@resend.dev>",
      to: email,
      subject: "Verify your email — OTP",
      html: `
        <div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 32px; background: #F8F9FC; border-radius: 20px;">
          <div style="margin-bottom: 32px;">
            <span style="font-size: 14px; font-weight: 700; letter-spacing: -0.01em; color: #1a3bbd;">Careers Portal</span>
          </div>
          <h1 style="font-size: 28px; font-weight: 700; color: #121317; margin: 0 0 8px;">Verify your email</h1>
          <p style="font-size: 15px; color: #737A87; margin: 0 0 32px; line-height: 1.6;">
            Hi ${name || "there"}, use the code below to verify your email and complete your application.
          </p>
          <div style="background: white; border: 1px solid #E1E6EC; border-radius: 16px; padding: 28px; text-align: center; margin-bottom: 28px;">
            <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #B2BBC5;">Your OTP</p>
            <p style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #1a3bbd;">${otp}</p>
          </div>
          <p style="font-size: 13px; color: #B2BBC5; text-align: center; margin: 0;">
            This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send OTP." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
