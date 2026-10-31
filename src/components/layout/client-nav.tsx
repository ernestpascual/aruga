"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Home,
  History,
  MessageSquare,
  LogOut,
  User,
  Palette,
  Bot,
  Scan,
  HeartHandshake,
  ChevronDown,
  FolderArchive,
  Wrench,
  BookOpen,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { NotificationsDropdown } from "@/components/ui/notifications-dropdown";
import { useAuth } from "@/lib/supabase/auth-context";

type NavChild = { href: string; label: string; icon: React.ElementType };
type NavItem = { label: string; icon: React.ElementType; href?: string; exact?: boolean; children?: NavChild[] };

export function ClientNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const navItems: NavItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/client/dashboard" },
    {
      label: "Home Program",
      icon: Home,
      href: "/client",
      exact: true,
      children: [{ href: "/client/activities", label: "Activities", icon: Palette }],
    },
    {
      label: "Records",
      icon: FolderArchive,
      children: [
        { href: "/client/activities", label: "Activities", icon: Palette },
        { href: "/client/history", label: "History", icon: History },
      ],
    },
    { label: "Messages", icon: MessageSquare, href: "/client/messages" },
    {
      label: "Tools",
      icon: Wrench,
      children: [
        { href: "/client/guide", label: "How to use Aruga", icon: BookOpen },
        { href: "/aruga-guide", label: "Guide", icon: HeartHandshake },
        { href: "/sam-test", label: "SAM Test", icon: Scan },
      ],
    },
  ];

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpenGroup, setMobileOpenGroup] = useState<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleEnter(label: string) {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpenDropdown(label);
  }
  function handleLeave() {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => setOpenDropdown(null), 120);
  }

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  function isActiveItem(item: NavItem): boolean {
    if (item.href) {
      if (item.exact) return pathname === item.href;
      return pathname.startsWith(item.href);
    }
    if (item.children) return item.children.some((c) => pathname.startsWith(c.href));
    return false;
  }

  function isChildActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 gap-4">
        <div className="flex items-center shrink-0">
          <Logo href="/client/dashboard" />
        </div>

        {/* Desktop Navigation - centered, evenly spaced */}
        <nav className="hidden md:flex flex-1 justify-center items-center gap-6 lg:gap-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActiveItem(item);

              if (item.children) {
                const isOpen = openDropdown === item.label;
                return (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => handleEnter(item.label)}
                    onMouseLeave={handleLeave}
                  >
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        active ? "bg-zinc-800 text-teal-400 font-semibold" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="absolute left-0 top-full pt-2 z-50">
                        <div className="min-w-[180px] rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl py-1.5">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            const childActive = isChildActive(child.href);
                            return (
                              <Link
                                key={child.href + child.label}
                                href={child.href}
                                onClick={() => setOpenDropdown(null)}
                                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium transition-colors ${
                                  childActive ? "bg-zinc-800 text-teal-400" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70"
                                }`}
                              >
                                <ChildIcon className="w-3.5 h-3.5" />
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // plain link
              return (
                <Link
                  key={item.label}
                  href={item.href!}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-zinc-800 text-teal-400 font-semibold" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

        {/* Right side */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <Link
            href="/client/profile"
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              pathname === "/client/profile" ? "bg-teal-950/80 border-teal-500 text-teal-300" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            <User className="w-3.5 h-3.5 text-teal-400" />
            <span className="max-w-[120px] truncate hidden sm:inline">{profile?.display_name || "Profile"}</span>
          </Link>

          <NotificationsDropdown role="client" />
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

      {/* Mobile Nav */}
      <div className="flex md:hidden border-t border-zinc-800/60 bg-zinc-900/50 px-2 py-2 gap-1 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActiveItem(item);

          if (item.children) {
            const expanded = mobileOpenGroup === item.label;
            return (
              <div key={item.label} className="flex flex-col shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileOpenGroup(expanded ? null : item.label)}
                  className={`flex items-center gap-1 text-xs font-medium py-1.5 px-2.5 rounded-md transition-colors shrink-0 ${
                    active ? "text-teal-400 bg-zinc-800" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                  <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <div className="mt-1 ml-1 flex flex-col gap-0.5 border-l border-zinc-800 pl-2">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = isChildActive(child.href);
                      return (
                        <Link
                          key={child.href + child.label}
                          href={child.href}
                          onClick={() => setMobileOpenGroup(null)}
                          className={`flex items-center gap-1.5 text-xs font-medium py-1 px-2 rounded-md transition-colors ${
                            childActive ? "text-teal-400 bg-zinc-800" : "text-zinc-400"
                          }`}
                        >
                          <ChildIcon className="w-3 h-3" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href!}
              className={`flex items-center gap-1 text-xs font-medium py-1 px-2.5 rounded-md transition-colors shrink-0 whitespace-nowrap ${
                active ? "text-teal-400 bg-zinc-800" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/client/profile"
          className={`flex items-center gap-1 text-xs font-medium py-1 px-2.5 rounded-md transition-colors shrink-0 whitespace-nowrap ${
            pathname === "/client/profile" ? "text-teal-400 bg-zinc-800" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Profile
        </Link>
      </div>
    </header>
  );
}
