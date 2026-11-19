import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Pause,
  Play,
  ShieldAlert,
  Activity,
  Ban,
  Filter,
  Trash2,
  Terminal,
  Copy,
  Check,
  Zap,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { LiveFlowRow, LiveThroughputPoint, RenderApiConfig } from '../types/nids';
import { PredictionBadge } from '../components/shared/UiPrimitives';
import { formatNumber } from '../data/cicIdsData';

interface LiveTrafficPageProps {
  liveSeries: LiveThroughputPoint[];
  liveFlows: LiveFlowRow[];
  isLiveRunning: boolean;
  onToggleLive: () => void;
  onTriggerSingleSensorFlow: () => Promise<void>;
  onClearFlows: () => Promise<void>;
  refreshIntervalSec: number;
  blockedToday: number;
  renderConfig: RenderApiConfig;
  liveApiError?: string | null;
  onRetryHealthCheck?: () => void;
  isDark: boolean;
}

export function LiveTrafficPage({
  liveSeries,
  liveFlows,
  isLiveRunning,
  onToggleLive,
  onTriggerSingleSensorFlow,
  onClearFlows,
  refreshIntervalSec,
  blockedToday,
  renderConfig,
  liveApiError,
  onRetryHealthCheck,
  isDark,
}: LiveTrafficPageProps) {
  const [predictionFilter, setPredictionFilter] = useState<'ALL' | 'BENIGN' | 'ATTACK'>('ALL');
  const [protocolFilter, setProtocolFilter] = useState<'ALL' | 'TCP' | 'UDP' | 'ICMP'>('ALL');
  const [showWebhookBox, setShowWebhookBox] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [ingestingNow, setIngestingNow] = useState(false);

  const isRenderLive = renderConfig.enabled && renderConfig.connectionStatus === 'connected';

  const filteredFlows = useMemo(() => {
    return liveFlows.filter((row) => {
      const matchPrediction = predictionFilter === 'ALL' || row.prediction === predictionFilter;
      const matchProtocol = protocolFilter === 'ALL' || row.protocol === protocolFilter;
      return matchPrediction && matchProtocol;
    });
  }, [liveFlows, predictionFilter, protocolFilter]);

  const recentAttacks = useMemo(() => {
    const recent = liveFlows.slice(0, 15);
    if (recent.length === 0) return 0;
    return recent.filter((r) => r.prediction === 'ATTACK').length / recent.length;
  }, [liveFlows]);

  const threatLevel: 'Low' | 'Medium' | 'High' =
    recentAttacks >= 0.35 ? 'High' : recentAttacks >= 0.18 ? 'Medium' : 'Low';

  const latestPoint = liveSeries[liveSeries.length - 1];
  const activeConnections = latestPoint ? Math.round(latestPoint.flowsPerSec * 1.45) : 0;

  const gridStroke = isDark ? '#1E354E' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0B1B2B' : '#FFFFFF',
    borderColor: isDark ? '#1E354E' : '#E2E8F0',
    borderRadius: '10px',
    fontSize: '12px',
    color: isDark ? '#F1F5F9' : '#0F172A',
  };

  const threatStyles = {
    Low: {
      text: 'text-[#059669]',
      bar: 'bg-[#059669] w-1/3',
      desc: 'Normal baseline flow ratio',
    },
    Medium: {
      text: 'text-[#D97706]',
      bar: 'bg-[#D97706] w-2/3',
      desc: 'Elevated suspicious probes detected',
    },
    High: {
      text: 'text-[#DC2626]',
      bar: 'bg-[#DC2626] w-full',
      desc: 'Active intrusion bursts flagged by classifier',
    },
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const curlSnippet = `curl -X POST ${originUrl}/api/ingest/flow \\
  -H "Content-Type: application/json" \\
  -d '{
    "sourceIp": "172.16.0.1",
    "destinationIp": "192.168.10.50",
    "protocol": "TCP",
    "features": {
      "Destination Port": 80,
      "Flow Duration": 1124510,
      "Total Fwd Packets": 924,
      "Total Backward Packets": 410,
      "Flow Bytes/s": 371200,
      "Flow Packets/s": 1186.3,
      "Init_Win_bytes_forward": 29200
    }
  }'`;

  const handleManualProbe = async () => {
    setIngestingNow(true);
    await onTriggerSingleSensorFlow();
    setIngestingNow(false);
  };

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
            Live Traffic Monitor
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5 tabular-nums">
            Sending 5 sample flows every {refreshIntervalSec}s to{' '}
            <span className="font-mono font-semibold text-[#0F172A] dark:text-white">
              POST /predict_batch
            </span>{' '}
            ·{' '}
            <span className="font-semibold text-[#0F172A] dark:text-white">
              {liveApiError
                ? 'Render /predict_batch error (no demo data shown)'
                : isRenderLive
                ? `Render API (${renderConfig.lastLatencyMs ?? 0}ms)`
                : renderConfig.connectionStatus === 'checking'
                ? 'Waking up backend... please wait'
                : 'Backend Offline · check /health'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowWebhookBox((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:border-[#2563EB] cursor-pointer whitespace-nowrap"
          >
            <Terminal className="w-3.5 h-3.5 text-[#0891B2]" />
            Sensor Webhook API
          </button>

          <button
            type="button"
            disabled={ingestingNow}
            onClick={handleManualProbe}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:border-[#2563EB] cursor-pointer disabled:opacity-55 whitespace-nowrap"
          >
            <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
            {ingestingNow ? 'Scoring 5 Flows...' : 'Score 5 Flows Now'}
          </button>

          <button
            type="button"
            onClick={onToggleLive}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              isLiveRunning
                ? 'bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white'
                : 'bg-[#059669] hover:bg-[#047857] text-white'
            }`}
          >
            {isLiveRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Pause Live Stream
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Start Live Stream
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsible External Sensor Ingestion Webhook Guide */}
      {showWebhookBox && (
        <div className="rounded-xl bg-[#0B1B2B] border border-slate-700 p-4 text-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-white">
                Real-Time Zeek / Suricata / Python Ingestion Webhook
              </p>
              <p className="text-[11px] text-slate-400">
                POST any extracted CIC-IDS2017 flow JSON to this endpoint — the server scores it with your Render.com model and logs alerts automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(curlSnippet);
                setCopiedCurl(true);
                window.setTimeout(() => setCopiedCurl(false), 1800);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0F2A44] hover:bg-[#16385A] text-white border border-slate-600 cursor-pointer shrink-0"
            >
              {copiedCurl ? <Check className="w-3.5 h-3.5 text-[#34D399]" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCurl ? 'Copied' : 'Copy cURL'}
            </button>
          </div>
          <pre className="p-3 rounded-lg bg-slate-950/70 font-mono text-[11px] text-slate-200 overflow-x-auto leading-relaxed">
            {curlSnippet}
          </pre>
        </div>
      )}

      {/* Real Render API Error Banner (zero demo data fallback) */}
      {liveApiError && (
        <div className="rounded-xl bg-[#DC2626]/8 dark:bg-[#DC2626]/15 border border-[#DC2626]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#DC2626] dark:text-[#FCA5A5]">
                Live Render Backend Error — Zero Demo Data Generated
              </p>
              <p className="text-xs font-mono text-[#0F172A] dark:text-slate-200 mt-0.5 break-all">
                {liveApiError}
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                Live flows and alerts will appear automatically as soon as{' '}
                <span className="font-mono">{renderConfig.apiUrl}/predict_batch</span> returns HTTP 200.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRetryHealthCheck && (
              <button
                type="button"
                onClick={onRetryHealthCheck}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#0B1B2B] border border-[#DC2626]/30 text-[#0F172A] dark:text-white hover:border-[#DC2626] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Check /health
              </button>
            )}
            <button
              type="button"
              disabled={ingestingNow}
              onClick={handleManualProbe}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white cursor-pointer disabled:opacity-55"
            >
              Retry /predict_batch
            </button>
          </div>
        </div>
      )}

      {/* Top 3 Live Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
              Current Threat Level
            </span>
            <ShieldAlert className={`w-4 h-4 ${threatStyles[threatLevel].text}`} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <p className={`text-2xl font-bold ${threatStyles[threatLevel].text}`}>{threatLevel}</p>
            <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums">
              {Math.round(recentAttacks * 100)}% recent attack rate
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${threatStyles[threatLevel].bar}`} />
          </div>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1.5">
            {threatStyles[threatLevel].desc}
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
              Active Connections
            </span>
            <Activity className="w-4 h-4 text-[#2563EB]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#0F172A] dark:text-white tabular-nums">
            {formatNumber(activeConnections)}
          </p>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-2 tabular-nums">
            Current ingress: {latestPoint ? formatNumber(latestPoint.packetsPerSec) : '0'} pkt/s ·{' '}
            {latestPoint ? formatNumber(latestPoint.flowsPerSec) : '0'} flows/s
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
              Blocked Attempts Today
            </span>
            <Ban className="w-4 h-4 text-[#DC2626]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#0F172A] dark:text-white tabular-nums">
            {formatNumber(blockedToday)}
          </p>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-2">
            Persisted counter updated on every detected attack flow
          </p>
        </div>
      </div>

      {/* Big Live Throughput Line Chart */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Real-Time Network Throughput (Packets/sec &amp; Flows/sec)
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Rolling 20-interval backend telemetry · {isLiveRunning ? 'Streaming active' : 'Stream paused'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#2563EB]" />
              Packets/sec
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0891B2]" />
              Flows/sec
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={liveSeries} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: axisColor }}
                axisLine={{ stroke: gridStroke }}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: axisColor }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: axisColor }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="packetsPerSec"
                name="Packets / sec"
                stroke="#2563EB"
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="flowsPerSec"
                name="Flows / sec"
                stroke="#0891B2"
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Feed Table + Filters */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] dark:border-[#1E354E] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Persisted Live Flow Classification Feed
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
              Showing {filteredFlows.length} of {liveFlows.length} persisted flows
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E]">
              {(['ALL', 'BENIGN', 'ATTACK'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPredictionFilter(opt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    predictionFilter === opt
                      ? 'bg-white dark:bg-[#2563EB] text-[#0F172A] dark:text-white shadow-xs'
                      : 'text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  {opt === 'ALL' ? 'All Traffic' : opt === 'BENIGN' ? 'Normal (Safe)' : 'Attack'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#64748B]" />
              <select
                value={protocolFilter}
                onChange={(e) => setProtocolFilter(e.target.value as 'ALL' | 'TCP' | 'UDP' | 'ICMP')}
                aria-label="Filter by protocol"
                className="h-8 px-2.5 rounded-lg text-xs font-medium bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="ALL">All Protocols</option>
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="ICMP">ICMP</option>
              </select>
            </div>

            {liveFlows.length > 0 && (
              <button
                type="button"
                onClick={onClearFlows}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium bg-white dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#64748B] hover:text-[#DC2626] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredFlows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-[#0F172A] dark:text-white">
              {liveFlows.length === 0
                ? 'Waiting for real predictions from Render API'
                : 'No live flows match the current filter'}
            </p>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
              {liveFlows.length === 0
                ? 'Demo data is disabled. Real rows appear here once POST /predict_batch returns HTTP 200 OK.'
                : 'Adjust the prediction or protocol filters above to view scored flows.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-[#0B1B2B] border-b border-[#E2E8F0] dark:border-[#1E354E] text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-3">Source IP</th>
                  <th className="py-2.5 px-3">Destination IP</th>
                  <th className="py-2.5 px-3">Protocol</th>
                  <th className="py-2.5 px-3 text-right">Duration</th>
                  <th className="py-2.5 px-3 text-right">Packets</th>
                  <th className="py-2.5 px-3 text-right">Bytes</th>
                  <th className="py-2.5 px-3">Prediction</th>
                  <th className="py-2.5 px-3 text-right">Confidence</th>
                  <th className="py-2.5 px-4 text-right">Engine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E] text-xs">
                {filteredFlows.map((flow) => {
                  const isAttack = flow.prediction === 'ATTACK';
                  return (
                    <tr
                      key={flow.id}
                      className={
                        isAttack
                          ? 'bg-[#DC2626]/[0.06] dark:bg-[#DC2626]/[0.14] hover:bg-[#DC2626]/[0.10] dark:hover:bg-[#DC2626]/[0.20] transition-colors'
                          : 'bg-[#059669]/[0.04] dark:bg-[#059669]/[0.07] hover:bg-[#059669]/[0.08] dark:hover:bg-[#059669]/[0.12] transition-colors'
                      }
                    >
                      <td className="py-2.5 px-4 font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums whitespace-nowrap">
                        {flow.timestamp}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-[#0F172A] dark:text-white whitespace-nowrap">
                        {flow.sourceIp}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#0F172A] dark:text-slate-200 whitespace-nowrap">
                        {flow.destinationIp}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#64748B] dark:text-slate-300">
                        {flow.protocol}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#0F172A] dark:text-slate-200 tabular-nums whitespace-nowrap">
                        {formatNumber(flow.flowDurationMs)} ms
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#0F172A] dark:text-slate-200 tabular-nums">
                        {formatNumber(flow.packets)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#0F172A] dark:text-slate-200 tabular-nums whitespace-nowrap">
                        {formatNumber(flow.bytes)} B
                      </td>
                      <td className="py-2.5 px-3">
                        <PredictionBadge
                          prediction={flow.prediction}
                          label={flow.prediction === 'BENIGN' ? 'Normal (Safe)' : flow.attackLabel}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                        {flow.confidence.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                        <span className="text-[#059669] font-semibold">Render API</span>
                        {flow.latencyMs ? ` · ${flow.latencyMs}ms` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
