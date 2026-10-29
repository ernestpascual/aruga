import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-medium border transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-zinc-700 bg-zinc-800 text-zinc-200",
        teal:
          "border-teal-500/40 bg-teal-950/60 text-teal-300",
        amber:
          "border-amber-500/40 bg-amber-950/60 text-amber-300",
        emerald:
          "border-emerald-500/40 bg-emerald-950/60 text-emerald-300",
        rose:
          "border-rose-500/40 bg-rose-950/60 text-rose-300",
        outline:
          "border-zinc-800 text-zinc-400 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  statusText?: string;
  icon?: React.ReactNode;
}

export function Badge({
  className = "",
  variant,
  statusText,
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <div className={`${badgeVariants({ variant })} ${className}`} {...props}>
      {icon}
      <span>{statusText || children}</span>
    </div>
  );
}
