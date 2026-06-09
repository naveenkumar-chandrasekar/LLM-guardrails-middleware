import type { GuardrailResult, GuardrailViolation } from "../types";
import type { GuardrailsConfig } from "../types";

const INJECTION_PATTERNS = [
  { name: "ignore_instructions", pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i },
  { name: "jailbreak_dan", pattern: /\bDAN\b|do anything now|jailbreak/i },
  { name: "role_override", pattern: /you are now|pretend (you are|to be)|act as if you have no|forget (you are|that you're)/i },
  { name: "prompt_leak", pattern: /reveal\s+(your\s+)?(system\s+)?prompt|print\s+(your\s+)?instructions|show\s+your\s+prompt/i },
  { name: "system_override", pattern: /\[system\]|\{\{.*\}\}|<\|im_start\|>|<\|im_end\|>/i },
  { name: "token_manipulation", pattern: /###\s*(instruction|system|human|assistant|prompt)/i },
  { name: "repeat_word", pattern: /repeat\s+(the\s+word\s+)?"?\w+"?\s+\d+\s+times/i },
];

/** Default max special chars before a suspicious-chars warning fires. */
const DEFAULT_SUSPICIOUS_CHAR_THRESHOLD = 50;

export function checkInjection(
  text: string,
  config?: GuardrailsConfig["injection"]
): GuardrailResult {
  const violations: GuardrailViolation[] = [];
  const threshold = config?.suspiciousCharThreshold ?? DEFAULT_SUSPICIOUS_CHAR_THRESHOLD;

  for (const { name, pattern } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      violations.push({
        rule: `injection_${name}`,
        severity: "block",
        message: `Potential prompt injection detected: ${name.replace(/_/g, " ")}`,
      });
    }
  }

  const suspiciousChars = (text.match(/[<>{}\[\]|\\]/g) || []).length;
  if (suspiciousChars > threshold) {
    violations.push({
      rule: "injection_suspicious_chars",
      severity: "warn",
      message: `High density of special characters (${suspiciousChars}, threshold: ${threshold})`,
    });
  }

  return {
    passed: violations.filter((v) => v.severity === "block").length === 0,
    violations,
  };
}
