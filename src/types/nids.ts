export type PageId =
  | 'overview'
  | 'inference'
  | 'live'
  | 'alerts'
  | 'analysis'
  | 'models'
  | 'dataset'
  | 'lab'
  | 'reports'
  | 'settings';

export type TimeRange = '1h' | '6h' | '24h' | '7d';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type AlertStatus = 'New' | 'Investigating' | 'Acknowledged' | 'Resolved';

export type AttackCategory =
  | 'All'
  | 'DoS/DDoS'
  | 'PortScan'
  | 'Brute Force'
  | 'Web Attack'
  | 'Bot'
  | 'Infiltration'
  | 'Heartbleed';

export type PayloadFormat = 'wrapped_object' | 'flat_object' | 'feature_array';

export type EndpointConnectionStatus = 'disconnected' | 'checking' | 'connected' | 'error';

export interface TopClassScore {
  label: string;
  probability: number;
}

export interface BackendHealthInfo {
  status?: string;
  model?: string;
  nFeatures?: number;
  classes?: string[];
}

export interface RenderApiConfig {
  enabled: boolean;
  apiUrl: string;
  healthPath: string;
  predictPath: string;
  payloadFormat: PayloadFormat;
  timeoutSec: number;
  apiKey?: string;
  lastCheckedAt?: string;
  lastLatencyMs?: number;
  connectionStatus: EndpointConnectionStatus;
  lastError?: string;
  backendHealth?: BackendHealthInfo;
}

export interface NormalizedPrediction {
  prediction: 'BENIGN' | 'ATTACK';
  attackLabel: string;
  confidence: number;
  severity?: Severity | 'none';
  top3?: TopClassScore[];
  probabilities?: Record<string, number>;
  isDemoFallback?: boolean;
}

export interface InferenceResponse {
  ok: boolean;
  source: 'render-api' | 'local-engine';
  status: number;
  latencyMs: number;
  endpoint?: string;
  normalized: NormalizedPrediction;
  raw?: unknown;
  error?: string;
  warning?: string;
  recordedFlow?: LiveFlowRow;
  recordedAlert?: AlertRecord;
  liveStats?: LiveSessionStats;
}

export interface BatchScoredRow {
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
  source: 'render-api' | 'local-engine';
  top3?: TopClassScore[];
  isDemoFallback?: boolean;
}

export interface FlowFeatures {
  flowDuration: string;
  totalFwdPackets: number;
  totalBwdPackets: number;
  packetLengthMean: string;
  flowBytesPerSec: string;
  flowPacketsPerSec: string;
  initWinBytesFwd: number;
  dstPort: number;
  protocol: 'TCP' | 'UDP' | 'ICMP';
}

export interface AlertRecord {
  id: string;
  timestamp: string;
  date: string;
  attackType: string;
  category: Exclude<AttackCategory, 'All'>;
  sourceIp: string;
  destinationIp: string;
  dstPort: number;
  severity: Severity;
  status: AlertStatus;
  confidence: number;
  modelUsed: string;
  detectionLatency: string;
  recommendedAction: string;
  features: FlowFeatures;
  top3?: TopClassScore[];
  isSimulated?: boolean;
  isLiveApi?: boolean;
  isDemoFallback?: boolean;
}

export interface LiveFlowRow {
  id: string;
  timestamp: string;
  sourceIp: string;
  destinationIp: string;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  flowDurationMs: number;
  packets: number;
  bytes: number;
  prediction: 'BENIGN' | 'ATTACK';
  attackLabel: string;
  confidence: number;
  top3?: TopClassScore[];
  engineSource?: 'render-api' | 'local-engine';
  latencyMs?: number;
  isDemoFallback?: boolean;
}

export interface LiveThroughputPoint {
  time: string;
  packetsPerSec: number;
  flowsPerSec: number;
  attackFlows: number;
}

export interface LiveSessionStats {
  totalScored: number;
  benignScored: number;
  attackScored: number;
  blockedToday: number;
  avgLatencyMs: number;
  attackByCategory: Record<string, number>;
  sourceIpHits: Record<string, { count: number; lastAttack: string; category: string }>;
  portHits: Record<string, number>;
}

export interface SavedReportRecord {
  id: string;
  templateId: 'daily' | 'weekly-model' | 'attack-trend' | 'fpr-analysis';
  title: string;
  format: 'PDF' | 'CSV';
  generatedAt: string;
  range: string;
  summary: string;
  metrics: Array<{ label: string; value: string }>;
}

export interface ModelMetric {
  id: string;
  name: string;
  family: 'Supervised' | 'Deep Learning' | 'Unsupervised';
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number;
  fpr: number;
  inferenceTimeMs: number;
  isBest?: boolean;
  notes: string;
}

export interface DatasetFileRecord {
  fileName: string;
  shortName: string;
  day: string;
  rows: number;
  benign: number;
  attack: number;
  sizeMb: number;
  attackTypes: string[];
}

export interface AppSettings {
  activeModel: string;
  confidenceThreshold: number;
  alertSensitivity: 'Low' | 'Medium' | 'High';
  emailAlerts: boolean;
  soundAlerts: boolean;
  theme: 'light' | 'dark';
  refreshIntervalSec: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'info' | 'warning' | 'danger';
}

export interface SimulationScenario {
  id: 'portscan' | 'dos' | 'bruteforce' | 'webattack';
  title: string;
  tool: string;
  buttonLabel: string;
  attackType: string;
  category: Exclude<AttackCategory, 'All'>;
  severity: Severity;
  command: string;
  sourceIp: string;
  targetIp: string;
  targetPort: number;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  confidence: number;
  latencySec: number;
  recommendedAction: string;
  logs: string[];
  features: FlowFeatures;
  numericVector: Record<string, number>;
}
