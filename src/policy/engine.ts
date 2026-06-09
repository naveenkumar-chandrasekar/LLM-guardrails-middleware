import type { GuardrailViolation } from "../guardrails/types";
import { semanticMatch } from "../guardrails/semantic";
import type { Policy, PolicyRule } from "./types";

function matchesKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter((kw) => text.toLowerCase().includes(kw.toLowerCase()));
}

function matchesPattern(text: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, "i").test(text);
  } catch {
    return false;
  }
}

function evalInputRule(text: string, rule: PolicyRule): GuardrailViolation | null {
  if (rule.enabled === false) return null;
  const severity = rule.action === "block" ? "block" : rule.action === "redact" ? "redact" : "warn";

  if (rule.keywords?.length) {
    const hits = matchesKeywords(text, rule.keywords);
    if (hits.length > 0) {
      return { rule: rule.id, severity, message: rule.message || `Policy rule "${rule.id}" triggered`, matches: hits };
    }
  }

  if (rule.pattern && matchesPattern(text, rule.pattern)) {
    return { rule: rule.id, severity, message: rule.message || `Pattern match for rule "${rule.id}"` };
  }

  return null;
}

async function evalInputSemanticRule(text: string, rule: PolicyRule): Promise<GuardrailViolation | null> {
  if (rule.enabled === false || !rule.examples?.length) return null;
  const severity = rule.action === "block" ? "block" : rule.action === "redact" ? "redact" : "warn";

  const { matched, topScore, topExample } = await semanticMatch(text, rule.examples, rule.threshold ?? 0.72);
  if (matched) {
    return {
      rule: rule.id,
      severity,
      message: rule.message || `Semantic policy rule "${rule.id}" triggered`,
      matches: [`similarity ${topScore.toFixed(3)} to: "${topExample}"`],
    };
  }
  return null;
}

function evalOutputRule(text: string, rule: PolicyRule): GuardrailViolation | null {
  if (rule.enabled === false) return null;
  const severity = rule.action === "block" ? "block" : rule.action === "redact" ? "redact" : "warn";

  if (rule.keywords?.length) {
    const hits = matchesKeywords(text, rule.keywords);
    if (hits.length > 0) {
      return { rule: rule.id, severity, message: rule.message || `Policy rule "${rule.id}" triggered`, matches: hits };
    }
  }

  if (rule.contains?.length) {
    const missing = rule.contains.filter((c) => !text.toLowerCase().includes(c.toLowerCase()));
    if (missing.length > 0) {
      return { rule: rule.id, severity, message: rule.message || `Required content missing from output: ${missing.join(", ")}`, matches: missing };
    }
  }

  if (rule.pattern && matchesPattern(text, rule.pattern)) {
    return { rule: rule.id, severity, message: rule.message || `Pattern match for rule "${rule.id}"` };
  }

  return null;
}

async function evalOutputSemanticRule(text: string, rule: PolicyRule): Promise<GuardrailViolation | null> {
  if (rule.enabled === false || !rule.examples?.length) return null;
  const severity = rule.action === "block" ? "block" : rule.action === "redact" ? "redact" : "warn";

  const { matched, topScore, topExample } = await semanticMatch(text, rule.examples, rule.threshold ?? 0.72);
  if (matched) {
    return {
      rule: rule.id,
      severity,
      message: rule.message || `Semantic policy rule "${rule.id}" triggered`,
      matches: [`similarity ${topScore.toFixed(3)} to: "${topExample}"`],
    };
  }
  return null;
}

export function evaluateInputRules(text: string, policy: Policy): GuardrailViolation[] {
  return policy.rules
    .filter((r) => r.type === "input_topic" || r.type === "input_required")
    .map((r) => evalInputRule(text, r))
    .filter((v): v is GuardrailViolation => v !== null);
}

export async function evaluateInputSemanticRules(text: string, policy: Policy): Promise<GuardrailViolation[]> {
  const semanticRules = policy.rules.filter((r) => r.type === "input_semantic");
  const results = await Promise.all(semanticRules.map((r) => evalInputSemanticRule(text, r)));
  return results.filter((v): v is GuardrailViolation => v !== null);
}

export function evaluateOutputRules(text: string, policy: Policy): GuardrailViolation[] {
  return policy.rules
    .filter((r) => r.type === "output_topic" || r.type === "output_required" || r.type === "output_contains")
    .map((r) => evalOutputRule(text, r))
    .filter((v): v is GuardrailViolation => v !== null);
}

export async function evaluateOutputSemanticRules(text: string, policy: Policy): Promise<GuardrailViolation[]> {
  const semanticRules = policy.rules.filter((r) => r.type === "output_semantic");
  const results = await Promise.all(semanticRules.map((r) => evalOutputSemanticRule(text, r)));
  return results.filter((v): v is GuardrailViolation => v !== null);
}
