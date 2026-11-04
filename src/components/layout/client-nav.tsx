"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Activity,
  PlayCircle,
  HeartHandshake,
  ChevronDown,
  FolderArchive,
  Wrench,
  BookOpen,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { NotificationsDropdown } from "@/components/ui/notifications-dropdown";
import { useAuth } from "@/lib/supabase/auth-context";

type NavChild = { href: string; label: string; icon: React.ElementType };
type NavItem = { label: string; icon: React.ElementType; href?: string; exact?: boolean; children?: NavChild[] };

export function ClientNav() {
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
  React.useEffect(() => {
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
    { label: "Dashboard", icon: LayoutDashboard, href: "/client/dashboard" },
    {
      label: "Home Program",
      icon: Home,
      href: "/client",
      exact: true,
      children: [
        { href: "/client/activities", label: "Activities", icon: Palette },
        { href: "/client/care-guide", label: "Care Guide", icon: HeartHandshake },
      ],
    },
    {
      label: "Records",
      icon: FolderArchive,
      children: [
        { href: "/client/history", label: "History", icon: History },
      ],
    },
    { label: "Messages", icon: MessageSquare, href: "/client/messages" },
    {
      label: "Tools",
      icon: Wrench,
      children: [
        { href: "/client/guide", label: "How to use Aruga", icon: BookOpen },
        { href: "/aruga-guide", label: "Aruga Guide AI Agent", icon: Bot },
        { href: "/tools/biomech", label: "Biomechanic Agent", icon: Activity },
        { href: "/tools/replay", label: "Biomech Replay", icon: PlayCircle },
      ],
    },
  ];

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenGroup, setMobileOpenGroup] = useState<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close mobile menu on route change + lock scroll
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileOpenGroup(null);
  }, [pathname]);
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileMenuOpen(false); };
      window.addEventListener("keydown", onEsc);
      return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onEsc); };
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

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
      // Hard navigation — bypasses Next.js Router Cache which can resurrect
      // the login form snapshot with stale email/password + loading=true
      if (typeof window !== "undefined") window.location.assign("/login");
      else router.push("/login");
    }
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
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
      <div className="flex h-14 sm:h-16 items-center justify-between gap-3 px-4 sm:px-6">
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

        {/* Right side — visible on all sizes, compact on mobile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/client/profile"
            className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors min-h-[36px] ${
              pathname === "/client/profile" ? "bg-teal-950/80 border-teal-500/60 text-teal-300" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            <User className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="max-w-[120px] truncate">{profile?.display_name || "Profile"}</span>
          </Link>
          {/* Mobile: icon-only profile */}
          <Link
            href="/client/profile"
            aria-label="Profile"
            className={`sm:hidden flex items-center justify-center w-9 h-9 rounded-lg border shrink-0 ${
              pathname === "/client/profile" ? "bg-teal-950/80 border-teal-500/60 text-teal-300" : "bg-zinc-900 border-zinc-800 text-zinc-300"
            }`}
          >
            <User className="w-4 h-4 text-teal-400" />
          </Link>
          <NotificationsDropdown role="client" />
          <button
            type="button"
            onClick={handleSignOut}
            className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1.5 rounded min-h-[36px] hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors shrink-0"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer — slide-in side sheet, always mounted for CSS transition */}
      <div className={`md:hidden pointer-events-none fixed inset-0 z-40 ${mobileMenuOpen ? "pointer-events-auto" : ""}`} aria-hidden={!mobileMenuOpen}>
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={mobileMenuOpen ? 0 : -1}
          onClick={() => setMobileMenuOpen(false)}
          className={`absolute inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen ? "opacity-100" : "opacity-0"}`}
        />
        <div className={`absolute left-0 top-14 bottom-0 w-[82%] max-w-[320px] flex flex-col bg-zinc-950 border-r border-zinc-800 shadow-2xl overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 overscroll-contain">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActiveItem(item);
                if (item.children) {
                  const expanded = mobileOpenGroup === item.label;
                  return (
                    <div key={item.label} className="rounded-xl border border-transparent data-[expanded=true]:border-zinc-800 data-[expanded=true]:bg-zinc-900/60" data-expanded={expanded}>
                      <button
                        type="button"
                        onClick={() => setMobileOpenGroup(expanded ? null : item.label)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors min-h-[48px] ${
                          active ? "text-teal-400 bg-zinc-900" : "text-zinc-300 hover:bg-zinc-900"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${active ? "bg-teal-950/60 border-teal-500/30 text-teal-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          {item.label}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
                      </button>
                      {expanded && (
                        <div className="px-3 pb-3 pt-1 space-y-1">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            const childActive = isChildActive(child.href);
                            return (
                              <Link
                                key={child.href + child.label}
                                href={child.href}
                                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                                  childActive ? "bg-zinc-800 text-teal-400" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
                                }`}
                              >
                                <ChildIcon className="w-4 h-4 shrink-0" />
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
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-colors ${
                      active ? "bg-zinc-800 text-teal-400" : "text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${active ? "bg-teal-950/60 border-teal-500/30 text-teal-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
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
              <Link
                href="/client/profile"
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-colors ${
                  pathname === "/client/profile" ? "bg-zinc-800 text-teal-400" : "text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${pathname === "/client/profile" ? "bg-teal-950/60 border-teal-500/30 text-teal-400" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>
                  <User className="w-4 h-4" />
                </span>
                Profile
                {profile?.display_name ? <span className="ml-auto text-xs text-zinc-500 truncate max-w-[140px]">{profile.display_name}</span> : null}
              </Link>
            </nav>
            <div className="shrink-0 p-4 border-t border-zinc-800 bg-zinc-950 space-y-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-medium min-h-[48px] hover:bg-zinc-800 hover:text-zinc-100 active:scale-[0.98] transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
              <p className="text-center text-[11px] text-zinc-600">Aruga • Clinician-directed home programs</p>
            </div>
          </div>
        </div>
    </header>
  );
}
