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
  /** springy jump-in entrance on scroll into view */
  pop?: boolean;
  popDelay?: number;
}

/**
 * Parallax — inner content drifts at its own rate while its section passes
 * through the viewport. Wrap section content; vary `speed` for depth.
 * With `pop`, children also spring in (opacity / rise / scale) on entry.
 */
export function Parallax({ children, className, speed = 80, direction = -1, pop = false, popDelay = 0 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [(speed / 2) * direction, (speed / 2) * -direction]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>
        {pop ? (
          <motion.div
            initial={{ opacity: 0, y: 70, scale: 0.9 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.35 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: popDelay }}
          >
            {children}
          </motion.div>
        ) : (
          children
        )}
      </motion.div>
    </div>
  );
}
