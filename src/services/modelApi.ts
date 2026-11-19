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
  RenderApiConfig,
  SavedReportRecord,
  Severity,
} from '../types/nids';

export const DEFAULT_RENDER_API_URL = 'https://sentinel-ai-nids-backend.onrender.com';

export const DEFAULT_RENDER_CONFIG: RenderApiConfig = {
  enabled: true,
  apiUrl: DEFAULT_RENDER_API_URL,
  healthPath: '/health',
  predictPath: '/predict',
  payloadFormat: 'wrapped_object',
  timeoutSec: 55,
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

export async function fetchBootstrapState(): Promise<BootstrapResponse> {
  const res = await fetch('/api/bootstrap');
  if (!res.ok) throw new Error(`Bootstrap failed (${res.status})`);
  return res.json();
}

export async function persistSettingsAndRenderConfig(
  settings: AppSettings,
  renderConfig: RenderApiConfig
): Promise<{ ok: boolean; settings: AppSettings; renderConfig: RenderApiConfig }> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, renderConfig }),
  });
  return res.json();
}

export async function resetBackendSettings(): Promise<{
  ok: boolean;
  settings: AppSettings;
  renderConfig: RenderApiConfig;
}> {
  const res = await fetch('/api/settings/reset', { method: 'POST' });
  return res.json();
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
  const res = await fetch('/api/model/health', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiUrl: config.apiUrl,
      healthPath: config.healthPath,
      apiKey: config.apiKey || '',
      timeoutMs: (config.timeoutSec || 55) * 1000,
    }),
  });
  return res.json();
}

export async function runModelPrediction(
  config: RenderApiConfig,
  features: Record<string, number>,
  options?: { recordToTelemetry?: boolean; sourceIp?: string; destinationIp?: string }
): Promise<InferenceResponse> {
  const res = await fetch('/api/model/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      features,
      renderConfigOverride: config,
      recordToTelemetry: options?.recordToTelemetry ?? true,
      sourceIp: options?.sourceIp,
      destinationIp: options?.destinationIp,
    }),
  });
  return res.json();
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
  flow: LiveFlowRow;
  alert?: AlertRecord;
  throughput: LiveThroughputPoint[];
  liveStats: LiveSessionStats;
  warning?: string;
  isDemoFallback?: boolean;
  error?: string;
}> {
  const res = await fetch('/api/ingest/flow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
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
  source: 'render-api' | 'local-engine';
  latencyMs: number;
  flows: LiveFlowRow[];
  createdAlerts: AlertRecord[];
  throughput: LiveThroughputPoint[];
  liveStats: LiveSessionStats;
  warning?: string;
  isDemoFallback?: boolean;
  error?: string;
}> {
  const res = await fetch('/api/ingest/live-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
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
  const res = await fetch('/api/ingest/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function clearLiveFlowsApi(): Promise<void> {
  await fetch('/api/flows/clear', { method: 'POST' });
}

export async function createAlertApi(alert: AlertRecord): Promise<{ alerts: AlertRecord[] }> {
  const res = await fetch('/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alert),
  });
  return res.json();
}

export async function updateAlertStatusApi(
  id: string,
  status: AlertStatus
): Promise<{ alerts: AlertRecord[] }> {
  const res = await fetch(`/api/alerts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function deleteAlertApi(id: string): Promise<{ alerts: AlertRecord[] }> {
  const res = await fetch(`/api/alerts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function acknowledgeAllAlertsApi(): Promise<{ alerts: AlertRecord[] }> {
  const res = await fetch('/api/alerts/ack-all', { method: 'POST' });
  return res.json();
}

export async function saveReportApi(
  report: Omit<SavedReportRecord, 'generatedAt'> & { generatedAt?: string }
): Promise<{ report: SavedReportRecord; reports: SavedReportRecord[] }> {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
  return res.json();
}

export async function deleteReportApi(id: string): Promise<{ reports: SavedReportRecord[] }> {
  const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.json();
}

// Generate realistic network probe vector to feed through /api/ingest/flow -> Render.com model
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
feature_columns = joblib.load("features.joblib")  # Exact 78 stripped CIC-IDS2017 column names

class PredictRequest(BaseModel):
    features: dict | list

@app.get("/health")
def health():
    return {"status": "online", "model": "XGBoost-CIC-IDS2017", "features": len(feature_columns)}

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
    classes = [str(c) for c in model.classes_]
    confidence = float(np.max(proba))

    return {
        "prediction": str(pred),
        "confidence": round(confidence, 4),
        "probabilities": {cls: round(float(p), 4) for cls, p in zip(classes, proba)}
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
