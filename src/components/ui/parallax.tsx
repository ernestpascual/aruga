"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

interface ParallaxProps {
  children: React.ReactNode;
  className?: string;
  /** total px the content travels across the section's viewport passage */
  speed?: number;
  /** direction of travel relative to scroll */
  direction?: 1 | -1;
}

/**
 * Parallax — inner content drifts at its own rate while its section passes
 * through the viewport. Wrap section content; vary `speed` for depth.
 */
export function Parallax({ children, className, speed = 80, direction = -1 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [(speed / 2) * direction, (speed / 2) * -direction]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
