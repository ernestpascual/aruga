import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get("requesterId") || searchParams.get("therapistId") || searchParams.get("clientUserId") || searchParams.get("userId");

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Service unavailable: database not configured" }, { status: 503 });
    }
    if (!requesterId) {
      return NextResponse.json({ error: "requesterId required" }, { status: 403 });
    }

    // Find all patient threads this user participates in
    const { data: patients, error: pErr } = await admin
      .from("patients")
      .select("id")
      .or(`therapist_id.eq.${requesterId},client_user_id.eq.${requesterId}`);

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const patientIds = (patients || []).map((p: { id: string }) => p.id);
    if (patientIds.length === 0) {
      return NextResponse.json({ totalUnread: 0, perPatient: {}, patientIds: [] });
    }

    // Fetch last_read_at for each patient for this user
    const { data: readStates } = await admin
      .from("message_read_states")
      .select("patient_id, last_read_at")
      .eq("user_id", requesterId)
      .in("patient_id", patientIds);

    const lastReadMap = new Map<string, string>();
    for (const r of readStates || []) {
      lastReadMap.set((r as { patient_id: string }).patient_id, (r as { last_read_at: string }).last_read_at);
    }

    // Fetch all messages for these patients (only id, sender, created_at needed for counts, but fetch minimal)
    // To avoid huge payload, query per patient limited to last 200? For accuracy we need all unread counts, but typical threads < 500 msgs
    // Use single query then compute
    const { data: msgs, error: mErr } = await admin
      .from("messages")
      .select("patient_id, sender_id, created_at")
      .in("patient_id", patientIds)
      .order("created_at", { ascending: true });

    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 500 });
    }

    const perPatient: Record<string, number> = {};
    let totalUnread = 0;

    // Group by patient
    const grouped = new Map<string, Array<{ sender_id: string; created_at: string }>>();
    for (const m of msgs || []) {
      const pid = (m as { patient_id: string }).patient_id;
      if (!grouped.has(pid)) grouped.set(pid, []);
      grouped.get(pid)!.push(m as { sender_id: string; created_at: string });
    }

    for (const pid of patientIds) {
      const lastRead = lastReadMap.get(pid); // ISO string or undefined
      const list = grouped.get(pid) || [];
      let count = 0;
      for (const msg of list) {
        if (msg.sender_id === requesterId) continue; // own messages never unread
        if (!lastRead) {
          count += 1;
        } else {
          if (new Date(msg.created_at) > new Date(lastRead)) count += 1;
        }
      }
      perPatient[pid] = count;
      totalUnread += count;
    }

    // Also include patients with zero messages as 0
    for (const pid of patientIds) {
      if (!(pid in perPatient)) perPatient[pid] = 0;
    }

    return NextResponse.json({ totalUnread, perPatient, patientIds });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
