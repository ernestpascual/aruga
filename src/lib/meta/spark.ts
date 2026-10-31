import "server-only";
import OpenAI from "openai";
import { createMetaOpenAiClient, getMetaConfig } from "./client";
import {
  MetaApiError,
  MetaTimeoutError,
  MetaRateLimitError,
  MetaRefusalError,
} from "./errors";
import {
  DraftProgramSchema,
  AnalyzeVideoSchema,
  DraftFeedbackSchema,
  DraftProgramParsed,
  AnalyzeVideoParsed,
  DraftFeedbackParsed,
} from "./schemas";
import {
  buildDraftProgramPrompt,
  buildAnalyzeVideoPrompt,
  buildDraftFeedbackPrompt,
  buildOtChatSystemPrompt,
} from "./prompts";
import { DEFAULT_OT_CHAT_MODEL, isOtChatModel } from "./models";

/**
 * Execute a structured Muse Spark 1.3 prompt and validate with Zod
 */
async function callSparkStructured<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: import("zod").ZodSchema<T>;
  schemaName: string;
  jsonSchemaObj: Record<string, unknown>;
  mediaUrl?: string;
}): Promise<{ parsed: T; latencyMs: number }> {
  const config = getMetaConfig();
  const client = createMetaOpenAiClient();
  const startTime = Date.now();

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: params.systemPrompt },
    ];

    if (params.mediaUrl) {
      // Include media reference for video observation
      messages.push({
        role: "user",
        content: [
          { type: "text", text: params.userPrompt },
          // Meta Responses API media format
          {
            type: "image_url",
            image_url: { url: params.mediaUrl },
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: params.userPrompt,
      });
    }

    const response = await client.chat.completions.create({
      model: config.models.spark,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: params.schemaName,
          strict: true,
          schema: params.jsonSchemaObj,
        },
      },
      temperature: 0.2,
      max_tokens: 1500,
    });

    const latencyMs = Date.now() - startTime;
    const choice = response.choices[0];

    if (!choice || !choice.message) {
      throw new MetaApiError("Empty response returned from Muse Spark 1.3", "EMPTY_SPARK_RESPONSE", 500);
    }

    if (choice.finish_reason === "content_filter") {
      throw new MetaRefusalError("Muse Spark 1.3 refused the request due to content safety filter.");
    }

    const rawContent = choice.message.content;
    if (!rawContent) {
      throw new MetaApiError("No content returned in message from Muse Spark 1.3", "NO_CONTENT", 500);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch {
      throw new MetaApiError("Failed to parse JSON output from Muse Spark 1.3", "INVALID_JSON_OUTPUT", 500);
    }

    const validated = params.schema.safeParse(parsedJson);
    if (!validated.success) {
      throw new MetaApiError(
        `Muse Spark output failed schema validation: ${validated.error.issues.map((i) => i.message).join(", ")}`,
        "SCHEMA_VALIDATION_FAILED",
        500
      );
    }

    return { parsed: validated.data, latencyMs };
  } catch (err: unknown) {
    if (err instanceof MetaApiError) throw err;

    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
      throw new MetaTimeoutError();
    }
    if (errorMsg.includes("rate") || errorMsg.includes("429")) {
      throw new MetaRateLimitError();
    }
    throw new MetaApiError(`Muse Spark execution failed: ${errorMsg}`, "SPARK_CALL_FAILED", 500, true);
  }
}

// 1. Program Drafting with Muse Spark
export async function runSparkDraftProgram(params: {
  rawInstructions: string;
  discipline?: "SLP" | "OT" | "PT";
  currentTitle?: string;
}): Promise<{ result: DraftProgramParsed; latencyMs: number }> {
  const { system, user } = buildDraftProgramPrompt(params);

  const jsonSchemaObj = {
    type: "object",
    properties: {
      title: { type: "string" },
      mainInstructions: { type: "string" },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            position: { type: "integer" },
            title: { type: "string" },
            instructions: { type: "string" },
          },
          required: ["position", "title", "instructions"],
          additionalProperties: false,
        },
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["title", "mainInstructions", "steps", "warnings"],
    additionalProperties: false,
  };

  const { parsed, latencyMs } = await callSparkStructured<DraftProgramParsed>({
    systemPrompt: system,
    userPrompt: user,
    schema: DraftProgramSchema,
    schemaName: "draft_home_program",
    jsonSchemaObj,
  });

  return { result: parsed, latencyMs };
}

// 2. Video Observation with Muse Spark
export async function runSparkAnalyzeVideo(params: {
  videoUrl: string;
  stepInstructions: string;
  stepTitle?: string;
  durationSeconds?: number;
}): Promise<{ result: AnalyzeVideoParsed; latencyMs: number }> {
  const { system, user } = buildAnalyzeVideoPrompt(params);

  const jsonSchemaObj = {
    type: "object",
    properties: {
      observations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            description: { type: "string" },
            approxTimestampSeconds: { type: ["number", "null"] },
            confidenceNote: { type: "string" },
          },
          required: ["id", "description", "approxTimestampSeconds"],
          additionalProperties: false,
        },
      },
      limitations: {
        type: "array",
        items: { type: "string" },
      },
      suggestedObjectConcept: { type: ["string", "null"] },
    },
    required: ["observations", "limitations", "suggestedObjectConcept"],
    additionalProperties: false,
  };

  const { parsed, latencyMs } = await callSparkStructured<AnalyzeVideoParsed>({
    systemPrompt: system,
    userPrompt: user,
    schema: AnalyzeVideoSchema,
    schemaName: "analyze_step_video",
    jsonSchemaObj,
    mediaUrl: params.videoUrl,
  });

  return { result: parsed, latencyMs };
}

// 3. Feedback Drafting with Muse Spark
export async function runSparkDraftFeedback(params: {
  stepInstructions: string;
  therapistNotes: string;
  confirmedObservations: string[];
  clientComment?: string;
  skipped?: boolean;
  skipReason?: string;
}): Promise<{ result: DraftFeedbackParsed; latencyMs: number }> {
  const { system, user } = buildDraftFeedbackPrompt(params);

  const jsonSchemaObj = {
    type: "object",
    properties: {
      draftStepNote: { type: "string" },
      overallFeedbackSuggestion: { type: "string" },
    },
    required: ["draftStepNote", "overallFeedbackSuggestion"],
    additionalProperties: false,
  };

  const { parsed, latencyMs } = await callSparkStructured<DraftFeedbackParsed>({
    systemPrompt: system,
    userPrompt: user,
    schema: DraftFeedbackSchema,
    schemaName: "draft_therapist_feedback",
    jsonSchemaObj,
  });

  return { result: parsed, latencyMs };
}

// 4. Rehab Guide Chat (butler) with Muse Spark (multimodal, prompt-cached per conversation)
export async function runSparkOtChat(params: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userText: string;
  images?: string[];
  videoUrls?: string[];
  conversationId?: string;
  evidenceContext?: string;
  clientContext?: string;
  model?: string;
}): Promise<{ text: string; latencyMs: number; modelId: string }> {
  const config = getMetaConfig();
  const client = createMetaOpenAiClient();
  const startTime = Date.now();
  const modelId =
    params.model && isOtChatModel(params.model)
      ? params.model
      : config.models.spark || DEFAULT_OT_CHAT_MODEL;

  // Keep the system prompt byte-identical across turns in the same chat so the
  // prefix cache can hit. Do NOT interpolate conversation-specific data here.
  const systemPrompt = buildOtChatSystemPrompt();

  try {
    // Keep history short: long histories + images + evidence eat the context
    // and leave nothing for output (finish_reason=length with no text).
    const trimmedHistory = (params.history || []).slice(-8);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt,
      },
    ];

    for (const turn of trimmedHistory) {
      if (turn.role !== "user" && turn.role !== "assistant") continue;
      const content = (turn.content || "").slice(0, 2000);
      if (!content.trim()) continue;
      messages.push({ role: turn.role, content });
    }

    // Personalized context (profile + current home program) — injected right after history so it grounds explanations of why exercises matter.
    if (params.clientContext?.trim()) {
      messages.push({
        role: "user",
        content: params.clientContext.slice(0, 2200),
      });
    }

    // Search-grounded evidence goes in its own message AFTER history so the
    // byte-identical system prefix stays cacheable across turns in the same chat.
    if (params.evidenceContext?.trim()) {
      messages.push({
        role: "user",
        content: params.evidenceContext.slice(0, 2500),
      });
    }

    const imageUrls = (params.images || []).filter(Boolean).slice(0, 4);
    // Legacy raw-video bytes are never forwarded: base64 video in chat
    // completions is rejected by strict validators and blows up payload size.
    // New clients send extracted JPEG frames as images instead; old clients
    // get a text marker so the model still knows a clip was attached.
    const videoUrls = (params.videoUrls || []).filter(Boolean).slice(0, 2);

    let finalText = params.userText?.trim() || "";
    if (!finalText && imageUrls.length === 0 && videoUrls.length === 0) {
      throw new MetaApiError("Message text or media is required.", "EMPTY_CHAT_REQUEST", 400);
    }
    if (videoUrls.length > 0) {
      finalText += `\n\n[Note: the user attached ${videoUrls.length} video clip(s), but only a text reference could be forwarded. Describe what to look for generally and ask for still frames if needed.]`;
    }
    if (!finalText) finalText = "Please describe what you tentatively observe in the attached media.";

    if (imageUrls.length === 0) {
      messages.push({ role: "user", content: finalText });
    } else {
      const contentParts: Array<Record<string, unknown>> = [
        { type: "text", text: finalText },
      ];
      for (const url of imageUrls) {
        contentParts.push({
          type: "image_url",
          image_url: { url, detail: "auto" },
        });
      }
      messages.push({
        role: "user",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: contentParts as any,
      });
    }

    const response = await client.chat.completions.create(
      {
        model: modelId,
        messages,
        temperature: 0.4,
        // Single budget key only: sending both max_tokens and
        // max_completion_tokens confuses some gateways. 4000 leaves room
        // for hidden reasoning tokens before the visible answer.
        max_tokens: 4000,
      } as never,
      { timeout: 25000, maxRetries: 1 } as never
    );

    const latencyMs = Date.now() - startTime;
    const choice = response.choices?.[0];

    if (!choice || !choice.message) {
      throw new MetaApiError(`Empty response returned from ${modelId}`, "EMPTY_SPARK_RESPONSE", 500);
    }
    if (choice.finish_reason === "content_filter") {
      throw new MetaRefusalError(`${modelId} refused the request due to content safety filter.`);
    }

    const msg = choice.message as unknown as {
      content?: unknown;
      refusal?: unknown;
      reasoning_content?: unknown;
      tool_calls?: unknown;
    };
    if (msg.refusal && String(msg.refusal).trim()) {
      throw new MetaRefusalError(`${modelId} refused: ${String(msg.refusal).slice(0, 500)}`);
    }

    const rawContent = msg.content;
    const text =
      typeof rawContent === "string"
        ? rawContent
        : Array.isArray(rawContent)
          ? (rawContent as Array<unknown>)
              .map((p) =>
                typeof p === "string"
                  ? p
                  : p && typeof p === "object" && "text" in p
                    ? String((p as { text: unknown }).text ?? "")
                    : ""
              )
              .join("")
          : "";

    if (!text.trim()) {
      // Diagnostic log: empty content with a 200 choice almost always means
      // the payload shape (e.g. multimodal parts) wasn't honored, the token
      // budget was consumed by reasoning, or the gateway returned tool calls.
      try {
        const keys = msg && typeof msg === "object" ? Object.keys(msg) : [];
        console.error(
          `[ot-chat] NO_CONTENT model=${modelId} finish_reason=${String(choice.finish_reason)} ` +
            `contentType=${rawContent === null ? "null" : Array.isArray(rawContent) ? "array" : typeof rawContent} ` +
            `messageKeys=${keys.join(",")} ` +
            `hasToolCalls=${Boolean(msg.tool_calls)} ` +
            `hasReasoning=${Boolean(msg.reasoning_content)} ` +
            `images=${(params.images || []).length}`
        );
      } catch {
        /* ignore logging errors */
      }
      const hint =
        choice.finish_reason === "length"
          ? " (finish_reason=length: response hit the token limit with no text — retry with shorter history/fewer images)"
          : choice.finish_reason === "tool_calls"
            ? " (finish_reason=tool_calls: model returned tool calls instead of text)"
            : "";
      throw new MetaApiError(
        `No content returned in message from ${modelId}${hint}. Check server log [ot-chat] NO_CONTENT for finish_reason/contentType. If images were attached, retry text-only to isolate a multimodal payload issue.`,
        "NO_CONTENT",
        500
      );
    }

    return { text: text.trim(), latencyMs, modelId };
  } catch (err: unknown) {
    if (err instanceof MetaApiError) throw err;
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
      throw new MetaTimeoutError();
    }
    if (errorMsg.includes("rate") || errorMsg.includes("429")) {
      throw new MetaRateLimitError();
    }
    throw new MetaApiError(`Muse Spark chat failed: ${errorMsg}`, "SPARK_CALL_FAILED", 500, true);
  }
}
