import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { name, email, jobTitle } = await req.json();

    const { error } = await resend.emails.send({
      from: "Careers Portal <onboarding@resend.dev>",
      to: email,
      subject: `Application received — ${jobTitle}`,
      html: `
        <div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 32px; background: #F8F9FC; border-radius: 20px;">
          <div style="margin-bottom: 32px;">
            <span style="font-size: 14px; font-weight: 700; letter-spacing: -0.01em; color: #1a3bbd;">Careers Portal</span>
          </div>
          <div style="width: 56px; height: 56px; background: rgba(26,59,189,0.08); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
            <span style="font-size: 28px;">✓</span>
          </div>
          <h1 style="font-size: 26px; font-weight: 700; color: #121317; margin: 0 0 12px; letter-spacing: -0.02em;">Application received!</h1>
          <p style="font-size: 15px; color: #737A87; margin: 0 0 24px; line-height: 1.65;">
            Hi <strong style="color: #121317;">${name}</strong>, thank you for applying for the <strong style="color: #1a3bbd;">${jobTitle}</strong> position.
          </p>
          <div style="background: white; border: 1px solid #E1E6EC; border-radius: 16px; padding: 20px 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #B2BBC5;">What happens next</p>
            <ul style="margin: 12px 0 0; padding: 0 0 0 18px; color: #45474D; font-size: 14px; line-height: 1.8;">
              <li>Our team will review your application</li>
              <li>We'll reach out if your profile is a match</li>
              <li>Shortlisted candidates will be contacted within 7 days</li>
            </ul>
          </div>
          <p style="font-size: 13px; color: #B2BBC5; margin: 0; line-height: 1.6;">
            If you have questions, feel free to reply to this email.
          </p>
          <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #E1E6EC;">
            <p style="margin: 0; font-size: 12px; color: #B2BBC5;">© ${new Date().getFullYear()} Careers Portal</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Resend confirmation error:", error);
      return NextResponse.json({ error: "Failed to send confirmation." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
