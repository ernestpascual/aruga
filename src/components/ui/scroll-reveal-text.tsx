"use client";

import React, { useMemo, useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

export interface RevealSegment {
  text: string;
  className?: string;
}

interface ScrollRevealTextProps {
  segments: RevealSegment[];
  className?: string;
}

function Word({
  progress,
  range,
  className,
  children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  className?: string;
  children: string;
}) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  return (
    <>
      <motion.span style={{ opacity }} className={className}>
        {children}
      </motion.span>{" "}
    </>
  );
}

/**
 * ScrollRevealText — words fade from dim to full as the text travels through
 * the viewport, driven directly by scroll position (scrubs both ways).
 */
export function ScrollRevealText({ segments, className }: ScrollRevealTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.45"],
  });

  const total = useMemo(
    () =>
      segments.reduce(
        (n, s) => n + s.text.split(" ").filter(Boolean).length,
        0
      ),
    [segments]
  );

  let cursor = 0;

  return (
    <span ref={ref} className={className}>
      {segments.map((seg, si) => {
        const words = seg.text.split(" ").filter(Boolean);
        const start = cursor;
        cursor += words.length;
        return (
          <span key={si} className={seg.className}>
            {words.map((w, wi) => {
              const i = start + wi;
              return (
                <Word
                  key={`${si}-${wi}`}
                  progress={scrollYProgress}
                  range={[i / total, Math.min(1, (i + 1.5) / total)]}
                >
                  {w}
                </Word>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}
