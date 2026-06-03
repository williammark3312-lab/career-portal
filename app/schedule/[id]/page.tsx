"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../src/lib/supabase";
import {
  Calendar, CheckCircle2, Clock, AlertTriangle, Loader2, Sparkles, Check
} from "lucide-react";
import GlassBackground from "../../../src/components/GlassBackground";

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
      <main className="min-h-screen flex items-center justify-center bg-[#F8F9FC] relative overflow-hidden">
        <GlassBackground />
        <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-600 rounded-full animate-spin relative z-10" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-between bg-[#F8F9FC] text-zinc-800 relative z-10 overflow-hidden">
      <GlassBackground />

      {/* Decorative Header Banner */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500 z-20" />

      <div className="flex-1 w-full max-w-lg mx-auto px-6 py-28 flex flex-col justify-center relative z-10">
        
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-red-100 rounded-3xl p-8 text-center shadow-xl shadow-red-500/2"
          >
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5 border border-red-100/50">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Unable to Load Scheduling Page</h2>
            <p className="text-xs font-semibold text-zinc-400 leading-relaxed">{error}</p>
          </motion.div>
        ) : confirmedSlot ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-zinc-200/60 rounded-[32px] p-8 text-center shadow-xl shadow-blue-500/5"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-6 border border-emerald-100/80 shadow-inner animate-pulse-slow">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 mb-2">
              Interview Confirmed!
            </h1>
            <p className="text-xs font-semibold text-zinc-400 leading-relaxed max-w-[280px] mx-auto mb-8">
              Hi {app?.name}, your discussion slot has been finalized with the recruitment team.
            </p>

            <div className="bg-emerald-50/20 border border-emerald-100/70 rounded-2xl p-6 text-left mb-8 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-2">
                Confirmed Meeting Info
              </span>
              <h3 className="text-base font-bold text-zinc-800 mb-1">
                {job?.title || "Role Interview"}
              </h3>
              <p className="text-xs font-semibold text-zinc-400 mb-4">
                Recruitment Candidate Evaluation
              </p>
              <div className="flex gap-2.5 items-start text-xs font-bold text-zinc-700">
                <Calendar className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{formatDateTime(confirmedSlot)}</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 font-semibold leading-relaxed">
              We have dispatched a calendar invitation to <strong className="text-zinc-600 font-bold">{app?.email}</strong>. We look forward to speaking with you!
            </p>
          </motion.div>
        ) : proposedSlots.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-zinc-200/60 rounded-[32px] p-8 text-center shadow-xl shadow-blue-500/5"
          >
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-5 border border-blue-100/50">
              <Clock className="w-6 h-6 animate-pulse-slow" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">No Time Slots Offered</h2>
            <p className="text-xs font-semibold text-zinc-400 leading-relaxed">
              Our team has not proposed scheduling options for this applicant profile yet. Reach out to your coordinator to set up your meeting window.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-zinc-200/60 rounded-[32px] p-8 shadow-xl shadow-blue-500/5"
          >
            <div className="mb-6 text-center sm:text-left">
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100/50 px-2 py-0.5 rounded-md uppercase tracking-wider mb-3.5 inline-block">
                Choose a time
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 mb-1.5">
                Select Interview Slot
              </h1>
              <p className="text-xs font-semibold text-zinc-400 leading-relaxed">
                Hi {app?.name}, please choose a convenient slot from the proposed options below:
              </p>
            </div>

            <div className="flex flex-col gap-3.5 mb-8">
              {proposedSlots.map((slot, idx) => {
                const isSelected = selectedSlot === slot;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlot(slot)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 text-left outline-none cursor-pointer w-full ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/20 shadow-sm"
                        : "border-zinc-200 hover:border-zinc-300 bg-white"
                    }`}
                  >
                    <div className="flex gap-3.5 items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isSelected ? "bg-blue-100 text-blue-600" : "bg-zinc-50 text-zinc-400"
                      }`}>
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className={`text-xs sm:text-sm font-bold ${
                        isSelected ? "text-zinc-800" : "text-zinc-600"
                      }`}>
                        {formatDateTime(slot)}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/10">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              disabled={!selectedSlot || confirming}
              onClick={handleConfirmSlot}
              className={`w-full py-3.5 px-6 rounded-xl font-bold text-xs cursor-pointer border-none text-white flex items-center justify-center gap-2 transition-all duration-200 ${
                selectedSlot 
                  ? "bg-zinc-950 hover:bg-zinc-900 shadow-md shadow-zinc-950/15" 
                  : "bg-zinc-300 cursor-not-allowed"
              }`}
            >
              {confirming ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <Sparkles className="w-4.5 h-4.5" />
              )}
              Confirm Interview Slot
            </button>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-200/50 py-6 bg-white/40 backdrop-blur-md mt-auto z-15">
        <div className="max-w-lg mx-auto px-6 flex justify-between items-center text-[11px] text-zinc-500 font-semibold">
          <p>© {new Date().getFullYear()} Google Antigravity. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
