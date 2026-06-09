import type { GuardrailResult } from "../types";

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","is","it","this","that","i","you","we"
]);

export function checkKeywordDensity(text: string, maxDensity = 0.15, minWords = 20): GuardrailResult {
  const words = text.toLowerCase().trim().split(/\s+/);
  if (words.length < minWords) return { passed: true, violations: [] };

  const freq: Record<string, number> = {};
  for (const word of words) {
    const clean = word.replace(/[^a-z0-9]/g, "");
    if (clean.length < 3 || STOP_WORDS.has(clean)) continue;
    freq[clean] = (freq[clean] || 0) + 1;
  }

  const violations = Object.entries(freq)
    .filter(([, count]) => count / words.length > maxDensity)
    .map(([word, count]) => ({
      rule: "input_keyword_density",
      severity: "warn" as const,
      message: `Keyword "${word}" appears suspiciously often (${count}x, ${((count / words.length) * 100).toFixed(1)}% of input)`,
      matches: [word],
    }));

  return { passed: violations.length === 0, violations };
}
