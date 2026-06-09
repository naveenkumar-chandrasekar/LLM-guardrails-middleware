<template>
  <div class="page">

    <!-- Main header: brand only -->
    <header class="main-header">
      <div class="brand">
        <div class="brand-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="currentColor"/>
            <path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="brand-name">LLM Guardrails</span>
      </div>
    </header>

    <!-- Sub-header: all controls -->
    <div class="sub-header">
      <div class="sub-left">
        <!-- File selector -->
        <el-select
          v-model="selectedFile"
          @change="loadFile"
          size="small"
          style="width:170px"
        >
          <el-option v-for="f in files" :key="f" :label="f" :value="f" />
        </el-select>

        <div class="sub-divider"></div>

        <!-- Stats -->
        <div class="stats">
          <div class="stat-item">
            <span class="stat-value">{{ rules.length }}</span>
            <span class="stat-label">Total</span>
          </div>
          <div class="stat-dot"></div>
          <div class="stat-item stat-item-success">
            <span class="stat-value">{{ rules.filter(r => r.enabled !== false).length }}</span>
            <span class="stat-label">Active</span>
          </div>
          <div class="stat-dot"></div>
          <div class="stat-item stat-item-danger">
            <span class="stat-value">{{ rules.filter(r => r.action === 'block' && r.enabled !== false).length }}</span>
            <span class="stat-label">Blocking</span>
          </div>
        </div>
      </div>

      <div class="sub-right">
        <el-radio-group v-model="mode" size="small" @change="switchMode">
          <el-radio-button value="visual">Visual</el-radio-button>
          <el-radio-button value="yaml">YAML</el-radio-button>
        </el-radio-group>

        <el-button size="small" :icon="Refresh" @click="loadFile">Reload</el-button>
        <el-button size="small" :icon="Plus" @click="showNewPolicy = true">New Policy</el-button>
        <el-button size="small" type="primary" :icon="Check" @click="save" :loading="saving">
          {{ saving ? "Saving…" : "Save Changes" }}
        </el-button>
      </div>
    </div>

    <!-- New Policy Dialog -->
    <el-dialog v-model="showNewPolicy" title="Create New Policy" width="420px" :close-on-click-modal="true">
      <p class="dialog-sub">A blank policy file will be created in your S3 bucket.</p>
      <el-form @submit.prevent="createPolicy" style="margin-top: 16px">
        <el-form-item label="Filename" label-position="top">
          <el-input
            v-model="newPolicyName"
            placeholder="e.g. customer-support"
            @keydown.enter="createPolicy"
            autofocus
          >
            <template #suffix><span style="color:var(--el-text-color-placeholder);font-size:12px">.yaml</span></template>
          </el-input>
        </el-form-item>
        <p v-if="newPolicyError" class="form-error">{{ newPolicyError }}</p>
      </el-form>
      <template #footer>
        <el-button @click="showNewPolicy = false">Cancel</el-button>
        <el-button type="primary" @click="createPolicy" :disabled="!newPolicyName.trim()">Create Policy</el-button>
      </template>
    </el-dialog>

    <!-- Content -->
    <div class="content">

      <!-- Visual mode -->
      <div v-if="mode === 'visual'">
        <div v-if="rules.length === 0" class="empty">
          <el-empty description="No rules yet. Add your first guardrail rule." />
        </div>

        <div class="rules">
          <div
            v-for="(rule, idx) in rules"
            :key="idx"
            class="rule-card"
            :class="{ 'rule-active': editingIdx === idx, 'rule-off': rule.enabled === false }"
          >
            <!-- Card summary row -->
            <div class="rule-summary">
              <div class="rule-accent" :class="`accent-${rule.action}`"></div>
              <el-switch :model-value="rule.enabled !== false" @change="toggleRule(idx)" size="small" />
              <div class="rule-meta">
                <span class="rule-id">{{ rule.id }}</span>
                <span class="rule-msg" v-if="rule.message">{{ rule.message }}</span>
              </div>
              <div class="rule-badges">
                <span class="action-badge" :class="`action-${rule.action}`">{{ rule.action }}</span>
                <span class="type-badge">{{ rule.type }}</span>
              </div>
              <div class="rule-actions">
                <el-tooltip :content="editingIdx === idx ? 'Close' : 'Edit rule'" placement="top">
                  <el-button :icon="editingIdx === idx ? Close : Edit" size="small" text circle @click="toggleEdit(idx)" />
                </el-tooltip>
                <el-popconfirm title="Delete this rule?" confirm-button-text="Delete" cancel-button-text="Cancel" @confirm="deleteRule(idx)">
                  <template #reference>
                    <el-button :icon="Delete" size="small" text circle type="danger" />
                  </template>
                </el-popconfirm>
              </div>
            </div>

            <!-- Expanded edit panel -->
            <transition name="expand">
              <div v-if="editingIdx === idx" class="edit-panel">
                <div class="edit-panel-inner">
                  <div class="edit-section">
                    <p class="edit-section-title">Identity</p>
                    <div class="edit-grid-3">
                      <div class="edit-field">
                        <label class="edit-label">Rule ID</label>
                        <el-input v-model="rule.id" size="small" class="mono" />
                      </div>
                      <div class="edit-field">
                        <label class="edit-label">Type</label>
                        <el-select v-model="rule.type" size="small" style="width:100%">
                          <el-option v-for="t in ruleTypes" :key="t" :label="t" :value="t" />
                        </el-select>
                      </div>
                      <div class="edit-field">
                        <label class="edit-label">Action</label>
                        <el-select v-model="rule.action" size="small" style="width:100%">
                          <el-option label="block" value="block" />
                          <el-option label="warn" value="warn" />
                          <el-option label="redact" value="redact" />
                        </el-select>
                      </div>
                    </div>
                    <div class="edit-field" style="margin-top:10px">
                      <label class="edit-label">Violation message</label>
                      <el-input v-model="rule.message" size="small" placeholder="Shown in the violation log" />
                    </div>
                  </div>

                  <div v-if="usesKeywords(rule.type) || usesContains(rule.type) || usesPattern(rule.type) || usesSemantic(rule.type)" class="edit-section">
                    <p class="edit-section-title">Matching</p>
                    <div class="edit-field" v-if="usesKeywords(rule.type)">
                      <label class="edit-label">Keywords <span class="edit-hint">one per line · substring match</span></label>
                      <el-input type="textarea" :model-value="(rule.keywords||[]).join('\n')"
                        @blur="(e:FocusEvent)=>rule.keywords=(e.target as HTMLTextAreaElement).value.split('\n').map(s=>s.trim()).filter(Boolean)"
                        :rows="4" class="mono" placeholder="keyword one&#10;keyword two" />
                    </div>
                    <div class="edit-field" v-if="usesContains(rule.type)">
                      <label class="edit-label">Required phrases <span class="edit-hint">output must contain at least one</span></label>
                      <el-input type="textarea" :model-value="(rule.contains||[]).join('\n')"
                        @blur="(e:FocusEvent)=>rule.contains=(e.target as HTMLTextAreaElement).value.split('\n').map(s=>s.trim()).filter(Boolean)"
                        :rows="3" placeholder="source:&#10;reference:" />
                    </div>
                    <div class="edit-field" v-if="usesPattern(rule.type)">
                      <label class="edit-label">Regex pattern</label>
                      <el-input v-model="rule.pattern" size="small" class="mono" placeholder="\b\d{4}-\d{4}\b" />
                    </div>
                    <div class="edit-field" v-if="usesSemantic(rule.type)">
                      <label class="edit-label">Example phrases <span class="edit-hint">AI matches by semantic meaning, not exact text</span></label>
                      <el-input type="textarea" :model-value="(rule.examples||[]).join('\n')"
                        @blur="(e:FocusEvent)=>rule.examples=(e.target as HTMLTextAreaElement).value.split('\n').map(s=>s.trim()).filter(Boolean)"
                        :rows="5" class="mono" placeholder="which stocks should I buy&#10;give me financial advice" />
                    </div>
                    <div v-if="usesSemantic(rule.type)" class="edit-inline">
                      <label class="edit-label" style="white-space:nowrap">Similarity threshold</label>
                      <el-input-number :model-value="rule.threshold??0.72" @change="(v:number|undefined)=>rule.threshold=v??0.72" :min="0" :max="1" :step="0.01" :precision="2" size="small" style="width:120px" />
                      <span class="edit-hint">0.0–1.0 · lower = broader match · default 0.72</span>
                    </div>
                  </div>

                  <div class="edit-footer">
                    <el-button size="small" type="primary" @click="editingIdx=null">
                      <el-icon style="margin-right:4px"><Check /></el-icon>Done
                    </el-button>
                  </div>
                </div>
              </div>
            </transition>
          </div>

          <el-button class="add-btn" :icon="Plus" @click="addRule" style="width:100%;margin-top:8px">
            Add Rule
          </el-button>
        </div>
      </div>

      <!-- YAML mode -->
      <div v-if="mode === 'yaml'">
        <el-input
          v-model="rawContent"
          type="textarea"
          :rows="30"
          class="mono yaml-ta"
          spellcheck="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { parse as parseYaml, stringify as dumpYaml } from "yaml";
import { ElMessage } from "element-plus";
import { Document, Refresh, Plus, Check, Edit, Delete, Close } from "@element-plus/icons-vue";
import { policiesApi } from "../api/client";

type PolicyAction = "block" | "warn" | "redact";
type PolicyRuleType = "input_topic" | "input_required" | "input_semantic" | "output_topic" | "output_required" | "output_contains" | "output_semantic" | "pii" | "injection";

interface PolicyRule {
  id: string; type: PolicyRuleType; action: PolicyAction;
  keywords?: string[]; contains?: string[]; pattern?: string;
  examples?: string[]; threshold?: number; message?: string; enabled?: boolean;
}

const files = ref<string[]>([]);
const selectedFile = ref("default.yaml");
const rawContent = ref("");
const saving = ref(false);
const mode = ref<"visual" | "yaml">("visual");
const rules = ref<PolicyRule[]>([]);
const editingIdx = ref<number | null>(null);
const showNewPolicy = ref(false);
const newPolicyName = ref("");
const newPolicyError = ref("");

const ruleTypes: PolicyRuleType[] = ["input_topic","input_required","input_semantic","output_topic","output_required","output_contains","output_semantic","pii","injection"];

function usesKeywords(t: PolicyRuleType) { return ["input_topic","output_topic","pii","injection"].includes(t); }
function usesContains(t: PolicyRuleType) { return ["output_contains","output_required","input_required"].includes(t); }
function usesPattern(t: PolicyRuleType) { return ["pii","injection","input_topic","output_topic"].includes(t); }
function usesSemantic(t: PolicyRuleType) { return ["input_semantic","output_semantic"].includes(t); }

function parseContent(text: string) {
  try {
    const p = parseYaml(text) as any;
    if (!p) return;
    rules.value = (p.rules || []).map((r: any) => ({
      id: r.id||"", type: r.type||"input_topic", action: r.action||"warn",
      keywords: r.keywords, contains: r.contains, pattern: r.pattern,
      examples: r.examples, threshold: r.threshold, message: r.message, enabled: r.enabled !== false,
    }));
  } catch {}
}

function buildYaml() {
  return dumpYaml({
    rules: rules.value.map(r => {
      const o: any = { id: r.id, type: r.type, action: r.action, enabled: r.enabled !== false };
      if (r.keywords?.length) o.keywords = r.keywords;
      if (r.contains?.length) o.contains = r.contains;
      if (r.pattern) o.pattern = r.pattern;
      if (r.examples?.length) o.examples = r.examples;
      if (r.threshold !== undefined) o.threshold = r.threshold;
      if (r.message) o.message = r.message;
      return o;
    }),
  }, { lineWidth: 120 });
}

function switchMode(m: string | number | boolean) {
  if (m === "yaml" && mode.value === "visual") rawContent.value = buildYaml();
  else if (m === "visual" && mode.value === "yaml") parseContent(rawContent.value);
  mode.value = m as "visual" | "yaml";
  editingIdx.value = null;
}

function toggleRule(idx: number) { rules.value[idx].enabled = rules.value[idx].enabled === false; }
function deleteRule(idx: number) { rules.value.splice(idx, 1); if (editingIdx.value === idx) editingIdx.value = null; }
function toggleEdit(idx: number) { editingIdx.value = editingIdx.value === idx ? null : idx; }
function addRule() { rules.value.push({ id: "new_rule", type: "input_topic", action: "block", enabled: true }); editingIdx.value = rules.value.length - 1; }

async function loadFile() {
  editingIdx.value = null;
  try { const d = await policiesApi.get(selectedFile.value); rawContent.value = d.content; parseContent(d.content); }
  catch { rawContent.value = "# Could not load policy file"; }
}

async function save() {
  saving.value = true;
  const content = mode.value === "visual" ? buildYaml() : rawContent.value;
  try {
    await policiesApi.save(selectedFile.value, content);
    if (mode.value === "visual") rawContent.value = content;
    ElMessage.success("Policy saved successfully");
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || "Save failed");
  } finally { saving.value = false; }
}

async function createPolicy() {
  const name = newPolicyName.value.trim().replace(/\.ya?ml$/, "");
  if (!name) return;
  const filename = `${name}.yaml`;
  if (files.value.includes(filename)) { newPolicyError.value = "A policy with this name already exists"; return; }
  try {
    await policiesApi.save(filename, `rules: []\n`);
    files.value = [...files.value, filename];
    selectedFile.value = filename;
    rawContent.value = "rules: []\n";
    parseContent(rawContent.value);
    showNewPolicy.value = false; newPolicyName.value = ""; newPolicyError.value = "";
    ElMessage.success(`Created ${filename}`);
  } catch (err: any) { newPolicyError.value = err.response?.data?.error || "Failed to create"; }
}

onMounted(async () => {
  try { files.value = (await policiesApi.list()).policies; } catch { files.value = ["default.yaml"]; }
  await loadFile();
});
</script>

<style scoped>
.page { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: #F1F5F9; }

/* ── Main header ── */
.main-header {
  flex-shrink: 0;
  height: 58px; padding: 0 24px;
  background: #1E3A8A;
  display: flex; align-items: center;
  box-shadow: 0 2px 8px rgba(30,58,138,0.3);
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand-icon {
  width: 32px; height: 32px;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  backdrop-filter: blur(4px);
}
.brand-name {
  font-size: 15px; font-weight: 700;
  color: #fff; letter-spacing: -0.02em;
}

/* ── Sub-header ── */
.sub-header {
  flex-shrink: 0;
  display: flex; align-items: center;
  margin: 12px 24px;
  padding: 8px 14px; gap: 12px;
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.sub-left  { display: flex; align-items: center; gap: 10px; flex: 1; }
.sub-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.stats { display: flex; align-items: center; gap: 6px; }

/* Sub-header divider */
.sub-divider { width: 1px; height: 22px; background: #E2E8F0; flex-shrink: 0; }

/* Stats */
.stats { display: flex; align-items: center; gap: 12px; }
.stat-item { display: flex; align-items: baseline; gap: 4px; }
.stat-value { font-size: 15px; font-weight: 700; color: #1E293B; line-height: 1; }
.stat-label { font-size: 11px; font-weight: 500; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em; }
.stat-item-success .stat-value { color: #059669; }
.stat-item-success .stat-label { color: #6EE7B7; }
.stat-item-danger  .stat-value { color: #DC2626; }
.stat-item-danger  .stat-label { color: #FCA5A5; }
.stat-dot { width: 3px; height: 3px; border-radius: 50%; background: #CBD5E1; flex-shrink: 0; }

/* ── Content ── */
.content { flex: 1; overflow-y: auto; padding: 0 24px 24px; }

/* ── Rules ── */
.rules { display: flex; flex-direction: column; gap: 6px; }

/* Rule card */
.rule-card {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.rule-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
.rule-card.rule-active { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.rule-card.rule-off { opacity: 0.45; }

/* Summary row */
.rule-summary {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 16px;
}
.rule-accent {
  width: 3px; height: 36px; border-radius: 2px; flex-shrink: 0;
}
.accent-block  { background: #EF4444; }
.accent-warn   { background: #F59E0B; }
.accent-redact { background: #8B5CF6; }

.rule-meta { flex: 1; min-width: 0; }
.rule-id {
  font-size: 13px; font-weight: 600;
  font-family: ui-monospace, 'JetBrains Mono', monospace;
  color: #0F172A; display: block;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rule-msg {
  font-size: 12px; color: #94A3B8; display: block; margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.rule-badges { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.action-badge {
  display: inline-flex; align-items: center;
  font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; padding: 2px 8px; border-radius: 4px; line-height: 18px;
}
.action-block  { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
.action-warn   { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; }
.action-redact { background: #F5F3FF; color: #7C3AED; border: 1px solid #DDD6FE; }
.type-badge {
  display: inline-flex; align-items: center;
  font-size: 11px; font-family: ui-monospace, monospace; line-height: 18px;
  background: #F8FAFC; color: #64748B;
  border: 1px solid #E2E8F0; padding: 2px 8px; border-radius: 4px;
}
.rule-actions { display: flex; align-items: center; gap: 0; flex-shrink: 0; }

/* El-switch override */
.rule-summary :deep(.el-switch.is-checked .el-switch__core) {
  background: #2563EB; border-color: #2563EB;
}

/* Expand animation */
.expand-enter-active, .expand-leave-active { transition: all 0.2s ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
.expand-enter-to, .expand-leave-from { opacity: 1; max-height: 800px; }

/* Edit panel */
.edit-panel { border-top: 1px solid #EFF3F9; background: #FAFBFF; }
.edit-panel-inner { padding: 20px 20px 16px; display: flex; flex-direction: column; gap: 20px; }

.edit-section { display: flex; flex-direction: column; gap: 10px; }
.edit-section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: #2563EB; margin: 0;
}
.edit-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.edit-grid-3 .edit-field :deep(.el-select),
.edit-grid-3 .edit-field :deep(.el-input) { width: 100% !important; }
.edit-field { display: flex; flex-direction: column; gap: 5px; }
.edit-inline { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.edit-label {
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em; color: #64748B;
}
.edit-hint { text-transform: none; letter-spacing: 0; font-weight: 400; color: #94A3B8; font-size: 11px; }
.edit-footer { padding-top: 4px; border-top: 1px solid #EFF3F9; }

.mono :deep(textarea),
.mono :deep(input) { font-family: ui-monospace, monospace !important; font-size: 12px !important; }
.yaml-ta :deep(textarea) {
  font-family: ui-monospace, monospace !important;
  font-size: 13px !important; line-height: 1.7 !important;
  min-height: calc(100vh - 200px) !important;
}
.form-error { font-size: 12px; color: #DC2626; margin-top: 4px; }
.dialog-sub { font-size: 13px; color: #64748B; margin: 0; }

/* Add rule button */
.add-btn {
  border-style: dashed !important;
  border-color: #CBD5E1 !important;
  color: #64748B !important;
  height: 44px !important;
  font-size: 13px !important;
  transition: all 0.15s !important;
}
.add-btn:hover {
  border-color: #2563EB !important;
  color: #2563EB !important;
  background: #EFF6FF !important;
}

/* Override radio button active */
:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: #2563EB;
  border-color: #2563EB;
  box-shadow: -1px 0 0 0 #2563EB;
}

.empty { padding: 80px 0; }
</style>
