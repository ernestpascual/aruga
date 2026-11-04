"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  MessageSquare,
  LogOut,
  Stethoscope,
  HeartHandshake,
  Activity,
  PlayCircle,
  Palette,
  Wrench,
  ChevronDown,
  BookOpen,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { NotificationsDropdown } from "@/components/ui/notifications-dropdown";
import { useAuth } from "@/lib/supabase/auth-context";

type NavChild = { href: string; label: string; icon: React.ElementType };
type NavItem = { label: string; icon: React.ElementType; href?: string; exact?: boolean; children?: NavChild[] };

export function TherapistNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut, user } = useAuth();
  const [msgUnread, setMsgUnread] = useState(0);

  const fetchMsgUnread = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/messages/unread?requesterId=${user.id}`);
      const data = await res.json();
      if (res.ok && typeof data.totalUnread === "number") setMsgUnread(data.totalUnread);
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) { setMsgUnread(0); return; }
    fetchMsgUnread();
    const iv = setInterval(fetchMsgUnread, 12000);
    const onCustom = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && typeof d.totalUnread === "number") setMsgUnread(d.totalUnread);
    };
    window.addEventListener("aruga:messages-unread", onCustom as EventListener);
    const onVis = () => { if (document.visibilityState === "visible") fetchMsgUnread(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); window.removeEventListener("aruga:messages-unread", onCustom as EventListener); document.removeEventListener("visibilitychange", onVis); };
  }, [user?.id, fetchMsgUnread]);

  const navItems: NavItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/therapist/dashboard" },
    {
      label: "Clients",
      icon: Users,
      children: [
        { href: "/therapist/clients", label: "Clients List", icon: Users },
        { href: "/therapist/activities", label: "Activities", icon: Palette },
        { href: "/therapist/assessments", label: "Assessment", icon: ClipboardList },
      ],
    },
    { label: "Messages", icon: MessageSquare, href: "/therapist/messages" },
    {
      label: "Tools",
      icon: Wrench,
      children: [
        { href: "/therapist/guide", label: "How to use Aruga", icon: BookOpen },
        { href: "/aruga-guide", label: "Aruga Guide AI Agent", icon: HeartHandshake },
        { href: "/tools/biomech", label: "Biomechanic Agent", icon: Activity },
        { href: "/tools/replay", label: "Biomech Replay", icon: PlayCircle },
      ],
    },
  ];

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
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
    try {
      await signOut();
    } finally {
      if (typeof window !== "undefined") window.location.assign("/login");
      else router.push("/login");
    }
  };

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
      window.addEventListener("keydown", onEsc);
      return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onEsc); };
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  useEffect(() => { setMobileOpen(false); setMobileOpenGroup(null); }, [pathname]);

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
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/80">
      <div className="mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4 max-w-7xl">
        {/* Left: Logo + Hamburger */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 -ml-1 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Logo href="/therapist/dashboard" />
        </div>

        {/* Desktop Navigation - centered */}
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
                      <div className="min-w-[190px] rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl py-1.5">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = isChildActive(child.href);
                          return (
                            <Link
                              key={child.href + child.label}
                              href={child.href}
                              onClick={() => setOpenDropdown(null)}
                              className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                                childActive ? "bg-zinc-800 text-teal-400" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70"
                              }`}
                            >
                              <ChildIcon className="w-4 h-4" />
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

            return (
              <Link
                key={item.label}
                href={item.href!}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-zinc-800 text-teal-400 font-semibold" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {item.label === "Messages" && msgUnread > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-zinc-950 shadow-sm">
                    {msgUnread > 99 ? "99+" : msgUnread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <Link
            href="/therapist/profile"
            className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              pathname === "/therapist/profile"
                ? "bg-teal-950/80 border-teal-500 text-teal-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
            <span className="max-w-[120px] truncate">{profile?.display_name || "Profile"}</span>
          </Link>

          {/* Mobile profile icon */}
          <Link
            href="/therapist/profile"
            className={`sm:hidden w-9 h-9 grid place-items-center rounded-lg border ${pathname === "/therapist/profile" ? "bg-teal-950/80 border-teal-500/40 text-teal-300" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}
            aria-label="Profile"
          >
            <Stethoscope className="w-4 h-4" />
          </Link>

          <NotificationsDropdown role="therapist" />

          <button
            type="button"
            onClick={handleSignOut}
            className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
          {/* Mobile sign out icon */}
          <button
            type="button"
            onClick={handleSignOut}
            className="sm:hidden w-9 h-9 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer — slide-in side sheet, always mounted for transition */}
      <div className={`md:hidden pointer-events-none fixed inset-0 z-40 ${mobileOpen ? "pointer-events-auto" : ""}`} aria-hidden={!mobileOpen}>
        <button type="button" aria-label="Close menu" tabIndex={mobileOpen ? 0 : -1} onClick={() => setMobileOpen(false)} className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? "opacity-100" : "opacity-0"}`} />
        <div className={`absolute top-14 left-0 bottom-0 w-[300px] max-w-[85vw] bg-zinc-950 border-r border-zinc-800 shadow-2xl overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActiveItem(item);
                if (item.children) {
                  const expanded = mobileOpenGroup === item.label;
                  return (
                    <div key={item.label} className="rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setMobileOpenGroup(expanded ? null : item.label)}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                          active ? "bg-zinc-800 text-teal-300" : "text-zinc-300 hover:bg-zinc-900"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg grid place-items-center border ${active ? "bg-teal-950/60 border-teal-500/30 text-teal-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          {item.label}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                      {expanded && (
                        <div className="mt-1 ml-3 pl-3 border-l border-zinc-800 space-y-1 py-1">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            const childActive = isChildActive(child.href);
                            return (
                              <Link
                                key={child.href + child.label}
                                href={child.href}
                                onClick={() => {
                                  setMobileOpen(false);
                                  setMobileOpenGroup(null);
                                }}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                  childActive ? "bg-zinc-800 text-teal-400 font-medium" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                                }`}
                              >
                                <ChildIcon className="w-4 h-4" />
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
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                      active ? "bg-zinc-800 text-teal-400" : "text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg grid place-items-center border ${active ? "bg-teal-950/60 border-teal-500/30 text-teal-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    {item.label}
                    {item.label === "Messages" && msgUnread > 0 && (
                      <span className="ml-auto inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-zinc-950">
                        {msgUnread > 99 ? "99+" : msgUnread}
                      </span>
                    )}
                  </Link>
                );
              })}

              <div className="pt-3 mt-3 border-t border-zinc-800 space-y-1">
                <Link
                  href="/therapist/profile"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium ${pathname === "/therapist/profile" ? "bg-teal-950/40 border border-teal-500/30 text-teal-300" : "text-zinc-300 hover:bg-zinc-900"}`}
                >
                  <span className="w-8 h-8 rounded-lg grid place-items-center bg-zinc-900 border border-zinc-800 text-teal-400">
                    <Stethoscope className="w-4 h-4" />
                  </span>
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                >
                  <span className="w-8 h-8 rounded-lg grid place-items-center bg-zinc-900 border border-zinc-800">
                    <LogOut className="w-4 h-4" />
                  </span>
                  Sign out
                </button>
              </div>

              <p className="px-3 pt-4 text-[11px] text-zinc-500 text-center">Aruga Therapist Portal • v2</p>
            </nav>
          </div>
        </div>
    </header>
  );
}
