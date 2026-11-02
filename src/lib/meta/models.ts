/**
 * Shared Meta model registry (browser-safe).
 * IDs verified against https://dev.meta.ai/docs/models + pricing pages.
 */

export const OT_CHAT_MODELS = [
  "muse-spark-1.2-contributor",
  "muse-spark-1.3-contributor",
  "muse-wonder-1.0",
] as const;

export type OtChatModelId = (typeof OT_CHAT_MODELS)[number];

export const DEFAULT_OT_CHAT_MODEL: OtChatModelId = "muse-spark-1.2-contributor";

// Activity generation — Meta-only: Muse Image via api.meta.ai (no third-party fallbacks)
export const ACTIVITY_IMAGE_MODELS = [
  "muse-image-1.0",
  "muse-image-1.1",
] as const;

export const DEFAULT_ACTIVITY_IMAGE_MODEL = "muse-image-1.0";

export const OT_CHAT_MODEL_LABELS: Record<OtChatModelId, string> = {
  "muse-spark-1.2-contributor": "Spark 1.2 Contributor",
  "muse-spark-1.3-contributor": "Spark 1.3 Contributor",
  "muse-wonder-1.0": "Wonder 1.0",
};

export function isOtChatModel(value: unknown): value is OtChatModelId {
  return (
    typeof value === "string" &&
    (OT_CHAT_MODELS as readonly string[]).includes(value)
  );
}
