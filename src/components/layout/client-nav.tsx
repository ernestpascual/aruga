"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Home,
  History,
  MessageSquare,
  LogOut,
  User,
  HeartPulse,
  Baby,
  GraduationCap,
  Bot,
  Scan,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationsDropdown } from "@/components/ui/notifications-dropdown";
import { useAuth } from "@/lib/supabase/auth-context";

export function ClientNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const navItems = [
    { href: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/client", label: "Active Routine", icon: Home, exact: true },
    { href: "/client/history", label: "History", icon: History },
    { href: "/client/messages", label: "Messages", icon: MessageSquare },
    { href: "/ask-ot", label: "Ask OT", icon: Bot },
    { href: "/sam-test", label: "SAM Test", icon: Scan },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const category = profile?.client_category || "adult";
  const categoryLabel =
    category === "pedia"
      ? "Pediatric"
      : category === "adolescent"
      ? "Adolescent"
      : category === "old_people"
      ? "Old People (55+)"
      : "Adult Client";

  const CategoryIcon =
    category === "pedia"
      ? Baby
      : category === "adolescent"
      ? GraduationCap
      : category === "old_people"
      ? HeartPulse
      : User;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo href="/client/dashboard" />

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-800 text-teal-400 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side role, profile, and sign out */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Badge
            variant="teal"
            icon={<CategoryIcon className="w-3.5 h-3.5 text-teal-400" />}
            statusText={categoryLabel}
          />

          <Link
            href="/client/profile"
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              pathname === "/client/profile"
                ? "bg-teal-950/80 border-teal-500 text-teal-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            <User className="w-3.5 h-3.5 text-teal-400" />
            <span className="max-w-[120px] truncate hidden sm:inline">
              {profile?.display_name || "Profile"}
            </span>
          </Link>

          <NotificationsDropdown role="client" />

          <ThemeToggle />

          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="flex md:hidden border-t border-zinc-800/60 bg-zinc-900/50 px-3 py-2 justify-around overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 text-xs font-medium py-1 px-2.5 rounded-md transition-colors shrink-0 ${
                isActive
                  ? "text-teal-400 bg-zinc-800"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/client/profile"
          className={`flex items-center gap-1 text-xs font-medium py-1 px-2.5 rounded-md transition-colors shrink-0 ${
            pathname === "/client/profile"
              ? "text-teal-400 bg-zinc-800"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Profile
        </Link>
      </div>
    </header>
  );
}
