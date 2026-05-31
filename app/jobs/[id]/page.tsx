"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "../../../src/lib/supabase";
import { Canvas } from "@react-three/fiber";
import { Float, Environment, MeshTransmissionMaterial } from "@react-three/drei";
import {
  ArrowLeft, CheckCircle2, Upload, Briefcase, MapPin, Download,
  Mail, Lock, ShieldCheck, Send, RefreshCw, Key, LogOut
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Header from "../../../src/components/Header";
import Footer from "../../../src/components/Footer";

type Job = {
  id: string; title: string; department: string; location: string; description: string;
};

function FloatingRing() {
  return (
    <Float speed={1.8} rotationIntensity={0.9} floatIntensity={1.2}>
      <mesh rotation={[0.5, -0.5, 0]}>
        <torusGeometry args={[2, 0.45, 64, 128]} />
        <MeshTransmissionMaterial backside samples={6} thickness={0.6}
          chromaticAberration={0.08} anisotropy={0.5} distortion={0.12}
          distortionScale={0.2} temporalDistortion={0.03} clearcoat={1}
          clearcoatRoughness={0.05} color="#1a3bbd"
          transmission={0.55} roughness={0.05} resolution={1024}
        />
      </mesh>
    </Float>
  );
}

function renderMd(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (inUl) { out.push("</ul>"); inUl = false; } continue; }
    if (/^#{1,3} /.test(line)) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      const text = line.replace(/^#{1,3} /, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      out.push(`<h3 class="text-[18px] font-semibold text-[#121317] mt-7 mb-3">${text}</h3>`);
      continue;
    }
    if (/^[•\-] /.test(line)) {
      if (!inUl) { out.push('<ul class="space-y-1.5 my-4 ml-5 list-disc text-[#121317]">'); inUl = true; }
      const text = line.replace(/^[•\-] /, "").replace(/\*\*(.*?)\*\*/g, "<strong class='font-medium text-[#121317]'>$1</strong>");
      out.push(`<li class="pl-1 marker:text-[#3279F9]">${text}</li>`);
      continue;
    }
    if (inUl) { out.push("</ul>"); inUl = false; }
    const text = line.replace(/\*\*(.*?)\*\*/g, "<strong class='font-medium text-[#121317]'>$1</strong>");
    out.push(`<p class="my-2 text-[15px] leading-[1.7] text-[#121317]">${text}</p>`);
  }
  if (inUl) out.push("</ul>");
  return out.join("\n");
}

/* ── Success chime ── */
function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [
      { freq: 523.25, start: 0, dur: 0.4 },
      { freq: 659.25, start: 0.1, dur: 0.4 },
      { freq: 783.99, start: 0.2, dur: 0.6 },
    ].forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* silent */
  }
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

  const [candidate, setCandidate]   = useState<any>(null);
  const [otpSent, setOtpSent]       = useState(false);
  const [otpCode, setOtpCode]       = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [authError, setAuthError]   = useState("");
  const [authSuccessMsg, setAuthSuccessMsg] = useState("");

  useEffect(() => {
    fetchJob();
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCandidate(session.user);
        setEmail(session.user.email || "");
        if (session.user.user_metadata?.full_name) {
          setName(session.user.user_metadata.full_name);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setCandidate(session.user);
        setEmail(session.user.email || "");
        if (session.user.user_metadata?.full_name) {
          setName(session.user.user_metadata.full_name);
        }
        setAuthError("");
        setAuthSuccessMsg("");
      } else {
        setCandidate(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleGoogleSignIn() {
    setAuthError("");
    setAuthSuccessMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
      },
    });
    if (error) {
      setAuthError(error.message);
    }
  }

  async function handleSendOTP() {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    try {
      setOtpLoading(true);
      setAuthError("");
      setAuthSuccessMsg("");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.href,
        },
      });
      if (error) {
        setAuthError(error.message);
      } else {
        setOtpSent(true);
        setAuthSuccessMsg(`Code sent! Please check your email inbox / spam.`);
      }
    } catch {
      setAuthError("Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (!otpCode || otpCode.length !== 6) {
      setAuthError("Please enter a valid 6-digit code.");
      return;
    }
    try {
      setOtpLoading(true);
      setAuthError("");
      setAuthSuccessMsg("");
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });
      if (error) {
        setAuthError(error.message);
      } else {
        setOtpSent(false);
        setOtpCode("");
        setAuthSuccessMsg("Email successfully verified!");
        if (data.session) {
          setCandidate(data.session.user);
          setEmail(data.session.user.email || "");
          if (data.session.user.user_metadata?.full_name) {
            setName(data.session.user.user_metadata.full_name);
          }
        }
      }
    } catch {
      setAuthError("Failed to verify code. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleCandidateSignOut() {
    await supabase.auth.signOut();
    setCandidate(null);
    setEmail("");
    setName("");
    setOtpSent(false);
    setOtpCode("");
    setAuthError("");
    setAuthSuccessMsg("");
  }

  async function fetchJob() {
    const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
    if (data) setJob(data);
  }

  async function handleDownloadPDF() {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);
      await new Promise((r) => setTimeout(r, 100));
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = canvas.width / 3;
      const pdfHeight = canvas.height / 3;
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
        unit: "px",
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Receipt_${submittedApp?.id?.slice(0, 8).toUpperCase() || "Application"}.pdf`);
    } catch {
      window.print();
    } finally {
      setIsDownloading(false);
    }
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
      else {
        setSubmittedApp(data);
        playSuccessChime();
        setSubmitted(true);
      }
    } catch { alert("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  /* Loading */
  if (!job) {
    return (
      <main className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[rgba(50,121,249,0.25)] border-t-[#3279F9] animate-spin" />
          <p className="text-[14px] text-[#121317]">Loading…</p>
        </div>
      </main>
    );
  }

  /* Success / Receipt */
  if (submitted) {
    return (
      <main className="relative flex flex-col min-h-screen bg-[#F8F9FC]">
        <div className="fixed inset-0 z-0 pointer-events-none opacity-50">
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
            <ambientLight intensity={1.4} />
            <directionalLight position={[10, 10, 5]} intensity={2} />
            <Suspense fallback={null}><FloatingRing /><Environment preset="city" /></Suspense>
          </Canvas>
        </div>
        <Header />
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 gap-6">
          {/* Receipt card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            ref={receiptRef}
            className="glass w-full max-w-md rounded-[28px] overflow-hidden"
          >
            {/* Top color bar */}
            <div className="h-1.5 bg-gradient-to-r from-[#3279F9] via-[#7C3AED] to-[#10B981]" />

            {/* Receipt top */}
            <div className="px-5 sm:px-8 py-6 sm:py-8 text-center border-b border-dashed border-[#E1E6EC]">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="w-16 h-16 bg-[#3279F9]/10 text-[#3279F9] rounded-full flex items-center justify-center mx-auto mb-5 border border-[#3279F9]/20"
              >
                <CheckCircle2 className="w-8 h-8" />
              </motion.div>
              <h2 className="text-[24px] font-bold tracking-tight mb-1.5 text-[#1a3bbd]">
                Application Submitted!
              </h2>
              <p className="text-[13px] text-[#121317]">We&apos;ve received your profile successfully</p>
            </div>

            {/* Receipt details */}
            <div className="px-5 sm:px-8 py-5 sm:py-6">
              <div className="flex flex-col gap-3.5">
                {[
                  { label: "CONFIRMATION ID", value: `#${submittedApp?.id?.slice(0, 8).toUpperCase() || "N/A"}` },
                  { label: "APPLICANT NAME", value: name },
                  { label: "POSITION APPLIED", value: job.title },
                  { label: "CURRENT CITY", value: location },
                  {
                    label: "DATE SUBMITTED",
                    value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                  },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-start gap-4">
                    <span className="text-[10px] font-700 text-[#B2BBC5] tracking-widest uppercase">{row.label}</span>
                    <span className="text-[13px] font-semibold text-[#121317] text-right max-w-[55%]">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#E1E6EC] mt-5 pt-4 text-center">
                <p className="text-[11px] text-[#3279F9] font-semibold tracking-wide">
                  © {new Date().getFullYear()} Careers Portal
                </p>
              </div>
            </div>
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="w-full max-w-md flex flex-col gap-3"
          >
            <button
              id="receipt-download-btn"
              disabled={isDownloading}
              onClick={handleDownloadPDF}
              className="btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving PDF…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Receipt
                </>
              )}
            </button>
            <button
              id="receipt-return-btn"
              onClick={() => router.push("/jobs")}
              className="btn-dark w-full justify-center"
            >
              Back to Careers
            </button>
          </motion.div>
        </div>
        <Footer />
      </main>
    );
  }

  /* Main */
  return (
    <main className="relative flex flex-col min-h-screen bg-[#F8F9FC] text-[#121317]">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
          <Suspense fallback={null}><FloatingRing /><Environment preset="city" /></Suspense>
        </Canvas>
      </div>

      <Header />

      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-4 sm:px-5 md:px-8 pt-28 sm:pt-44 pb-8 sm:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="glass rounded-[24px] sm:rounded-[32px] overflow-hidden"
        >
          {/* Job Header */}
          <div className="px-5 sm:px-10 py-6 sm:py-10 border-b border-[#E1E6EC]">
            <span className="dept-tag mb-5 inline-block">{job.department}</span>
            <h1 className="text-[28px] sm:text-[38px] md:text-[52px] font-bold tracking-[-0.03em] leading-[1.1] mb-4 sm:mb-6 text-gradient">{job.title}</h1>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-full border border-[#E1E6EC] bg-white px-4 py-2 text-[13px] font-medium text-[#121317]">
                <MapPin className="w-3.5 h-3.5 text-[#121317]" />
                {job.location}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#E1E6EC] bg-white px-4 py-2 text-[13px] font-medium text-[#121317]">
                <Briefcase className="w-3.5 h-3.5 text-[#121317]" />
                Full Time
              </div>
            </div>
          </div>

          {/* Job Body */}
          <div className="px-5 sm:px-10 py-6 sm:py-10">
            <h2 className="text-[22px] font-semibold mb-6 text-[#121317]">About the role</h2>
            <div className="text-[15px]" dangerouslySetInnerHTML={{ __html: renderMd(job.description) }} />

            {!showApply ? (
              <div className="mt-10 pt-8 border-t border-[#E1E6EC]">
                <button onClick={() => setShowApply(true)} className="btn-primary">Apply for this position</button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="mt-10 pt-10 border-t border-[#E1E6EC]"
              >
                <div className="mb-8">
                  <h2 className="text-[26px] font-semibold text-[#1a3bbd]">Submit your application</h2>
                  <p className="text-[14px] text-[#121317] mt-2">
                    Fill out the form below to apply for <strong className="text-[#3279F9]">{job.title}</strong>
                  </p>
                </div>

                <div className="space-y-5">
                  {candidate && (
                    <div className="rounded-[16px] border border-[#1e8e3e]/30 bg-[#1e8e3e]/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1e8e3e]/10 border border-[#1e8e3e]/20 flex items-center justify-center flex-shrink-0">
                          <ShieldCheck className="w-5.5 h-5.5 text-[#1e8e3e]" />
                        </div>
                        <div>
                          <h4 className="text-[14.5px] font-semibold text-[#121317]">Email Verified Successfully</h4>
                          <p className="text-[12.5px] text-[#121317]/70 font-medium">Signed in as <strong className="text-[#1a3bbd]">{candidate.email}</strong></p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCandidateSignOut}
                        className="text-[13px] font-semibold text-[#d93025] hover:text-[#b02015] flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[#d93025]/5 transition-colors self-start sm:self-auto"
                      >
                        <LogOut className="w-4 h-4" />
                        Use different email
                      </button>
                    </div>
                  )}

                  {!candidate ? (
                    <div className="rounded-[20px] border border-[#1a3bbd]/15 bg-[rgba(26,56,179,0.03)] backdrop-blur-md p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-[#3279F9]/10 rounded-full blur-[80px] -z-10" />

                      <div className="flex flex-col gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold text-[#1a3bbd] bg-[#1a3bbd]/8 self-start">
                          <Lock className="w-3.5 h-3.5" /> Verification Required
                        </span>
                        <h3 className="text-[18px] sm:text-[20px] font-bold text-[#121317] tracking-tight">Verify your email to continue</h3>
                        <p className="text-[13.5px] text-[#121317]/80 leading-relaxed font-medium">
                          To protect against spam and secure your candidate record, please authenticate using Google or verify your email address.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-white hover:bg-[#F8F9FC] border border-[#CDD4DC] shadow-[0_2px_4px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-300 font-semibold text-[14.5px] text-[#121317]"
                      >
                        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                        </svg>
                        Continue with Google
                      </button>
                      <p className="text-[11px] text-[#121317]/50 -mt-3.5 font-medium text-center leading-normal">
                        Note: Google login requires provider configuration in your Supabase Dashboard.
                      </p>

                      <div className="flex items-center gap-4 text-[#CDD4DC]">
                        <div className="h-[1px] flex-1 bg-[#CDD4DC]" />
                        <span className="text-[12px] font-bold text-[#121317]/50 tracking-wider uppercase select-none">or</span>
                        <div className="h-[1px] flex-1 bg-[#CDD4DC]" />
                      </div>

                      <div className="flex flex-col gap-4">
                        {!otpSent ? (
                          <div className="flex flex-col gap-3">
                            <label className="text-[13px] font-bold text-[#121317]/80 uppercase tracking-wider">Email OTP Verification</label>
                            <div className="flex flex-col sm:flex-row gap-2.5">
                              <div className="relative flex-1">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#121317]/40" />
                                <input
                                  type="email"
                                  value={email}
                                  onChange={e => setEmail(e.target.value)}
                                  placeholder="candidate@gmail.com"
                                  className="form-input py-3 w-full font-medium"
                                  style={{ paddingLeft: "44px" }}
                                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSendOTP(); } }}
                                />
                              </div>
                              <button
                                type="button"
                                disabled={otpLoading}
                                onClick={handleSendOTP}
                                className="btn-dark sm:w-auto w-full px-6 py-3 font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
                              >
                                {otpLoading ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Send className="w-4 h-4" />
                                    Send Code
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3.5 bg-white/50 border border-[#CDD4DC]/60 rounded-xl p-4 sm:p-5">
                            <label className="text-[13px] font-bold text-[#121317]/80 uppercase tracking-wider flex items-center gap-1.5">
                              <Key className="w-4 h-4 text-[#1a3bbd]" /> Enter Verification Code
                            </label>
                            <p className="text-[12.5px] text-[#121317]/70 font-medium">
                              We sent a 6-digit OTP code to <strong className="text-[#1a3bbd]">{email}</strong>.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2.5">
                              <input
                                type="text"
                                maxLength={6}
                                value={otpCode}
                                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                                placeholder="123456"
                                className="form-input tracking-[0.3em] font-mono text-center text-[18px] py-2 w-full flex-1 font-semibold"
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleVerifyOTP(); } }}
                              />
                              <button
                                type="button"
                                disabled={otpLoading}
                                onClick={handleVerifyOTP}
                                className="btn-primary sm:w-auto w-full px-6 py-2.5 font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
                              >
                                {otpLoading ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : "Verify Code"}
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[12.5px] font-semibold mt-1">
                              <button
                                type="button"
                                onClick={handleSendOTP}
                                className="text-[#1a3bbd] hover:text-[#3279F9] transition-colors"
                              >
                                Resend Code
                              </button>
                              <button
                                type="button"
                                onClick={() => { setOtpSent(false); setAuthError(""); setAuthSuccessMsg(""); }}
                                className="text-[#d93025] hover:text-[#b02015] transition-colors"
                              >
                                Change Email
                              </button>
                            </div>

                            <div className="mt-4 p-3.5 rounded-xl bg-[rgba(26,56,179,0.06)] border border-[#1a3bbd]/15 flex items-start gap-2.5 text-left">
                              <span className="text-[16px] leading-none">💡</span>
                              <div className="flex-1">
                                <p className="text-[12.5px] font-bold text-[#1a3bbd]">Received a "Sign in" link instead of a 6-digit code?</p>
                                <p className="text-[12px] text-[#121317]/80 mt-0.5 leading-relaxed font-semibold">
                                  Simply **click the "Sign in" button inside your email** to instantly authenticate and automatically unlock this form!
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {authError && (
                        <div className="text-[12.5px] font-semibold text-[#d93025] bg-[#d93025]/5 border border-[#d93025]/15 rounded-lg px-4 py-3 text-center w-full">
                          {authError.toLowerCase().includes("rate limit") ? (
                            <div className="text-left flex flex-col gap-2">
                              <p className="font-bold flex items-center gap-1.5"><span className="text-[14px]">⚠️</span> Email Rate Limit Exceeded</p>
                              <p className="text-[12px] text-[#121317]/80 leading-relaxed font-medium">
                                Supabase's default mailer restricts email auth requests to **3 emails per hour** to prevent abuse.
                              </p>
                              <div className="mt-1.5 p-3.5 rounded-xl bg-[rgba(26,56,179,0.06)] border border-[#1a3bbd]/15 flex flex-col gap-1.5 text-[11.5px] text-[#1a3bbd] font-semibold">
                                <p className="font-bold text-[12px]">🛠️ How to resolve permanently:</p>
                                <p className="text-[#121317]/70 font-medium">
                                  Go to your <strong>Supabase Dashboard</strong> &rarr; <strong>Project Settings</strong> &rarr; <strong>Auth</strong>, and configure your own custom SMTP credentials (e.g. via Resend or SendGrid) to lift all limits.
                                </p>
                                <p className="mt-1 font-bold text-[12px]">⚡ To continue testing right now:</p>
                                <p className="text-[#121317]/70 font-medium">
                                  Use the <strong>"Continue with Google"</strong> button above, which bypasses SMTP mailer limits entirely!
                                </p>
                              </div>
                            </div>
                          ) : (
                            authError
                          )}
                        </div>
                      )}
                      {authSuccessMsg && (
                        <div className="text-[12.5px] font-semibold text-[#1e8e3e] bg-[#1e8e3e]/5 border border-[#1e8e3e]/15 rounded-lg px-4 py-2.5 text-center">
                          {authSuccessMsg}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {candidate && (
                    <div className="space-y-5 transition-all duration-500 relative">
                      <div>
                        <label className="form-label">Full Name <span className="text-red-500">*</span></label>
                        <input
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="Jane Doe"
                          className="form-input"
                        />
                        {errors.name && <p className="mt-1.5 text-[12px] text-red-500">{errors.name}</p>}
                      </div>

                      <div>
                        <label className="form-label">Email Address <span className="text-red-500">*</span></label>
                        <input
                          value={email}
                          type="email"
                          disabled
                          placeholder="jane@example.com"
                          className="form-input bg-[#F8F9FC] text-[#121317]/60 cursor-not-allowed border-[#CDD4DC]/60 font-semibold"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="form-label">Phone Number <span className="text-red-500">*</span></label>
                          <div className="flex">
                            <span className="inline-flex items-center px-4 rounded-l-[12px] border border-r-0 border-[#CDD4DC] bg-[#F8F9FC] text-[15px] font-medium text-[#121317] select-none whitespace-nowrap">
                              +91
                            </span>
                            <input
                              value={phone}
                              onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                              placeholder="98765 43210"
                              maxLength={10}
                              className="form-input rounded-l-none border-l-0"
                            />
                          </div>
                          {errors.phone && <p className="mt-1.5 text-[12px] text-red-500">{errors.phone}</p>}
                        </div>
                        <div>
                          <label className="form-label">City <span className="text-red-500">*</span></label>
                          <input
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            placeholder="e.g. Mumbai"
                            className="form-input"
                          />
                          {errors.location && <p className="mt-1.5 text-[12px] text-red-500">{errors.location}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="form-label">Resume / CV <span className="text-red-500">*</span></label>
                        <div className="relative rounded-[14px] border-2 border-dashed border-[#CDD4DC] bg-white/60 px-6 py-9 text-center hover:bg-white transition-colors cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={e => { const f = e.target.files?.[0]; if (f) setResume(f); }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <Upload className="mx-auto h-7 w-7 text-[#121317] mb-2" />
                          <p className="text-[14px] font-medium text-[#121317]">{resume ? resume.name : "Click to upload or drag & drop"}</p>
                          <p className="text-[12px] text-[#121317] mt-1">PDF, DOC up to 5 MB</p>
                        </div>
                        {errors.resume && <p className="mt-1.5 text-[12px] text-red-500">{errors.resume}</p>}
                      </div>

                      <div className="pt-2">
                        <button
                          disabled={loading}
                          onClick={handleSubmit}
                          className="btn-dark w-full disabled:opacity-60"
                        >
                          {loading ? "Submitting…" : "Submit Application"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      <Footer />
    </main>
  );
}
