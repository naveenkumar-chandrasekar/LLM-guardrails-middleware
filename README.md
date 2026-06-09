# llm-guardrails

LLM guardrails middleware — sanitize requests and responses on your existing LLM routes, manage policies via a built-in UI, store rules in S3.

## Install

```bash
npm install llm-guardrails
```

---

## How It Works

```
Incoming request
      │
      ▼
guardrailsMiddleware()   ← checks input, blocks/redacts if needed
      │
      ▼
Your route handler       ← you own the LLM call
      │
      ▼
guardrailsMiddleware()   ← checks output before it leaves
      │
      ▼
Response sent
```

---

## Quick Start

```ts
import express from "express";
import { guardrailsMiddleware, createGuardrailsRouter } from "llm-guardrails";

const app = express();
app.use(express.json());

// Policy editor UI + API
app.use("/guardrails", createGuardrailsRouter());

// Your LLM route — middleware sanitizes input and output
app.post("/chat", guardrailsMiddleware({ policyFile: "default.yaml" }), async (req, res) => {
  const reply = await yourLLM(req.body.messages); // messages already sanitized
  res.json({ content: reply });                    // output checked before sending
});

app.listen(3000);
```

Set S3 env vars — policies are read from and saved to your S3 bucket:

```env
GUARDRAILS_S3_BUCKET=my-policies-bucket
GUARDRAILS_S3_FOLDER=policies
GUARDRAILS_S3_REGION=us-east-1
GUARDRAILS_S3_ENDPOINT=http://localhost:4566   # optional — for LocalStack
```

---

## `guardrailsMiddleware(options?)`

Mounts on any Express route. Runs input checks before the LLM call and intercepts the response to run output checks before it reaches the client.

```ts
guardrailsMiddleware({
  policyFile: "default.yaml",         // optional — which S3 policy to enforce
  onBlocked: (violations, req) => {}, // optional — callback when request is blocked
  guardrails: {                        // optional — fine-tune built-in checks
    injection: { enabled: true },
    sentiment: { enabled: true, action: "warn" },
    outputPII: { enabled: true, action: "redact" },
  },
})
```

After the middleware runs, `req.guardrails` is available in your handler:

```ts
req.guardrails.inputViolations   // violations found on input
req.guardrails.outputViolations  // violations found on output
req.guardrails.blocked           // true if request was blocked
req.guardrails.sanitizedMessages // PII-redacted messages
```

---

## `createGuardrailsRouter()`

Mounts a policy editor UI and REST API. Reads S3 config from environment variables automatically.

```ts
app.use("/guardrails", createGuardrailsRouter());
```

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Built-in policy editor UI |
| `GET` | `/v1/policies` | List policy files from S3 |
| `GET` | `/v1/policies/:filename` | Get raw YAML of a policy |
| `PUT` | `/v1/policies/:filename` | Save a policy to S3 |
| `GET` | `/v1/logs` | Request history |
| `GET` | `/v1/logs/stats` | Aggregate violation stats |

---

## Policy Configuration

Policies are YAML files stored in S3. The middleware loads them on first use and caches them in memory (default 60s TTL).

```env
GUARDRAILS_S3_BUCKET=my-bucket    # required
GUARDRAILS_S3_FOLDER=policies     # optional
GUARDRAILS_S3_REGION=us-east-1   # optional
GUARDRAILS_S3_ENDPOINT=...        # optional — S3-compatible storage
```

### Policy File Structure

```yaml
rules:
  - id: no_financial_advice
    type: input_semantic
    action: block
    enabled: true
    threshold: 0.64
    examples:
      - which stocks should I buy
      - give me financial advice
      - where should I put my money
    message: Financial advice requests are blocked

  - id: no_pii_in_output
    type: output_topic
    action: warn
    enabled: true
    keywords:
      - your SSN is
      - your credit card number
    message: Output may contain PII
```

### Rule Types

| Type | Evaluates | Method |
|------|-----------|--------|
| `input_topic` | User input | Keyword or regex |
| `input_semantic` | User input | AI similarity — catches paraphrases |
| `input_required` | User input | Must contain phrase |
| `output_topic` | LLM output | Keyword or regex |
| `output_semantic` | LLM output | AI similarity — catches paraphrases |
| `output_contains` | LLM output | Must contain phrase |
| `output_required` | LLM output | Must contain phrase |

### Actions

| Action | Behaviour |
|--------|-----------|
| `block` | Reject — returns 400 immediately, LLM is not called |
| `warn` | Log the violation, let the response through |
| `redact` | Strip matching content from the response |

### Semantic Matching

Requires `@xenova/transformers` for AI similarity matching:

```bash
npm install @xenova/transformers
```

Model runs fully locally — no external API needed.

---

## Policy Cache

Policies load from S3 once and cache in memory. Default TTL is 60 seconds. Saving a policy via the UI invalidates the cache immediately.

```ts
import { setPolicyTTL, clearPolicyCache } from "llm-guardrails";

setPolicyTTL(30_000);  // 30 seconds
setPolicyTTL(0);       // always fetch from S3
clearPolicyCache();    // force immediate re-fetch
```

---

## Built-in Guardrails

Always active on every request — no policy file required.

**Input:**
| Guardrail | What it catches |
|-----------|-----------------|
| PII detection | Emails, SSNs, credit cards, API keys — redacted automatically |
| Prompt injection | Jailbreaks, role overrides, instruction overrides |
| Code / SQL safety | `DROP TABLE`, `rm -rf`, reverse shells |
| Sentiment | Threats, hostility, doxxing |
| URL safety | Raw IPs, `javascript:`, SSRF targets |

**Output:**
| Guardrail | What it catches |
|-----------|-----------------|
| Toxicity | Hate speech, self-harm instructions |
| Secrets | Private keys, AWS credentials, JWTs |
| PII | PII in LLM responses — redacted by default |
| Code safety | `eval()`, dangerous shell patterns |

---

## Individual Guardrail Functions

Use checks directly without the middleware:

```ts
import {
  checkPII,
  checkInjection,
  checkToxicity,
  evaluateInputSemanticRules,
  evaluateOutputSemanticRules,
} from "llm-guardrails";

const { violations, sanitized } = checkPII(text, "redact");
const { violations } = checkInjection(text);
const { violations } = checkToxicity(llmResponse);

const violations = await evaluateInputSemanticRules(text, policy);
```

---

## Policy API

```ts
import { listPolicies, loadPolicy, savePolicy } from "llm-guardrails";

const s3 = { bucket: "my-bucket", folder: "policies" };

const files = await listPolicies(s3);
const policy = await loadPolicy("default.yaml", s3);
await savePolicy(yamlString, "custom.yaml", s3);
```

---

## License

MIT
