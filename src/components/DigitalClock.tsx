"use client";

import { useEffect, useState } from "react";

interface DigitalClockProps {
  className?: string;
  showDot?: boolean;
}

export default function DigitalClock({ className = "", showDot = true }: DigitalClockProps) {
  const [mounted, setMounted] = useState(false);
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted || !timeStr) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-zinc-950/80 text-zinc-300 text-xs font-mono tracking-wider backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] select-none transition-all duration-300 hover:border-white/20 ${className}`}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      )}
      <span className="tabular-nums font-semibold text-zinc-200 text-xs sm:text-[13px]">{timeStr}</span>
    </div>
  );
}
