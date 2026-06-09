import { Router, static as serveStatic } from "express";
import path from "path";
import fs from "fs";
import { getLogs, getStats } from "../logger";
import { getPolicyRaw, listPolicies, savePolicy } from "../policy/loader";
import { getS3Config } from "../s3-config";

const UI_DIR = path.resolve(__dirname, "../../ui-dist");

export function createGuardrailsRouter(): Router {
  const router = Router();

  router.get("/v1/policies", async (_req, res) => {
    try {
      res.json({ policies: await listPolicies(getS3Config()) });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list policies" });
    }
  });

  router.get("/v1/policies/:filename", async (req, res) => {
    try {
      res.json({ filename: req.params.filename, content: await getPolicyRaw(req.params.filename, getS3Config()) });
    } catch {
      res.status(404).json({ error: "Policy file not found" });
    }
  });

  router.put("/v1/policies/:filename", async (req, res) => {
    const { content } = req.body;
    if (typeof content !== "string") { res.status(400).json({ error: "content must be a string" }); return; }
    try {
      await savePolicy(content, req.params.filename, getS3Config());
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid YAML" });
    }
  });

  router.get("/v1/logs/stats", (_req, res) => { res.json(getStats()); });
  router.get("/v1/logs", (req, res) => {
    res.json(getLogs(parseInt(req.query.page as string) || 1, parseInt(req.query.limit as string) || 50));
  });

  if (fs.existsSync(UI_DIR)) {
    router.use("/assets", serveStatic(path.join(UI_DIR, "assets")));
    router.get("/", (req, res) => {
      const html = fs.readFileSync(path.join(UI_DIR, "index.html"), "utf-8");
      const apiBase = req.baseUrl + "/v1";
      const injected = html.replace("</head>", `<script>window.__GUARDRAILS_API_BASE__="${apiBase}";</script></head>`);
      res.send(injected);
    });
    router.get(/.*/, (_req, res) => {
      res.sendFile(path.join(UI_DIR, "index.html"));
    });
  }

  return router;
}
