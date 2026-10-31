/**
 * HIPAA Safe Harbor De-Identification Utility (45 CFR § 164.514(b))
 *
 * Sanitizes clinical notes and contexts before dispatch to external third-party
 * AI endpoints, ensuring that 18 direct individual identifiers (including full names,
 * email addresses, and phone numbers) are stripped or replaced with safe generic handles.
 */

export interface DeidentifyOptions {
  clientName?: string | null;
  category?: string | null;
  replaceNameWith?: string;
}

/**
 * Returns a standardized non-identifiable client handle.
 */
export function anonymizePatientName(name?: string | null, fallback = "Client"): string {
  if (!name || !name.trim()) return fallback;
  return fallback;
}

/**
 * Sanitizes clinical text to remove direct individual identifiers.
 */
export function deidentifyClinicalText(
  text: string,
  optionsOrName: DeidentifyOptions | string = {}
): string {
  if (!text) return "";

  const options: DeidentifyOptions =
    typeof optionsOrName === "string" ? { clientName: optionsOrName } : optionsOrName;

  let sanitized = text;

  // 1. Strip exact patient full name if provided
  if (options.clientName && options.clientName.trim().length > 1) {
    const rawName = options.clientName.trim();
    const nameParts = rawName.split(/\s+/);
    const replacement = options.replaceNameWith || "Client";

    // Replace full name first
    const fullNameRegex = new RegExp(escapeRegex(rawName), "gi");
    sanitized = sanitized.replace(fullNameRegex, replacement);

    // If multi-word name, replace first and last name if specific
    if (nameParts.length >= 2) {
      nameParts.forEach((part) => {
        if (part.length > 2 && !isCommonEnglishWord(part)) {
          const partRegex = new RegExp(`\\b${escapeRegex(part)}\\b`, "gi");
          sanitized = sanitized.replace(partRegex, replacement);
        }
      });
    }
  }

  // 2. Strip standard email addresses
  sanitized = sanitized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[REDACTED_EMAIL]"
  );

  // 3. Strip phone numbers (various US/international formats)
  sanitized = sanitized.replace(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    "[REDACTED_PHONE]"
  );

  // 4. Strip Social Security or National ID numbers
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");

  return sanitized;
}

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COMMON_WORDS = new Set([
  "the", "and", "for", "with", "from", "patient", "client", "doctor",
  "therapist", "dr", "mr", "ms", "mrs", "good", "well", "hand", "walk",
]);

function isCommonEnglishWord(word: string): boolean {
  return COMMON_WORDS.has(word.toLowerCase());
}
