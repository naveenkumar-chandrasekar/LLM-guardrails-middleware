import type { GuardrailResult } from "../types";

const HOSTILE_PATTERNS = [
  { name: "death_threat",     pattern: /\b(i will|i'm going to|i'll)\s+(kill|murder|destroy|end)\s+(you|your|everyone)\b/i },
  { name: "violent_threat",   pattern: /\b(i will|gonna)\s+(hurt|attack|beat|shoot|stab)\s+(you|everyone)\b/i },
  { name: "severe_profanity", pattern: /\b(f+u+c+k\s+you|go\s+to\s+hell|piece\s+of\s+shit)\b/gi },
  { name: "doxxing_threat",   pattern: /\b(i know where you live|find your address|expose your info|dox you)\b/i },
  { name: "extortion",        pattern: /\b(pay me|send money|or i will|otherwise i'll)\b.*\b(expose|destroy|ruin|leak)\b/i },
  { name: "hate_target",      pattern: /\b(all|every)\s+(jews|muslims|christians|blacks|whites|gays|women|men)\s+(should|deserve|must|are)\b/i },
];

export function checkSentiment(text: string, action: "block" | "warn" = "warn"): GuardrailResult {
  const severity: import("../types").GuardrailSeverity = action === "block" ? "block" : "warn";
  const violations = HOSTILE_PATTERNS.flatMap(({ name, pattern }) => {
    const matches = text.match(pattern);
    if (!matches) return [];
    return [{
      rule: `sentiment_${name}`,
      severity,
      message: `Hostile content detected: ${name.replace(/_/g, " ")}`,
      matches,
    }];
  });

  return { passed: violations.filter(v => v.severity === "block").length === 0, violations };
}
