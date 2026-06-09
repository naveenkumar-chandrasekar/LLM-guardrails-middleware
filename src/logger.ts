import type { GuardrailViolation } from "./guardrails/types";

export interface LogEntry {
  id: string;
  content: string;
  provider: string;
  model: string;
  inputViolations: GuardrailViolation[];
  outputViolations: GuardrailViolation[];
  retries: number;
  blocked: boolean;
  latencyMs: number;
  timestamp: string;
  inputPreview: string;
}

const MAX_LOGS = 500;
const logs: LogEntry[] = [];

export function logRequest(entry: Omit<LogEntry, "timestamp">): void {
  logs.unshift({ ...entry, timestamp: new Date().toISOString() });
  if (logs.length > MAX_LOGS) logs.splice(MAX_LOGS);
}

export function getLogs(page = 1, limit = 50): { logs: LogEntry[]; total: number; pages: number } {
  const start = (page - 1) * limit;
  return { logs: logs.slice(start, start + limit), total: logs.length, pages: Math.ceil(logs.length / limit) };
}

export function getStats() {
  const total = logs.length;
  const blocked = logs.filter((l) => l.blocked).length;
  const violationCounts: Record<string, number> = {};
  for (const log of logs) {
    for (const v of [...log.inputViolations, ...log.outputViolations]) {
      violationCounts[v.rule] = (violationCounts[v.rule] || 0) + 1;
    }
  }
  const topViolations = Object.entries(violationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([rule, count]) => ({ rule, count }));
  const avgLatency = total > 0 ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / total) : 0;
  return {
    total, blocked,
    withViolations: logs.filter((l) => l.inputViolations.length + l.outputViolations.length > 0).length,
    blockRate: total ? blocked / total : 0,
    topViolations, avgLatency,
  };
}
