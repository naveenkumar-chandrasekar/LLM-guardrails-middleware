import type { GuardrailResult } from "../types";

const DANGEROUS_CODE_PATTERNS = [
  { name: "rm_rf",            pattern: /rm\s+-rf?\s+(\/|~|\*|\$HOME|\.\.)/, severity: "block" as const },
  { name: "pipe_to_shell",    pattern: /\|\s*(bash|sh|zsh|fish|cmd)\b/i, severity: "block" as const },
  { name: "curl_exec",        pattern: /curl\s+.*\|\s*(bash|sh)|wget\s+.*-O\s*-\s*\|/i, severity: "block" as const },
  { name: "reverse_shell",    pattern: /\/dev\/tcp\/|nc\s+-e\s*\/bin|bash\s+-i\s*>&\s*\/dev\/tcp/i, severity: "block" as const },
  { name: "fork_bomb",        pattern: /:\(\)\s*\{\s*:\|:\s*&\s*\}/, severity: "block" as const },
  { name: "dd_overwrite",     pattern: /dd\s+if=.*of=\/(dev|boot|etc|sys)/i, severity: "block" as const },
  { name: "chmod_777",        pattern: /chmod\s+(777|a\+rwx|o\+w)\s+(\/|\$)/, severity: "warn" as const },
  { name: "eval_dynamic",     pattern: /\beval\s*\(\s*(.*\$|.*`|.*process\.env)/i, severity: "warn" as const },
  { name: "process_env_exec", pattern: /process\.env\.[A-Z_]+.*exec\(|exec\(.*process\.env/i, severity: "warn" as const },
  { name: "system_call",      pattern: /\bsystem\s*\(\s*['"`]?\s*(rm|wget|curl|nc|bash|sh)/i, severity: "warn" as const },
  // SQL destructive operations
  { name: "sql_drop",         pattern: /\bdrop\s+(table|database|schema|index|view)\b/i, severity: "block" as const },
  { name: "sql_truncate",     pattern: /\btruncate\s+(table\s+)?\w/i, severity: "block" as const },
  { name: "sql_delete_all",   pattern: /\bdelete\s+from\s+\w+\s*(;|$|where\s+1\s*=\s*1)/im, severity: "block" as const },
  { name: "sql_drop_all",     pattern: /drop\s+all\s+(tables|databases)|delete\s+all\s+(the\s+)?(tables|records|rows|data)/i, severity: "block" as const },
];

export function checkCodeSafety(text: string): GuardrailResult {
  const violations = DANGEROUS_CODE_PATTERNS.flatMap(({ name, pattern, severity }) => {
    const matches = text.match(pattern);
    if (!matches) return [];
    return [{
      rule: `code_safety_${name}`,
      severity,
      message: `Dangerous code pattern detected: ${name.replace(/_/g, " ")}`,
      matches: matches.slice(0, 3),
    }];
  });

  return { passed: violations.filter(v => v.severity === "block").length === 0, violations };
}
