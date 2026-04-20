/**
 * Normalises an AUST L number and builds a resilient ARTG search URL.
 *
 * Accepts inputs like "AUST L 12345", "AUSTL12345", "12345", with or without
 * spaces or punctuation, and returns the canonical TGA ARTG search URL.
 */
export function normaliseAustL(raw: string | null | undefined): string {
  if (!raw) return "";
  // Strip any "AUST L"/"AUSTL"/"AUST-L" prefix (case-insensitive) and all whitespace.
  // Keep digits only — the TGA register keys on the numeric AUST L identifier.
  const digits = raw.replace(/aust[\s-]*l/gi, "").replace(/\s+/g, "").replace(/[^\d]/g, "");
  return digits;
}

export function buildArtgSearchUrl(austL: string | null | undefined): string | null {
  const id = normaliseAustL(austL);
  if (!id) return null;
  return `https://www.tga.gov.au/resources/artg?keywords=${encodeURIComponent(id)}`;
}
