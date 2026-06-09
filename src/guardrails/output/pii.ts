import { checkPII } from "../input/pii";
import type { GuardrailResult, GuardrailSeverity } from "../types";

export function checkOutputPII(text: string, action: "block" | "warn" | "redact" = "redact"): GuardrailResult {
  const piiAction = action === "block" ? "block" : "redact";
  const result = checkPII(text, piiAction);
  const severity: GuardrailSeverity = action === "warn" ? "warn" : action;
  return {
    passed: action === "block" ? result.passed : true,
    violations: result.violations.map(v => ({
      ...v,
      severity,
      rule: v.rule.replace(/^pii_/, "output_pii_"),
      message: v.message.replace("in input", "in output"),
    })),
    // propagate sanitized text so gateway can use it in the response
    sanitized: action !== "block" ? result.sanitized : undefined,
  };
}
