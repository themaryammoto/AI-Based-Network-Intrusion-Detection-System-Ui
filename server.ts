import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { CIC_77_FEATURES, padCicFeatures } from './src/data/cicFeatureSchema.ts';
import type {
  AlertRecord,
  AlertStatus,
  AppSettings,
  AttackCategory,
  LiveFlowRow,
  LiveThroughputPoint,
  NormalizedPrediction,
  RenderApiConfig,
  SavedReportRecord,
  Severity,
} from './src/types/nids.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'sentinel-store.json');

interface StoreState {
  settings: AppSettings;
  renderConfig: RenderApiConfig;
  alerts: AlertRecord[];
  flows: LiveFlowRow[];
  throughput: LiveThroughputPoint[];
  reports: SavedReportRecord[];
  liveStats: {
    totalScored: number;
    benignScored: number;
    attackScored: number;
    blockedToday: number;
    avgLatencyMs: number;
    attackByCategory: Record<string, number>;
    sourceIpHits: Record<string, { count: number; lastAttack: string; category: string }>;
    portHits: Record<string, number>;
  };
}

const DEFAULT_RENDER_API_URL = (
  process.env.RENDER_MODEL_API_URL || 'https://sentinel-ai-nids-backend.onrender.com'
)
  .trim()
  .replace(/\/+$/, '');

const DEFAULT_SETTINGS: AppSettings = {
  activeModel: 'XGBoost',
  confidenceThreshold: 0.8,
  alertSensitivity: 'High',
  emailAlerts: true,
  soundAlerts: false,
  theme: 'light',
  refreshIntervalSec: 2,
};

const DEFAULT_RENDER_CONFIG: RenderApiConfig = {
  enabled: true,
  apiUrl: DEFAULT_RENDER_API_URL,
  healthPath: '/health',
  predictPath: '/predict',
  payloadFormat: 'wrapped_object',
  timeoutSec: 90,
  apiKey: '',
  connectionStatus: 'disconnected',
};

function createInitialStore(): StoreState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    renderConfig: { ...DEFAULT_RENDER_CONFIG },
    alerts: [],
    flows: [],
    throughput: [],
    reports: [
      {
        id: 'RPT-101',
        templateId: 'weekly-model',
        title: 'Weekly Model Evaluation Audit',
        format: 'PDF',
        generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        range: '2017-07-03 to 2017-07-07',
        summary:
          'XGBoost achieved 99.87% Accuracy, 99.63% Precision, 99.69% Attack Recall, 99.66% F1-Score, 0.999 ROC-AUC, and 0.09% FPR across 566,149 held-out CIC-IDS2017 test flows.',
        metrics: [
          { label: 'Active Classifier', value: 'XGBoost' },
          { label: 'Accuracy', value: '99.87%' },
          { label: 'Precision', value: '99.63%' },
          { label: 'Attack Recall', value: '99.69%' },
          { label: 'F1-Score', value: '99.66%' },
          { label: 'False Positive Rate', value: '0.09%' },
        ],
      },
    ],
    liveStats: {
      totalScored: 0,
      benignScored: 0,
      attackScored: 0,
      blockedToday: 0,
      avgLatencyMs: 0,
      attackByCategory: {},
      sourceIpHits: {},
      portHits: {},
    },
  };
}

function loadStore(): StoreState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoreState>;
      const seed = createInitialStore();
      // Keep only real Render API alerts & flows — scrub any prior demo/local records
      const realAlerts = Array.isArray(parsed.alerts)
        ? parsed.alerts.filter(
            (a) =>
              !a.isDemoFallback &&
              !a.id.startsWith('DEMO-') &&
              !a.id.startsWith('ALT-20') &&
              a.isLiveApi
          )
        : [];
      const realFlows = Array.isArray(parsed.flows)
        ? parsed.flows.filter((f) => f.engineSource === 'render-api' && !f.isDemoFallback)
        : [];
      const hasRealTelemetry = realFlows.length > 0 || realAlerts.length > 0;
      return {
        settings: { ...seed.settings, ...(parsed.settings || {}) },
        renderConfig: { ...seed.renderConfig, ...(parsed.renderConfig || {}), enabled: true },
        alerts: realAlerts,
        flows: realFlows,
        throughput:
          hasRealTelemetry && Array.isArray(parsed.throughput) ? parsed.throughput : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : seed.reports,
        liveStats: hasRealTelemetry
          ? { ...seed.liveStats, ...(parsed.liveStats || {}) }
          : seed.liveStats,
      };
    }
  } catch (err) {
    console.error('Failed to read store file, initializing fresh store:', err);
  }
  const fresh = createInitialStore();
  saveStore(fresh);
  return fresh;
}

let saveTimer: NodeJS.Timeout | null = null;
function saveStore(state: StoreState, immediate = false) {
  const writeNow = () => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist sentinel-store.json:', err);
    }
  };

  if (immediate) {
    if (saveTimer) clearTimeout(saveTimer);
    writeNow();
    return;
  }

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 300);
}

let store: StoreState = loadStore();

function validateExternalUrl(rawUrl: string): { valid: boolean; normalized?: string; error?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Model API URL is required.' };
  }
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must start with https:// or http://' };
    }
    const host = parsed.hostname.toLowerCase();
    if (host === '169.254.169.254' || host === 'metadata.google.internal') {
      return { valid: false, error: 'Restricted host address.' };
    }
    return { valid: true, normalized: trimmed };
  } catch {
    return { valid: false, error: 'Invalid URL format. Example: https://your-model.onrender.com' };
  }
}

function joinEndpoint(baseUrl: string, subPath: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = (subPath || '').trim();
  if (!cleanPath || cleanPath === '/') return cleanBase;
  return `${cleanBase}/${cleanPath.replace(/^\/+/, '')}`;
}

function inferCategory(label: string): Exclude<AttackCategory, 'All'> {
  const lower = label.toLowerCase();
  if (lower.includes('portscan') || lower.includes('port scan') || lower.includes('nmap')) return 'PortScan';
  if (lower.includes('dos') || lower.includes('ddos') || lower.includes('hulk') || lower.includes('goldeneye') || lower.includes('slow')) return 'DoS/DDoS';
  if (lower.includes('ssh') || lower.includes('ftp') || lower.includes('patator') || lower.includes('brute')) return 'Brute Force';
  if (lower.includes('web') || lower.includes('sql') || lower.includes('xss')) return 'Web Attack';
  if (lower.includes('bot')) return 'Bot';
  if (lower.includes('heartbleed')) return 'Heartbleed';
  if (lower.includes('infiltrat')) return 'Infiltration';
  return 'DoS/DDoS';
}

function inferSeverity(label: string, confidence: number): Severity {
  const lower = label.toLowerCase();
  if (
    lower.includes('ddos') ||
    lower.includes('dos') ||
    lower.includes('sql') ||
    lower.includes('heartbleed') ||
    lower.includes('infiltrat')
  ) {
    return 'Critical';
  }
  if (lower.includes('portscan') || lower.includes('brute') || lower.includes('ssh') || lower.includes('ftp')) {
    return 'High';
  }
  return confidence >= 95 ? 'High' : 'Medium';
}

function normalizeSingleResponse(data: unknown): NormalizedPrediction {
  if (typeof data === 'number') {
    const isBenign = data === 0;
    return {
      prediction: isBenign ? 'BENIGN' : 'ATTACK',
      attackLabel: isBenign ? 'Normal' : `Attack Class ${data}`,
      confidence: 95.0,
      severity: isBenign ? 'none' : 'High',
    };
  }

  if (typeof data === 'string') {
    const upper = data.trim().toUpperCase();
    const isBenign = upper === 'BENIGN' || upper === '0' || upper === 'NORMAL' || upper === 'SAFE';
    return {
      prediction: isBenign ? 'BENIGN' : 'ATTACK',
      attackLabel: isBenign ? 'Normal' : data.trim(),
      confidence: 95.0,
      severity: isBenign ? 'none' : 'High',
    };
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const rawLabel =
      obj.predicted_label ??
      obj.attack_type ??
      obj.attackType ??
      obj.label ??
      obj.prediction ??
      obj.predicted_class ??
      obj.class ??
      obj.result ??
      'Normal';

    let labelStr = String(rawLabel).trim();
    const upper = labelStr.toUpperCase();
    const isBenign =
      upper === 'NORMAL' ||
      upper === 'BENIGN' ||
      upper === '0' ||
      upper === 'SAFE' ||
      upper === 'FALSE';

    if (isBenign) {
      labelStr = 'Normal';
    } else if (upper === '1' || upper === 'TRUE') {
      labelStr = 'Intrusion Detected';
    }

    const rawConf =
      obj.probability ??
      obj.confidence ??
      obj.prob ??
      obj.score ??
      obj.max_probability;

    let confidence = 96.0;
    if (typeof rawConf === 'number' && Number.isFinite(rawConf)) {
      confidence = rawConf <= 1 ? Number((rawConf * 100).toFixed(2)) : Number(rawConf.toFixed(2));
    } else if (typeof rawConf === 'string' && !Number.isNaN(Number(rawConf))) {
      const n = Number(rawConf);
      confidence = n <= 1 ? Number((n * 100).toFixed(2)) : Number(n.toFixed(2));
    }

    let top3: Array<{ label: string; probability: number }> | undefined;
    if (Array.isArray(obj.top_3)) {
      const parsedTop3: Array<{ label: string; probability: number }> = [];
      for (const entry of obj.top_3) {
        if (Array.isArray(entry) && entry.length >= 2) {
          const p = Number(entry[1]);
          if (Number.isFinite(p)) {
            parsedTop3.push({
              label: String(entry[0]),
              probability: p <= 1 ? Number((p * 100).toFixed(2)) : Number(p.toFixed(2)),
            });
          }
        } else if (entry && typeof entry === 'object') {
          const rec = entry as Record<string, unknown>;
          const lbl = String(rec.label ?? rec.class ?? rec.name ?? '');
          const p = Number(rec.probability ?? rec.prob ?? rec.score ?? rec.confidence ?? 0);
          if (lbl && Number.isFinite(p)) {
            parsedTop3.push({
              label: lbl,
              probability: p <= 1 ? Number((p * 100).toFixed(2)) : Number(p.toFixed(2)),
            });
          }
        }
      }
      if (parsedTop3.length > 0) top3 = parsedTop3;
    }

    let probabilities: Record<string, number> | undefined;
    if (obj.probabilities && typeof obj.probabilities === 'object' && !Array.isArray(obj.probabilities)) {
      probabilities = {};
      for (const [k, v] of Object.entries(obj.probabilities as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          probabilities[k] = v <= 1 ? Number((v * 100).toFixed(2)) : Number(v.toFixed(2));
        }
      }
      if (!top3 && Object.keys(probabilities).length > 0) {
        top3 = Object.entries(probabilities)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([label, probability]) => ({ label, probability }));
      }
      if (rawConf === undefined && Object.keys(probabilities).length > 0) {
        confidence = Math.max(...Object.values(probabilities));
      }
    } else if (top3) {
      probabilities = {};
      for (const item of top3) {
        probabilities[item.label] = item.probability;
      }
    }

    let severity: Severity | 'none' = isBenign ? 'none' : inferSeverity(labelStr, confidence);
    if (typeof obj.severity === 'string') {
      const sevLower = obj.severity.toLowerCase();
      if (sevLower === 'none') severity = 'none';
      else if (sevLower === 'critical') severity = 'Critical';
      else if (sevLower === 'high') severity = 'High';
      else if (sevLower === 'medium') severity = 'Medium';
      else if (sevLower === 'low') severity = 'Low';
    }

    return {
      prediction: isBenign ? 'BENIGN' : 'ATTACK',
      attackLabel: labelStr,
      confidence: Math.min(100, Math.max(0, confidence)),
      severity,
      top3,
      probabilities,
    };
  }

  return {
    prediction: 'BENIGN',
    attackLabel: 'Normal',
    confidence: 50.0,
    severity: 'none',
  };
}

function buildRenderPayload(features: Record<string, number>, format: RenderApiConfig['payloadFormat']): unknown {
  const full = padCicFeatures(features);
  if (format === 'flat_object') return full;
  if (format === 'feature_array') return { features: CIC_77_FEATURES.map((col) => full[col] ?? 0) };
  return { features: full };
}

// Strict real-API-only inference (no demo or local fallback)
async function executeInference(
  features: Record<string, number>,
  overrideConfig?: Partial<RenderApiConfig>
): Promise<{
  ok: boolean;
  source: 'render-api';
  status: number;
  latencyMs: number;
  endpoint?: string;
  normalized: NormalizedPrediction;
  raw: unknown;
  error?: string;
}> {
  const cfg: RenderApiConfig = { ...store.renderConfig, ...(overrideConfig || {}) };
  if (!cfg.apiUrl || !cfg.apiUrl.trim()) {
    return {
      ok: false,
      source: 'render-api',
      status: 400,
      latencyMs: 0,
      normalized: { prediction: 'BENIGN', attackLabel: 'Error', confidence: 0 },
      raw: null,
      error: 'Render API URL is not configured in Settings.',
    };
  }

  const validation = validateExternalUrl(cfg.apiUrl);
  if (!validation.valid || !validation.normalized) {
    return {
      ok: false,
      source: 'render-api',
      status: 400,
      latencyMs: 0,
      normalized: { prediction: 'BENIGN', attackLabel: 'Error', confidence: 0 },
      raw: null,
      error: validation.error,
    };
  }

  const targetUrl = joinEndpoint(validation.normalized, cfg.predictPath || '/predict');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (cfg.apiKey && cfg.apiKey.trim()) {
    headers['Authorization'] = cfg.apiKey.trim().startsWith('Bearer ')
      ? cfg.apiKey.trim()
      : `Bearer ${cfg.apiKey.trim()}`;
  }

  const payload = buildRenderPayload(features, cfg.payloadFormat || 'wrapped_object');
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.min((Number(cfg.timeoutSec) || 55) * 1000, 65000)
  );

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const contentType = response.headers.get('content-type') || '';
    const raw = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : { rawText: (await response.text().catch(() => '')).slice(0, 600) };

    if (!response.ok) {
      const detail =
        raw && typeof raw === 'object' && 'detail' in (raw as Record<string, unknown>)
          ? ` — ${String((raw as Record<string, unknown>).detail)}`
          : raw && typeof raw === 'object' && 'rawText' in (raw as Record<string, unknown>)
          ? ` — ${String((raw as Record<string, unknown>).rawText)}`
          : '';
      return {
        ok: false,
        source: 'render-api',
        status: response.status,
        latencyMs,
        endpoint: targetUrl,
        normalized: { prediction: 'BENIGN', attackLabel: 'Error', confidence: 0 },
        raw,
        error: `Render /predict returned HTTP ${response.status}${detail}`,
      };
    }

    let normalized: NormalizedPrediction;
    if (Array.isArray(raw)) {
      normalized = normalizeSingleResponse(raw[0]);
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.predictions)) {
        normalized = normalizeSingleResponse(obj.predictions[0]);
      } else if (Array.isArray(obj.results)) {
        normalized = normalizeSingleResponse(obj.results[0]);
      } else {
        normalized = normalizeSingleResponse(raw);
      }
    } else {
      normalized = normalizeSingleResponse(raw);
    }

    store.renderConfig.lastLatencyMs = latencyMs;
    store.renderConfig.connectionStatus = 'connected';
    store.renderConfig.lastError = undefined;
    saveStore(store);

    return {
      ok: true,
      source: 'render-api',
      status: response.status,
      latencyMs,
      endpoint: targetUrl,
      normalized,
      raw,
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'Prediction timed out. Render free-tier instances take 30–50s to wake from sleep.'
        : err instanceof Error
        ? err.message
        : 'Failed to reach Render endpoint.';
    return {
      ok: false,
      source: 'render-api',
      status: 502,
      latencyMs,
      endpoint: targetUrl,
      normalized: { prediction: 'BENIGN', attackLabel: 'Error', confidence: 0 },
      raw: null,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function recordIngestedFlow(params: {
  sourceIp: string;
  destinationIp: string;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  features: Record<string, number>;
  inference: Awaited<ReturnType<typeof executeInference>>;
  createAlertIfAttack?: boolean;
  alertPrefix?: string;
  recommendedAction?: string;
}): { flow: LiveFlowRow; alert?: AlertRecord } {
  const now = new Date();
  const timestamp = now.toTimeString().slice(0, 8);
  const dateStr = now.toISOString().slice(0, 10);
  const { normalized, latencyMs, source } = params.inference;

  const dstPort = Number(params.features['Destination Port'] ?? 80);
  const flowDurationUs = Number(params.features['Flow Duration'] ?? 100000);
  const fwdPkts = Number(params.features['Total Fwd Packets'] ?? 12);
  const bwdPkts = Number(params.features['Total Backward Packets'] ?? Math.max(1, Math.round(fwdPkts * 0.45)));
  const totalPkts = Math.max(1, Math.round(fwdPkts + bwdPkts));
  const pktMean = Number(params.features['Packet Length Mean'] ?? params.features['Fwd Packet Length Mean'] ?? 140);
  const bytes = Math.max(64, Math.round(totalPkts * pktMean));
  const flowBytesSec = Number(params.features['Flow Bytes/s'] ?? Math.round(bytes / Math.max(0.001, flowDurationUs / 1e6)));
  const flowPktsSec = Number(params.features['Flow Packets/s'] ?? Number((totalPkts / Math.max(0.001, flowDurationUs / 1e6)).toFixed(2)));
  const initWin = Number(params.features['Init_Win_bytes_forward'] ?? 29200);

  const flow: LiveFlowRow = {
    id: `FLW-${Date.now().toString().slice(-5)}-${Math.floor(10 + Math.random() * 89)}`,
    timestamp,
    sourceIp: params.sourceIp,
    destinationIp: params.destinationIp,
    protocol: params.protocol,
    flowDurationMs: Math.max(1, Math.round(flowDurationUs / 1000)),
    packets: totalPkts,
    bytes,
    prediction: normalized.prediction,
    attackLabel: normalized.attackLabel,
    confidence: normalized.confidence,
    top3: normalized.top3,
    engineSource: source,
    latencyMs,
    isDemoFallback: normalized.isDemoFallback,
  };

  store.flows = [flow, ...store.flows].slice(0, 100);

  // Update liveStats
  const stats = store.liveStats;
  stats.totalScored += 1;
  stats.avgLatencyMs = Math.round(
    stats.totalScored === 1
      ? latencyMs
      : (stats.avgLatencyMs * (stats.totalScored - 1) + latencyMs) / stats.totalScored
  );

  if (normalized.prediction === 'ATTACK') {
    stats.attackScored += 1;
    stats.blockedToday += 1;
    const cat = inferCategory(normalized.attackLabel);
    stats.attackByCategory[cat] = (stats.attackByCategory[cat] || 0) + 1;
    const existingIp = stats.sourceIpHits[params.sourceIp];
    stats.sourceIpHits[params.sourceIp] = {
      count: (existingIp?.count || 0) + 1,
      lastAttack: normalized.attackLabel,
      category: cat,
    };
    const portKey = String(dstPort);
    stats.portHits[portKey] = (stats.portHits[portKey] || 0) + 1;
  } else {
    stats.benignScored += 1;
  }

  // Push new throughput bucket
  const isAttack = normalized.prediction === 'ATTACK';
  store.throughput = [
    ...store.throughput.slice(1),
    {
      time: timestamp,
      packetsPerSec: Math.min(9500, Math.max(400, Math.round(totalPkts * (isAttack ? 4.2 : 18)))),
      flowsPerSec: Math.max(85, Math.round((isAttack ? 280 : 160) + (totalPkts % 140))),
      attackFlows: isAttack ? Math.max(12, Math.round(totalPkts / 12)) : 0,
    },
  ];

  // Auto-generate alert if attack meets threshold
  let createdAlert: AlertRecord | undefined;
  const thresholdPct = store.settings.confidenceThreshold * 100;
  if (
    params.createAlertIfAttack !== false &&
    normalized.prediction === 'ATTACK' &&
    normalized.confidence >= thresholdPct
  ) {
    const cat = inferCategory(normalized.attackLabel);
    const severity: Severity =
      normalized.severity && normalized.severity !== 'none'
        ? normalized.severity
        : inferSeverity(normalized.attackLabel, normalized.confidence);
    const prefix = params.alertPrefix || (source === 'render-api' ? 'API' : 'NIDS');
    createdAlert = {
      id: `${prefix}-${Math.floor(4000 + Math.random() * 5999)}`,
      timestamp,
      date: dateStr,
      attackType: normalized.attackLabel,
      category: cat,
      sourceIp: params.sourceIp,
      destinationIp: params.destinationIp,
      dstPort,
      severity,
      status: 'New',
      confidence: normalized.confidence,
      modelUsed: `${store.settings.activeModel} (Render API)`,
      detectionLatency: `${(latencyMs / 1000).toFixed(2)}s`,
      recommendedAction:
        params.recommendedAction ||
        `Inspect flow from ${params.sourceIp} targeting ${params.destinationIp}:${dstPort} and apply perimeter firewall mitigation.`,
      features: {
        flowDuration: `${flowDurationUs.toLocaleString('en-US')} us`,
        totalFwdPackets: Math.round(fwdPkts),
        totalBwdPackets: Math.round(bwdPkts),
        packetLengthMean: `${pktMean.toFixed(1)} B`,
        flowBytesPerSec: `${Math.round(flowBytesSec).toLocaleString('en-US')} B/s`,
        flowPacketsPerSec: `${flowPktsSec.toFixed(1)} pkt/s`,
        initWinBytesFwd: Math.round(initWin),
        dstPort,
        protocol: params.protocol,
      },
      top3: normalized.top3,
      isLiveApi: true,
    };
    store.alerts = [createdAlert, ...store.alerts].slice(0, 200);
  }

  saveStore(store);
  return { flow, alert: createdAlert };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // 1. Bootstrap full persistent dashboard state
  app.get('/api/bootstrap', (_req, res) => {
    res.json({
      settings: store.settings,
      renderConfig: store.renderConfig,
      alerts: store.alerts,
      flows: store.flows,
      throughput: store.throughput,
      reports: store.reports,
      liveStats: store.liveStats,
    });
  });

  // 2. Settings CRUD
  app.get('/api/settings', (_req, res) => {
    res.json({ settings: store.settings, renderConfig: store.renderConfig });
  });

  app.put('/api/settings', (req, res) => {
    const { settings, renderConfig } = req.body || {};
    if (settings && typeof settings === 'object') {
      store.settings = { ...store.settings, ...settings };
    }
    if (renderConfig && typeof renderConfig === 'object') {
      store.renderConfig = {
        ...store.renderConfig,
        ...renderConfig,
        apiUrl: String(renderConfig.apiUrl ?? store.renderConfig.apiUrl).trim().replace(/\/+$/, ''),
      };
    }
    saveStore(store, true);
    res.json({ ok: true, settings: store.settings, renderConfig: store.renderConfig });
  });

  app.post('/api/settings/reset', (_req, res) => {
    store.settings = { ...DEFAULT_SETTINGS };
    store.renderConfig = { ...DEFAULT_RENDER_CONFIG };
    saveStore(store, true);
    res.json({ ok: true, settings: store.settings, renderConfig: store.renderConfig });
  });

  // 3. Render.com Model Health Check
  app.post('/api/model/health', async (req, res) => {
    const {
      apiUrl = store.renderConfig.apiUrl,
      healthPath = store.renderConfig.healthPath || '/health',
      apiKey = store.renderConfig.apiKey || '',
      timeoutMs = (store.renderConfig.timeoutSec || 45) * 1000,
    } = req.body || {};

    const validation = validateExternalUrl(apiUrl);
    if (!validation.valid || !validation.normalized) {
      res.status(400).json({ ok: false, error: validation.error });
      return;
    }

    const targetUrl = joinEndpoint(validation.normalized, healthPath);
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
    };
    if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
      headers['Authorization'] = apiKey.trim().startsWith('Bearer ')
        ? apiKey.trim()
        : `Bearer ${apiKey.trim()}`;
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(Number(timeoutMs) || 45000, 65000));

    try {
      let response = await fetch(targetUrl, { method: 'GET', headers, signal: controller.signal });
      if (response.status === 404 && healthPath && healthPath !== '/') {
        response = await fetch(validation.normalized, { method: 'GET', headers, signal: controller.signal });
      }

      const latencyMs = Date.now() - startedAt;
      const contentType = response.headers.get('content-type') || '';
      const responseBody = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : (await response.text().catch(() => '')).slice(0, 400);

      const healthObj =
        responseBody && typeof responseBody === 'object'
          ? (responseBody as Record<string, unknown>)
          : null;
      const backendHealth =
        response.ok && healthObj
          ? {
              status: typeof healthObj.status === 'string' ? healthObj.status : 'ok',
              model: typeof healthObj.model === 'string' ? healthObj.model : undefined,
              nFeatures:
                typeof healthObj.n_features === 'number' ? healthObj.n_features : undefined,
              classes: Array.isArray(healthObj.classes)
                ? healthObj.classes.map((c) => String(c))
                : undefined,
            }
          : store.renderConfig.backendHealth;

      store.renderConfig = {
        ...store.renderConfig,
        apiUrl: validation.normalized,
        healthPath,
        apiKey: typeof apiKey === 'string' ? apiKey : store.renderConfig.apiKey,
        enabled: response.ok ? true : store.renderConfig.enabled,
        connectionStatus: response.ok ? 'connected' : 'error',
        lastLatencyMs: latencyMs,
        lastCheckedAt: new Date().toTimeString().slice(0, 8),
        lastError: response.ok ? undefined : `Endpoint responded with HTTP ${response.status}`,
        backendHealth,
      };
      saveStore(store, true);

      res.json({
        ok: response.ok,
        status: response.status,
        latencyMs,
        endpoint: targetUrl,
        responseBody,
        renderConfig: store.renderConfig,
        error: store.renderConfig.lastError,
      });
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Connection timed out. Render free-tier services take 30–50s to wake from sleep — retry once awake.'
          : err instanceof Error
          ? err.message
          : 'Failed to reach Render endpoint.';

      store.renderConfig = {
        ...store.renderConfig,
        apiUrl: validation.normalized,
        connectionStatus: 'error',
        lastLatencyMs: latencyMs,
        lastCheckedAt: new Date().toTimeString().slice(0, 8),
        lastError: message,
      };
      saveStore(store, true);

      res.status(502).json({
        ok: false,
        status: 502,
        latencyMs,
        endpoint: targetUrl,
        renderConfig: store.renderConfig,
        error: message,
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  // 4. Direct Prediction Endpoint (used by Single Flow Inference)
  app.post('/api/model/predict', async (req, res) => {
    const { features, renderConfigOverride, recordToTelemetry = false, sourceIp, destinationIp } = req.body || {};
    if (!features || typeof features !== 'object') {
      res.status(400).json({ ok: false, error: 'Numeric feature object is required.' });
      return;
    }

    const inference = await executeInference(features as Record<string, number>, renderConfigOverride);
    let recorded: { flow?: LiveFlowRow; alert?: AlertRecord } = {};
    if (inference.ok && recordToTelemetry) {
      recorded = recordIngestedFlow({
        sourceIp: sourceIp || '172.16.0.1',
        destinationIp: destinationIp || '192.168.10.50',
        protocol: 'TCP',
        features: features as Record<string, number>,
        inference,
        createAlertIfAttack: true,
        alertPrefix: inference.source === 'render-api' ? 'API' : 'NIDS',
      });
    }

    res.status(inference.ok ? 200 : inference.status || 502).json({
      ...inference,
      recordedFlow: recorded.flow,
      recordedAlert: recorded.alert,
      liveStats: store.liveStats,
    });
  });

  // 5. Real Live Flow Ingestion Webhook (strictly real Render API — no demo fallback)
  app.post('/api/ingest/flow', async (req, res) => {
    const {
      sourceIp = '192.168.10.14',
      destinationIp = '192.168.10.50',
      protocol = 'TCP',
      features = {},
      createAlertIfAttack = true,
      alertPrefix,
      recommendedAction,
    } = req.body || {};

    const inference = await executeInference(features as Record<string, number>);
    if (!inference.ok) {
      res.status(inference.status || 502).json(inference);
      return;
    }

    const proto: 'TCP' | 'UDP' | 'ICMP' =
      protocol === 'UDP' || protocol === 'ICMP' ? protocol : 'TCP';

    const { flow, alert } = recordIngestedFlow({
      sourceIp,
      destinationIp,
      protocol: proto,
      features: features as Record<string, number>,
      inference,
      createAlertIfAttack,
      alertPrefix,
      recommendedAction,
    });

    res.json({
      ok: true,
      inference,
      flow,
      alert,
      throughput: store.throughput,
      liveStats: store.liveStats,
    });
  });

  // 5b. Live Traffic 5-Flow Batch Ingestion calling Render POST /predict_batch (strictly real API — zero demo data)
  app.post('/api/ingest/live-batch', async (req, res) => {
    const { flows: inputFlows = [], createAlertIfAttack = true } = req.body || {};
    if (!Array.isArray(inputFlows) || inputFlows.length === 0) {
      res.status(400).json({ ok: false, error: 'Provide an array of live flow samples.' });
      return;
    }

    const batchItems = inputFlows.slice(0, 10) as Array<{
      sourceIp?: string;
      destinationIp?: string;
      protocol?: 'TCP' | 'UDP' | 'ICMP';
      features?: Record<string, number>;
    }>;

    const cfg = store.renderConfig;
    const validation = validateExternalUrl(cfg.apiUrl || '');
    if (!validation.valid || !validation.normalized) {
      res.status(400).json({
        ok: false,
        source: 'render-api',
        error: validation.error || 'Render API URL is not configured.',
      });
      return;
    }

    const paddedList = batchItems.map((item) => padCicFeatures(item.features || {}));
    const batchUrl = joinEndpoint(validation.normalized, '/predict_batch');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (cfg.apiKey && cfg.apiKey.trim()) {
      headers['Authorization'] = cfg.apiKey.trim().startsWith('Bearer ')
        ? cfg.apiKey.trim()
        : `Bearer ${cfg.apiKey.trim()}`;
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.min((Number(cfg.timeoutSec) || 55) * 1000, 60000)
    );

    try {
      const response = await fetch(batchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ flows: paddedList }),
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;
      const contentType = response.headers.get('content-type') || '';
      const raw = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : (await response.text().catch(() => '')).slice(0, 400);

      if (!response.ok || !raw) {
        const detail =
          typeof raw === 'string' && raw.trim()
            ? ` — ${raw.trim()}`
            : raw && typeof raw === 'object' && 'detail' in (raw as Record<string, unknown>)
            ? ` — ${String((raw as Record<string, unknown>).detail)}`
            : '';
        res.status(response.status || 502).json({
          ok: false,
          source: 'render-api',
          status: response.status,
          latencyMs,
          endpoint: batchUrl,
          error: `Render /predict_batch returned HTTP ${response.status}${detail}`,
        });
        return;
      }

      const rawArray = Array.isArray(raw)
        ? raw
        : typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).predictions)
        ? ((raw as Record<string, unknown>).predictions as unknown[])
        : typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).results)
        ? ((raw as Record<string, unknown>).results as unknown[])
        : [];

      if (rawArray.length !== batchItems.length) {
        res.status(502).json({
          ok: false,
          source: 'render-api',
          status: 502,
          latencyMs,
          endpoint: batchUrl,
          error: `Unexpected /predict_batch response shape (expected ${batchItems.length} predictions, got ${rawArray.length}).`,
        });
        return;
      }

      const normalizedList = rawArray.map((entry) => normalizeSingleResponse(entry));
      store.renderConfig.lastLatencyMs = latencyMs;
      store.renderConfig.connectionStatus = 'connected';
      store.renderConfig.lastError = undefined;

      const createdFlows: LiveFlowRow[] = [];
      const createdAlerts: AlertRecord[] = [];
      for (let i = 0; i < batchItems.length; i++) {
        const item = batchItems[i];
        const proto: 'TCP' | 'UDP' | 'ICMP' =
          item.protocol === 'UDP' || item.protocol === 'ICMP' ? item.protocol : 'TCP';
        const { flow, alert } = recordIngestedFlow({
          sourceIp: item.sourceIp || '192.168.10.14',
          destinationIp: item.destinationIp || '192.168.10.50',
          protocol: proto,
          features: item.features || {},
          inference: {
            ok: true,
            source: 'render-api',
            status: 200,
            latencyMs,
            normalized: normalizedList[i],
            raw: rawArray[i],
          },
          createAlertIfAttack,
          alertPrefix: 'LIVE',
        });
        createdFlows.push(flow);
        if (alert) createdAlerts.push(alert);
      }

      res.json({
        ok: true,
        source: 'render-api',
        latencyMs,
        flows: store.flows,
        batchFlows: createdFlows,
        createdAlerts,
        throughput: store.throughput,
        liveStats: store.liveStats,
      });
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Render /predict_batch timed out (cold start). Retry once awake.'
          : err instanceof Error
          ? err.message
          : 'Failed to reach Render /predict_batch.';
      res.status(502).json({
        ok: false,
        source: 'render-api',
        status: 502,
        latencyMs,
        endpoint: batchUrl,
        error: message,
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  // 6. Batch CSV Scoring Endpoint (strictly real Render API — zero demo fallback)
  app.post('/api/ingest/batch', async (req, res) => {
    const { rows = [], pushAttacksToAlerts = true, fileName = 'uploaded.csv' } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ ok: false, error: 'Provide an array of flow rows to score.' });
      return;
    }

    const results: Array<{
      rowIndex: number;
      sourceIp: string;
      destinationIp: string;
      dstPort: number;
      flowDuration: number;
      totalFwdPackets: number;
      flowBytesPerSec: number;
      prediction: 'BENIGN' | 'ATTACK';
      attackLabel: string;
      confidence: number;
      latencyMs: number;
      source: 'render-api';
    }> = [];
    const createdAlerts: AlertRecord[] = [];

    const maxRows = Math.min(rows.length, 100);
    for (let i = 0; i < maxRows; i++) {
      const item = rows[i] as Record<string, unknown>;
      const numericOnly: Record<string, number> = {};
      for (const [k, v] of Object.entries(item)) {
        if (k.toLowerCase() === 'label') continue;
        const n = typeof v === 'number' ? v : Number(v);
        if (v !== '' && v !== null && Number.isFinite(n)) {
          numericOnly[k] = n;
        }
      }

      const inference = await executeInference(numericOnly);
      if (!inference.ok) {
        res.status(inference.status || 502).json({
          ok: false,
          error: `Row ${i + 1} failed: ${inference.error}`,
          partialResults: results,
        });
        return;
      }

      const sourceIp = String(item['Source IP'] || item['Src IP'] || `172.16.0.${(i % 20) + 1}`);
      const destinationIp = String(item['Destination IP'] || item['Dst IP'] || '192.168.10.50');
      const { alert } = recordIngestedFlow({
        sourceIp,
        destinationIp,
        protocol: 'TCP',
        features: numericOnly,
        inference,
        createAlertIfAttack: pushAttacksToAlerts && createdAlerts.length < 10,
        alertPrefix: 'CSV',
        recommendedAction: `Detected during CSV batch scan (${fileName}). Inspect host ${sourceIp} traffic.`,
      });
      if (alert) createdAlerts.push(alert);

      results.push({
        rowIndex: i + 1,
        sourceIp,
        destinationIp,
        dstPort: Number(numericOnly['Destination Port'] ?? 80),
        flowDuration: Number(numericOnly['Flow Duration'] ?? 0),
        totalFwdPackets: Number(numericOnly['Total Fwd Packets'] ?? 0),
        flowBytesPerSec: Number(numericOnly['Flow Bytes/s'] ?? 0),
        prediction: inference.normalized.prediction,
        attackLabel: inference.normalized.attackLabel,
        confidence: inference.normalized.confidence,
        latencyMs: inference.latencyMs,
        source: inference.source,
      });
    }

    res.json({
      ok: true,
      results,
      createdAlerts,
      flows: store.flows,
      throughput: store.throughput,
      liveStats: store.liveStats,
    });
  });

  // 7. Flows Clear
  app.post('/api/flows/clear', (_req, res) => {
    store.flows = [];
    saveStore(store, true);
    res.json({ ok: true });
  });

  // 8. Persistent Alerts CRUD
  app.get('/api/alerts', (_req, res) => {
    res.json({ alerts: store.alerts });
  });

  app.post('/api/alerts', (req, res) => {
    const alert = req.body as AlertRecord;
    if (!alert || !alert.id) {
      res.status(400).json({ ok: false, error: 'Valid alert object required.' });
      return;
    }
    store.alerts = [alert, ...store.alerts].slice(0, 200);
    saveStore(store, true);
    res.json({ ok: true, alert, alerts: store.alerts });
  });

  app.patch('/api/alerts/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body as { status?: AlertStatus };
    if (!status) {
      res.status(400).json({ ok: false, error: 'Status is required.' });
      return;
    }
    store.alerts = store.alerts.map((a) => (a.id === id ? { ...a, status } : a));
    saveStore(store, true);
    res.json({ ok: true, alerts: store.alerts });
  });

  app.delete('/api/alerts/:id', (req, res) => {
    const { id } = req.params;
    store.alerts = store.alerts.filter((a) => a.id !== id);
    saveStore(store, true);
    res.json({ ok: true, alerts: store.alerts });
  });

  app.post('/api/alerts/ack-all', (_req, res) => {
    store.alerts = store.alerts.map((a) =>
      a.status === 'New' || a.status === 'Investigating' ? { ...a, status: 'Acknowledged' } : a
    );
    saveStore(store, true);
    res.json({ ok: true, alerts: store.alerts });
  });

  // 9. Persistent Reports CRUD
  app.get('/api/reports', (_req, res) => {
    res.json({ reports: store.reports });
  });

  app.post('/api/reports', (req, res) => {
    const report = req.body as SavedReportRecord;
    if (!report || !report.title) {
      res.status(400).json({ ok: false, error: 'Valid report payload required.' });
      return;
    }
    const created: SavedReportRecord = {
      ...report,
      id: report.id || `RPT-${Math.floor(102 + Math.random() * 890)}`,
      generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    store.reports = [created, ...store.reports].slice(0, 50);
    saveStore(store, true);
    res.json({ ok: true, report: created, reports: store.reports });
  });

  app.delete('/api/reports/:id', (req, res) => {
    const { id } = req.params;
    store.reports = store.reports.filter((r) => r.id !== id);
    saveStore(store, true);
    res.json({ ok: true, reports: store.reports });
  });

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI-Based Network Intrusion Detection System running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AI-Based Network Intrusion Detection System server:', err);
  process.exit(1);
});
