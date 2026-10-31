"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  CheckCircle2,
  X,
  Clock,
  UserPlus,
  HeartHandshake,
  Loader2,
  Check,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/supabase/auth-context";
import Link from "next/link";

export interface AppNotification {
  id: string;
  type: "client_link_request" | "therapist_invitation" | "pending_status" | "info";
  title: string;
  description: string;
  timestamp: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  patientCondition?: string;
  patientAge?: number;
  caregiverName?: string | null;
  therapistId?: string;
  therapistName?: string;
  therapistDiscipline?: string;
  initiatedBy: "therapist" | "client";
  status: "pending" | "accepted" | "declined";
  actionRequired: boolean;
}

interface NotificationsDropdownProps {
  role?: "therapist" | "client";
}

export function NotificationsDropdown({ role: propRole }: NotificationsDropdownProps) {
  const { user, profile } = useAuth();
  const effectiveRole = propRole || profile?.role || "therapist";
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; message: string; type: "success" | "error" } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("role", effectiveRole);
      if (user?.id) params.set("userId", user.id);

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount ?? data.notifications.filter((n: AppNotification) => n.actionRequired).length);
      }
    } catch {
      // ignore network errors
    }
  }, [effectiveRole, user?.id]);

  useEffect(() => {
    fetchNotifications();

    // Poll periodically for new notifications (every 15s)
    const interval = setInterval(fetchNotifications, 15000);

    // Also listen for link action events triggered by other components
    const handleRefresh = () => fetchNotifications();
    window.addEventListener("aruga:notification-action", handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("aruga:notification-action", handleRefresh);
    };
  }, [fetchNotifications]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = async (
    notif: AppNotification,
    action: "approve" | "accept" | "decline"
  ) => {
    if (processingId) return;
    setProcessingId(notif.id);
    setActionFeedback(null);

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: notif.patientId,
          action,
          role: effectiveRole,
          userId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update connection.");

      setActionFeedback({
        id: notif.id,
        message: action === "decline" ? "Request declined." : "Connection confirmed & approved!",
        type: "success",
      });

      // Dispatch event to refresh any parent/sibling dashboard components
      window.dispatchEvent(new Event("aruga:notification-action"));

      // Refresh local notifications
      setTimeout(() => {
        fetchNotifications();
        setActionFeedback(null);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionFeedback({
        id: notif.id,
        message: msg,
        type: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 60) return "just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return "recent";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View in-app notifications"
        className={`relative p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer border ${
          isOpen ? "bg-zinc-800 border-zinc-700 text-zinc-100" : "border-transparent"
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-zinc-950 shadow-md animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/60">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-semibold text-zinc-100">Notifications</h3>
              {unreadCount > 0 ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {unreadCount} action required
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400">All clear</span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-zinc-800/60">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-2.5">
                  <CheckCircle2 className="w-5 h-5 text-teal-400/70" />
                </div>
                <p className="text-xs font-medium text-zinc-300">No pending notifications</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  You are all caught up with your clinical connections.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isProcessing = processingId === notif.id;
                const feedback = actionFeedback?.id === notif.id ? actionFeedback : null;

                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 space-y-2.5 transition-colors ${
                      notif.actionRequired ? "bg-amber-950/10 hover:bg-amber-950/20" : "hover:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            notif.actionRequired
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                          }`}
                        >
                          {notif.type === "client_link_request" ? (
                            <UserPlus className="w-3.5 h-3.5" />
                          ) : (
                            <HeartHandshake className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-200 leading-snug">
                            {notif.title}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                            {notif.description}
                          </p>
                          {notif.patientCondition && (
                            <p className="text-[10px] text-zinc-500 mt-1">
                              Condition: <span className="text-zinc-300">{notif.patientCondition}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {formatTimeAgo(notif.timestamp)}
                      </span>
                    </div>

                    {/* Inline Action Feedback */}
                    {feedback && (
                      <div
                        className={`text-[11px] py-1.5 px-2.5 rounded-lg border flex items-center gap-1.5 ${
                          feedback.type === "success"
                            ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                            : "bg-rose-950/40 border-rose-500/30 text-rose-300"
                        }`}
                      >
                        {feedback.type === "success" ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                        <span>{feedback.message}</span>
                      </div>
                    )}

                    {/* Action Buttons for Pending Approvals */}
                    {notif.actionRequired && !feedback && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleAction(notif, "approve")}
                          disabled={isProcessing}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-1 px-3 shadow-sm"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          Approve & Connect
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAction(notif, "decline")}
                          disabled={isProcessing}
                          className="h-7 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 px-2.5"
                        >
                          Decline
                        </Button>
                      </div>
                    )}

                    {/* Pending Waiting State (for initiator) */}
                    {!notif.actionRequired && (
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 pt-0.5">
                        <Clock className="w-3 h-3 text-amber-400/80" />
                        <span>Awaiting recipient response</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer quick link */}
          <div className="px-4 py-2.5 bg-zinc-900/40 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Aruga Clinical Network</span>
            {effectiveRole === "therapist" ? (
              <Link
                href="/therapist/clients"
                onClick={() => setIsOpen(false)}
                className="text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium transition-colors"
              >
                View Caseload <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <Link
                href="/client/dashboard"
                onClick={() => setIsOpen(false)}
                className="text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium transition-colors"
              >
                Dashboard <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
