import type { GuardrailResult } from "../types";

const SECRET_PATTERNS = [
  { name: "private_key",       pattern: /-----BEGIN\s+(RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i },
  { name: "aws_key",           pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "aws_secret",        pattern: /aws_secret_access_key\s*=\s*[A-Za-z0-9+\/]{40}/i },
  { name: "gcp_service_acct",  pattern: /"type"\s*:\s*"service_account"/ },
  { name: "connection_string", pattern: /(mongodb|postgresql|mysql|redis|amqp):\/\/[^:]+:[^@]+@/ },
  { name: "password_assign",   pattern: /password\s*[:=]\s*['"`][^'"`]{6,}['"`]/i },
  { name: "bearer_token",      pattern: /[Bb]earer\s+[A-Za-z0-9\-._~+\/]{20,}={0,2}/ },
  { name: "jwt_token",         pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+\/]+=*/ },
  { name: "github_token",      pattern: /ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}/ },
  { name: "stripe_key",        pattern: /(sk|pk)_(live|test)_[A-Za-z0-9]{24,}/ },
  { name: "slack_token",       pattern: /xox[baprs]-[A-Za-z0-9\-]{10,}/ },
];

export function checkSecrets(text: string, action: "block" | "warn" = "warn"): GuardrailResult {
  const severity: import("../types").GuardrailSeverity = action === "block" ? "block" : "warn";
  const violations = SECRET_PATTERNS.flatMap(({ name, pattern }) => {
    if (!pattern.test(text)) return [];
    return [{
      rule: `output_secret_${name}`,
      severity,
      message: `Potential secret detected in output: ${name.replace(/_/g, " ")}`,
    }];
  });

  return { passed: violations.filter(v => v.severity === "block").length === 0, violations };
}
