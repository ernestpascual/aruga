/**
 * Site & Application Configuration
 * Aruga - Clinician-Directed Home-Program Companion
 *
 * Keep the app name and branding configurable in one place.
 */

export const siteConfig = {
  name: "Aruga",
  tagline: "Clinician-Directed Home-Program Companion for Pediatric & Adult Rehabilitation",
  description:
    "Empowering speech-language pathologists, occupational therapists, and physical therapists across pediatric and adult care with intelligent home programs, tabletop/developmental video submissions, and clinician-verified review assistance.",
  version: "1.1.0",
  disciplines: [
    { id: "SLP", name: "Speech-Language Pathology", label: "SLP" },
    { id: "OT", name: "Occupational Therapy", label: "OT" },
    { id: "PT", name: "Physical Therapy", label: "PT" },
  ],
  videoLimits: {
    maxDurationSeconds: 30,
    maxSizeBytes: 25 * 1024 * 1024, // 25 MB
    preferredResolution: "720p",
    supportedFormats: ["video/mp4", "video/webm"],
  },
  ai: {
    provider: "Meta AI",
    models: {
      spark: "muse-spark-1.2-contributor",
      sam: "sam-3.1",
    },
    apiBaseUrl: process.env.META_API_BASE_URL || "https://api.meta.ai/v1",
    mode: (process.env.AI_MODE || "mock") as "off" | "live" | "mock",
  },
  disclaimer:
    "AI assists with organization and draft observations. Your therapist reviews and provides feedback.",
  messagingNotice:
    "Messaging is not monitored continuously and is not an emergency service. In an emergency, please call your local emergency number (e.g. 911).",
  prototypeNotice:
    "Demonstration prototype for pediatric and adult clinical workflows. This environment uses synthetic records and consenting pediatric & adult demonstrators across lifespan rehabilitation.",
} as const;

export type SiteConfig = typeof siteConfig;
