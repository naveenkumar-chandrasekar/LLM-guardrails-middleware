import axios from "axios";
import type { GuardrailResult } from "../types";

export interface LanguageQualityConfig {
  apiUrl?: string;
  language?: string;
  maxErrors?: number;
  action?: "block" | "warn";
}

interface LTMatch {
  message: string;
  rule: { id: string; issueType: string };
  context: { text: string; offset: number; length: number };
}

const DEFAULTS: Required<LanguageQualityConfig> = {
  apiUrl: process.env.LANGUAGETOOL_URL || "https://api.languagetool.org/v2/check",
  language: process.env.LANGUAGETOOL_LANG || "en-US",
  maxErrors: parseInt(process.env.LANGUAGETOOL_MAX_ERRORS || "5"),
  action: "warn",
};

// Issue types that indicate serious quality problems worth blocking
const SEVERE_ISSUE_TYPES = new Set(["misspelling", "grammar"]);

export async function checkLanguageQuality(
  text: string,
  config: LanguageQualityConfig = {}
): Promise<GuardrailResult> {
  const { apiUrl, language, maxErrors, action } = { ...DEFAULTS, ...config };

  // Skip very short outputs
  if (text.trim().split(/\s+/).length < 10) return { passed: true, violations: [] };

  let matches: LTMatch[] = [];
  try {
    const res = await axios.post(
      apiUrl,
      new URLSearchParams({ text, language }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 5000 }
    );
    matches = res.data.matches || [];
  } catch {
    // Don't block if the service is unreachable — fail open
    return { passed: true, violations: [] };
  }

  if (matches.length === 0) return { passed: true, violations: [] };

  const hasSevere = matches.some(m => SEVERE_ISSUE_TYPES.has(m.rule.issueType));
  const exceedsThreshold = matches.length > maxErrors;

  const severity: import("../types").GuardrailSeverity = action === "block" && (hasSevere || exceedsThreshold) ? "block" : "warn";

  const violations = [{
    rule: "output_language_quality",
    severity,
    message: `Language quality check failed: ${matches.length} issue(s) found (e.g. ${matches[0].message})`,
    matches: matches.slice(0, 3).map(m => m.context.text.substring(m.context.offset, m.context.offset + m.context.length)),
  }];

  return { passed: severity !== "block", violations };
}
