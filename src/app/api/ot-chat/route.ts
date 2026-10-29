import { NextRequest, NextResponse } from "next/server";
import { otChatAssistant } from "@/lib/meta-ai";
import { MetaApiError } from "@/lib/meta/errors";
import { DEFAULT_OT_CHAT_MODEL, isOtChatModel } from "@/lib/meta/models";

// Keep in sync with the chat UI: images are client-compressed, videos arrive
// as extracted JPEG frames (sent as kind:"image"). Limits are intentionally
// small so a chat POST stays fast and never OOMs on base64 JSON.
const MAX_ATTACHMENTS = 4;
const MAX_DATA_URL_CHARS = 3_000_000; // ~2.2MB binary per file
const MAX_TOTAL_CHARS = 8_000_000;

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json();
    const { history, userText, message, attachments, conversationId, model } = body ?? {};

    const text: string = (userText ?? message ?? "").toString();
    const turns: Array<{ role: "user" | "assistant"; content: string }> =
      Array.isArray(history) ? history : [];

    const files: Array<{
      kind: "image" | "video";
      dataUrl: string;
      mimeType?: string;
      name?: string;
    }> = Array.isArray(attachments) ? attachments : [];

    if (!text.trim() && files.length === 0) {
      return NextResponse.json(
        { error: "Message text or an image/video attachment is required." },
        { status: 400 }
      );
    }
    if (text.length > 4000) {
      return NextResponse.json(
        { error: "Message is too long (max 4000 characters)." },
        { status: 400 }
      );
    }
    if (files.length > MAX_ATTACHMENTS) {
      return NextResponse.json(
        { error: `Too many attachments (max ${MAX_ATTACHMENTS}).` },
        { status: 400 }
      );
    }
    let totalChars = 0;
    for (const f of files) {
      if (f.kind !== "image" && f.kind !== "video") {
        return NextResponse.json(
          { error: "Each attachment must have kind 'image' or 'video'." },
          { status: 400 }
        );
      }
      if (typeof f.dataUrl !== "string" || !f.dataUrl.startsWith("data:")) {
        return NextResponse.json(
          { error: "Each attachment must include a data URL (data:...)." },
          { status: 400 }
        );
      }
      if (f.dataUrl.length > MAX_DATA_URL_CHARS) {
        return NextResponse.json(
          {
            error: `Attachment ${f.name || f.kind} is too large after processing. Please use a smaller photo or a shorter video clip (frames are auto-extracted).`,
          },
          { status: 413 }
        );
      }
      totalChars += f.dataUrl.length;
      // Basic mime allow-list; data URL header carries the mime type.
      // Videos are pre-converted to JPEG frames client-side, so video-kind
      // attachments with image data URLs are accepted (legacy naming).
      const header = f.dataUrl.slice(5, 60).toLowerCase();
      const isImage = header.startsWith("image/");
      const isVideo = header.startsWith("video/");
      if (f.kind === "image" && !isImage) {
        return NextResponse.json(
          { error: "Image attachments must be image data URLs (e.g. image/jpeg, image/png)." },
          { status: 400 }
        );
      }
      if (f.kind === "video" && !isImage && !isVideo) {
        return NextResponse.json(
          { error: "Video attachments must be video data URLs (e.g. video/mp4, video/webm)." },
          { status: 400 }
        );
      }
    }
    if (totalChars > MAX_TOTAL_CHARS) {
      return NextResponse.json(
        { error: "Attachments are too large in total. Send fewer/smaller images." },
        { status: 413 }
      );
    }

    // Sanitize history: keep last 20 turns, plain text only (no data URLs echo).
    const cleanHistory = turns
      .filter(
        (t) =>
          t &&
          (t.role === "user" || t.role === "assistant") &&
          typeof t.content === "string"
      )
      .slice(-20)
      .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));

    const result = await otChatAssistant({
      history: cleanHistory,
      userText: text,
      attachments: files,
      conversationId:
        typeof conversationId === "string" ? conversationId : undefined,
      model: isOtChatModel(model) ? model : DEFAULT_OT_CHAT_MODEL,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    if (err instanceof MetaApiError) {
      console.error(
        `[ot-chat] ${err.code} after ${elapsed}ms: ${err.message}`
      );
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode || 500 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ot-chat] UNHANDLED after ${elapsed}ms: ${msg}`);
    return NextResponse.json({ error: msg || "Chat request failed." }, { status: 500 });
  }
}
