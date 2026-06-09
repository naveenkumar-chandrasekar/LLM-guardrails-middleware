import type { GuardrailResult } from "../types";

export interface LengthConfig {
  maxChars?: number;
  maxWords?: number;
  action?: "block" | "warn";
}

const DEFAULTS: Required<LengthConfig> = {
  maxChars: parseInt(process.env.GUARDRAILS_MAX_CHARS || "8000"),
  maxWords: parseInt(process.env.GUARDRAILS_MAX_WORDS || "1500"),
  action: "block",
};

export function checkInputLength(text: string, config: LengthConfig = {}): GuardrailResult {
  const { maxChars, maxWords, action } = { ...DEFAULTS, ...config };
  const severity = action === "block" ? "block" : "warn";
  const violations: import("../types").GuardrailViolation[] = [];

  if (text.length > maxChars) {
    violations.push({
      rule: "input_length_chars",
      severity,
      message: `Input exceeds maximum character limit (${text.length}/${maxChars})`,
    });
  }

  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > maxWords) {
    violations.push({
      rule: "input_length_words",
      severity,
      message: `Input exceeds maximum word limit (${wordCount}/${maxWords})`,
    });
  }

  return { passed: violations.length === 0, violations };
}
