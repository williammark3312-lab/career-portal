"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "../../../src/lib/supabase";
import { ArrowLeft, CheckCircle2, Upload, Briefcase, MapPin, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Header from "../../../src/components/Header";

type Job = {
  id: string; title: string; department: string; location: string; description: string;
};

function renderMd(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (inUl) { out.push("</ul>"); inUl = false; } continue; }
    if (/^#{1,3} /.test(line)) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      const text = line.replace(/^#{1,3} /, "").replace(/\*\*(.*?)\*\*/g, "<strong class='md-bold'>$1</strong>");
      out.push(`<h3 class="md-heading">${text}</h3>`);
      continue;
    }
    if (/^[•\-] /.test(line)) {
      if (!inUl) { out.push('<ul class="md-list">'); inUl = true; }
      const text = line.replace(/^[•\-] /, "").replace(/\*\*(.*?)\*\*/g, "<strong class='md-bold'>$1</strong>");
      out.push(`<li>${text}</li>`);
      continue;
    }
    if (inUl) { out.push("</ul>"); inUl = false; }
    const text = line.replace(/\*\*(.*?)\*\*/g, "<strong class='md-bold'>$1</strong>");
    out.push(`<p class="md-body">${text}</p>`);
  }
  if (inUl) out.push("</ul>");
  return out.join("\n");
}

function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = [
      { freq: 523.25, start: 0,    dur: 0.55 },
      { freq: 659.25, start: 0.13, dur: 0.55 },
      { freq: 783.99, start: 0.26, dur: 0.80 },
    ];
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime + start);
      gain2.gain.setValueAtTime(0, ctx.currentTime + start);
      gain2.gain.linearRampToValueAtTime(0.05, ctx.currentTime + start + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur * 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + start);
      osc2.stop(ctx.currentTime + start + dur);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch { /* silent */ }
}

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [job, setJob]               = useState<Job | null>(null);
  const [loading, setLoading]       = useState(false);
  const [showApply, setShowApply]   = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [phone, setPhone]           = useState("");
  const [location, setLocation]     = useState("");
  const [resume, setResume]         = useState<File | null>(null);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [submittedApp, setSubmittedApp] = useState<{ id?: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  async function handleDownloadPDF() {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      const canvas = await html2canvas(receiptRef.current, {
        scale: 4,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true
      });
      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = canvas.width / 4;
      const pdfHeight = canvas.height / 4;
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
        unit: "px",
        format: [pdfWidth, pdfHeight]
      });
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Application_Receipt_${submittedApp?.id?.slice(0, 8).toUpperCase() || 'Token'}.pdf`);
    } catch { window.print(); }
    finally { setIsDownloading(false); }
  }

  useEffect(() => { fetchJob(); }, []);

  async function fetchJob() {
    const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
    if (data) setJob(data);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim() || name.length < 3) e.name = "Enter your full name (min 3 chars)";
    if (!/^\S+@\S+\.\S+$/.test(email))   e.email = "Enter a valid email";
    if (!/^[6-9]\d{9}$/.test(phone))     e.phone = "Enter a valid 10-digit number";
    if (!location.trim())                 e.location = "City is required";
    if (!resume) { e.resume = "Please attach your resume"; }
    else if (!["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(resume.type))
      e.resume = "Only PDF / DOC / DOCX allowed";
    else if (resume.size > 5*1024*1024) e.resume = "Max file size is 5 MB";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || !resume) return;
    try {
      setLoading(true);
      const fileName = `${Date.now()}-${resume.name}`;
      const { error: uploadErr } = await supabase.storage.from("resumes").upload(fileName, resume);
      if (uploadErr) { alert(uploadErr.message); return; }
      const { data: { publicUrl } } = supabase.storage.from("resumes").getPublicUrl(fileName);
      const { data, error } = await supabase.from("applications").insert([
        { name, email, phone: `+91 ${phone}`, location, resume_url: publicUrl, job_id: id, status: "Pending" },
      ]).select().single();
      if (error) alert(error.message);
      else { setSubmittedApp(data); playSuccessChime(); setSubmitted(true); }
    } catch { alert("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  /* Loading */
  if (!job) {
    return (
      <main style={{ minHeight: "100vh", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: "var(--white)", animation: "spin 0.8s linear infinite" }} />
      </main>
    );
  }

  /* Success */
  if (submitted) {
    return (
      <main style={{ minHeight: "100vh", background: "transparent", display: "flex", flexDirection: "column", color: "var(--white)" }}>
        <Header />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 24 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: "100%", maxWidth: 440 }}
          >
            {/* Receipt card */}
            <div
              ref={receiptRef}
              style={{ background: "#fff", borderRadius: 20, overflow: "hidden", border: "1px solid #E1E6EC" }}
            >
              <div style={{ background: "#111", padding: "40px 32px", textAlign: "center" }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                  style={{ width: 56, height: 56, background: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}
                >
                  <CheckCircle2 style={{ width: 28, height: 28, color: "#111" }} />
                </motion.div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.025em", fontFamily: '"Geist", ui-sans-serif' }}>
                  Application Received
                </h2>
              </div>
              <div style={{ padding: "32px" }}>
                <p style={{ fontSize: 14, color: "#737A87", textAlign: "center", marginBottom: 24 }}>
                  Thank you for applying. Here is your application token for future reference.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { label: "Reference No.", value: `#${submittedApp?.id?.slice(0, 8).toUpperCase() || "N/A"}` },
                    { label: "Applicant", value: name },
                    { label: "Position", value: job.title },
                    { label: "Date", value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < arr.length - 1 ? "1px solid #E1E6EC" : "none" }}>
                      <span style={{ fontSize: 13, color: "#737A87" }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#121317", textAlign: "right", maxWidth: "55%" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <button disabled={isDownloading} onClick={handleDownloadPDF} className="btn-primary" style={{ width: "100%", justifyContent: "center", gap: 8, padding: "12px", display: "flex", alignItems: "center" }}>
              {isDownloading ? (
                <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", animation: "spin 0.8s linear infinite" }} /> Generating PDF…</>
              ) : (
                <><Download style={{ width: 16, height: 16 }} /> Download PDF Receipt</>
              )}
            </button>
            <button onClick={() => router.push("/jobs")} className="btn-secondary" style={{ width: "100%", justifyContent: "center", padding: "12px", display: "flex", alignItems: "center" }}>
              Back to Careers
            </button>
          </motion.div>
        </div>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <p>© {new Date().getFullYear()} Careers Portal</p>
          </div>
        </footer>
      </main>
    );
  }

  /* Main */
  return (
    <main style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "transparent", color: "var(--white)" }}>
      <Header />

      <div style={{ flex: 1, maxWidth: 860, margin: "0 auto", width: "100%", padding: "60px 40px 80px" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Job Header */}
          <div style={{ paddingBottom: 40, borderBottom: "1px solid var(--border)", marginBottom: 40 }}>
            <span className="dept-tag" style={{ display: "inline-block", marginBottom: 20 }}>{job.department}</span>
            <h1 style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.0,
              marginBottom: 24,
              fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
              color: "var(--white)",
            }}>
              {job.title}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 100, padding: "8px 16px", fontSize: 13, color: "var(--fg-muted)" }}>
                <MapPin style={{ width: 13, height: 13 }} />
                {job.location}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 100, padding: "8px 16px", fontSize: 13, color: "var(--fg-muted)" }}>
                <Briefcase style={{ width: 13, height: 13 }} />
                Full Time
              </div>
            </div>
          </div>

          {/* Job Body */}
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", marginBottom: 24, color: "var(--white)" }}>
              About the role
            </h2>
            <div style={{ fontSize: 15 }} dangerouslySetInnerHTML={{ __html: renderMd(job.description) }} />

            {!showApply ? (
              <div style={{ marginTop: 48, paddingTop: 40, borderTop: "1px solid var(--border)" }}>
                <button onClick={() => setShowApply(true)} className="btn-primary btn-primary-lg">
                  Apply for this position
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ marginTop: 48, paddingTop: 48, borderTop: "1px solid var(--border)" }}
              >
                <div style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--white)", marginBottom: 8 }}>
                    Submit your application
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--fg-muted)" }}>
                    Applying for <strong style={{ color: "var(--white)", fontWeight: 600 }}>{job.title}</strong>
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <label className="form-label">Full Name <span style={{ color: "#f87171" }}>*</span></label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" className="form-input" />
                    {errors.name && <p style={{ marginTop: 6, fontSize: 12, color: "#f87171" }}>{errors.name}</p>}
                  </div>

                  <div>
                    <label className="form-label">Email Address <span style={{ color: "#f87171" }}>*</span></label>
                    <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="jane@example.com" className="form-input" />
                    {errors.email && <p style={{ marginTop: 6, fontSize: 12, color: "#f87171" }}>{errors.email}</p>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label className="form-label">Phone Number <span style={{ color: "#f87171" }}>*</span></label>
                      <div style={{ display: "flex" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "12px 14px", borderRadius: "10px 0 0 10px", border: "1px solid var(--border)", borderRight: "none", background: "var(--black-300)", fontSize: 14, color: "var(--fg-muted)", whiteSpace: "nowrap", userSelect: "none" }}>
                          +91
                        </span>
                        <input
                          value={phone}
                          onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder="98765 43210"
                          maxLength={10}
                          className="form-input"
                          style={{ borderRadius: "0 10px 10px 0", borderLeft: "none" }}
                        />
                      </div>
                      {errors.phone && <p style={{ marginTop: 6, fontSize: 12, color: "#f87171" }}>{errors.phone}</p>}
                    </div>
                    <div>
                      <label className="form-label">City <span style={{ color: "#f87171" }}>*</span></label>
                      <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mumbai" className="form-input" />
                      {errors.location && <p style={{ marginTop: 6, fontSize: 12, color: "#f87171" }}>{errors.location}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Resume / CV <span style={{ color: "#f87171" }}>*</span></label>
                    <div style={{ position: "relative", border: "1px dashed var(--border)", borderRadius: 10, padding: "36px 24px", textAlign: "center", cursor: "pointer", background: "var(--black-100)", transition: "border-color 0.2s" }}>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setResume(f); }}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                      />
                      <Upload style={{ width: 24, height: 24, color: "var(--fg-muted)", margin: "0 auto 10px" }} />
                      <p style={{ fontSize: 14, fontWeight: 600, color: resume ? "var(--white)" : "var(--fg-muted)" }}>
                        {resume ? resume.name : "Click to upload or drag & drop"}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--grey-500)", marginTop: 4 }}>PDF, DOC up to 5 MB</p>
                    </div>
                    {errors.resume && <p style={{ marginTop: 6, fontSize: 12, color: "#f87171" }}>{errors.resume}</p>}
                  </div>

                  <div style={{ paddingTop: 8 }}>
                    <button
                      disabled={loading}
                      onClick={handleSubmit}
                      className="btn-primary btn-primary-lg"
                      style={{ width: "100%", justifyContent: "center", display: "flex", opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}
                    >
                      {loading ? "Submitting…" : "Submit Application"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>© {new Date().getFullYear()} Careers Portal</p>
          <div className="site-footer-links"><a href="/jobs">Careers</a></div>
        </div>
      </footer>
    </main>
  );
}
