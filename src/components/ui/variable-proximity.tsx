"use client";

import React, { useEffect, useMemo, useRef } from "react";

type Falloff = "linear" | "exponential" | "gaussian";

interface VariableProximityProps {
  label: string;
  className?: string;
  style?: React.CSSProperties;
  /** e.g. "'wght' 100" — resting state (far from cursor) */
  fromFontVariationSettings: string;
  /** e.g. "'wght' 400" — fully engaged state (at cursor) */
  toFontVariationSettings: string;
  /** element that mouse movement is tracked over */
  containerRef: React.RefObject<HTMLElement | null>;
  /** px radius of the effect */
  radius?: number;
  falloff?: Falloff;
}

/** Parse "'wght' 100, 'opsz' 9" -> { wght: 100, opsz: 9 } */
function parseSettings(str: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /'([^']+)'\s+(-?[\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) out[m[1]] = parseFloat(m[2]);
  return out;
}

function falloffValue(distance: number, radius: number, falloff: Falloff): number {
  const t = Math.max(0, 1 - distance / radius);
  if (falloff === "exponential") return t * t;
  if (falloff === "gaussian") {
    const x = distance / radius;
    return Math.exp(-x * x * 2);
  }
  return t;
}

/**
 * Variable Proximity — characters near the cursor interpolate toward
 * `toFontVariationSettings`, far characters rest at `fromFontVariationSettings`.
 * Requires a variable font on the text (Playwrite IT Trad supports wght 100–400).
 */
export function VariableProximity({
  label,
  className = "",
  style,
  fromFontVariationSettings,
  toFontVariationSettings,
  containerRef,
  radius = 120,
  falloff = "linear",
}: VariableProximityProps) {
  const charsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const fromParsed = useMemo(() => parseSettings(fromFontVariationSettings), [fromFontVariationSettings]);
  const toParsed = useMemo(() => parseSettings(toFontVariationSettings), [toFontVariationSettings]);
  const axes = useMemo(
    () => Array.from(new Set([...Object.keys(fromParsed), ...Object.keys(toParsed)])),
    [fromParsed, toParsed]
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const container = containerRef.current;
    if (!container) return;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    const tick = () => {
      const r = container.getBoundingClientRect();
      const { x: mx, y: my } = mouseRef.current;
      for (const el of charsRef.current) {
        if (!el) continue;
        const c = el.getBoundingClientRect();
        const cx = c.left - r.left + c.width / 2;
        const cy = c.top - r.top + c.height / 2;
        const d = Math.hypot(mx - cx, my - cy);
        const f = falloffValue(d, radius, falloff);
        const parts = axes.map((axis) => {
          const from = fromParsed[axis] ?? toParsed[axis] ?? 0;
          const to = toParsed[axis] ?? from;
          return `'${axis}' ${(from + (to - from) * f).toFixed(1)}`;
        });
        el.style.fontVariationSettings = parts.join(", ");
      }
      raf = requestAnimationFrame(tick);
    };

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [containerRef, radius, falloff, axes, fromParsed, toParsed]);

  // "Aruga" is one word, but split on spaces anyway so multi-word labels keep gaps.
  const words = label.split(" ");
  let charIndex = 0;

  return (
    <span className={className} style={style} aria-label={label}>
      {words.map((word, wi) => (
        <span key={wi} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          {word.split("").map((ch) => {
            const i = charIndex++;
            return (
              <span
                key={i}
                aria-hidden
                ref={(el) => {
                  charsRef.current[i] = el;
                }}
                style={{ display: "inline-block", fontVariationSettings: fromFontVariationSettings }}
              >
                {ch}
              </span>
            );
          })}
          {wi < words.length - 1 ? <span style={{ display: "inline-block" }}>&nbsp;</span> : null}
        </span>
      ))}
    </span>
  );
}
