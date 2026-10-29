import React from "react";
import { Sparkles, Info } from "lucide-react";

interface MockBadgeProps {
  className?: string;
  showExplanation?: boolean;
}

export function MockBadge({ className = "", showExplanation = false }: MockBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/40 text-amber-300 ${className}`}>
      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
      <span>Mock AI Fixture</span>
      {showExplanation && (
        <span className="text-[11px] font-normal text-amber-400/80 border-l border-amber-500/30 pl-1.5 ml-0.5 flex items-center gap-1">
          <Info className="w-3 h-3 inline" />
          Test mode active
        </span>
      )}
    </div>
  );
}
