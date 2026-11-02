import "server-only";

export interface ClinicalReference {
  id: string;
  title: string;
  authors: string;
  year: string;
  source: string;
  url: string;
}

export interface ClinicalEvidence {
  query: string;
  references: ClinicalReference[];
  contextBlock: string;
}

const CLINICAL_KEYWORDS = [
  "therapy", "therapist", "occupational", "rehab", "rehabilitation",
  "physical", "speech", "pt ", "ot ", "slp", "st ", "swallow", "swallowing", "dysphagia", "aphasia", "articulation",
  "exercise", "grasp", "grasping", "fine motor", "motor", "sensory",
  "posture", "positioning", "adaptive", "splint", "orthosis",
  "stroke", "hemiparesis", "parkinson", "dementia", "autism", "adhd",
  "pediatric", "child", "toddler", "hand", "wrist", "shoulder", "elbow",
  "finger", "thumb", "pincer", "bilateral", "coordination", "balance",
  "gait", "mobility", "adls", "dressing", "feeding", "eating", "bathing",
  "toileting", "transfers", "pain", "fatigue", "spasticity", "contracture",
  "arthritis", "carpal", "tendon", "fracture", "injury", "surgery",
  "orthopedic", "neurological", "cognitive", "memory", "attention",
  "play", "toy", "peg", "block", "cup", "utensil", "workstation",
  "ergonomic", "wheelchair", "walker", "daily living", "home program",
  "dose", "repetition", "strengthening", "stretching", "mobility", "tremor", "balance",
  "why", "condition", "diagnosis", "program", "step",
];

const SMALLTALK_PATTERN = /^(hi|hello|hey|thanks|thank you|bye|good (morning|afternoon|evening)|how are you|who are you|what can you do)[!?.\s]*$/i;

export function isClinicallyRelated(text: string, hasMedia = false): boolean {
  const t = (text || "").trim();
  if (hasMedia) return true; // attached image/video of a task is clinical context
  if (t.length < 2) return false;
  if (SMALLTALK_PATTERN.test(t) && t.length < 30) return false;
  const lower = t.toLowerCase();
  if (lower.length > 40) return true; // substantive question defaults to clinical grounding
  return CLINICAL_KEYWORDS.some((k) => lower.includes(k.toLowerCase().trim()));
}

function buildSearchQuery(userText: string): string {
  const cleaned = userText.replace(/\s+/g, " ").trim().slice(0, 200);
  return `${cleaned} rehabilitation physical occupational speech therapy evidence`;
}

async function fetchWithTimeout(url: string, ms = 3500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function withDeadline<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Search grounding via PubMed E-utilities (no key required) + OpenAlex fallback.
 * Time-boxed so grounding never blocks the primary Muse call (total budget ~5s).
 * Never throws — returns empty evidence on failure so chat still works.
 */
export async function searchClinicalEvidence(
  userText: string,
  opts?: { deadlineMs?: number }
): Promise<ClinicalEvidence> {
  const deadlineMs = opts?.deadlineMs ?? 5000;
  const deadlineAt = Date.now() + deadlineMs;
  const remainingMs = () => Math.max(400, deadlineAt - Date.now());

  async function doSearch(): Promise<ClinicalEvidence> {
  const query = buildSearchQuery(userText);
  const references: ClinicalReference[] = [];

  try {
    // 1) PubMed esearch
    const esearchUrl =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed` +
      `&term=${encodeURIComponent(query)}&retmode=json&retmax=5&sort=relevance`;
    if (remainingMs() <= 450) throw new Error("grounding deadline");
    const esearchRes = await fetchWithTimeout(esearchUrl, Math.min(3500, remainingMs()));
    if (esearchRes.ok) {
      const esearchJson = (await esearchRes.json()) as {
        esearchresult?: { idlist?: string[] };
      };
      const ids = esearchJson.esearchresult?.idlist ?? [];

      if (ids.length > 0) {
        // 2) PubMed esummary for titles / authors / journal / year
        const esummaryUrl =
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed` +
          `&id=${ids.join(",")}&retmode=json`;
        if (remainingMs() <= 450) throw new Error("grounding deadline");
        const esummaryRes = await fetchWithTimeout(esummaryUrl, Math.min(3500, remainingMs()));
        if (esummaryRes.ok) {
          const esummaryJson = (await esummaryRes.json()) as {
            result?: Record<string, Record<string, unknown>>;
          };
          const result = esummaryJson.result ?? {};
          for (const id of ids) {
            const rec = result[id] as
              | { title?: string; authors?: Array<{ name?: string }>; pubdate?: string; source?: string }
              | undefined;
            if (!rec || !rec.title) continue;
            const authors = (rec.authors ?? [])
              .slice(0, 3)
              .map((a) => a.name)
              .filter(Boolean)
              .join(", ");
            const year = (rec.pubdate ?? "").slice(0, 4) || "n.d.";
            references.push({
              id: `PMID:${id}`,
              title: rec.title,
              authors: authors || "PubMed authors",
              year,
              source: (rec.source as string) || "PubMed",
              url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            });
          }
        }
      }
    }
  } catch {
    // fall through to fallback
  }

  // Fallback: OpenAlex works search (also keyless) if PubMed returned nothing
  if (references.length === 0) {
    try {
      const openAlexUrl =
        `https://api.openalex.org/works?search=${encodeURIComponent(query)}` +
        `&filter=from_publication_date:2015-01-01&per-page=4&select=id,title,publication_year,authorships,primary_location,doi`;
      if (remainingMs() <= 450) throw new Error("grounding deadline");
      const oaRes = await fetchWithTimeout(openAlexUrl, Math.min(3500, remainingMs()));
      if (oaRes.ok) {
        const oaJson = (await oaRes.json()) as {
          results?: Array<{
            id?: string;
            title?: string;
            publication_year?: number;
            doi?: string;
            authorships?: Array<{ author?: { display_name?: string } }>;
            primary_location?: { source?: { display_name?: string } };
          }>;
        };
        for (const w of oaJson.results ?? []) {
          if (!w.title) continue;
          const authors = (w.authorships ?? [])
            .slice(0, 3)
            .map((a) => a.author?.display_name)
            .filter(Boolean)
            .join(", ");
          const url =
            w.doi ?? w.id?.replace("https://openalex.org/", "https://doi.org/") ?? "https://openalex.org";
          references.push({
            id: w.id ?? w.doi ?? w.title.slice(0, 24),
            title: w.title,
            authors: authors || "OpenAlex authors",
            year: String(w.publication_year ?? "n.d."),
            source: w.primary_location?.source?.display_name ?? "OpenAlex",
            url,
          });
        }
      }
    } catch {
      // ignore — chat proceeds ungrounded but flagged
    }
  }

  const contextBlock =
    references.length > 0
      ? [
          "SEARCH-GROUNDED CLINICAL EVIDENCE (cite these; do not invent other citations):",
          ...references.map(
            (r, i) =>
              `[${i + 1}] ${r.authors} (${r.year}). ${r.title} ${r.source}. ${r.url}`
          ),
          "Use at least 1-2 of the sources above when the answer is clinically related.",
          "If the sources do not fully answer the question, say so explicitly.",
        ].join("\n")
      : "SEARCH-GROUNDED CLINICAL EVIDENCE: live search returned no usable sources for this turn. Give general educational information only, state that specific references could not be retrieved, and advise confirming with a licensed OT.";

  return { query, references, contextBlock };
  }

  // Enforce overall deadline: if grounding exceeds budget, return empty evidence so chat still proceeds
  const empty: ClinicalEvidence = {
    query: buildSearchQuery(userText),
    references: [],
    contextBlock:
      "SEARCH-GROUNDED CLINICAL EVIDENCE: live search timed out for this turn. Give general educational information only, state that specific references could not be retrieved in time, and advise confirming with a licensed OT.",
  };
  return withDeadline(doSearch(), deadlineMs, empty);
}

export function formatReferencesSection(references: ClinicalReference[]): string {
  if (references.length === 0) return "";
  const lines = references.map(
    (r, i) => `${i + 1}. ${r.authors} (${r.year}). ${r.title}. ${r.source}. ${r.url}`
  );
  return `\n\nReferences\n${lines.join("\n")}`;
}
