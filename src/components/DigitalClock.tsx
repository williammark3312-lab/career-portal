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
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-zinc-950/40 text-zinc-300 text-[11px] font-mono tracking-wider backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] select-none transition-all duration-300 ${className}`}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-blue-400" />
        </span>
      )}
      <span className="tabular-nums font-medium text-zinc-300">{timeStr}</span>
    </div>
  );
}
