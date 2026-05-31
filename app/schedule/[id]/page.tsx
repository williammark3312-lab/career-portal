"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../src/lib/supabase";
import {
  Calendar, CheckCircle2, Clock, AlertTriangle, Loader2, Sparkles, Check, ChevronRight
} from "lucide-react";
import AnimatedBackground from "../../../src/components/AnimatedBackground";

/* ─── Interfaces ─── */
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

export default function CandidateSchedulingPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [app, setApp] = useState<any | null>(null);
  const [job, setJob] = useState<any | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null);

  // Parse notes data
  const notesData = app ? parseNotes(app.notes) : null;
  const interview = notesData?.interview || null;
  const proposedSlots = interview?.proposed_slots || [];

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      try {
        const { data: appData, error: appError } = await supabase
          .from("applications")
          .select("*")
          .eq("id", id)
          .single();

        if (appError || !appData) {
          setError("We couldn't find this scheduling invitation. Please check the URL or contact your recruiter.");
          setLoading(false);
          return;
        }

        setApp(appData);

        const parsed = parseNotes(appData.notes);
        if (parsed.interview?.status === "scheduled" && parsed.interview?.selected_slot) {
          setConfirmedSlot(parsed.interview.selected_slot);
        }

        const { data: jobData } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", appData.job_id)
          .single();

        if (jobData) setJob(jobData);
      } catch (err) {
        setError("An unexpected error occurred while loading your invitation details.");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  function formatDateTime(str: string) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      }
    } catch {}
    return str;
  }

  function playChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // Note 1 (E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // Note 2 (A5) after 120ms
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
      gain2.gain.setValueAtTime(0.0, ctx.currentTime);
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start();
      osc1.stop(ctx.currentTime + 0.85);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.95);
    } catch (err) {
      console.warn("Failed to play chime:", err);
    }
  }

  async function handleConfirmSlot() {
    if (!selectedSlot || confirming || !app) return;
    setConfirming(true);

    try {
      const parsed = parseNotes(app.notes);
      const updatedInterview: InterviewData = {
        proposed_slots: parsed.interview?.proposed_slots || [],
        selected_slot: selectedSlot,
        status: "scheduled"
      };

      const { error: updateError } = await supabase
        .from("applications")
        .update({
          notes: JSON.stringify({
            comments: parsed.comments,
            interview: updatedInterview
          })
        })
        .eq("id", app.id);

      if (updateError) {
        alert("Failed to confirm slot: " + updateError.message);
      } else {
        playChime();
        setConfirmedSlot(selectedSlot);

        // Dispatch Confirmation Email to Candidate's Gmail
        fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: app.email,
            subject: `Interview Finalized - ${job?.title || "Job Application"}`,
            candidateName: app.name,
            jobTitle: job?.title || "Job Application",
            dateTime: selectedSlot
          })
        }).catch(err => {
          console.error("Email API fetch failed:", err);
        });
      }
    } catch (err: any) {
      alert("Error confirming slot: " + err.message);
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F8F9FF] relative overflow-hidden">
        <AnimatedBackground />
        <div className="w-8 h-8 border-2 border-[var(--google-blue)]/30 border-t-[var(--google-blue)] rounded-full animate-spin relative z-10" />
      </main>
    );
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "transparent", color: "var(--neutral-900)", position: "relative", zIndex: 1 }}>
      <AnimatedBackground />

      {/* Decorative Header Banner */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        background: "linear-gradient(90deg, #4285F4, #34A853, #FBBC05, #EA4335)"
      }} />

      <div style={{ flex: 1, width: "100%", maxWidth: 640, margin: "0 auto", padding: "clamp(60px, 10vw, 90px) clamp(16px, 4vw, 24px) 80px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "36px",
              borderRadius: 24,
              border: "1px solid rgba(217,48,37,0.1)",
              background: "rgba(255, 255, 255, 0.75)",
              backdropFilter: "blur(20px)",
              textAlign: "center",
              boxShadow: "0 10px 40px rgba(0,0,0,0.02)"
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(217,48,37,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <AlertTriangle style={{ width: 24, height: 24, color: "var(--google-red, #d93025)" }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--neutral-900)", margin: "0 0 10px" }}>Unable to load page</h2>
            <p style={{ fontSize: 14, color: "var(--neutral-500)", lineHeight: 1.6, margin: 0 }}>{error}</p>
          </motion.div>
        ) : confirmedSlot ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              padding: "40px 32px",
              borderRadius: 28,
              border: "1px solid rgba(30,142,62,0.15)",
              background: "rgba(255, 255, 255, 0.75)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
              textAlign: "center"
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(30,142,62,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
              <CheckCircle2 style={{ width: 32, height: 32, color: "#1e8e3e" }} />
            </div>
            
            <h1 className="text-gradient" style={{ fontSize: 24, fontWeight: 600, fontFamily: '"Google Sans Display", sans-serif', margin: "0 0 8px" }}>
              Interview Confirmed!
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--neutral-500)", margin: "0 0 32px", fontWeight: 500 }}>
              Hi {app?.name}, your meeting has been successfully booked with our recruitment team.
            </p>

            <div style={{
              background: "rgba(30,142,62,0.03)",
              border: "1px solid rgba(30,142,62,0.1)",
              borderRadius: 20,
              padding: "24px 20px",
              textAlign: "left",
              marginBottom: 32
            }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1e8e3e", display: "block", marginBottom: 12 }}>
                Booking Summary
              </span>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--neutral-800)", margin: "0 0 6px" }}>
                {job?.title || "Job Application"}
              </h3>
              <p style={{ fontSize: 13, color: "var(--neutral-500)", fontWeight: 500, margin: "0 0 18px" }}>
                Interview Slot Selection
              </p>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, color: "var(--neutral-700)", fontWeight: 600 }}>
                <Calendar style={{ width: 18, height: 18, color: "#1e8e3e", flexShrink: 0, marginTop: 2 }} />
                <span>{formatDateTime(confirmedSlot)}</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "var(--neutral-400)", margin: 0 }}>
              A calendar invitation has been configured for {app?.email}. We look forward to connecting with you!
            </p>
          </motion.div>
        ) : proposedSlots.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "36px",
              borderRadius: 24,
              border: "1px solid rgba(0,0,0,0.06)",
              background: "rgba(255, 255, 255, 0.75)",
              backdropFilter: "blur(20px)",
              textAlign: "center",
              boxShadow: "0 10px 40px rgba(0,0,0,0.02)"
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(66,133,244,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Clock style={{ width: 24, height: 24, color: "var(--google-blue, #1a73e8)" }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--neutral-900)", margin: "0 0 10px" }}>No time slots proposed yet</h2>
            <p style={{ fontSize: 14, color: "var(--neutral-500)", lineHeight: 1.6, margin: 0 }}>
              The recruiter hasn't proposed scheduling options for this profile yet. Please reach out to your point of contact to set up proposed slots.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "36px 28px",
              borderRadius: 28,
              border: "1px solid rgba(0,0,0,0.06)",
              background: "rgba(255, 255, 255, 0.75)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.03)"
            }}
          >
            <div style={{ marginBottom: 28 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--google-blue)", background: "rgba(26,115,232,0.08)", padding: "4px 10px", borderRadius: 10, display: "inline-block", marginBottom: 12 }}>
                Interview Selection
              </span>
              <h1 className="text-gradient" style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 600, fontFamily: '"Google Sans Display", sans-serif', letterSpacing: "-0.02em", margin: "0 0 6px" }}>
                Select your interview slot
              </h1>
              <p style={{ fontSize: 14, color: "var(--neutral-500)", fontWeight: 500, margin: 0 }}>
                Hi {app?.name}, please choose a convenient time slot from the recruiter proposed options below.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
              {proposedSlots.map((slot, idx) => {
                const isSelected = selectedSlot === slot;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlot(slot)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 20px",
                      borderRadius: 18,
                      border: isSelected ? "2px solid var(--google-blue, #1a73e8)" : "1px solid rgba(0,0,0,0.08)",
                      background: isSelected ? "rgba(26,115,232,0.03)" : "#ffffff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      outline: "none",
                      boxShadow: isSelected ? "0 4px 12px rgba(26,115,232,0.05)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: isSelected ? "rgba(26,115,232,0.1)" : "rgba(0,0,0,0.03)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isSelected ? "var(--google-blue)" : "var(--neutral-400)"
                      }}>
                        <Calendar style={{ width: 15, height: 15 }} />
                      </div>
                      <span style={{ fontSize: 14.5, fontWeight: isSelected ? 600 : 500, color: isSelected ? "var(--neutral-900)" : "var(--neutral-700)" }}>
                        {formatDateTime(slot)}
                      </span>
                    </div>
                    {isSelected && (
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--google-blue)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff" }}>
                        <Check style={{ width: 12, height: 12 }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              disabled={!selectedSlot || confirming}
              onClick={handleConfirmSlot}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 16,
                fontWeight: 600,
                fontSize: 14.5,
                cursor: selectedSlot ? "pointer" : "not-allowed",
                border: "none",
                color: "#ffffff",
                background: selectedSlot ? "var(--google-blue, #1a73e8)" : "var(--neutral-300)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s"
              }}
            >
              {confirming ? (
                <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
              ) : (
                <Sparkles style={{ width: 18, height: 18 }} />
              )}
              Confirm Interview Time
            </button>
          </motion.div>
        )}
      </div>

      <footer style={{ borderTop: "1px solid rgba(0, 0, 0, 0.05)", padding: "24px 0", background: "rgba(255, 255, 255, 0.4)", backdropFilter: "blur(10px)", marginTop: "auto" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <p style={{ fontSize: 13, color: "var(--neutral-500)", fontWeight: 500 }}>© {new Date().getFullYear()} Google Antigravity. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
