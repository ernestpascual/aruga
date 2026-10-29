import { User } from "@supabase/supabase-js";
import { Profile } from "@/types/database";
import {
  DEMO_THERAPIST_ID,
  DEMO_CLIENT_ID,
  DEMO_PEDIATRIC_CLIENT_ID,
} from "./mock-store";

export const DEMO_USER_EMAILS = [
  "therapist@aruga.local",
  "adult.marcus@aruga.local",
  "marcus.vance.demo@aruga-health.local",
  "teen.maya@aruga.local",
  "maya.lin.demo@aruga-health.local",
  "pedia.leo@aruga.local",
  "leo.chen.demo@aruga-health.local",
];

export const DEMO_USER_IDS = [
  DEMO_THERAPIST_ID,
  DEMO_CLIENT_ID,
  DEMO_PEDIATRIC_CLIENT_ID,
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "22222222-2222-4222-8222-222222222224",
];

/**
 * Checks whether the current user is a demo / bypass user.
 * Newly registered users (real email/password accounts) will return FALSE.
 * Only demo credentials, local bypasses, or demo emails return TRUE.
 */
export function isDemoUser(
  user: User | null | undefined,
  profile?: Profile | null | undefined
): boolean {
  if (!user && !profile) return false;

  const email = (user?.email || "").toLowerCase().trim();
  const userId = user?.id || profile?.id || "";

  // 1. Check if user ID matches one of the fixed demo IDs
  if (DEMO_USER_IDS.includes(userId)) return true;

  // 2. Check if email matches any demo email
  if (DEMO_USER_EMAILS.some((de) => email === de.toLowerCase())) return true;

  // 3. Check if email ends with @aruga.local or contains .demo@
  if (email.endsWith("@aruga.local") || email.includes(".demo@")) return true;

  // 4. Check user metadata flag
  if (user?.user_metadata?.is_demo === true) return true;

  return false;
}
