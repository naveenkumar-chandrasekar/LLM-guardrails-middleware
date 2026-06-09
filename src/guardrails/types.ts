export type GuardrailSeverity = "block" | "warn" | "redact";

export interface GuardrailViolation {
  rule: string;
  severity: GuardrailSeverity;
  message: string;
  matches?: string[];
}

export interface GuardrailResult {
  passed: boolean;
  violations: GuardrailViolation[];
  sanitized?: string;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GuardrailsConfig {
  inputLength?: { maxChars?: number; maxWords?: number; action?: "block" | "warn" };
  language?: { allowedScripts?: string[]; blockedScripts?: string[]; action?: "block" | "warn" };
  urlSafety?: { enabled?: boolean; action?: "block" | "warn" };
  sentiment?: { enabled?: boolean; action?: "block" | "warn" };
  keywordDensity?: { enabled?: boolean; maxDensity?: number };
  outputPII?: { enabled?: boolean; action?: "block" | "warn" | "redact" };
  codeSafety?: { enabled?: boolean; action?: "block" | "warn" };
  secrets?: { enabled?: boolean; action?: "block" | "warn" };
  languageQuality?: { enabled?: boolean; apiUrl?: string; language?: string; maxErrors?: number; action?: "block" | "warn" };
  /** Injection detection config. suspiciousCharThreshold defaults to 50. */
  injection?: { enabled?: boolean; suspiciousCharThreshold?: number };
}

export interface S3Config {
  bucket: string;
  folder?: string;
  region?: string;
  endpoint?: string;
}

