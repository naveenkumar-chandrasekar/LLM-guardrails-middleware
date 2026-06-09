import express from "express";
import { createGuardrailsRouter } from "./dist/index.js";

process.env.GUARDRAILS_S3_BUCKET = "guardrails-policies";
process.env.GUARDRAILS_S3_FOLDER = "policies";
process.env.GUARDRAILS_S3_REGION = "us-east-1";
process.env.GUARDRAILS_S3_ENDPOINT = "http://localhost:4568";

const app = express();
app.use(express.json());
app.use(createGuardrailsRouter());
app.listen(3000, () => console.log("Test server running on http://localhost:3000"));
