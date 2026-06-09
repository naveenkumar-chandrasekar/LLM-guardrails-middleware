import type { GuardrailResult } from "../types";

const SCRIPT_RANGES: Array<{ name: string; regex: RegExp }> = [
  { name: "arabic",     regex: /[؀-ۿ]/ },
  { name: "hebrew",     regex: /[֐-׿]/ },
  { name: "cyrillic",   regex: /[Ѐ-ӿ]/ },
  { name: "cjk",        regex: /[一-鿿㐀-䶿]/ },
  { name: "devanagari", regex: /[ऀ-ॿ]/ },
  { name: "thai",       regex: /[฀-๿]/ },
  { name: "greek",      regex: /[Ͱ-Ͽ]/ },
  { name: "latin",      regex: /[A-Za-z]/ },
];

export interface LanguageConfig {
  allowedScripts?: string[];   // e.g. ["latin"] — block everything else
  blockedScripts?: string[];   // e.g. ["cjk"] — block these specifically
  action?: "block" | "warn";
}

export function detectScript(text: string): string {
  const counts: Record<string, number> = {};
  for (const { name, regex } of SCRIPT_RANGES) {
    counts[name] = (text.match(new RegExp(regex.source, "g")) || []).length;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

export function checkLanguage(text: string, config: LanguageConfig = {}): GuardrailResult {
  if (!config.allowedScripts?.length && !config.blockedScripts?.length) {
    return { passed: true, violations: [] };
  }

  const severity = config.action === "warn" ? "warn" : "block";
  const detected = detectScript(text);

  if (config.blockedScripts?.includes(detected)) {
    return {
      passed: false,
      violations: [{
        rule: "input_language_blocked_script",
        severity,
        message: `Detected script "${detected}" is not permitted`,
        matches: [detected],
      }],
    };
  }

  if (config.allowedScripts?.length && !config.allowedScripts.includes(detected)) {
    return {
      passed: false,
      violations: [{
        rule: "input_language_not_allowed",
        severity,
        message: `Detected script "${detected}" is not in the allowed list: ${config.allowedScripts.join(", ")}`,
        matches: [detected],
      }],
    };
  }

  return { passed: true, violations: [] };
}
