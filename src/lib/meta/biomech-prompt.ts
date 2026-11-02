/**
 * BIOMECH_KEYWORDS — sole source for Biomech Agent (16 locked)
 * All workflows must pick subset of this array only. See plan/BIOMECH_ENGINE_PLAN.md §2.1
 */
export const BIOMECH_KEYWORDS = [
  "person",
  "shoulder",
  "elbow",
  "forearm",
  "wrist",
  "hand",
  "finger",
  "thumb",
  "hip",
  "knee joint",
  "ankle joint",
  "foot",
  "trunk",
  "cervical spine",
  "thoracic spine",
  "neck",
] as const;

export type BiomechKeyword = (typeof BIOMECH_KEYWORDS)[number];

export function isBiomechKeyword(v: string): v is BiomechKeyword {
  return (BIOMECH_KEYWORDS as readonly string[]).includes(v);
}

export function assertSamTextConcept(concept: string) {
  if (!concept || typeof concept !== "string") throw new Error(`Invalid SAM concept: ${concept}`);
  if (concept.split(/\s+/).length > 8) throw new Error(`SAM concept too long (>8 words): ${concept}`);
  if (!isBiomechKeyword(concept)) {
    throw new Error(`Concept "${concept}" not in BIOMECH_KEYWORDS 16 — must pick from locked list`);
  }
}

export const BIOMECH_INTENT_PRESETS: Record<string, BiomechKeyword[]> = {
  U1: ["person", "shoulder", "elbow", "forearm", "wrist"],
  U2: ["person", "hand", "finger", "thumb"],
  U3: ["person", "hip", "knee joint", "ankle joint", "foot"],
  U4: ["person", "trunk", "hip", "knee joint", "neck"],
  U5: ["person", "trunk", "cervical spine", "thoracic spine"],
  U6: ["person", "hip", "knee joint", "trunk"],
  U7: ["person", "hand", "shoulder"],
  U8: ["person", "shoulder", "elbow", "wrist"],
  U9: ["person", "shoulder", "hip"], // aggregated — longitudinal
  U10: ["person", "shoulder", "elbow", "neck"],
  U11: ["person", "neck", "cervical spine", "thoracic spine", "trunk"],
};

export function intentToConcepts(intent: string): BiomechKeyword[] {
  const key = intent.toUpperCase().match(/U\d{1,2}/)?.[0] || "U1";
  return BIOMECH_INTENT_PRESETS[key] || BIOMECH_INTENT_PRESETS.U1;
}
