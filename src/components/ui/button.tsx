"use client";

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "motion/react";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default:
          "bg-teal-600 text-zinc-950 hover:bg-teal-500 font-semibold shadow-sm",
        secondary:
          "bg-zinc-800 text-zinc-100 hover:bg-zinc-700/80 border border-zinc-700/60",
        outline:
          "border border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50",
        ghost:
          "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
        danger:
          "bg-red-950/80 text-red-200 border border-red-800/80 hover:bg-red-900",
        link:
          "text-teal-400 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-8 px-3 text-xs rounded-md",
        lg: "h-12 px-6 text-base rounded-lg",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref" | "children">,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant,
      size,
      isLoading,
      children,
      disabled,
      whileHover,
      whileTap,
      transition,
      ...props
    },
    ref
  ) => {
    const isInteractive = !disabled && !isLoading && variant !== "link";

    return (
      <motion.button
        ref={ref}
        disabled={disabled || isLoading}
        whileHover={
          isInteractive
            ? (whileHover ?? { scale: 1.02 })
            : undefined
        }
        whileTap={
          isInteractive
            ? (whileTap ?? { scale: 0.97 })
            : undefined
        }
        transition={transition ?? { type: "spring", stiffness: 450, damping: 25 }}
        className={`${buttonVariants({ variant, size })} ${className}`}
        {...props}
      >
        {isLoading && (
          <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";

