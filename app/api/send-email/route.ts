import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

function formatDateTime(str: string) {
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
      const day = d.getDate();
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const weekday = weekdayNames[d.getDay()];
      return `${weekday}, ${day} ${month} ${year} at ${formattedHours}:${formattedMinutes} ${ampm}`;
    }
  } catch {}
  return str;
}

export async function POST(request: Request) {
  try {
    const { to, subject, candidateName, jobTitle, dateTime } = await request.json();

    if (!to || !candidateName || !jobTitle || !dateTime) {
      return NextResponse.json(
        { error: "Missing required fields (to, candidateName, jobTitle, dateTime)." },
        { status: 400 }
      );
    }

    const formattedTime = formatDateTime(dateTime);

    // Responsive HTML Email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Interview Confirmation</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #f8f9ff;
            margin: 0;
            padding: 0;
            color: #202124;
            -webkit-font-smoothing: antialiased;
          }
          .wrapper {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 20px;
            border: 1px solid rgba(0, 0, 0, 0.06);
            box-shadow: 0 4px 20px rgba(0,0,0,0.02);
            overflow: hidden;
          }
          .header-banner {
            height: 6px;
            background: linear-gradient(90deg, #4285F4, #34A853, #FBBC05, #EA4335);
          }
          .content {
            padding: 40px 32px;
          }
          .greeting {
            font-size: 20px;
            font-weight: 600;
            color: #1a73e8;
            margin: 0 0 16px;
          }
          .body-text {
            font-size: 15px;
            line-height: 1.6;
            color: #5f6368;
            margin: 0 0 32px;
          }
          .summary-card {
            background-color: #f8f9ff;
            border: 1px solid #e8f0fe;
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 32px;
          }
          .summary-title {
            font-size: 11.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #1a73e8;
            margin: 0 0 12px;
          }
          .job-title {
            font-size: 17px;
            font-weight: 600;
            color: #202124;
            margin: 0 0 4px;
          }
          .company {
            font-size: 13px;
            color: #5f6368;
            margin: 0 0 18px;
          }
          .slot-row {
            display: flex;
            align-items: center;
            font-size: 14.5px;
            font-weight: 600;
            color: #202124;
          }
          .slot-icon {
            font-size: 18px;
            margin-right: 8px;
          }
          .footer {
            border-top: 1px solid #f1f3f4;
            padding: 24px 32px;
            background-color: #fafafa;
            text-align: center;
            font-size: 12px;
            color: #9aa0a6;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header-banner"></div>
          <div class="content">
            <h2 class="greeting">Interview Confirmed!</h2>
            <p class="body-text">
              Hi ${candidateName},<br><br>
              Thank you for choosing your preferred slot. Your interview details have been finalized and scheduled. Please review the booking summary below:
            </p>
            
            <div class="summary-card">
              <div class="summary-title">Booking Summary</div>
              <div class="job-title">${jobTitle}</div>
              <div class="company">Careers Portal Invitation</div>
              <div class="slot-row">
                <span class="slot-icon">📅</span> <strong>${formattedTime}</strong>
              </div>
            </div>
            
            <p class="body-text" style="margin-bottom: 0;">
              Our recruitment team will send a calendar invite containing the meeting link (Google Meet) shortly before the scheduled session. If you need to make any changes, please feel free to reach out to us.<br><br>
              We look forward to speaking with you!
            </p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} Careers Portal. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    // ─── Option 1: Resend API Dispatch ───
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && resendKey !== "re_your_api_key_here") {
      const emailFrom = process.env.SMTP_FROM || "onboarding@resend.dev";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: emailFrom,
          to,
          subject: subject || `Interview Finalized - ${jobTitle}`,
          html: htmlContent
        })
      });

      const resData = await res.json();
      if (res.ok) {
        return NextResponse.json({
          success: true,
          message: `Confirmation email dispatched to ${to} via Resend.`,
          data: resData
        });
      } else {
        console.error("Resend API failed:", resData);
        // Fallthrough to SMTP or error if Resend is explicitly configured but failing
      }
    }

    // ─── Option 2: SMTP Nodemailer Dispatch ───
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || `"Recruitment Portal" <no-reply@careers-portal.com>`;

    if (host && user && pass) {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass
        }
      });

      await transporter.sendMail({
        from,
        to,
        subject: subject || `Interview Finalized - ${jobTitle}`,
        html: htmlContent
      });

      return NextResponse.json({
        success: true,
        message: `Confirmation email dispatched to ${to} via SMTP.`
      });
    }

    // ─── Option 3: Fallback Mock (Variables missing) ───
    console.warn(
      "No active email provider detected. To send live emails, configure either RESEND_API_KEY or SMTP variables inside your `.env.local` file."
    );
    console.log(`[SMTP MOCK] Dispatch email to ${to} for interview on ${formattedTime}`);

    return NextResponse.json({
      success: true,
      message: "Email dispatch logged (Credentials are missing in local .env.local).",
      mocked: true
    });
  } catch (error: any) {
    console.error("Email dispatch failed:", error);
    return NextResponse.json(
      { error: "Internal server error. Failed to send email confirmation: " + error.message },
      { status: 500 }
    );
  }
}
