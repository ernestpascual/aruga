import "server-only";
import OpenAI from "openai";
import { MetaApiError } from "./errors";
import { DEFAULT_OT_CHAT_MODEL } from "./models";

const APPROVED_META_HOSTS = [
  "api.meta.ai",
  "api.dev.meta.ai",
  "localhost",
  "127.0.0.1",
];

export function getMetaConfig() {
  const apiKey =
    process.env.MODEL_API_KEY ||
    process.env.META_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  const baseUrl =
    process.env.META_API_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.meta.ai/v1";
  const aiMode = (process.env.AI_MODE || "live").toLowerCase() as "off" | "live" | "mock";

  // Validate base URL if live mode
  if (aiMode === "live") {
    try {
      const parsedUrl = new URL(baseUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new MetaApiError(
          `Invalid protocol for META_API_BASE_URL (${parsedUrl.protocol}). Expected http: or https:.`,
          "INVALID_URL",
          500
        );
      }
      const isApproved =
        process.env.META_API_BASE_URL || process.env.OPENAI_BASE_URL
          ? true // explicitly user-configured custom endpoint
          : APPROVED_META_HOSTS.some(
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
  if (!config.apiKey) {
    throw new MetaApiError(
      "MODEL_API_KEY is missing from environment. Real Meta API calls require an authenticated API key.",
      "MISSING_API_KEY",
      401
    );
  }

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    maxRetries: 2,
    timeout: 30000,
  });
}

