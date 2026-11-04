"use client";

import React from "react";
import { motion } from "motion/react";

interface FadeContentProps {
  children: React.ReactNode;
  className?: string;
  /** px of vertical rise */
  distance?: number;
  /** seconds */
  duration?: number;
  /** px of initial blur */
  blur?: number;
  delay?: number;
  /** 0 → plays on mount; otherwise fraction of element visible to trigger */
  threshold?: number;
  initialOpacity?: number;
}

/**
 * FadeContent — content fades, de-blurs and rises into place when scrolled
 * into view (plays once). Same effect family as React Bits' Fade Content.
 */
export function FadeContent({
  children,
  className,
  distance = 24,
  duration = 0.8,
  blur = 6,
  delay = 0,
  threshold = 0.15,
  initialOpacity = 0,
}: FadeContentProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: initialOpacity, y: distance, filter: `blur(${blur}px)` }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: threshold }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
