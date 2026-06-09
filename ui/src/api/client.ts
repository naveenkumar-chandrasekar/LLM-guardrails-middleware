import axios from "axios";

const BASE_URL = (window as unknown as Record<string, unknown>).__GUARDRAILS_API_BASE__ as string | undefined ?? "/v1";
const api = axios.create({ baseURL: BASE_URL });

export const policiesApi = {
  list: () => api.get<{ policies: string[] }>("/policies").then((r) => r.data),
  get: (filename: string) => api.get<{ filename: string; content: string }>(`/policies/${filename}`).then((r) => r.data),
  save: (filename: string, content: string) => api.put(`/policies/${filename}`, { content }).then((r) => r.data),
};
