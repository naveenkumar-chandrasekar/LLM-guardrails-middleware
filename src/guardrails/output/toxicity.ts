import type { GuardrailResult } from "../types";

const TOXIC_PATTERNS = [
  { name: "hate_speech", pattern: /\b(hate|kill|destroy|exterminate)\s+(all\s+)?(people|humans?|group)\b/i },
  { name: "self_harm", pattern: /\b(how to|ways to|guide to)\s+(kill|harm|hurt)\s+(yourself|oneself)\b/i },
  { name: "explicit_violence", pattern: /\b(step[- ]by[- ]step|instructions?|guide)\s+(to|for)\s+(murder|bombing|shooting)\b/i },
  { name: "profanity_severe", pattern: /\b(f+u+c+k+|s+h+i+t+|b+i+t+c+h+)\b/gi },
];

export function checkToxicity(text: string, blockOnSevere = true): GuardrailResult {
  const violations = TOXIC_PATTERNS.flatMap(({ name, pattern }) => {
    const matches = text.match(pattern);
    if (!matches) return [];
    const isSevere = name !== "profanity_severe";
    return [{
      rule: `toxicity_${name}`,
      severity: (isSevere && blockOnSevere ? "block" : "warn") as "block" | "warn",
      message: `Toxic content detected: ${name.replace(/_/g, " ")}`,
      matches,
    }];
  });

  return {
    passed: violations.filter((v) => v.severity === "block").length === 0,
    violations,
  };
}
