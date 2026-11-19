import React, { useState, useRef, useEffect } from 'react';
import {
  Plug,
  Play,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Download,
  Code2,
  FileSpreadsheet,
  Send,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  AlertRecord,
  BatchScoredRow,
  InferenceResponse,
  LiveFlowRow,
  LiveSessionStats,
  LiveThroughputPoint,
  PayloadFormat,
  RenderApiConfig,
} from '../types/nids';
import {
  CIC_FLOW_PRESETS,
  RENDER_FASTAPI_STARTER_CODE,
  RENDER_REQUIREMENTS_TXT,
  inferAttackCategory,
  inferSeverityFromAttack,
  ingestBatchCsvRows,
  parseCicCsv,
  runModelPrediction,
} from '../services/modelApi';
import { PredictionBadge } from '../components/shared/UiPrimitives';
import { formatNumber } from '../data/cicIdsData';

interface InferencePageProps {
  renderConfig: RenderApiConfig;
  activeModel: string;
  onSaveRenderConfig: (next: RenderApiConfig) => Promise<void>;
  onTestRenderConnection: (cfg?: RenderApiConfig) => Promise<void>;
  onSyncBackendTelemetry: (payload: {
    flow?: LiveFlowRow;
    flows?: LiveFlowRow[];
    alert?: AlertRecord;
    alerts?: AlertRecord[];
    throughput?: LiveThroughputPoint[];
    liveStats?: LiveSessionStats;
  }) => void;
  onInjectAlert: (alert: AlertRecord) => Promise<void>;
  onNotify: (title: string, description: string, variant?: 'success' | 'info' | 'warning' | 'danger') => void;
}

type InferenceTab = 'single' | 'batch' | 'deploy-guide';

export function InferencePage({
  renderConfig,
  activeModel,
  onSaveRenderConfig,
  onTestRenderConnection,
  onSyncBackendTelemetry,
  onInjectAlert,
  onNotify,
}: InferencePageProps) {
  const [activeTab, setActiveTab] = useState<InferenceTab>('single');

  const [urlInput, setUrlInput] = useState(renderConfig.apiUrl);
  const [predictPathInput, setPredictPathInput] = useState(renderConfig.predictPath);
  const [healthPathInput, setHealthPathInput] = useState(renderConfig.healthPath);
  const [apiKeyInput, setApiKeyInput] = useState(renderConfig.apiKey || '');
  const [payloadFormatInput, setPayloadFormatInput] = useState<PayloadFormat>(
    renderConfig.payloadFormat
  );

  useEffect(() => {
    setUrlInput(renderConfig.apiUrl);
    setPredictPathInput(renderConfig.predictPath);
    setHealthPathInput(renderConfig.healthPath);
    setApiKeyInput(renderConfig.apiKey || '');
    setPayloadFormatInput(renderConfig.payloadFormat);
  }, [renderConfig.apiUrl, renderConfig.predictPath, renderConfig.healthPath, renderConfig.apiKey, renderConfig.payloadFormat]);

  // Single-flow state
  const [selectedPresetId, setSelectedPresetId] = useState(CIC_FLOW_PRESETS[1].id);
  const [sourceIp, setSourceIp] = useState(CIC_FLOW_PRESETS[1].sourceIp);
  const [destinationIp, setDestinationIp] = useState(CIC_FLOW_PRESETS[1].destinationIp);
  const [featureValues, setFeatureValues] = useState<Record<string, number>>(
    CIC_FLOW_PRESETS[1].features
  );
  const [useRawJson, setUseRawJson] = useState(false);
  const [rawJsonText, setRawJsonText] = useState(
    JSON.stringify(CIC_FLOW_PRESETS[1].features, null, 2)
  );
  const [autoRecordTelemetry, setAutoRecordTelemetry] = useState(true);
  const [isPredicting, setIsPredicting] = useState(false);
  const [lastInference, setLastInference] = useState<InferenceResponse | null>(null);

  // Batch CSV state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string | number>[]>([]);
  const [batchLimit, setBatchLimit] = useState<number>(25);
  const [pushBatchAttacks, setPushBatchAttacks] = useState<boolean>(true);
  const [isScoringBatch, setIsScoringBatch] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchScoredRow[]>([]);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleSaveAndTestEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = urlInput.trim().replace(/\/+$/, '');
    const nextConfig: RenderApiConfig = {
      ...renderConfig,
      apiUrl: cleaned,
      healthPath: healthPathInput.trim() || '/health',
      predictPath: predictPathInput.trim() || '/predict',
      apiKey: apiKeyInput.trim(),
      payloadFormat: payloadFormatInput,
      enabled: Boolean(cleaned),
    };
    await onSaveRenderConfig(nextConfig);
    if (cleaned) {
      await onTestRenderConnection(nextConfig);
    } else {
      onNotify(
        'Local Server Engine Active',
        'Cleared external URL. Predictions now run on the server-side CIC-IDS2017 engine.',
        'info'
      );
    }
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = CIC_FLOW_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setSourceIp(preset.sourceIp);
    setDestinationIp(preset.destinationIp);
    setFeatureValues({ ...preset.features });
    setRawJsonText(JSON.stringify(preset.features, null, 2));
  };

  const handleFeatureChange = (key: string, val: string) => {
    const num = Number(val);
    const updated = { ...featureValues, [key]: Number.isFinite(num) ? num : 0 };
    setFeatureValues(updated);
    setRawJsonText(JSON.stringify(updated, null, 2));
  };

  const handleRunSinglePrediction = async () => {
    let vectorToSend: Record<string, number> = featureValues;
    if (useRawJson) {
      try {
        const parsed = JSON.parse(rawJsonText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          onNotify('Invalid JSON', 'Provide a flat JSON object of feature names and numbers.', 'danger');
          return;
        }
        vectorToSend = parsed as Record<string, number>;
      } catch {
        onNotify('JSON Parse Error', 'Fix syntax errors in the raw JSON editor before predicting.', 'danger');
        return;
      }
    }

    setIsPredicting(true);
    try {
      const result = await runModelPrediction(renderConfig, vectorToSend, {
        recordToTelemetry: autoRecordTelemetry,
        sourceIp,
        destinationIp,
      });
      setLastInference(result);

      if (!result.ok) {
        onNotify('Prediction Failed', result.error || 'Model endpoint returned an error.', 'danger');
        return;
      }

      if (autoRecordTelemetry) {
        onSyncBackendTelemetry({
          flow: result.recordedFlow,
          alert: result.recordedAlert,
          liveStats: result.liveStats,
        });
      }

      const { prediction, attackLabel, confidence } = result.normalized;
      onNotify(
        prediction === 'ATTACK' ? `Intrusion Detected: ${attackLabel}` : 'Flow Classified: BENIGN',
        `${result.source === 'render-api' ? 'Render.com API' : 'Server Engine'} · Confidence ${confidence.toFixed(1)}% · ${result.latencyMs}ms`,
        prediction === 'ATTACK' ? 'danger' : 'success'
      );
    } finally {
      setIsPredicting(false);
    }
  };

  const handleSendManualAlert = async () => {
    if (!lastInference || !lastInference.ok) return;
    const { attackLabel, confidence } = lastInference.normalized;
    const now = new Date();
    const dstPort = Number(featureValues['Destination Port'] ?? 80);
    const alert: AlertRecord = {
      id: `API-${Math.floor(4000 + Math.random() * 5999)}`,
      timestamp: now.toTimeString().slice(0, 8),
      date: now.toISOString().slice(0, 10),
      attackType: attackLabel === 'BENIGN' ? 'Analyst Manual Log' : attackLabel,
      category: inferAttackCategory(attackLabel),
      sourceIp,
      destinationIp,
      dstPort,
      severity: inferSeverityFromAttack(attackLabel, confidence),
      status: 'New',
      confidence,
      modelUsed:
        lastInference.source === 'render-api'
          ? `${activeModel} (Render API)`
          : `${activeModel} (Server Engine)`,
      detectionLatency: `${(lastInference.latencyMs / 1000).toFixed(2)}s`,
      recommendedAction: `Triaged via ${
        lastInference.source === 'render-api' ? 'live Render.com Kaggle model' : 'server engine'
      }. Inspect traffic from ${sourceIp} to ${destinationIp}:${dstPort}.`,
      features: {
        flowDuration: `${formatNumber(Number(featureValues['Flow Duration'] ?? 0))} us`,
        totalFwdPackets: Number(featureValues['Total Fwd Packets'] ?? 0),
        totalBwdPackets: Number(featureValues['Total Backward Packets'] ?? 0),
        packetLengthMean: `${Number(featureValues['Packet Length Mean'] ?? 0).toFixed(1)} B`,
        flowBytesPerSec: `${formatNumber(Math.round(Number(featureValues['Flow Bytes/s'] ?? 0)))} B/s`,
        flowPacketsPerSec: `${Number(featureValues['Flow Packets/s'] ?? 0).toFixed(1)} pkt/s`,
        initWinBytesFwd: Number(featureValues['Init_Win_bytes_forward'] ?? 0),
        dstPort,
        protocol: 'TCP',
      },
      isLiveApi: lastInference.source === 'render-api',
    };
    await onInjectAlert(alert);
  };

  const handleCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const { headers, rows } = parseCicCsv(text);
      if (headers.length === 0 || rows.length === 0) {
        onNotify('Invalid CSV', 'CSV file must contain a header row and at least 1 data row.', 'danger');
        return;
      }
      setCsvFileName(file.name);
      setParsedHeaders(headers);
      setParsedRows(rows);
      setBatchResults([]);
      onNotify(
        'CSV Ready for Scoring',
        `${file.name}: ${formatNumber(rows.length)} rows · ${headers.length} stripped columns.`,
        'success'
      );
    };
    reader.readAsText(file);
  };

  const handleRunBatchScoring = async () => {
    if (parsedRows.length === 0) return;
    setIsScoringBatch(true);
    try {
      const res = await ingestBatchCsvRows({
        rows: parsedRows.slice(0, batchLimit),
        pushAttacksToAlerts: pushBatchAttacks,
        fileName: csvFileName || 'batch.csv',
      });

      if (!res.ok) {
        if (res.partialResults) setBatchResults(res.partialResults);
        onNotify('Batch Scoring Stopped', res.error || 'Batch API returned an error.', 'danger');
        return;
      }

      const scored = res.results || [];
      setBatchResults(scored);
      onSyncBackendTelemetry({
        flows: res.flows,
        alerts: res.createdAlerts,
        throughput: res.throughput,
        liveStats: res.liveStats,
      });

      const attacksCount = scored.filter((r) => r.prediction === 'ATTACK').length;
      onNotify(
        'Batch Scoring Complete',
        `Scored ${scored.length} flows (${attacksCount} attacks, ${scored.length - attacksCount} BENIGN). Persisted to telemetry.`,
        attacksCount > 0 ? 'warning' : 'success'
      );
    } finally {
      setIsScoringBatch(false);
    }
  };

  const handleExportBatchCsv = () => {
    if (batchResults.length === 0) return;
    const csv = [
      'Row,Source IP,Destination IP,Dst Port,Flow Duration,Total Fwd Packets,Flow Bytes/s,Prediction,Attack Label,Confidence (%),Latency (ms),Engine',
      ...batchResults.map((r) =>
        [
          r.rowIndex,
          r.sourceIp,
          r.destinationIp,
          r.dstPort,
          r.flowDuration,
          r.totalFwdPackets,
          r.flowBytesPerSec,
          r.prediction,
          `"${r.attackLabel}"`,
          r.confidence,
          r.latencyMs,
          r.source,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sentinel-ai-scored-flows.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify('Scored CSV Exported', `Exported ${batchResults.length} classified rows.`, 'success');
  };

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onNotify('Copied to Clipboard', 'Ready to paste into your Render.com deployment repository.', 'info');
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const batchAttacks = batchResults.filter((r) => r.prediction === 'ATTACK').length;
  const batchBenign = batchResults.length - batchAttacks;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
            Model Inference — Render.com Kaggle API
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Run live predictions and CSV batch classification against your Kaggle-trained model deployed on Render.com
          </p>
        </div>

        <div className="flex items-center p-1 rounded-lg bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shrink-0">
          {(
            [
              { id: 'single', label: 'Single Flow Predict' },
              { id: 'batch', label: 'CSV Batch Scoring' },
              { id: 'deploy-guide', label: 'Render.com Setup Guide' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#0F2A44] dark:bg-[#2563EB] text-white'
                  : 'text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Render.com Endpoint Connection Panel */}
      <form
        onSubmit={handleSaveAndTestEndpoint}
        className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0F2A44] dark:bg-[#2563EB] text-white flex items-center justify-center shrink-0">
              <Plug className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                Render.com Model Endpoint Connection
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Saved persistently on the Express server and proxied with zero CORS issues
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            {renderConfig.connectionStatus === 'connected' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#059669]/10 text-[#059669] dark:text-[#6EE7B7] border border-[#059669]/25 tabular-nums">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Render Live · {renderConfig.lastLatencyMs ?? 0}ms
              </span>
            )}
            {renderConfig.connectionStatus === 'checking' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2563EB]/10 text-[#2563EB] dark:text-[#93C5FD] border border-[#2563EB]/25">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Pinging Render...
              </span>
            )}
            {renderConfig.connectionStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#DC2626]/10 text-[#DC2626] dark:text-[#FCA5A5] border border-[#DC2626]/25">
                <AlertCircle className="w-3.5 h-3.5" />
                Endpoint Error
              </span>
            )}
            {renderConfig.connectionStatus === 'disconnected' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0891B2]/10 text-[#0891B2] dark:text-[#67E8F9] border border-[#0891B2]/25">
                Server Local Engine Active
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label
              htmlFor="render-url-input"
              className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1"
            >
              Render Service Base URL
            </label>
            <input
              id="render-url-input"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://your-nids-model.onrender.com"
              className="w-full h-9 px-3 rounded-lg text-xs font-mono bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="predict-path-input"
              className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1"
            >
              Predict Route
            </label>
            <input
              id="predict-path-input"
              type="text"
              value={predictPathInput}
              onChange={(e) => setPredictPathInput(e.target.value)}
              placeholder="/predict"
              className="w-full h-9 px-3 rounded-lg text-xs font-mono bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="payload-format-select"
              className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1"
            >
              JSON Payload Format
            </label>
            <select
              id="payload-format-select"
              value={payloadFormatInput}
              onChange={(e) => setPayloadFormatInput(e.target.value as PayloadFormat)}
              className="w-full h-9 px-2.5 rounded-lg text-xs bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="wrapped_object">{`{ "features": { ... } }`}</option>
              <option value="flat_object">{`Flat JSON { "Flow Duration": ... }`}</option>
              <option value="feature_array">{`{ "features": [ ... ] }`}</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={renderConfig.connectionStatus === 'checking'}
              className="w-full h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer disabled:opacity-55 whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  renderConfig.connectionStatus === 'checking' ? 'animate-spin' : ''
                }`}
              />
              Connect &amp; Test
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span>Health path:</span>
              <input
                type="text"
                value={healthPathInput}
                onChange={(e) => setHealthPathInput(e.target.value)}
                className="w-24 px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] font-mono text-[#0F172A] dark:text-white"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span>Optional Bearer Token:</span>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Optional"
                className="w-36 px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] font-mono text-[#0F172A] dark:text-white"
              />
            </label>
          </div>
          {renderConfig.lastError && (
            <span className="text-[#DC2626] dark:text-[#FCA5A5] font-medium">
              {renderConfig.lastError}
            </span>
          )}
        </div>
      </form>

      {/* TAB 1: SINGLE FLOW LIVE PREDICTION */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                  CIC-IDS2017 Flow Feature Vector
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Select a flow vector preset or edit features / paste full 78-feature JSON
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUseRawJson((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:border-[#2563EB] cursor-pointer whitespace-nowrap"
              >
                <Code2 className="w-3.5 h-3.5 text-[#2563EB]" />
                {useRawJson ? 'Switch to Form Grid' : 'Edit Raw JSON (78 cols)'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CIC_FLOW_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset.id)}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    selectedPresetId === preset.id
                      ? 'bg-[#2563EB]/10 dark:bg-[#2563EB]/20 border-[#2563EB]'
                      : 'bg-[#F8FAFC] dark:bg-[#0B1B2B] border-[#E2E8F0] dark:border-[#1E354E] hover:border-slate-400'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-[#0F172A] dark:text-white truncate">
                    {preset.expected}
                  </p>
                  <p className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">
                    {preset.sourceIp}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                  Source IP
                </label>
                <input
                  type="text"
                  value={sourceIp}
                  onChange={(e) => setSourceIp(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg text-xs font-mono bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                  Destination IP
                </label>
                <input
                  type="text"
                  value={destinationIp}
                  onChange={(e) => setDestinationIp(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg text-xs font-mono bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white"
                />
              </div>
            </div>

            {useRawJson ? (
              <textarea
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                rows={12}
                spellCheck={false}
                className="w-full p-3 rounded-lg font-mono text-xs bg-[#0B1B2B] text-slate-100 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(featureValues).map(([key, val]) => (
                  <div key={key}>
                    <label
                      className="block text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] mb-1 truncate"
                      title={key}
                    >
                      {key}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={val}
                      onChange={(e) => handleFeatureChange(key, e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg text-xs font-mono tabular-nums bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E2E8F0] dark:border-[#1E354E]">
              <label className="inline-flex items-center gap-2 text-xs text-[#0F172A] dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRecordTelemetry}
                  onChange={(e) => setAutoRecordTelemetry(e.target.checked)}
                  className="rounded border-slate-300 accent-[#2563EB]"
                />
                Persist flow to Live Monitor &amp; auto-create Alert on Attack
              </label>

              <button
                type="button"
                onClick={handleRunSinglePrediction}
                disabled={isPredicting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer disabled:opacity-55 whitespace-nowrap"
              >
                {isPredicting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Running Model...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Run Live Prediction
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Col: Verdict */}
          <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 flex flex-col justify-between">
            {lastInference ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {lastInference.ok ? (
                      lastInference.normalized.prediction === 'ATTACK' ? (
                        <ShieldAlert className="w-5 h-5 text-[#DC2626] shrink-0" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-[#059669] shrink-0" />
                      )
                    ) : (
                      <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0" />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                        {lastInference.ok ? 'Inference Verdict' : 'Inference Error'}
                      </h3>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {lastInference.source === 'render-api'
                          ? 'Render.com Deployed Kaggle Model'
                          : 'Server-Side CIC-IDS2017 Engine'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#0891B2] tabular-nums">
                    {lastInference.latencyMs}ms
                  </span>
                </div>

                {lastInference.ok ? (
                  <>
                    <div
                      className={`rounded-xl p-4 border ${
                        lastInference.normalized.prediction === 'ATTACK'
                          ? 'bg-[#DC2626]/[0.06] dark:bg-[#DC2626]/15 border-[#DC2626]/30'
                          : 'bg-[#059669]/[0.06] dark:bg-[#059669]/15 border-[#059669]/30'
                      }`}
                    >
                      <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                        Predicted Classification
                      </p>
                      <p
                        className={`text-xl font-bold mt-1 ${
                          lastInference.normalized.prediction === 'ATTACK'
                            ? 'text-[#DC2626] dark:text-[#FCA5A5]'
                            : 'text-[#059669] dark:text-[#6EE7B7]'
                        }`}
                      >
                        {lastInference.normalized.attackLabel}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-[#64748B] dark:text-[#94A3B8]">Confidence</span>
                        <span className="font-mono font-bold text-[#0F172A] dark:text-white tabular-nums">
                          {lastInference.normalized.confidence.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            lastInference.normalized.prediction === 'ATTACK'
                              ? 'bg-[#DC2626]'
                              : 'bg-[#059669]'
                          }`}
                          style={{ width: `${lastInference.normalized.confidence}%` }}
                        />
                      </div>
                    </div>

                    {lastInference.normalized.probabilities && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
                          Class Probabilities
                        </p>
                        <div className="space-y-1.5">
                          {Object.entries(lastInference.normalized.probabilities)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([cls, pct]) => (
                              <div key={cls} className="text-xs">
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-[#0F172A] dark:text-slate-200">{cls}</span>
                                  <span className="font-mono tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                                    {pct.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-[#2563EB] rounded-full"
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                        Raw JSON Response
                      </p>
                      <pre className="p-3 rounded-lg bg-[#0B1B2B] text-slate-200 font-mono text-[11px] overflow-x-auto max-h-36">
                        {JSON.stringify(lastInference.raw, null, 2)}
                      </pre>
                    </div>

                    {!lastInference.recordedAlert && (
                      <button
                        type="button"
                        onClick={handleSendManualAlert}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Log Entry to Alerts Center
                      </button>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/25 p-3.5 text-xs text-[#DC2626] dark:text-[#FCA5A5]">
                    {lastInference.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <Plug className="w-8 h-8 text-[#64748B] mb-2.5" />
                <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                  Ready for Real-Time Classification
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-xs">
                  Paste your Render.com URL above and click "Run Live Prediction" to score network
                  flows directly through your deployed Kaggle model.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CSV BATCH SCORING */}
      {activeTab === 'batch' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                  Upload CIC-IDS2017 / CICFlowMeter CSV for Bulk Classification
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Scores rows through your backend &amp; Render.com model, persists flows to Live Monitor, and generates alerts
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Select CSV File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvUpload(f);
                  }}
                />
              </div>
            </div>

            {parsedRows.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-[#E2E8F0] dark:border-[#1E354E] hover:border-[#2563EB] p-8 text-center cursor-pointer transition-colors"
              >
                <FileSpreadsheet className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
                  Click to upload a CIC-IDS2017 or CICFlowMeter .csv file
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                  Column whitespace is stripped automatically before sending numeric feature rows to your model
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-[#0F172A] dark:text-white font-mono">
                    {csvFileName}
                  </p>
                  <p className="text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                    {formatNumber(parsedRows.length)} rows parsed · {parsedHeaders.length} columns
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-xs text-[#0F172A] dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pushBatchAttacks}
                      onChange={(e) => setPushBatchAttacks(e.target.checked)}
                      className="accent-[#2563EB]"
                    />
                    Auto-create Alerts
                  </label>

                  <label className="text-xs text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                    Max rows:
                    <select
                      value={batchLimit}
                      onChange={(e) => setBatchLimit(Number(e.target.value))}
                      className="h-8 px-2 rounded-md bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white text-xs font-mono"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    disabled={isScoringBatch}
                    onClick={handleRunBatchScoring}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer disabled:opacity-55"
                  >
                    {isScoringBatch ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Scoring Batch...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Score CSV Flows
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {batchResults.length > 0 && (
            <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#E2E8F0] dark:border-[#1E354E] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="font-semibold text-[#0F172A] dark:text-white tabular-nums">
                    Scored: {batchResults.length}
                  </span>
                  <span className="font-semibold text-[#DC2626] tabular-nums">
                    Attacks: {batchAttacks}
                  </span>
                  <span className="font-semibold text-[#059669] tabular-nums">
                    BENIGN: {batchBenign}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleExportBatchCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F2A44] dark:bg-[#2563EB] text-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Scored CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] dark:bg-[#0B1B2B] border-b border-[#E2E8F0] dark:border-[#1E354E] text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                      <th className="py-2.5 px-4">#</th>
                      <th className="py-2.5 px-3">Source → Dest</th>
                      <th className="py-2.5 px-3 text-right">Port</th>
                      <th className="py-2.5 px-3 text-right">Fwd Pkts</th>
                      <th className="py-2.5 px-3 text-right">Bytes/s</th>
                      <th className="py-2.5 px-3">Prediction</th>
                      <th className="py-2.5 px-3 text-right">Confidence</th>
                      <th className="py-2.5 px-4 text-right">Engine</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E]">
                    {batchResults.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={
                          row.prediction === 'ATTACK'
                            ? 'bg-[#DC2626]/[0.05] dark:bg-[#DC2626]/15'
                            : 'hover:bg-slate-50 dark:hover:bg-[#0F2A44]/50'
                        }
                      >
                        <td className="py-2.5 px-4 font-mono text-[#64748B] tabular-nums">
                          {row.rowIndex}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#0F172A] dark:text-white whitespace-nowrap">
                          {row.sourceIp} → {row.destinationIp}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {row.dstPort}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatNumber(row.totalFwdPackets)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatNumber(Math.round(row.flowBytesPerSec))}
                        </td>
                        <td className="py-2.5 px-3">
                          <PredictionBadge prediction={row.prediction} label={row.attackLabel} />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                          {row.confidence.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-[#64748B] tabular-nums">
                          {row.source === 'render-api' ? 'Render API' : 'Server'} · {row.latencyMs}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RENDER.COM DEPLOYMENT STARTER GUIDE */}
      {activeTab === 'deploy-guide' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                  FastAPI Wrapper for Your Kaggle Model (main.py)
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Export your Kaggle model with joblib.dump(), push these files to GitHub, and deploy on Render.com
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard('main', RENDER_FASTAPI_STARTER_CODE)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white cursor-pointer shrink-0"
              >
                {copiedKey === 'main' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#059669]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy main.py
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-[#0B1B2B] text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed">
              {RENDER_FASTAPI_STARTER_CODE}
            </pre>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                  requirements.txt
                </h3>
                <button
                  type="button"
                  onClick={() => copyToClipboard('req', RENDER_REQUIREMENTS_TXT)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
                >
                  {copiedKey === 'req' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-[#0B1B2B] text-slate-200 font-mono text-xs overflow-x-auto">
                {RENDER_REQUIREMENTS_TXT}
              </pre>
            </div>

            <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 space-y-3 text-xs">
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                Render.com Deployment Steps
              </h3>
              <div className="space-y-2 text-[#64748B] dark:text-[#94A3B8]">
                <div>
                  <p className="font-semibold text-[#0F172A] dark:text-white">1. Build Command</p>
                  <code className="block mt-1 p-2 rounded bg-[#F1F5F9] dark:bg-[#0B1B2B] font-mono text-[11px] text-[#0F172A] dark:text-slate-200">
                    pip install -r requirements.txt
                  </code>
                </div>
                <div>
                  <p className="font-semibold text-[#0F172A] dark:text-white">2. Start Command</p>
                  <code className="block mt-1 p-2 rounded bg-[#F1F5F9] dark:bg-[#0B1B2B] font-mono text-[11px] text-[#0F172A] dark:text-slate-200">
                    uvicorn main:app --host 0.0.0.0 --port $PORT
                  </code>
                </div>
                <div>
                  <p className="font-semibold text-[#0F172A] dark:text-white">3. Connect Endpoint</p>
                  <p className="mt-1 leading-relaxed">
                    Paste your <code className="font-mono">https://...onrender.com</code> URL above
                    and click <strong>Connect &amp; Test</strong>. Every page (Inference, Live
                    Monitor, Batch CSV, Lab Testing) immediately uses your live Kaggle model.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
