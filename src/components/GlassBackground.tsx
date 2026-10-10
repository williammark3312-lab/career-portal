"use client";

import React from "react";

export default function GlassBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none bg-black overflow-hidden"
    />
  );
}
