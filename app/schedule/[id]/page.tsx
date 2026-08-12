"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, Clock, AlertTriangle, Loader2, Check } from "lucide-react";
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

interface ApplicationRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  comments?: string;
}

interface JobRecord {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
}

export default function CandidateSchedulingPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id = typeof rawId === "string" ? rawId.trim().replace(/\/$/, "") : rawId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [app, setApp] = useState<ApplicationRecord | null>(null);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null);

  const notesData = app ? parseNotes(app.notes || app.comments) : null;
  const interview = notesData?.interview || null;
  const proposedSlots = interview?.proposed_slots || [];

  useEffect(() => {
    if (!id || id === "[id]") return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/schedule/${id}`);
        const result = await response.json();

        if (!response.ok) {
          const errMsg = result.error || "We couldn't find this scheduling invitation. Please check the URL or contact your recruiter.";
          console.error("[schedule page] API error:", response.status, errMsg);
          setError(errMsg);
          setLoading(false);
          return;
        }

        const { app: record, job: jobData } = result;

        setApp(record);
        if (jobData) setJob(jobData);

        const parsed = parseNotes(record.notes || record.comments);
        if (parsed.interview?.status === "scheduled" && parsed.interview?.selected_slot) {
          setConfirmedSlot(parsed.interview.selected_slot);
        }
      } catch {
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

  function playChime() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.0, ctx.currentTime);
      gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start();
      osc1.stop(ctx.currentTime + 0.85);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.95);
    } catch {}
  }

  async function handleConfirmSlot() {
    if (!selectedSlot || confirming || !app) return;
    setConfirming(true);

    try {
      const response = await fetch(`/api/schedule/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedSlot })
      });
      const result = await response.json();

      if (!response.ok) {
        alert("Failed to confirm slot: " + (result.error || "Unknown error"));
      } else {
        playChime();
        setConfirmedSlot(selectedSlot);

        fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: app.email,
            subject: `Interview Finalized - ${job?.title || "Role Discussion"}`,
            candidateName: app.name,
            jobTitle: job?.title || "Role Discussion",
            dateTime: selectedSlot
          })
        }).catch((err) => {
          console.error("Email API fetch failed:", err);
        });
      }
    } catch (err) {
      alert("Error confirming slot: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#000000] relative overflow-hidden">
        <GlassBackground />
        <div className="w-6 h-6 border-2 border-zinc-800 border-t-zinc-450 animate-spin relative z-10" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-between bg-[#000000] text-white relative z-10 overflow-hidden">
      <GlassBackground />

      <div className="flex-1 w-full max-w-md mx-auto px-6 pt-24 pb-16 flex flex-col justify-center relative z-10">
        
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-950/20 border border-zinc-900 rounded-2xl p-8 text-center shadow-lg"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-850 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-white mb-2">Unable to Load Scheduling Page</h2>
            <p className="text-xs text-zinc-500 leading-relaxed font-semibold">{error}</p>
          </motion.div>
        ) : confirmedSlot ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-zinc-950/20 border border-zinc-900 rounded-2xl p-8 text-center shadow-lg flex flex-col gap-6"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-850 text-white flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white mb-1.5">
                Interview Confirmed
              </h1>
              <p className="text-xs text-zinc-500 font-semibold leading-relaxed max-w-[260px] mx-auto">
                Hi {app?.name}, your discussion slot has been finalized with the recruitment team.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 text-left shadow-sm flex flex-col gap-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Confirmed Meeting Info
              </span>
              <div>
                <h3 className="text-xs font-bold text-white">
                  {job?.title || "Role Interview"}
                </h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase mt-0.5">
                  Recruitment Candidate Evaluation
                </p>
              </div>
              <div className="flex gap-2 items-center text-xs font-semibold text-zinc-200 mt-2 border-t border-zinc-900/60 pt-3">
                <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>{formatDateTime(confirmedSlot)}</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 font-semibold leading-relaxed">
              We have dispatched a calendar invitation to <strong className="text-zinc-350">{app?.email}</strong>.
            </p>
          </motion.div>
        ) : proposedSlots.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-950/20 border border-zinc-900 rounded-2xl p-8 text-center shadow-lg"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-850 text-zinc-500 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-white mb-2">No Time Slots Offered</h2>
            <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
              Our team has not proposed scheduling options for this applicant profile yet.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-950/20 border border-zinc-900 rounded-2xl p-6 sm:p-8 shadow-lg flex flex-col gap-6"
          >
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">
                Choose a time
              </span>
              <h1 className="text-lg font-bold tracking-tight text-white mb-1">
                Select Interview Slot
              </h1>
              <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                Hi {app?.name}, please choose a convenient slot from the proposed options below:
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              {proposedSlots.map((slot, idx) => {
                const isSelected = selectedSlot === slot;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlot(slot)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left outline-none cursor-pointer w-full ${
                      isSelected
                        ? "border-white bg-zinc-900/60 shadow-sm"
                        : "border-zinc-900 hover:border-zinc-850 bg-zinc-950/40 text-zinc-450 hover:text-zinc-350"
                    }`}
                  >
                    <div className="flex gap-3 items-center">
                      <Calendar className={`w-4 h-4 ${isSelected ? "text-white" : "text-zinc-600"}`} />
                      <span className={`text-xs font-semibold ${isSelected ? "text-white" : "text-zinc-400"}`}>
                        {formatDateTime(slot)}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="w-4.5 h-4.5 rounded-full bg-white flex items-center justify-center text-black shadow-sm">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              disabled={!selectedSlot || confirming}
              onClick={handleConfirmSlot}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs cursor-pointer border transition-all flex items-center justify-center gap-2 ${
                selectedSlot 
                  ? "bg-white text-black hover:bg-zinc-200 border-transparent shadow-sm" 
                  : "bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed"
              }`}
            >
              {confirming && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Interview Slot
            </button>
          </motion.div>
        )}
      </div>

      <footer className="border-t border-zinc-900 py-6 bg-transparent mt-auto z-15">
        <div className="max-w-md mx-auto px-6 flex justify-between items-center text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
          <p>© {new Date().getFullYear()} Google Antigravity</p>
        </div>
      </footer>
    </main>
  );
}
