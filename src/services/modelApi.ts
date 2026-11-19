import {
  AlertRecord,
  AlertStatus,
  AppSettings,
  AttackCategory,
  BatchScoredRow,
  InferenceResponse,
  LiveFlowRow,
  LiveSessionStats,
  LiveThroughputPoint,
  NormalizedPrediction,
  RenderApiConfig,
  SavedReportRecord,
  Severity,
} from '../types/nids';
import { padCicFeatures } from '../data/cicFeatureSchema';

export const API_BASE = 'https://sentinel-ai-nids-backend.onrender.com';
export const DEFAULT_RENDER_API_URL = API_BASE;
const MODEL_REQUEST_TIMEOUT_MS = 90_000;

export const DEFAULT_RENDER_CONFIG: RenderApiConfig = {
  enabled: true,
  apiUrl: DEFAULT_RENDER_API_URL,
  healthPath: '/health',
  predictPath: '/predict',
  payloadFormat: 'wrapped_object',
  timeoutSec: 90,
  apiKey: '',
  connectionStatus: 'disconnected',
};

export interface FlowPreset {
  id: string;
  name: string;
  expected: string;
  sourceIp: string;
  destinationIp: string;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  features: Record<string, number>;
}

export const CIC_FLOW_PRESETS: FlowPreset[] = [
  {
    id: 'benign-https',
    name: 'Normal — Standard HTTPS Session',
    expected: 'Normal',
    sourceIp: '192.168.10.14',
    destinationIp: '172.217.10.46',
    protocol: 'TCP',
    features: {
      'Destination Port': 443,
      'Flow Duration': 185420,
      'Total Fwd Packets': 12,
      'Total Backward Packets': 14,
      'Total Length of Fwd Packets': 1840,
      'Total Length of Bwd Packets': 6420,
      'Fwd Packet Length Mean': 153.3,
      'Bwd Packet Length Std': 210.4,
      'Flow Bytes/s': 44547.5,
      'Flow Packets/s': 140.2,
      'Flow IAT Mean': 7416.8,
      'SYN Flag Count': 1,
      'ACK Flag Count': 1,
      'Init_Win_bytes_forward': 29200,
      'Packet Length Mean': 305.9,
    },
  },
  {
    id: 'dos-hulk',
    name: 'DoS/DDoS — High-Rate HTTP Flood',
    expected: 'DoS/DDoS',
    sourceIp: '172.16.0.1',
    destinationIp: '192.168.10.50',
    protocol: 'TCP',
    features: {
      'Destination Port': 80,
      'Flow Duration': 1124510,
      'Total Fwd Packets': 924,
      'Total Backward Packets': 410,
      'Total Length of Fwd Packets': 289027,
      'Total Length of Bwd Packets': 128420,
      'Fwd Packet Length Mean': 312.8,
      'Bwd Packet Length Std': 492.6,
      'Flow Bytes/s': 371200.0,
      'Flow Packets/s': 1186.3,
      'Flow IAT Mean': 843.6,
      'SYN Flag Count': 1,
      'ACK Flag Count': 1,
      'Init_Win_bytes_forward': 29200,
      'Packet Length Mean': 312.8,
    },
  },
  {
    id: 'portscan-nmap',
    name: 'PortScan — nmap TCP SYN Probe',
    expected: 'PortScan',
    sourceIp: '172.16.0.1',
    destinationIp: '192.168.10.50',
    protocol: 'TCP',
    features: {
      'Destination Port': 22,
      'Flow Duration': 48,
      'Total Fwd Packets': 2,
      'Total Backward Packets': 1,
      'Total Length of Fwd Packets': 88,
      'Total Length of Bwd Packets': 44,
      'Fwd Packet Length Mean': 44.0,
      'Bwd Packet Length Std': 0.0,
      'Flow Bytes/s': 2750000.0,
      'Flow Packets/s': 62500.0,
      'Flow IAT Mean': 24.0,
      'SYN Flag Count': 1,
      'ACK Flag Count': 0,
      'Init_Win_bytes_forward': 1024,
      'Packet Length Mean': 44.0,
    },
  },
  {
    id: 'ssh-patator',
    name: 'BruteForce — SSH-Patator',
    expected: 'BruteForce',
    sourceIp: '172.16.0.1',
    destinationIp: '192.168.10.50',
    protocol: 'TCP',
    features: {
      'Destination Port': 22,
      'Flow Duration': 12480310,
      'Total Fwd Packets': 24,
      'Total Backward Packets': 32,
      'Total Length of Fwd Packets': 3422,
      'Total Length of Bwd Packets': 4560,
      'Fwd Packet Length Mean': 142.6,
      'Bwd Packet Length Std': 198.2,
      'Flow Bytes/s': 639.5,
      'Flow Packets/s': 4.48,
      'Flow IAT Mean': 226914.7,
      'SYN Flag Count': 1,
      'ACK Flag Count': 1,
      'Init_Win_bytes_forward': 29200,
      'Packet Length Mean': 142.6,
    },
  },
  {
    id: 'web-sqli',
    name: 'WebAttack — SQL Injection Probe',
    expected: 'WebAttack',
    sourceIp: '172.16.0.12',
    destinationIp: '192.168.10.50',
    protocol: 'TCP',
    features: {
      'Destination Port': 80,
      'Flow Duration': 6420180,
      'Total Fwd Packets': 8,
      'Total Backward Packets': 6,
      'Total Length of Fwd Packets': 2140,
      'Total Length of Bwd Packets': 1890,
      'Fwd Packet Length Mean': 267.5,
      'Bwd Packet Length Std': 144.2,
      'Flow Bytes/s': 627.7,
      'Flow Packets/s': 2.18,
      'Flow IAT Mean': 493860.0,
      'SYN Flag Count': 1,
      'ACK Flag Count': 1,
      'Init_Win_bytes_forward': 29200,
      'Packet Length Mean': 287.8,
    },
  },
];

export interface BootstrapResponse {
  settings: AppSettings;
  renderConfig: RenderApiConfig;
  alerts: AlertRecord[];
  flows: LiveFlowRow[];
  throughput: LiveThroughputPoint[];
  reports: SavedReportRecord[];
  liveStats: LiveSessionStats;
}

const BROWSER_STATE_KEY = 'sentinel-nids-dashboard-state';

const DEFAULT_BROWSER_STATE: BootstrapResponse = {
  settings: {
    activeModel: 'XGBoost',
    confidenceThreshold: 0.8,
    alertSensitivity: 'High',
    emailAlerts: true,
    soundAlerts: false,
    theme: 'light',
    refreshIntervalSec: 2,
  },
  renderConfig: { ...DEFAULT_RENDER_CONFIG },
  alerts: [],
  flows: [],
  throughput: [],
  reports: [],
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

function readBrowserState(): BootstrapResponse {
  const serialized = window.localStorage.getItem(BROWSER_STATE_KEY);
  if (!serialized) return structuredClone(DEFAULT_BROWSER_STATE);

  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error("Saved dashboard data is invalid. Clear this site's local storage and retry.");
  }
  const saved = parsed as Partial<BootstrapResponse>;
  return {
    ...DEFAULT_BROWSER_STATE,
    ...saved,
    settings: { ...DEFAULT_BROWSER_STATE.settings, ...(saved.settings || {}) },
    renderConfig: { ...DEFAULT_RENDER_CONFIG, ...(saved.renderConfig || {}) },
    alerts: Array.isArray(saved.alerts) ? saved.alerts : [],
    flows: Array.isArray(saved.flows) ? saved.flows : [],
    throughput: Array.isArray(saved.throughput) ? saved.throughput : [],
    reports: Array.isArray(saved.reports) ? saved.reports : [],
    liveStats: { ...DEFAULT_BROWSER_STATE.liveStats, ...(saved.liveStats || {}) },
  };
}

function writeBrowserState(state: BootstrapResponse): void {
  window.localStorage.setItem(BROWSER_STATE_KEY, JSON.stringify(state));
}

export async function fetchBootstrapState(): Promise<BootstrapResponse> {
  return readBrowserState();
}

export async function persistSettingsAndRenderConfig(
  settings: AppSettings,
  renderConfig: RenderApiConfig
): Promise<{ ok: boolean; settings: AppSettings; renderConfig: RenderApiConfig }> {
  const state = readBrowserState();
  state.settings = settings;
  state.renderConfig = renderConfig;
  writeBrowserState(state);
  return { ok: true, settings, renderConfig };
}

export async function resetBackendSettings(): Promise<{
  ok: boolean;
  settings: AppSettings;
  renderConfig: RenderApiConfig;
}> {
  const state = readBrowserState();
  state.settings = { ...DEFAULT_BROWSER_STATE.settings };
  state.renderConfig = { ...DEFAULT_RENDER_CONFIG };
  writeBrowserState(state);
  return { ok: true, settings: state.settings, renderConfig: state.renderConfig };
}

async function fetchModelJson(
  path: string,
  init?: RequestInit,
  config?: RenderApiConfig
): Promise<{ data: Record<string, unknown> | unknown[]; status: number; latencyMs: number }> {
  const controller = new AbortController();
  const timeoutMs = Math.max(MODEL_REQUEST_TIMEOUT_MS, (config?.timeoutSec || 90) * 1000);
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    });
    const body = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error(
        `Backend returned non-JSON from ${path} (HTTP ${response.status}): ${body.slice(0, 180)}`
      );
    }

    if (!response.ok) {
      const detail =
        data && typeof data === 'object'
          ? String((data as Record<string, unknown>).detail ?? (data as Record<string, unknown>).error ?? '')
          : '';
      throw new Error(`Backend ${path} returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    if (!data || typeof data !== 'object') {
      throw new Error(`Backend ${path} returned an unexpected JSON response.`);
    }

    return {
      data: data as Record<string, unknown> | unknown[],
      status: response.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Backend ${path} timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function asProbability(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.min(100, Math.max(0, numeric <= 1 ? numeric * 100 : numeric));
}

function normalizeModelPrediction(value: unknown): NormalizedPrediction {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { predicted_label: value };
  const rawLabel =
    raw.predicted_label ??
    raw.attack_type ??
    raw.attackType ??
    raw.label ??
    raw.prediction ??
    raw.predicted_class ??
    raw.class ??
    raw.result;
  const label = String(rawLabel ?? '').trim();
  if (!label) throw new Error('Backend prediction did not include a predicted label.');

  const isNormal = label.toLowerCase() === 'normal';
  const attackLabel = isNormal ? 'Normal' : label;
  const probabilities: Record<string, number> = {};
  const rawProbabilities = raw.probabilities;
  if (rawProbabilities && typeof rawProbabilities === 'object' && !Array.isArray(rawProbabilities)) {
    for (const [classLabel, probability] of Object.entries(
      rawProbabilities as Record<string, unknown>
    )) {
      const normalized = asProbability(probability);
      if (normalized !== undefined) probabilities[classLabel] = normalized;
    }
  }

  const rawTop = raw.top_3 ?? raw.top3;
  if (Array.isArray(rawTop)) {
    for (const item of rawTop) {
      if (Array.isArray(item) && item.length > 1) {
        const probability = asProbability(item[1]);
        if (probability !== undefined) probabilities[String(item[0])] = probability;
      } else if (item && typeof item === 'object') {
        const score = item as Record<string, unknown>;
        const probability = asProbability(
          score.probability ?? score.prob ?? score.score ?? score.confidence
        );
        if (probability !== undefined) {
          probabilities[String(score.label ?? score.class ?? score.name ?? 'Unknown')] = probability;
        }
      }
    }
  }

  const top3 = Object.entries(probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([classLabel, probability]) => ({ label: classLabel, probability }));
  const confidence =
    asProbability(raw.probability ?? raw.confidence ?? raw.prob ?? raw.score ?? raw.max_probability) ??
    probabilities[attackLabel] ??
    top3[0]?.probability ??
    0;

  return {
    prediction: isNormal ? 'BENIGN' : 'ATTACK',
    attackLabel,
    confidence,
    severity: isNormal ? 'none' : inferSeverityFromAttack(attackLabel, confidence),
    top3: top3.length > 0 ? top3 : undefined,
    probabilities: Object.keys(probabilities).length > 0 ? probabilities : undefined,
  };
}

function buildPredictionRecords(
  input: {
    sourceIp: string;
    destinationIp: string;
    protocol: 'TCP' | 'UDP' | 'ICMP';
    features: Record<string, number>;
  },
  normalized: NormalizedPrediction,
  latencyMs: number,
  alertPrefix = 'API',
  recommendedAction?: string
): { flow: LiveFlowRow; alert?: AlertRecord } {
  const now = new Date();
  const timestamp = now.toTimeString().slice(0, 8);
  const flowDurationUs = Number(input.features['Flow Duration'] ?? 100000);
  const fwdPackets = Number(input.features['Total Fwd Packets'] ?? 12);
  const bwdPackets = Number(input.features['Total Backward Packets'] ?? Math.max(1, Math.round(fwdPackets * 0.45)));
  const totalPackets = Math.max(1, Math.round(fwdPackets + bwdPackets));
  const packetLengthMean = Number(
    input.features['Packet Length Mean'] ?? input.features['Fwd Packet Length Mean'] ?? 140
  );
  const dstPort = Number(input.features['Destination Port'] ?? 80);

  const flow: LiveFlowRow = {
    id: `FLW-${Date.now().toString().slice(-5)}-${Math.floor(10 + Math.random() * 89)}`,
    timestamp,
    sourceIp: input.sourceIp,
    destinationIp: input.destinationIp,
    protocol: input.protocol,
    flowDurationMs: Math.max(1, Math.round(flowDurationUs / 1000)),
    packets: totalPackets,
    bytes: Math.max(64, Math.round(totalPackets * packetLengthMean)),
    prediction: normalized.prediction,
    attackLabel: normalized.attackLabel,
    confidence: normalized.confidence,
    top3: normalized.top3,
    engineSource: 'render-api',
    latencyMs,
  };

  if (normalized.prediction !== 'ATTACK' || normalized.confidence < 80) return { flow };

  const alert: AlertRecord = {
    id: `${alertPrefix}-${Math.floor(4000 + Math.random() * 5999)}`,
    timestamp,
    date: now.toISOString().slice(0, 10),
    attackType: normalized.attackLabel,
    category: inferAttackCategory(normalized.attackLabel),
    sourceIp: input.sourceIp,
    destinationIp: input.destinationIp,
    dstPort,
    severity:
      normalized.severity && normalized.severity !== 'none'
        ? normalized.severity
        : inferSeverityFromAttack(normalized.attackLabel, normalized.confidence),
    status: 'New',
    confidence: normalized.confidence,
    modelUsed: 'XGBoost (Render API)',
    detectionLatency: `${(latencyMs / 1000).toFixed(2)}s`,
    recommendedAction:
      recommendedAction ??
      `Inspect flow from ${input.sourceIp} targeting ${input.destinationIp}:${dstPort} and apply perimeter firewall mitigation.`,
    features: {
      flowDuration: `${flowDurationUs.toLocaleString('en-US')} us`,
      totalFwdPackets: Math.round(fwdPackets),
      totalBwdPackets: Math.round(bwdPackets),
      packetLengthMean: `${packetLengthMean.toFixed(1)} B`,
      flowBytesPerSec: `${Math.round(Number(input.features['Flow Bytes/s'] ?? 0)).toLocaleString('en-US')} B/s`,
      flowPacketsPerSec: `${Number(input.features['Flow Packets/s'] ?? 0).toFixed(1)} pkt/s`,
      initWinBytesFwd: Number(input.features['Init_Win_bytes_forward'] ?? 29200),
      dstPort,
      protocol: input.protocol,
    },
    top3: normalized.top3,
    isLiveApi: true,
  };
  return { flow, alert };
}

export async function testRenderConnection(config: RenderApiConfig): Promise<{
  ok: boolean;
  status: number;
  latencyMs: number;
  endpoint?: string;
  responseBody?: unknown;
  renderConfig?: RenderApiConfig;
  error?: string;
}> {
  const startedAt = Date.now();
  try {
    const [{ data: rawHealth, status }, { data: rawLabelsResponse }] = await Promise.all([
      fetchModelJson('/health', undefined, config),
      fetchModelJson('/labels', undefined, config),
    ]);
    if (Array.isArray(rawHealth)) throw new Error('Backend /health returned an unexpected JSON array.');
    const health = rawHealth as Record<string, unknown>;
    const rawLabels = Array.isArray(rawLabelsResponse)
      ? rawLabelsResponse
      : rawLabelsResponse.labels ?? rawLabelsResponse.classes ?? rawLabelsResponse;
    const classes = Array.isArray(rawLabels)
      ? rawLabels.map(String)
      : Array.isArray(health.classes)
      ? health.classes.map(String)
      : undefined;
    const isHealthy = String(health.status ?? '').toLowerCase() === 'ok';
    const checkedAt = new Date().toTimeString().slice(0, 8);

    return {
      ok: isHealthy,
      status,
      latencyMs: Date.now() - startedAt,
      endpoint: `${API_BASE}/health`,
      responseBody: health,
      error: isHealthy ? undefined : `Unexpected backend health status: ${String(health.status ?? 'unknown')}`,
      renderConfig: {
        ...config,
        apiUrl: API_BASE,
        enabled: isHealthy,
        connectionStatus: isHealthy ? 'connected' : 'error',
        lastLatencyMs: Date.now() - startedAt,
        lastCheckedAt: checkedAt,
        lastError: isHealthy ? undefined : `Unexpected backend health status: ${String(health.status ?? 'unknown')}`,
        backendHealth: {
          status: String(health.status ?? ''),
          model: typeof health.model === 'string' ? health.model : undefined,
          nFeatures: typeof health.n_features === 'number' ? health.n_features : undefined,
          classes,
        },
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      endpoint: `${API_BASE}/health`,
      error: error instanceof Error ? error.message : 'Unable to reach the Render backend.',
    };
  }
}

export async function runModelPrediction(
  config: RenderApiConfig,
  features: Record<string, number>,
  options?: {
    recordToTelemetry?: boolean;
    sourceIp?: string;
    destinationIp?: string;
    protocol?: 'TCP' | 'UDP' | 'ICMP';
    alertPrefix?: string;
    createAlertIfAttack?: boolean;
    recommendedAction?: string;
  }
): Promise<InferenceResponse> {
  const startedAt = Date.now();
  try {
    const { data: rawData, status, latencyMs } = await fetchModelJson(
      '/predict',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: padCicFeatures(features) }),
      },
      config
    );
    const data = Array.isArray(rawData)
      ? { predictions: rawData }
      : (rawData as Record<string, unknown>);
    const responseBody = Array.isArray(data.predictions) ? data.predictions[0] : data;
    const normalized = normalizeModelPrediction(responseBody);
    const result: InferenceResponse = {
      ok: true,
      source: 'render-api',
      status,
      latencyMs,
      endpoint: `${API_BASE}/predict`,
      normalized,
      raw: data,
    };

    if (options?.recordToTelemetry !== false) {
      const { flow, alert } = buildPredictionRecords(
        {
          sourceIp: options?.sourceIp ?? '192.168.10.14',
          destinationIp: options?.destinationIp ?? '192.168.10.50',
          protocol: options?.protocol ?? 'TCP',
          features,
        },
        normalized,
        latencyMs,
        options?.alertPrefix,
        options?.recommendedAction
      );
      result.recordedFlow = flow;
      if (options?.createAlertIfAttack !== false) result.recordedAlert = alert;
    }

    return result;
  } catch (error) {
    return {
      ok: false,
      source: 'render-api',
      status: 0,
      latencyMs: Date.now() - startedAt,
      endpoint: `${API_BASE}/predict`,
      normalized: { prediction: 'ATTACK', attackLabel: 'Error', confidence: 0 },
      error: error instanceof Error ? error.message : 'Unable to reach the Render prediction API.',
    };
  }
}

export async function ingestLiveFlow(payload: {
  sourceIp: string;
  destinationIp: string;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  features: Record<string, number>;
  createAlertIfAttack?: boolean;
  alertPrefix?: string;
  recommendedAction?: string;
}): Promise<{
  ok: boolean;
  inference: InferenceResponse;
  flow?: LiveFlowRow;
  alert?: AlertRecord;
  throughput?: LiveThroughputPoint[];
  liveStats?: LiveSessionStats;
  warning?: string;
  isDemoFallback?: boolean;
  error?: string;
}> {
  const inference = await runModelPrediction(
    DEFAULT_RENDER_CONFIG,
    payload.features,
    {
      recordToTelemetry: true,
      sourceIp: payload.sourceIp,
      destinationIp: payload.destinationIp,
      protocol: payload.protocol,
      alertPrefix: payload.alertPrefix,
      createAlertIfAttack: payload.createAlertIfAttack,
      recommendedAction: payload.recommendedAction,
    }
  );
  return {
    ok: inference.ok,
    inference,
    flow: inference.recordedFlow,
    alert: inference.recordedAlert,
    throughput: [],
    error: inference.error,
  };
}

function getPredictionItems(data: Record<string, unknown> | unknown[]): unknown[] {
  if (Array.isArray(data)) return data;
  const response = data as Record<string, unknown>;
  if (Array.isArray(response.predictions)) return response.predictions;
  if (Array.isArray(response.results)) return response.results;
  throw new Error('Backend batch prediction response did not contain predictions.');
}

export async function ingestLiveBatch(payload: {
  flows: Array<{
    sourceIp: string;
    destinationIp: string;
    protocol: 'TCP' | 'UDP' | 'ICMP';
    features: Record<string, number>;
  }>;
  createAlertIfAttack?: boolean;
}): Promise<{
  ok: boolean;
  source: 'render-api';
  latencyMs: number;
  flows: LiveFlowRow[];
  createdAlerts: AlertRecord[];
  throughput: LiveThroughputPoint[];
  liveStats?: LiveSessionStats;
  error?: string;
}> {
  const startedAt = Date.now();
  try {
    const { data, latencyMs } = await fetchModelJson('/predict_batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flows: payload.flows.map((flow) => padCicFeatures(flow.features)) }),
    });
    const items = getPredictionItems(data);
    if (items.length !== payload.flows.length) {
      throw new Error(
        `Backend returned ${items.length} predictions for ${payload.flows.length} flows.`
      );
    }

    const created = payload.flows.map((input, index) => {
      const normalized = normalizeModelPrediction(items[index]);
      return buildPredictionRecords(input, normalized, latencyMs, 'LIVE');
    });
    return {
      ok: true,
      source: 'render-api',
      latencyMs,
      flows: created.map((item) => item.flow),
      createdAlerts:
        payload.createAlertIfAttack === false
          ? []
          : created.flatMap((item) => (item.alert ? [item.alert] : [])),
      throughput: [],
    };
  } catch (error) {
    return {
      ok: false,
      source: 'render-api',
      latencyMs: Date.now() - startedAt,
      flows: [],
      createdAlerts: [],
      throughput: [],
      error: error instanceof Error ? error.message : 'Unable to reach the Render batch prediction API.',
    };
  }
}

export async function ingestBatchCsvRows(payload: {
  rows: Record<string, string | number>[];
  pushAttacksToAlerts: boolean;
  fileName: string;
}): Promise<{
  ok: boolean;
  results?: BatchScoredRow[];
  partialResults?: BatchScoredRow[];
  createdAlerts?: AlertRecord[];
  flows?: LiveFlowRow[];
  throughput?: LiveThroughputPoint[];
  liveStats?: LiveSessionStats;
  warning?: string;
  error?: string;
}> {
  try {
    const inputs = payload.rows.map((row, index) => {
      const features: Record<string, number> = {};
      for (const [key, value] of Object.entries(row)) {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (key.toLowerCase() !== 'label' && Number.isFinite(numeric)) features[key] = numeric;
      }
      return {
        sourceIp: String(row['Source IP'] ?? row['Src IP'] ?? `192.168.10.${20 + (index % 200)}`),
        destinationIp: String(row['Destination IP'] ?? row['Dst IP'] ?? '192.168.10.50'),
        protocol: 'TCP' as const,
        features,
      };
    });
    const { data, latencyMs } = await fetchModelJson('/predict_batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flows: inputs.map((input) => padCicFeatures(input.features)) }),
    });
    const predictions = getPredictionItems(data);
    if (predictions.length !== inputs.length) {
      throw new Error(`Backend returned ${predictions.length} predictions for ${inputs.length} rows.`);
    }

    const records = inputs.map((input, index) => {
      const normalized = normalizeModelPrediction(predictions[index]);
      return {
        normalized,
        ...buildPredictionRecords(
          input,
          normalized,
          latencyMs,
          'CSV',
          `Scored from ${payload.fileName}; review flow from ${input.sourceIp}.`
        ),
      };
    });
    const results: BatchScoredRow[] = records.map(({ normalized, flow }, index) => ({
      rowIndex: index + 1,
      sourceIp: flow.sourceIp,
      destinationIp: flow.destinationIp,
      dstPort: Number(inputs[index].features['Destination Port'] ?? 80),
      flowDuration: Number(inputs[index].features['Flow Duration'] ?? 0),
      totalFwdPackets: Number(inputs[index].features['Total Fwd Packets'] ?? 0),
      flowBytesPerSec: Number(inputs[index].features['Flow Bytes/s'] ?? 0),
      prediction: normalized.prediction,
      attackLabel: normalized.attackLabel,
      confidence: normalized.confidence,
      latencyMs,
      source: 'render-api',
      top3: normalized.top3,
    }));

    return {
      ok: true,
      results,
      flows: records.map((item) => item.flow),
      createdAlerts: payload.pushAttacksToAlerts
        ? records.flatMap((item) => (item.alert ? [item.alert] : []))
        : [],
      throughput: [],
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to score the uploaded rows.',
      partialResults: [],
      throughput: [],
    };
  }
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...incoming, ...current.filter((item) => !incomingIds.has(item.id))];
}

export function persistTelemetryState(payload: {
  flow?: LiveFlowRow;
  flows?: LiveFlowRow[];
  alert?: AlertRecord;
  alerts?: AlertRecord[];
  throughput?: LiveThroughputPoint[];
  liveStats?: LiveSessionStats;
}): void {
  const state = readBrowserState();
  const incomingFlows = payload.flows ?? (payload.flow ? [payload.flow] : []);
  const incomingAlerts = payload.alerts ?? (payload.alert ? [payload.alert] : []);
  if (incomingFlows.length > 0) state.flows = mergeById(state.flows, incomingFlows).slice(0, 80);
  if (incomingAlerts.length > 0) state.alerts = mergeById(state.alerts, incomingAlerts).slice(0, 200);
  if (payload.throughput?.length) state.throughput = payload.throughput;
  else if (incomingFlows.length > 0) {
    const attacks = incomingFlows.filter((flow) => flow.prediction === 'ATTACK');
    const attackByCategory = { ...state.liveStats.attackByCategory };
    const sourceIpHits = { ...state.liveStats.sourceIpHits };
    attacks.forEach((flow) => {
      const category = inferAttackCategory(flow.attackLabel);
      attackByCategory[category] = (attackByCategory[category] ?? 0) + 1;
      const source = sourceIpHits[flow.sourceIp];
      sourceIpHits[flow.sourceIp] = {
        count: (source?.count ?? 0) + 1,
        lastAttack: flow.attackLabel,
        category,
      };
    });
    const total = state.liveStats.totalScored + incomingFlows.length;
    const latencyTotal = incomingFlows.reduce((sum, flow) => sum + (flow.latencyMs ?? 0), 0);
    state.liveStats = {
      ...state.liveStats,
      totalScored: total,
      benignScored: state.liveStats.benignScored + incomingFlows.length - attacks.length,
      attackScored: state.liveStats.attackScored + attacks.length,
      blockedToday: state.liveStats.blockedToday + attacks.length,
      avgLatencyMs:
        total > 0
          ? Math.round(
              (state.liveStats.avgLatencyMs * (total - incomingFlows.length) + latencyTotal) /
                total
            )
          : 0,
      attackByCategory,
      sourceIpHits,
    };
    state.throughput = [
      ...state.throughput.slice(-29),
      {
        time: new Date().toTimeString().slice(0, 8),
        packetsPerSec: incomingFlows.reduce((sum, flow) => sum + flow.packets, 0) / 2,
        flowsPerSec: incomingFlows.length / 2,
        attackFlows: attacks.length,
      },
    ];
  }
  if (payload.liveStats) state.liveStats = payload.liveStats;
  writeBrowserState(state);
}

export async function clearLiveFlowsApi(): Promise<void> {
  const state = readBrowserState();
  state.flows = [];
  state.throughput = [];
  writeBrowserState(state);
}

export async function createAlertApi(alert: AlertRecord): Promise<{ alerts: AlertRecord[] }> {
  const state = readBrowserState();
  state.alerts = mergeById(state.alerts, [alert]).slice(0, 200);
  writeBrowserState(state);
  return { alerts: state.alerts };
}

export async function updateAlertStatusApi(
  id: string,
  status: AlertStatus
): Promise<{ alerts: AlertRecord[] }> {
  const state = readBrowserState();
  state.alerts = state.alerts.map((alert) => (alert.id === id ? { ...alert, status } : alert));
  writeBrowserState(state);
  return { alerts: state.alerts };
}

export async function deleteAlertApi(id: string): Promise<{ alerts: AlertRecord[] }> {
  const state = readBrowserState();
  state.alerts = state.alerts.filter((alert) => alert.id !== id);
  writeBrowserState(state);
  return { alerts: state.alerts };
}

export async function acknowledgeAllAlertsApi(): Promise<{ alerts: AlertRecord[] }> {
  const state = readBrowserState();
  state.alerts = state.alerts.map((alert) =>
    alert.status === 'New' || alert.status === 'Investigating'
      ? { ...alert, status: 'Acknowledged' }
      : alert
  );
  writeBrowserState(state);
  return { alerts: state.alerts };
}

export async function saveReportApi(
  report: Omit<SavedReportRecord, 'generatedAt'> & { generatedAt?: string }
): Promise<{ report: SavedReportRecord; reports: SavedReportRecord[] }> {
  const savedReport: SavedReportRecord = {
    ...report,
    generatedAt: report.generatedAt ?? new Date().toISOString(),
  };
  const state = readBrowserState();
  state.reports = mergeById(state.reports, [savedReport]);
  writeBrowserState(state);
  return { report: savedReport, reports: state.reports };
}

export async function deleteReportApi(id: string): Promise<{ reports: SavedReportRecord[] }> {
  const state = readBrowserState();
  state.reports = state.reports.filter((report) => report.id !== id);
  writeBrowserState(state);
  return { reports: state.reports };
}

// Generate realistic flow vectors to score through the direct Render API.
export function buildLiveSensorSample(attackBias = 0.24): {
  sourceIp: string;
  destinationIp: string;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  features: Record<string, number>;
} {
  const isAttack = Math.random() < attackBias;
  if (!isAttack) {
    const base = CIC_FLOW_PRESETS[0];
    const jitter = 0.75 + Math.random() * 0.5;
    const benignSources = ['192.168.10.5', '192.168.10.9', '192.168.10.14', '192.168.10.16', '192.168.10.19'];
    const dests = ['192.168.10.50', '172.217.10.46', '104.16.207.165', '52.84.145.9'];
    const protos: Array<'TCP' | 'UDP' | 'ICMP'> = ['TCP', 'TCP', 'UDP', 'ICMP'];
    return {
      sourceIp: benignSources[Math.floor(Math.random() * benignSources.length)],
      destinationIp: dests[Math.floor(Math.random() * dests.length)],
      protocol: protos[Math.floor(Math.random() * protos.length)],
      features: {
        ...base.features,
        'Flow Duration': Math.round(base.features['Flow Duration'] * jitter),
        'Total Fwd Packets': Math.max(4, Math.round(base.features['Total Fwd Packets'] * jitter)),
        'Total Backward Packets': Math.max(4, Math.round(base.features['Total Backward Packets'] * jitter)),
        'Flow Bytes/s': Math.round(base.features['Flow Bytes/s'] * jitter),
      },
    };
  }

  const attackPresets = CIC_FLOW_PRESETS.slice(1);
  const chosen = attackPresets[Math.floor(Math.random() * attackPresets.length)];
  const jitter = 0.85 + Math.random() * 0.3;
  return {
    sourceIp: chosen.sourceIp,
    destinationIp: chosen.destinationIp,
    protocol: chosen.protocol,
    features: {
      ...chosen.features,
      'Flow Duration': Math.max(20, Math.round(chosen.features['Flow Duration'] * jitter)),
      'Total Fwd Packets': Math.max(2, Math.round(chosen.features['Total Fwd Packets'] * jitter)),
      'Flow Bytes/s': Math.round(chosen.features['Flow Bytes/s'] * jitter),
    },
  };
}

export function buildLiveBatchSamples(count = 5, attackBias = 0.28): Array<{
  sourceIp: string;
  destinationIp: string;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  features: Record<string, number>;
}> {
  const samples = [];
  for (let i = 0; i < count; i++) {
    samples.push(buildLiveSensorSample(attackBias));
  }
  return samples;
}

export function inferAttackCategory(label: string): Exclude<AttackCategory, 'All'> {
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

export function inferSeverityFromAttack(label: string, confidence: number): Severity {
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

export function parseCicCsv(csvText: string): {
  headers: string[];
  rawHeaders: string[];
  rows: Record<string, string | number>[];
} {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { headers: [], rawHeaders: [], rows: [] };
  }

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };

  const rawHeaders = splitLine(lines[0]);
  const headers = rawHeaders.map((h) => h.trim());
  const rows: Record<string, string | number>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length === 0) continue;
    const obj: Record<string, string | number> = {};
    headers.forEach((h, idx) => {
      const rawVal = (cols[idx] ?? '').trim();
      const numVal = Number(rawVal);
      if (rawVal !== '' && Number.isFinite(numVal)) {
        obj[h] = numVal;
      } else {
        obj[h] = rawVal;
      }
    });
    rows.push(obj);
  }

  return { headers, rawHeaders, rows };
}

export const RENDER_FASTAPI_STARTER_CODE = `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd

app = FastAPI(title="AI-Based Network Intrusion Detection System — Kaggle Model API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your Kaggle-trained artifacts (exported via joblib.dump)
model = joblib.load("xgboost_nids_model.joblib")
scaler = joblib.load("scaler.joblib")
feature_columns = joblib.load("features.joblib")  # Exact 77 stripped CIC-IDS2017 column names

class PredictRequest(BaseModel):
    features: dict | list

class BatchPredictRequest(BaseModel):
    flows: list[dict]

def class_labels():
    return [str(c) for c in model.classes_]

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "xgboost (CIC-IDS2017)",
        "n_features": len(feature_columns),
        "classes": class_labels(),
    }

@app.get("/labels")
def labels():
    return {"features": list(feature_columns), "classes": class_labels()}

@app.post("/predict")
def predict(req: PredictRequest):
    if isinstance(req.features, dict):
        row = {col: float(req.features.get(col, 0.0)) for col in feature_columns}
        X = pd.DataFrame([row])
    else:
        X = np.array(req.features, dtype=float).reshape(1, -1)

    X_scaled = scaler.transform(X)
    pred = model.predict(X_scaled)[0]
    proba = model.predict_proba(X_scaled)[0]
    confidence = float(np.max(proba))

    return {
        "predicted_label": str(pred),
        "probability": round(confidence, 4),
        "probabilities": {
            cls: round(float(p), 4) for cls, p in zip(class_labels(), proba)
        },
    }

@app.post("/predict_batch")
def predict_batch(req: BatchPredictRequest):
    rows = [
        {col: float(flow.get(col, 0.0)) for col in feature_columns}
        for flow in req.flows
    ]
    X = pd.DataFrame(rows, columns=feature_columns)
    X_scaled = scaler.transform(X)
    predictions = model.predict(X_scaled)
    probabilities = model.predict_proba(X_scaled)

    return {
        "predictions": [
            {
                "predicted_label": str(pred),
                "probability": round(float(max(proba)), 4),
                "probabilities": {
                    cls: round(float(p), 4) for cls, p in zip(class_labels(), proba)
                },
            }
            for pred, proba in zip(predictions, probabilities)
        ]
    }
`;

export const RENDER_REQUIREMENTS_TXT = `fastapi==0.115.6
uvicorn==0.34.0
scikit-learn==1.6.1
xgboost==2.1.3
joblib==1.4.2
pandas==2.2.3
numpy==2.2.1
`;
