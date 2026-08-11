"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface DigitalClockProps {
  className?: string;
  showIcon?: boolean;
}

export default function DigitalClock({ className = "", showIcon = true }: DigitalClockProps) {
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

  if (!mounted || !timeStr) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-zinc-950/60 text-zinc-500 text-xs font-mono opacity-0 select-none ${className}`}>
        <span className="tabular-nums text-xs">00:00:00 AM</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-zinc-950/60 text-zinc-300 text-xs font-mono tracking-wider backdrop-blur-md shadow-inner select-none transition-all duration-300 ${className}`}
    >
      {showIcon && <Clock className="w-3.5 h-3.5 text-zinc-400 animate-pulse" />}
      <span className="tabular-nums font-semibold text-[11px] sm:text-xs text-zinc-200">{timeStr}</span>
    </div>
  );
}
