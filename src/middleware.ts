import type { Request, Response, NextFunction } from "express";
import { checkPII } from "./guardrails/input/pii";
import { checkInjection } from "./guardrails/input/injection";
import { checkInputLength } from "./guardrails/input/length";
import { checkSentiment } from "./guardrails/input/sentiment";
import { checkURLSafety } from "./guardrails/url-safety";
import { checkToxicity } from "./guardrails/output/toxicity";
import { checkSecrets } from "./guardrails/output/secrets";
import { checkOutputPII } from "./guardrails/output/pii";
import { checkCodeSafety } from "./guardrails/output/code-safety";
import { evaluateInputRules, evaluateInputSemanticRules, evaluateOutputRules, evaluateOutputSemanticRules } from "./policy/engine";
import { loadPolicy } from "./policy/loader";
import { logRequest } from "./logger";
import { getS3Config } from "./s3-config";
import type { GuardrailViolation, Message, GuardrailsConfig } from "./guardrails/types";

export interface GuardrailsMiddlewareOptions {
  policyFile?: string;
  guardrails?: GuardrailsConfig;
  onBlocked?: (violations: GuardrailViolation[], req: Request) => void;
}

declare global {
  namespace Express {
    interface Request {
      guardrails?: {
        inputViolations: GuardrailViolation[];
        outputViolations: GuardrailViolation[];
        blocked: boolean;
        sanitizedMessages?: Message[];
      };
    }
  }
}

export function guardrailsMiddleware(options: GuardrailsMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const start = Date.now();
    const gc = options.guardrails ?? {};

    const messages: Message[] = req.body?.messages ?? [];
    const lastUserMsg = messages.filter((m: Message) => m.role === "user").at(-1);
    const inputText = lastUserMsg?.content ?? "";

    let workingMessages = [...messages];

    // --- Input: PII redact first ---
    const piiResult = checkPII(inputText, "redact");
    if (piiResult.sanitized && lastUserMsg) {
      workingMessages = workingMessages.map((m) =>
        m === lastUserMsg ? { ...m, content: piiResult.sanitized! } : m
      );
    }

    // --- Input: run all checks in parallel ---
    const policy = options.policyFile
      ? await loadPolicy(options.policyFile, getS3Config()).catch(() => null)
      : null;

    const inputChecks = await Promise.all([
      Promise.resolve(checkInputLength(inputText, gc.inputLength).violations),
      Promise.resolve(piiResult.violations),
      Promise.resolve(gc.injection?.enabled !== false ? checkInjection(inputText).violations : []),
      Promise.resolve(gc.sentiment?.enabled !== false ? checkSentiment(inputText, gc.sentiment?.action ?? "warn").violations : []),
      Promise.resolve(gc.urlSafety?.enabled !== false ? checkURLSafety(inputText, gc.urlSafety?.action ?? "warn").violations : []),
      Promise.resolve(gc.codeSafety?.enabled !== false ? checkCodeSafety(inputText).violations.map(v => ({ ...v, rule: `input_${v.rule}` })) : []),
      Promise.resolve(policy ? evaluateInputRules(inputText, policy) : []),
      policy ? evaluateInputSemanticRules(inputText, policy) : Promise.resolve([]),
    ]);

    const inputViolations: GuardrailViolation[] = inputChecks.flat();
    const blocked = inputViolations.some((v) => v.severity === "block");

    req.guardrails = { inputViolations, outputViolations: [], blocked, sanitizedMessages: workingMessages };

    if (blocked) {
      options.onBlocked?.(inputViolations, req);
      res.status(400).json({
        blocked: true,
        inputViolations,
        outputViolations: [],
        message: "Request blocked by guardrails",
      });
      return;
    }

    // Attach sanitized messages so route handler can use them
    if (req.body) req.body.messages = workingMessages;

    // --- Intercept res.json to run output checks ---
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Restore original immediately to avoid re-interception
      res.json = originalJson;

      const outputText: string =
        typeof body?.content === "string" ? body.content :
        typeof body?.message === "string" ? body.message :
        typeof body === "string" ? body : "";

      if (!outputText) return originalJson(body);

      const runOutputChecks = async () => {
        const outputPIIResult = gc.outputPII?.enabled !== false
          ? checkOutputPII(outputText, gc.outputPII?.action ?? "redact")
          : null;

        const outputChecks = await Promise.all([
          Promise.resolve(checkToxicity(outputText).violations),
          Promise.resolve(gc.codeSafety?.enabled !== false ? checkCodeSafety(outputText).violations : []),
          Promise.resolve(gc.secrets?.enabled !== false ? checkSecrets(outputText, gc.secrets?.action ?? "warn").violations : []),
          Promise.resolve(gc.urlSafety?.enabled !== false ? checkURLSafety(outputText, gc.urlSafety?.action ?? "warn").violations : []),
          Promise.resolve(outputPIIResult?.violations ?? []),
          Promise.resolve(policy ? evaluateOutputRules(outputText, policy) : []),
          policy ? evaluateOutputSemanticRules(outputText, policy) : Promise.resolve([]),
        ]);

        const outputViolations: GuardrailViolation[] = outputChecks.flat();
        const outputBlocked = outputViolations.some((v) => v.severity === "block");

        if (req.guardrails) {
          req.guardrails.outputViolations = outputViolations;
          req.guardrails.blocked = outputBlocked;
        }

        // Redact PII from output content if needed
        let finalContent = outputText;
        if (outputPIIResult?.sanitized) finalContent = outputPIIResult.sanitized;

        if (outputBlocked) {
          return originalJson({
            blocked: true,
            inputViolations: req.guardrails?.inputViolations ?? [],
            outputViolations,
            message: "Response blocked by guardrails",
          });
        }

        logRequest({
          id: crypto.randomUUID(),
          content: finalContent,
          provider: req.body?.provider ?? "unknown",
          model: req.body?.model ?? "unknown",
          inputViolations: req.guardrails?.inputViolations ?? [],
          outputViolations,
          retries: 0,
          blocked: false,
          latencyMs: Date.now() - start,
          inputPreview: inputText.slice(0, 100),
        });

        // Patch content in response if it was redacted
        const finalBody = outputPIIResult?.sanitized
          ? { ...body, content: finalContent }
          : body;

        return originalJson({
          ...finalBody,
          inputViolations: req.guardrails?.inputViolations ?? [],
          outputViolations,
        });
      };

      runOutputChecks().catch(() => originalJson(body));
      return res;
    } as typeof res.json;

    next();
  };
}
