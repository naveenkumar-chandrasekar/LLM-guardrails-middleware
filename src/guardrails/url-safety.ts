import type { GuardrailResult, GuardrailSeverity } from "./types";

const DANGEROUS_PATTERNS = [
  { name: "raw_ip_url",       pattern: /https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/\S*)?/gi },
  { name: "javascript_uri",   pattern: /javascript\s*:/gi },
  { name: "data_uri",         pattern: /data\s*:\s*[a-z]+\/[a-z]+\s*;/gi },
  { name: "local_file",       pattern: /file:\/\/\//gi },
  { name: "ssrf_internal",    pattern: /https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|169\.254\.|10\.\d+\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[\S]*/gi },
];

export function checkURLSafety(text: string, action: "block" | "warn" = "warn"): GuardrailResult {
  const severity: GuardrailSeverity = action === "block" ? "block" : "warn";
  const violations = DANGEROUS_PATTERNS.flatMap(({ name, pattern }) => {
    const matches = text.match(pattern);
    if (!matches) return [];
    return [{
      rule: `url_safety_${name}`,
      severity,
      message: `Suspicious URL pattern detected: ${name.replace(/_/g, " ")}`,
      matches,
    }];
  });

  return { passed: violations.filter(v => v.severity === "block").length === 0, violations };
}
