import "server-only";
import { createMetaOpenAiClient, getMetaConfig } from "./client";
import { MetaApiError, MetaTimeoutError, MetaRateLimitError } from "./errors";
import { ActivitySpecSchema, ActivitySpecParsed } from "./schemas";
import { buildActivitySparkPrompt } from "./prompts";
import { DEFAULT_ACTIVITY_IMAGE_MODEL } from "./models";

const AGE_BAND_LABELS: Record<string, string> = {
  pedia: "pedia",
  adolescent: "adolescent",
  adult: "adult",
  geriatric: "geriatric",
};

// Stage 1: Spark structured JSON for activity pedagogy + visual brief
export async function runSparkActivitySpec(params: {
  ageBand: string;
  category?: string;
  templatePrompt?: string;
  imagePrompt?: string;
  titleOverride?: string;
  theme?: string;
  difficulty?: string;
  lineStyle?: string;
  referenceLinks?: string[];
  referenceImageNotes?: string;
  referenceImages?: string[]; // data URLs for multimodal path
}): Promise<{ result: ActivitySpecParsed; latencyMs: number }> {
  const config = getMetaConfig();
  const client = createMetaOpenAiClient();
  const startTime = Date.now();
  const { system, user } = buildActivitySparkPrompt(params);

  const jsonSchemaObj = {
    type: "object",
    properties: {
      title: { type: "string" },
      instructions: { type: "string" },
      visualBrief: { type: "string" },
      refinedImagePrompt: { type: "string" },
      layoutSpec: {
        type: "object",
        properties: {
          orientation: { type: "string", enum: ["portrait", "landscape"] },
          lineGuides: { type: "string", enum: ["none", "double-line", "triple-line", "seyes", "dotted"] },
          zones: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, type: { type: "string" } },
              required: ["label", "type"],
              additionalProperties: false,
            },
          },
        },
        required: ["orientation", "lineGuides", "zones"],
        additionalProperties: false,
      },
      difficulty: { type: "string" },
      estimatedMinutes: { type: "integer" },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["title", "instructions", "visualBrief", "refinedImagePrompt", "layoutSpec", "difficulty", "estimatedMinutes", "warnings"],
    additionalProperties: false,
  };

  // Prefer Spark 1.3 for structured activity specs; 1.2 often returns NO_CONTENT with strict json_schema.
  const modelId = process.env.META_SPARK_MODEL || process.env.SPARK_MODEL_ID || "muse-spark-1.3-contributor";

  async function callOnce(useJsonSchema: boolean) {
    const hasImages = params.referenceImages && params.referenceImages.length > 0;
    const userContent = hasImages
      ? [
          { type: "text", text: user },
          ...params.referenceImages!.slice(0, 4).map((url) => ({ type: "image_url", image_url: { url, detail: "auto" } })),
        ]
      : user;

    const body: Record<string, unknown> = {
      model: modelId,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent as never },
      ],
      temperature: 0.35,
      // 4000 leaves headroom for reasoning tokens; 1800 was too tight and produced NO_CONTENT with finish_reason=length
      max_tokens: 4000,
    };
    if (useJsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: "activity_spec", strict: true, schema: jsonSchemaObj },
      };
    } else {
      body.response_format = { type: "json_object" };
    }
    return client.chat.completions.create(body as never, { timeout: 30000, maxRetries: 1 } as never);
  }

  try {
    let response: Awaited<ReturnType<typeof callOnce>>;
    let usedJsonSchema = true;
    try {
      response = await callOnce(true);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      // Some gateways reject strict json_schema; fall back to json_object and validate ourselves
      if (m.toLowerCase().includes("json_schema") || m.toLowerCase().includes("response_format")) {
        console.warn(`[activity-generator] json_schema not supported, retrying json_object: ${m}`);
        usedJsonSchema = false;
        response = await callOnce(false);
      } else {
        throw e;
      }
    }

    const latencyMs = Date.now() - startTime;
    const choice = (response as { choices?: Array<{ message?: unknown; finish_reason?: string }> })?.choices?.[0] as { message?: unknown; finish_reason?: string } | undefined;
    if (!choice || !choice.message) throw new MetaApiError("Empty response from Spark activity spec", "EMPTY_SPARK_RESPONSE", 500);

    if (choice.finish_reason === "content_filter") {
      throw new MetaApiError("Spark refused the activity prompt (content_filter). Try a simpler theme/wording without brand names.", "META_REFUSAL", 400);
    }

    const msg = choice.message as { content?: unknown; refusal?: unknown; reasoning_content?: unknown; tool_calls?: unknown };
    if (msg.refusal && String(msg.refusal).trim()) {
      throw new MetaApiError(`Spark refused: ${String(msg.refusal).slice(0, 800)}`, "META_REFUSAL", 400);
    }

    // OpenAI-compatible gateways vary: string, array of {text}, null with reasoning_content, or tool_calls
    const rawContentRaw = msg.content;
    let rawContent: string | null = null;
    if (typeof rawContentRaw === "string") rawContent = rawContentRaw;
    else if (Array.isArray(rawContentRaw)) {
      rawContent = (rawContentRaw as Array<unknown>).map((p) => typeof p === "string" ? p : p && typeof p === "object" && "text" in (p as Record<string, unknown>) ? String((p as Record<string, unknown>).text ?? "") : "").join("");
    } else if (rawContentRaw !== null && rawContentRaw !== undefined) {
      rawContent = String(rawContentRaw);
    }

    if (!rawContent || !rawContent.trim()) {
      const keys = msg && typeof msg === "object" ? Object.keys(msg) : [];
      console.error(
        `[activity-generator] NO_CONTENT model=${modelId} usedJsonSchema=${usedJsonSchema} finish_reason=${String(choice.finish_reason)} ` +
          `contentType=${rawContentRaw === null ? "null" : Array.isArray(rawContentRaw) ? "array" : typeof rawContentRaw} ` +
          `messageKeys=${keys.join(",")} hasToolCalls=${Boolean(msg.tool_calls)} hasReasoning=${Boolean(msg.reasoning_content)} ` +
          `hasImages=${Boolean(params.referenceImages?.length)} theme=${(params.theme || "").slice(0, 80)} ` +
          `fullResponse=${JSON.stringify(response).slice(0, 3000)}`
      );
      const hint =
        choice.finish_reason === "length"
          ? " (finish_reason=length: token budget exhausted with no text — try shorter theme/instructions or upgrade max_tokens)"
          : choice.finish_reason === "tool_calls"
            ? " (finish_reason=tool_calls: model returned tool_calls instead of text)"
            : "";
      // Retry with looser response_format if we haven't already
      if (usedJsonSchema) {
        console.warn(`[activity-generator] NO_CONTENT on json_schema, retrying json_object`);
        response = await callOnce(false);
        const c2 = (response as { choices?: Array<{ message?: unknown; finish_reason?: string }> })?.choices?.[0] as { message?: unknown; finish_reason?: string } | undefined;
        const m2 = c2?.message as { content?: unknown } | undefined;
        const rc2 = m2?.content as unknown;
        let s2: string | null = null;
        if (typeof rc2 === "string") s2 = rc2;
        else if (Array.isArray(rc2)) s2 = (rc2 as unknown[]).map((p) => typeof p === "string" ? p : (p as { text?: unknown })?.text ? String((p as { text?: unknown }).text) : "").join("");
        if (s2 && s2.trim()) {
          rawContent = s2;
        } else {
          throw new MetaApiError(
            `No content from Spark activity spec (model=${modelId}${hint}). Server log [activity-generator] NO_CONTENT has finish_reason/contentType. Try text-only (remove reference images) and shorter theme. Gateway response preview logged server-side.`,
            "NO_CONTENT",
            500
          );
        }
      } else {
        throw new MetaApiError(
          `No content from Spark activity spec (model=${modelId}${hint}). Server log [activity-generator] NO_CONTENT has finish_reason/contentType. Try text-only (remove reference images) and shorter theme.`,
          "NO_CONTENT",
          500
        );
      }
    }

    // Robust JSON extraction: handle fences, preamble, and truncation (finish_reason=length often cuts mid-string)
    function extractJsonObject(text: string): string {
      // 1. Strip common fences first
      let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      // 2. Narrow to outermost { ... } (discards preamble like "Here is..." or trailing notes)
      let first = s.indexOf("{");
      let last = s.lastIndexOf("}");
      // Also handle rare array wrapper [{...}]
      if (first !== -1 && last !== -1 && last > first) {
        s = s.slice(first, last + 1);
      }
      return s;
    }

    function tryRepairTruncatedJson(jsonStr: string): string {
      // Close an unterminated string, then balance braces/brackets, strip trailing commas.
      let s = jsonStr;
      // If we end inside a string (odd number of unescaped quotes on the tail), close it
      // Count quotes not preceded by \ – simple pass sufficient (no need to handle \\" perfectly)
      let inString = false;
      let escaped = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === '"') inString = !inString;
      }
      if (inString) {
        s += '"'; // close dangling string value
      }
      // Trim trailing comma/comma-whitespace that often precedes a cutoff
      s = s.replace(/,\s*$/, "");
      // Balance { } and [ ]
      const opens = { "{": "}", "[": "]" };
      const closes: Record<string, string> = { "}": "{", "]": "[" };
      const stack: string[] = [];
      inString = false;
      escaped = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (escaped) { escaped = false; continue; }
        if (ch === "\\" && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch in opens) stack.push(ch);
        else if (ch in closes) {
          if (stack[stack.length - 1] === closes[ch]) stack.pop();
          else stack.pop();
        }
      }
      while (stack.length) {
        const o = stack.pop()!;
        s += opens[o as keyof typeof opens];
      }
      return s;
    }

    let parsedJson: unknown;
    let stripped = extractJsonObject(rawContent!);
    try {
      parsedJson = JSON.parse(stripped);
    } catch (firstErr) {
      // Most common prod case: finish_reason=length truncates mid-string/mid-object
      const finishHint = choice.finish_reason === "length" ? " (response truncated — max_tokens exhausted mid-JSON)" : "";
      if (choice.finish_reason === "length") {
        const repairedRaw = tryRepairTruncatedJson(stripped);
        try {
          parsedJson = JSON.parse(repairedRaw);
          stripped = repairedRaw;
          console.warn(`[activity-generator] Repaired truncated JSON (length cutoff). Original preview: ${rawContent!.slice(0, 300)}...`);
        } catch {
          throw new MetaApiError(
            `Spark response was truncated mid-JSON${finishHint}. Preview: ${repairedRaw.slice(0, 600)}... Try a shorter theme or image prompt.`,
            "INVALID_JSON_OUTPUT",
            500
          );
        }
      } else {
        throw new MetaApiError(
          `Invalid JSON from Spark activity${finishHint} (preview: ${stripped.slice(0, 600)}...) firstParse: ${String(firstErr).slice(0, 200)}`,
          "INVALID_JSON_OUTPUT",
          500
        );
      }
    }

    const validated = ActivitySpecSchema.safeParse(parsedJson);
    if (!validated.success) {
      // Attempt to fill required fields from a partially-truncated but parseable payload instead of hard-failing
      const partial = parsedJson as Record<string, unknown>;
      const layoutSpec = (partial.layoutSpec && typeof partial.layoutSpec === "object" ? partial.layoutSpec : {}) as Record<string, unknown>;
      const patched: Record<string, unknown> = {
        title: partial.title ?? params.titleOverride ?? `Activity — ${params.ageBand}`,
        instructions: partial.instructions ?? "Complete the activity at your own pace.",
        visualBrief: partial.visualBrief ?? params.imagePrompt ?? `Therapy worksheet for ${params.ageBand}: ${(partial.instructions as string | undefined)?.slice(0, 200) ?? partial.title ?? "fine motor activity"} — black and white line art, bold outlines, A4 portrait, white background.`,
        refinedImagePrompt: partial.refinedImagePrompt ?? partial.visualBrief ?? (partial.title as string | undefined) ?? `Black and white line art therapy worksheet, thick clean outlines, A4 portrait, white background, no shading`,
        layoutSpec: {
          orientation: (layoutSpec.orientation as string) || "portrait",
          lineGuides: (layoutSpec.lineGuides as string) || "none",
          zones: Array.isArray(layoutSpec.zones) ? layoutSpec.zones : [],
        },
        difficulty: partial.difficulty ?? params.difficulty ?? "guided",
        estimatedMinutes: typeof partial.estimatedMinutes === "number" ? partial.estimatedMinutes : 10,
        warnings: Array.isArray(partial.warnings) ? partial.warnings : [`Recovered from truncated response (finish_reason=${String(choice.finish_reason)}). Fields defaulted.`],
      };
      const revalidated = ActivitySpecSchema.safeParse(patched);
      if (!revalidated.success) {
        throw new MetaApiError(`Activity spec validation failed: ${revalidated.error.issues.map(i=>i.message).join(", ")}`, "SCHEMA_VALIDATION_FAILED", 500);
      }
      console.warn(`[activity-generator] Recovered from validation failure via patched defaults. Original issues: ${validated.error.issues.map(i=>i.path.join(".")+":"+i.message).join("; ")} (preview: ${stripped.slice(0,400)}...)`);
      return { result: revalidated.data, latencyMs };
    }

    return { result: validated.data, latencyMs };
  } catch (err: unknown) {
    if (err instanceof MetaApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("timed out")) throw new MetaTimeoutError();
    if (msg.includes("429") || msg.includes("rate")) throw new MetaRateLimitError();
    throw new MetaApiError(`Spark activity spec failed: ${msg}`, "SPARK_CALL_FAILED", 500, true);
  }
}

// Stage 2: Muse Image (or OpenAI-compatible image model) — line art generation
export async function runMuseImage(prompt: string, opts?: { size?: string; model?: string }): Promise<{ imageUrl: string; revisedPrompt?: string; latencyMs: number; modelId: string }> {
  const config = getMetaConfig();
  const startTime = Date.now();
  const modelId = opts?.model || process.env.MUSE_IMAGE_MODEL_ID || process.env.IMAGE_MODEL_ID || DEFAULT_ACTIVITY_IMAGE_MODEL;

  // Try OpenAI-compatible images.generate (works for OpenAI, Azure, and many Meta gateways exposing images API)
  try {
    const client = createMetaOpenAiClient();
    const result = await client.images.generate({
      model: modelId,
      prompt,
      n: 1,
      size: (opts?.size as never) || ("1024x1024" as never),
      // response_format not needed, default url/b64_json
    } as never);

    const latencyMs = Date.now() - startTime;
    const data: unknown = result as unknown;
    // OpenAI SDK shapes vary
    const first: Record<string, unknown> | undefined = (result as { data?: Record<string, unknown>[] })?.data?.[0] as Record<string, unknown> | undefined;
    const url = ((first as Record<string, unknown>)?.url as string) || ((first as Record<string, unknown>)?.b64_json as string ? `data:image/png;base64,${(first as Record<string, unknown>).b64_json as string}` : "");
    if (!url) throw new MetaApiError("Image generation returned no URL/b64 data", "IMAGE_NO_DATA", 500);
    const revisedPrompt = (result as { data?: Array<{ revised_prompt?: string }> })?.data?.[0]?.revised_prompt;
    return { imageUrl: url, revisedPrompt, latencyMs, modelId };
  } catch (err: unknown) {
    // If images API not supported, throw structured error so caller can fallback to placeholder
    if (err instanceof MetaApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new MetaApiError(`Muse Image generation failed: ${msg}`, "IMAGE_CALL_FAILED", 500, true);
  }
}

// Mock fallback: deterministic SVG placeholder for AI_MODE=mock or no key
export function buildMockActivitySvg(title: string, ageBand: string, category: string): { dataUrl: string; prompt: string } {
  const mockPrompt = `mock placeholder for ${ageBand}/${category}: ${title}`;
  // Simple A4-ish SVG with title + grid placeholder
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1448" viewBox="0 0 1024 1448">
  <rect width="1024" height="1448" fill="white"/>
  <rect x="20" y="20" width="984" height="1408" fill="none" stroke="#a1a1aa" stroke-width="3" stroke-dasharray="12 8" rx="16"/>
  <text x="512" y="120" text-anchor="middle" font-family="Inter, sans-serif" font-size="28" font-weight="700" fill="#09090b">${esc(title)}</text>
  <text x="512" y="160" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" fill="#71717a">${esc(ageBand)} • ${esc(category)}</text>
  <g transform="translate(80,220)">
    <rect x="0" y="0" width="864" height="480" rx="12" fill="none" stroke="#14b8a6" stroke-width="2" stroke-dasharray="8 6"/>
    <text x="432" y="240" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="16" fill="#14b8a6">Activity line art renders here</text>
  </g>
  <g transform="translate(80,780)">
    <text x="0" y="0" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="#52525b">INSTRUCTIONS:</text>
    <foreignObject x="0" y="16" width="864" height="120"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,sans-serif;font-size:12px;color:#3f3f46;line-height:1.6">This is a mock generated activity. In live mode, Muse Spark crafts instructions and Muse Image renders a print-ready line-art worksheet.</div></foreignObject>
  </g>
  <g transform="translate(80,960)">
    <rect x="0" y="0" width="864" height="320" rx="10" fill="none" stroke="#e4e4e7" stroke-width="1.5"/>
    <text x="12" y="24" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="#71717a">HANDWRITING GUIDES (when applicable)</text>
    <line x1="12" y1="60" x2="852" y2="60" stroke="#0ea5e9" stroke-width="2"/>
    <line x1="12" y1="120" x2="852" y2="120" stroke="#0ea5e9" stroke-width="2"/>
    <line x1="12" y1="180" x2="852" y2="180" stroke="#0ea5e9" stroke-width="2"/>
    <text x="12" y="210" font-family="JetBrains Mono, monospace" font-size="10" fill="#a1a1aa">Aa  Bb  Cc  Dd  Ee  Ff  Gg ...</text>
  </g>
</svg>`;
  const b64 = Buffer.from(svg).toString("base64");
  return { dataUrl: `data:image/svg+xml;base64,${b64}`, prompt: mockPrompt };
}
