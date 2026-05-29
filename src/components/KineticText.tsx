"use client";

import { motion } from "framer-motion";

interface KineticTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function KineticText({ text, className, style }: KineticTextProps) {
  const letters = text.split("");

  return (
    <span className={`inline-block ${className || ""}`} style={style}>
      {letters.map((char, index) => (
        <motion.span
          key={index}
          className="inline-block"
          style={{
            whiteSpace: char === " " ? "pre" : "normal",
            display: "inline-block",
            transformOrigin: "center bottom",
          }}
          whileHover={{
            y: -3,
            scale: 1.08,
            color: "var(--google-blue)",
            textShadow: "0 0 8px rgba(26, 115, 232, 0.25)",
            transition: {
              type: "spring",
              stiffness: 400,
              damping: 14,
            },
          }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}
