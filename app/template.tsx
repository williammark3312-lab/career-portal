"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 35, scale: 0.97, filter: "blur(12px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ 
        type: "spring",
        stiffness: 85,
        damping: 18,
        mass: 0.75,
        opacity: { duration: 0.6, ease: "easeOut" }
      }}
    >
      {children}
    </motion.div>
  );
}
