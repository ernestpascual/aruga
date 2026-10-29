import "server-only";
import OpenAI from "openai";
import { MetaApiError } from "./errors";
import { DEFAULT_OT_CHAT_MODEL } from "./models";

const APPROVED_META_HOSTS = [
  "api.meta.ai",
  "api.dev.meta.ai",
];

export function getMetaConfig() {
  const apiKey = process.env.MODEL_API_KEY || "";
  const baseUrl = process.env.META_API_BASE_URL || "https://api.meta.ai/v1";
  const aiMode = (process.env.AI_MODE || "mock").toLowerCase() as "off" | "live" | "mock";

  // Validate base URL if live mode
  if (aiMode === "live") {
    try {
      const parsedUrl = new URL(baseUrl);
      const isApproved = APPROVED_META_HOSTS.some(
        (host) => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`)
      );
      if (!isApproved) {
        throw new MetaApiError(
          `Configured META_API_BASE_URL (${parsedUrl.hostname}) is not an approved Meta API host. Expected api.meta.ai.`,
          "INVALID_META_HOST",
          500
        );
      }
    } catch (err: unknown) {
      if (err instanceof MetaApiError) throw err;
      throw new MetaApiError(`Invalid META_API_BASE_URL: ${baseUrl}`, "INVALID_URL", 500);
    }
  }

  return {
    apiKey,
    baseUrl,
    aiMode,
    models: {
      spark: DEFAULT_OT_CHAT_MODEL,
      sam: "sam-3.1",
    },
  };
}

export function createMetaOpenAiClient(): OpenAI {
  const config = getMetaConfig();
  if (config.aiMode === "live" && !config.apiKey) {
    throw new MetaApiError(
      "MODEL_API_KEY is missing from environment. Real Meta API calls require an authenticated API key.",
      "MISSING_API_KEY",
      401
    );
  }

  return new OpenAI({
    apiKey: config.apiKey || "mock-key",
    baseURL: config.baseUrl,
    maxRetries: 2,
    timeout: 30000,
  });
}
