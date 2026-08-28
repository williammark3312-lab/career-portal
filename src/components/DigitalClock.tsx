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
      className={`inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-white/8 bg-[rgba(15,15,17,0.65)] text-white/80 text-xs font-mono tracking-wider backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] select-none transition-all duration-300 hover:bg-[rgba(25,25,28,0.8)] hover:border-white/15 hover:text-white ${className}`}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
          <span className="relative h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        </span>
      )}
      <span className="tabular-nums font-semibold text-white/90 text-xs sm:text-[13px]">{timeStr}</span>
    </div>
  );
}
