import React from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string;
  showTagline?: boolean;
}

export function Logo({
  className = "",
  size = "md",
  href = "/",
  showTagline = false,
}: LogoProps) {
  const content = (
    <div className={`flex items-center group cursor-pointer ${className}`}>
      <div className="flex flex-col">
        <span
          className="font-aruga font-normal text-zinc-100 tracking-wide group-hover:text-teal-300 transition-colors duration-200 flex items-center gap-1.5"
          style={{
            fontFamily: "'Playwrite IT Trad', 'Playwrite Italia Tradizionale', cursive",
            fontSize: size === "sm" ? "1.1rem" : size === "lg" ? "1.65rem" : "1.35rem",
          }}
        >
          {siteConfig.name}
        </span>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
