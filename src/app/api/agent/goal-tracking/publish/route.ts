import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  // In Phase 0, publish is no-op (mock). Phase 1 will insert into goal_reviews status=published.
  try { await req.json().catch(()=>null); } catch {}
  return NextResponse.json({ ok: true, published: true });
}
