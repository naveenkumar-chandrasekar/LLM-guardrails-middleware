import { z, ZodError } from "zod";
import type { GuardrailResult } from "../types";

function buildZodSchema(schema: Record<string, unknown>): z.ZodTypeAny {
  if (schema.type === "object" && schema.properties) {
    const shape: Record<string, z.ZodTypeAny> = {};
    const required = (schema.required as string[]) || [];
    for (const [key, val] of Object.entries(schema.properties as Record<string, unknown>)) {
      let field = buildZodSchema(val as Record<string, unknown>);
      if (!required.includes(key)) field = field.optional();
      shape[key] = field;
    }
    return z.object(shape);
  }
  if (schema.type === "array") {
    return z.array(buildZodSchema((schema.items as Record<string, unknown>) || {}));
  }
  if (schema.type === "string") return z.string();
  if (schema.type === "number") return z.number();
  if (schema.type === "boolean") return z.boolean();
  return z.unknown();
}

export function checkOutputSchema(text: string, schema: Record<string, unknown>): GuardrailResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      passed: false,
      violations: [{ rule: "output_schema_json", severity: "block", message: "Response is not valid JSON" }],
    };
  }

  try {
    buildZodSchema(schema).parse(parsed);
    return { passed: true, violations: [] };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        passed: false,
        violations: err.errors.map((e) => ({
          rule: "output_schema_field",
          severity: "block" as const,
          message: `Schema violation at ${e.path.join(".")}: ${e.message}`,
        })),
      };
    }
    return {
      passed: false,
      violations: [{ rule: "output_schema_unknown", severity: "block", message: "Unknown schema error" }],
    };
  }
}
