import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data?.user) {
        const isTherapist =
          data.user.user_metadata?.role === "therapist" ||
          data.user.email?.includes("therapist");

        return NextResponse.redirect(
          new URL(isTherapist ? "/therapist/dashboard" : "/client/dashboard", origin)
        );
      }
    }
  }

  // Fallback to landing page (which also handles auth state and redirects to dashboard)
  return NextResponse.redirect(new URL("/", origin));
}
