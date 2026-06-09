export type PolicyAction = "block" | "warn" | "redact" | "retry";
export type PolicyRuleType =
  | "input_topic"
  | "input_required"
  | "input_semantic"
  | "output_topic"
  | "output_required"
  | "output_contains"
  | "output_semantic"
  | "pii"
  | "injection";

export interface PolicyRule {
  id: string;
  type: PolicyRuleType;
  action: PolicyAction;
  keywords?: string[];
  contains?: string[];
  pattern?: string;
  examples?: string[];
  threshold?: number;
  message?: string;
  enabled?: boolean;
}

export interface Policy {
  name: string;
  version?: string;
  rules: PolicyRule[];
}
