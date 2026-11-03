import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v: string | null | undefined): boolean {
  return typeof v === "string" && UUID_RE.test(v);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const conversationId = searchParams.get("conversationId");

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ conversations: [], messages: [] });
    }

    // If specific conversationId requested, fetch its messages — guard legacy ot-xxx ids (22P02)
    if (conversationId) {
      if (!isValidUUID(conversationId)) {
        // Legacy client id (ot-mvzh8smg-xxxxx) or corrupted localStorage — no DB row possible
        return NextResponse.json({ messages: [] });
      }
      const { data: messages, error: mError } = await admin
        .from("ot_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (mError) {
        console.warn("Could not load ot_messages from database:", mError);
        return NextResponse.json({ messages: [] });
      }
      return NextResponse.json({ messages: messages || [] });
    }

    // Otherwise list conversations for user
    if (userId) {
      const { data: convs, error: cError } = await admin
        .from("ot_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (cError) {
        console.warn("Could not load ot_conversations from database:", cError);
        return NextResponse.json({ conversations: [] });
      }
      return NextResponse.json({ conversations: convs || [] });
    }

    return NextResponse.json({ conversations: [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, userId, conversationId, title, modelId, message } = body;
    const admin = createAdminClient();

    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    if (action === "create_conversation") {
      const newId = isValidUUID(conversationId) ? (conversationId as string) : crypto.randomUUID();
      const convTitle = title || "New Conversation";

      // Deduplicate: Check if this user created an identical conversation in the last 4 seconds
      const recentWindow = new Date(Date.now() - 4000).toISOString();
      const { data: existingEmpty } = await admin
        .from("ot_conversations")
        .select("*")
        .eq("user_id", userId)
        .eq("title", convTitle)
        .gte("created_at", recentWindow)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingEmpty) {
        return NextResponse.json({ conversation: existingEmpty, deduplicated: true });
      }

      const { data, error } = await admin
        .from("ot_conversations")
        .upsert(
          {
            id: newId,
            user_id: userId,
            title: convTitle,
            model_id: modelId || "meta/llama-3.3-70b-instruct",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select()
        .single();

      if (error) {
        console.warn("Could not create ot_conversation:", error);
        return NextResponse.json({ id: newId, title: convTitle });
      }
      return NextResponse.json({ conversation: data });
    }

    if (action === "save_message") {
      if (!conversationId || !message) {
        return NextResponse.json({ error: "conversationId and message required" }, { status: 400 });
      }
      if (!isValidUUID(conversationId)) {
        // Legacy client id — reject gracefully so client can regenerate UUID; avoid 22P02
        return NextResponse.json({ error: "Invalid conversationId: must be UUID. Clear localStorage key ot-helper-conversation-id and retry." }, { status: 400 });
      }

      // Auto-heal: ensure conversation exists before inserting message (handles race / cleared DB)
      if (userId) {
        try {
          await admin.from("ot_conversations").upsert(
            { id: conversationId, user_id: userId, title: title || "New Conversation", updated_at: new Date().toISOString() },
            { onConflict: "id" }
          );
        } catch {}
      }

      // Deduplicate recent message in this conversation (within 2 seconds)
      const recentWindow = new Date(Date.now() - 2000).toISOString();
      const { data: duplicate } = await admin
        .from("ot_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("role", message.role)
        .eq("content", message.content)
        .gte("created_at", recentWindow)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json({ message: duplicate, deduplicated: true });
      }

      const { data, error } = await admin
        .from("ot_messages")
        .insert({
          conversation_id: conversationId,
          role: message.role,
          content: message.content,
          attachments: message.attachments || [],
          sam_result: message.sam_result || null,
        })
        .select()
        .single();

      // Touch conversation updated_at and update title if provided
      const updateData: { updated_at: string; title?: string } = {
        updated_at: new Date().toISOString(),
      };
      if (title) updateData.title = title;

      try {
        await admin
          .from("ot_conversations")
          .update(updateData)
          .eq("id", conversationId);
      } catch {
        // ignore update errors
      }

      if (error) {
        console.warn("Could not save ot_message:", error);
      }
      return NextResponse.json({ message: data || message });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const action = searchParams.get("action") || "clear"; // 'clear' or 'delete'

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }
    if (!isValidUUID(conversationId)) {
      // Legacy id — nothing to delete in DB; just acknowledge so client stops retrying
      return NextResponse.json({ ok: true, cleared: true, legacy: true });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: true });
    }

    if (action === "clear") {
      // Clear all messages in this conversation
      await admin.from("ot_messages").delete().eq("conversation_id", conversationId);
      return NextResponse.json({ ok: true, cleared: true });
    }

    if (action === "delete") {
      // Delete messages and conversation
      await admin.from("ot_messages").delete().eq("conversation_id", conversationId);
      await admin.from("ot_conversations").delete().eq("id", conversationId);
      return NextResponse.json({ ok: true, deleted: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
