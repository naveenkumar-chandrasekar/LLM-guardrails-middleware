import type { GuardrailResult, GuardrailViolation } from "../types";

const PII_PATTERNS: Array<{ name: string; pattern: RegExp; placeholder: string }> = [
  { name: "credit_card", pattern: /\b(?:\d[ -]?){13,16}\b/g, placeholder: "[REDACTED:CC]" },
  { name: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g, placeholder: "[REDACTED:SSN]" },
  { name: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, placeholder: "[REDACTED:EMAIL]" },
  { name: "phone_us", pattern: /\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, placeholder: "[REDACTED:PHONE]" },
  { name: "api_key", pattern: /\b(sk-|pk-|api[-_]?key[-_]?)[A-Za-z0-9_-]{16,}\b/gi, placeholder: "[REDACTED:APIKEY]" },
  { name: "passport", pattern: /\b[A-Z]{1,2}\d{6,9}\b/g, placeholder: "[REDACTED:PASSPORT]" },
];

export function checkPII(text: string, action: "redact" | "block" = "redact"): GuardrailResult {
  const violations: GuardrailViolation[] = [];
  let sanitized = text;

  for (const { name, pattern, placeholder } of PII_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      violations.push({
        rule: `pii_${name}`,
        severity: action === "block" ? "block" : "redact",
        message: `Detected ${name.replace("_", " ")} in input`,
        matches: matches.map((m) => m.replace(/\d(?=\d{4})/g, "*")),
      });
      if (action === "redact") {
        sanitized = sanitized.replace(pattern, placeholder);
      }
    }
  }

  return {
    passed: violations.filter((v) => v.severity === "block").length === 0,
    violations,
    sanitized: violations.length > 0 ? sanitized : undefined,
  };
}
