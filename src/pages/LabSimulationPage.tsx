import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Shield,
  Server,
  Cpu,
  LayoutDashboard,
  ArrowRight,
  Play,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Plug,
  Copy,
  Check,
  Upload,
  FileSpreadsheet,
  Network,
  Wrench,
} from 'lucide-react';
import { LAB_SIMULATION_SCENARIOS } from '../data/cicIdsData';
import {
  AlertRecord,
  LiveFlowRow,
  LiveSessionStats,
  LiveThroughputPoint,
  RenderApiConfig,
  SimulationScenario,
} from '../types/nids';
import { SeverityBadge } from '../components/shared/UiPrimitives';
import { ingestBatchCsvRows, ingestLiveFlow, parseCicCsv } from '../services/modelApi';

interface LabSimulationPageProps {
  activeModel: string;
  renderConfig: RenderApiConfig;
  onSyncBackendTelemetry: (payload: {
    flow?: LiveFlowRow;
    flows?: LiveFlowRow[];
    alert?: AlertRecord;
    alerts?: AlertRecord[];
    throughput?: LiveThroughputPoint[];
    liveStats?: LiveSessionStats;
  }) => void;
  onInspectAlert: (alertId: string) => void;
  onOpenInferenceSetup: () => void;
  onNotify: (
    title: string,
    description: string,
    variant?: 'success' | 'info' | 'warning' | 'danger'
  ) => void;
  recentLabAlerts: AlertRecord[];
}

const TOPOLOGY_NODES = [
  {
    id: 0,
    title: 'Attacker VM',
    subtitle: 'Kali Linux (VMware)',
    tools: 'nmap · hping3 · Hydra · sqlmap',
    icon: Terminal,
  },
  {
    id: 1,
    title: 'Firewall / Sensor',
    subtitle: 'Zeek / Suricata',
    tools: 'Live .pcap Packet Capture',
    icon: Shield,
  },
  {
    id: 2,
    title: 'Target VM',
    subtitle: 'Ubuntu Server',
    tools: 'HTTP 80 · SSH 22 · FTP 21',
    icon: Server,
  },
  {
    id: 3,
    title: 'CICFlowMeter',
    subtitle: '77 Feature Extractor',
    tools: '.pcap → CSV (77 features)',
    icon: Network,
  },
  {
    id: 4,
    title: 'Render Backend',
    subtitle: 'XGBoost /predict',
    tools: 'sentinel-ai-nids-backend',
    icon: Cpu,
  },
  {
    id: 5,
    title: 'SOC Dashboard',
    subtitle: 'Live Alerting',
    tools: 'Target Latency < 5s',
    icon: LayoutDashboard,
  },
];

export function LabSimulationPage({
  activeModel,
  renderConfig,
  onSyncBackendTelemetry,
  onInspectAlert,
  onOpenInferenceSetup,
  onNotify,
  recentLabAlerts,
}: LabSimulationPageProps) {
  const [labMode, setLabMode] = useState<'simulated' | 'vmware-guide'>('simulated');
  const [runningScenario, setRunningScenario] = useState<SimulationScenario | null>(null);
  const [activeNodeIndex, setActiveNodeIndex] = useState<number>(-1);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    '[sentinel-lab] Ready. Choose a simulated Kali Linux attack below to call POST /predict and verify end-to-end alert generation.',
    '[sentinel-lab] Topology: Kali Attacker VM -> Zeek/Suricata -> Target VM -> CICFlowMeter (77 features) -> Render /predict -> Live Alert.',
  ]);
  const [lastResult, setLastResult] = useState<AlertRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [csvUploadSummary, setCsvUploadSummary] = useState<string | null>(null);
  const [targetIpInput, setTargetIpInput] = useState('192.168.10.50');

  const timersRef = useRef<number[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRenderConnected = Boolean(
    renderConfig.enabled && renderConfig.apiUrl.trim() && renderConfig.connectionStatus === 'connected'
  );

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLines]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const copyCommand = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const runScenario = (scenario: SimulationScenario) => {
    if (runningScenario) return;

    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];

    setRunningScenario(scenario);
    setActiveNodeIndex(0);
    setTerminalLines((prev) => [
      ...prev,
      '------------------------------------------------------------------------',
      `[${new Date().toTimeString().slice(0, 8)}] Starting ${scenario.title} (${scenario.tool})`,
    ]);

    const firstSteps = scenario.logs.slice(0, 4);
    const stepDelays = [350, 800, 1250, 1750];

    firstSteps.forEach((line, idx) => {
      const timer = window.setTimeout(() => {
        setActiveNodeIndex(Math.min(idx + 1, 4));
        setTerminalLines((prev) => [...prev, line]);
      }, stepDelays[idx]);
      timersRef.current.push(timer);
    });

    const ingestTimer = window.setTimeout(async () => {
      setActiveNodeIndex(4);
      setTerminalLines((prev) => [
        ...prev,
        `[cicflowmeter] Extracted 77 numeric flow features -> POST ${renderConfig.apiUrl}/predict`,
      ]);

      try {
        const res = await ingestLiveFlow({
          sourceIp: scenario.sourceIp,
          destinationIp: scenario.targetIp,
          protocol: scenario.protocol,
          features: scenario.numericVector,
          createAlertIfAttack: true,
          alertPrefix: 'LAB',
          recommendedAction: scenario.recommendedAction,
        });

        if (!res.ok || !res.flow) {
          setTerminalLines((prev) => [
            ...prev,
            `[error] ${res.error || 'Render /predict failed'} — zero demo data generated.`,
          ]);
          onNotify('Render /predict Failed', res.error || 'Inference request failed.', 'danger');
          setRunningScenario(null);
          return;
        }

        const { inference, flow, alert, throughput, liveStats } = res;
        setActiveNodeIndex(5);

        const latencySec = (inference.latencyMs / 1000).toFixed(2);

        setTerminalLines((prev) => [
          ...prev,
          `[predict-response] HTTP ${inference.status} · Detected in ${latencySec}s (${inference.latencyMs}ms) · Render Backend (/predict)`,
          `[classification] predicted_label="${inference.normalized.attackLabel}" · probability=${inference.normalized.confidence.toFixed(1)}%`,
          alert
            ? `[soc-alert] Alert ${alert.id} (${alert.severity}) pushed to Alerts Center & Overview.`
            : `[flow-engine] Flow ${flow.id} logged to Live Traffic Monitor.`,
        ]);

        onSyncBackendTelemetry({ flow, alert, throughput, liveStats });

        if (alert) {
          onNotify(
            `${alert.attackType} Detected in ${latencySec}s`,
            `Alert ${alert.id} (${alert.severity}) persisted to Alerts Center.`,
            'danger'
          );
          setLastResult(alert);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        setTerminalLines((prev) => [...prev, `[error] ${msg}`]);
        onNotify('Backend not reachable — check /health', msg, 'danger');
      } finally {
        setRunningScenario(null);
      }
    }, 2200);

    timersRef.current.push(ingestTimer);
  };

  const handleUploadCicFlowMeterCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCsv(true);
    setCsvUploadSummary(null);
    try {
      const text = await file.text();
      const parsed = parseCicCsv(text);
      if (parsed.rows.length === 0) {
        onNotify('Invalid CSV', 'No flow rows found in the uploaded CICFlowMeter file.', 'warning');
        return;
      }
      const res = await ingestBatchCsvRows({
        rows: parsed.rows.slice(0, 100),
        pushAttacksToAlerts: true,
        fileName: file.name,
      });
      if (!res.ok) {
        onNotify('Backend not reachable — check /health', res.error || 'Batch scoring failed.', 'danger');
        return;
      }
      const scored = res.results ?? [];
      const attacks = scored.filter((r) => r.prediction === 'ATTACK').length;
      onSyncBackendTelemetry({
        flows: res.flows,
        alerts: res.createdAlerts,
        throughput: res.throughput,
        liveStats: res.liveStats,
      });
      const summary = `Scored ${scored.length} rows from ${file.name} via Live Render API · ${attacks} attacks detected · ${
        res.createdAlerts?.length ?? 0
      } alerts created`;
      setCsvUploadSummary(summary);
      onNotify('CICFlowMeter CSV Scored', summary, 'success');
    } finally {
      setUploadingCsv(false);
      e.target.value = '';
    }
  };

  const pythonBatchScript = `import pandas as pd, requests

API = "${renderConfig.apiUrl || 'https://sentinel-ai-nids-backend.onrender.com'}"
df = pd.read_csv("capture_Flow.csv")
df.columns = [c.strip() for c in df.columns]

# Clean Inf/NaN and drop non-feature columns
feature_cols = requests.get(f"{API}/labels").json()["features"]
X = df.reindex(columns=feature_cols, fill_value=0.0).replace([float("inf"), float("-inf")], 0).fillna(0)

# Send 25 flows per batch to POST /predict_batch
for i in range(0, len(X), 25):
    batch = X.iloc[i:i+25].to_dict(orient="records")
    res = requests.post(f"{API}/predict_batch", json={"flows": batch}, timeout=60)
    print(f"Batch {i//25 + 1}:", res.status_code, res.json())`;

  const vmwareSteps = [
    {
      step: 1,
      title: 'Configure VMware Lab Network (Kali Linux + Ubuntu Target)',
      desc: 'Place both Kali Attacker VM and Ubuntu Target VM on the same VMware Host-Only or NAT subnet (e.g., 192.168.10.0/24) and verify connectivity with ping.',
      cmdId: 'step-1',
      command: `ping -c 3 ${targetIpInput}`,
    },
    {
      step: 2,
      title: 'Launch Controlled Attacks from Kali Linux VM',
      desc: 'Run any of the 4 FYP validation attacks against your Ubuntu Target VM while packet capture is active:',
      cmdId: 'step-2',
      command: `# 1. PortScan (nmap TCP SYN)
sudo nmap -sS -p 1-1000 ${targetIpInput}

# 2. DoS Flood (hping3 SYN flood)
sudo hping3 --flood -S -p 80 ${targetIpInput}

# 3. SSH Brute Force (Hydra)
hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://${targetIpInput}

# 4. Web Attack — SQL Injection (sqlmap)
sqlmap -u "http://${targetIpInput}/login.php?id=1" --batch --dbs`,
    },
    {
      step: 3,
      title: 'Capture Network Traffic to .pcap using Zeek / Suricata / tcpdump',
      desc: 'On the Ubuntu Target VM or Firewall Sensor VM, capture all packets on the lab interface (eth0/ens33) into a .pcap file:',
      cmdId: 'step-3',
      command: `# Capture full packets with tcpdump / Wireshark
sudo tcpdump -i ens33 -w attack_capture.pcap

# Or inspect live alerts with Suricata / Zeek
sudo suricata -i ens33 -l /var/log/suricata/
zeek -r attack_capture.pcap`,
    },
    {
      step: 4,
      title: 'Extract 77 CIC-IDS2017 Features with CICFlowMeter',
      desc: 'Convert attack_capture.pcap into a flow-level CSV containing the exact 77 numeric CIC-IDS2017 flow features:',
      cmdId: 'step-4',
      command: `cicflowmeter -f attack_capture.pcap -c capture_Flow.csv`,
    },
    {
      step: 5,
      title: 'Send CSV Rows to POST /predict_batch & Watch Live Alerts',
      desc: 'Upload capture_Flow.csv directly below or stream it with Python to your Render backend — detected attacks appear immediately in Alerts Center.',
      cmdId: 'step-5',
      command: pythonBatchScript,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header + Two-Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
            Lab Simulation &amp; VMware Kali Linux Testbed
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Validate end-to-end detection via Simulated Kali Attacks (POST /predict) or follow the Real VMware Kali Linux Lab Guide
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E]">
            <button
              type="button"
              onClick={() => setLabMode('simulated')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                labMode === 'simulated'
                  ? 'bg-[#0F2A44] dark:bg-[#2563EB] text-white'
                  : 'text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              A) Live API Attack Test
            </button>
            <button
              type="button"
              onClick={() => setLabMode('vmware-guide')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                labMode === 'vmware-guide'
                  ? 'bg-[#0F2A44] dark:bg-[#2563EB] text-white'
                  : 'text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              B) Real Lab Guide (VMware Kali)
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenInferenceSetup}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
              isRenderConnected
                ? 'bg-[#059669]/10 text-[#059669] dark:text-[#6EE7B7] border-[#059669]/25'
                : 'bg-[#D97706]/10 text-[#D97706] dark:text-[#FCD34D] border-[#D97706]/25'
            }`}
          >
            <Plug className="w-3.5 h-3.5" />
            {isRenderConnected ? 'Render /predict Ready' : 'Check Backend /health'}
          </button>
        </div>
      </div>

      {/* 6-Node End-to-End VMware Topology Diagram */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              End-to-End VMware Kali Linux Detection Topology
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Kali Attacker VM → Zeek/Suricata Sensor → Ubuntu Target VM → CICFlowMeter (77 features) → Render Backend /predict → Dashboard
            </p>
          </div>
          <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
            Model: {activeModel} · Target &lt; 5s
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-stretch">
          {TOPOLOGY_NODES.map((node, idx) => {
            const Icon = node.icon;
            const isActive = activeNodeIndex === idx;
            const isPassed = activeNodeIndex > idx;
            return (
              <div key={node.id} className="relative flex items-center">
                <div
                  className={`w-full h-full rounded-xl p-3 border transition-all duration-200 ${
                    isActive
                      ? 'bg-[#2563EB]/10 dark:bg-[#2563EB]/20 border-[#2563EB] shadow-sm'
                      : isPassed
                      ? 'bg-[#059669]/[0.06] dark:bg-[#059669]/15 border-[#059669]/40'
                      : 'bg-[#F8FAFC] dark:bg-[#0B1B2B] border-[#E2E8F0] dark:border-[#1E354E]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isActive
                          ? 'bg-[#2563EB] text-white'
                          : isPassed
                          ? 'bg-[#059669] text-white'
                          : 'bg-[#0F2A44]/10 dark:bg-slate-800 text-[#0F2A44] dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold text-[#64748B] dark:text-[#94A3B8]">
                      0{idx + 1}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-white leading-snug">
                    {node.title}
                  </p>
                  <p className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] truncate">
                    {node.subtitle}
                  </p>
                  <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1 truncate">
                    {node.tools}
                  </p>
                </div>
                {idx < TOPOLOGY_NODES.length - 1 && (
                  <ArrowRight className="hidden lg:block w-3.5 h-3.5 text-[#94A3B8] shrink-0 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MODE A: SIMULATED DEMO */}
      {labMode === 'simulated' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {LAB_SIMULATION_SCENARIOS.map((scenario) => {
              const isThisRunning = runningScenario?.id === scenario.id;
              return (
                <div
                  key={scenario.id}
                  className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-[#0891B2]">
                        {scenario.tool}
                      </span>
                      <SeverityBadge severity={scenario.severity} />
                    </div>
                    <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white mt-1.5">
                      {scenario.title}
                    </h3>
                    <p className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] mt-1 break-all bg-[#F8FAFC] dark:bg-[#0B1B2B] px-2 py-1.5 rounded border border-[#E2E8F0] dark:border-[#1E354E]">
                      $ {scenario.command}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(runningScenario)}
                    onClick={() => runScenario(scenario)}
                    className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-55 ${
                      isThisRunning
                        ? 'bg-[#D97706] text-white'
                        : 'bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isThisRunning ? 'Calling /predict...' : scenario.buttonLabel}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Live Terminal */}
            <div className="xl:col-span-2 rounded-xl bg-[#0B1B2B] border border-slate-800 shadow-xs overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 bg-[#08121E] border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#38BDF8]" />
                  <span className="text-xs font-mono font-semibold text-slate-200">
                    kali@sentinel-lab:~/nids-test — Live /predict Execution Log
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTerminalLines([
                      '[sentinel-lab] Terminal cleared. Select an attack button above to call POST /predict.',
                    ])
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              </div>

              <div className="p-4 font-mono text-xs leading-relaxed text-slate-200 h-[310px] overflow-y-auto space-y-1.5">
                {terminalLines.map((line, i) => {
                  const isError = line.includes('[error]');
                  const isAlert = line.includes('[soc-alert]') || line.includes('[classification]');
                  const isModel = line.includes('[predict-response]') || line.includes('[cicflowmeter]');
                  return (
                    <div
                      key={`${i}-${line.slice(0, 14)}`}
                      className={
                        isError
                          ? 'text-[#FCA5A5]'
                          : isAlert
                          ? 'text-[#34D399] font-semibold'
                          : isModel
                          ? 'text-[#38BDF8]'
                          : 'text-slate-300'
                      }
                    >
                      {line}
                    </div>
                  );
                })}
                <div ref={terminalEndRef} />
              </div>
            </div>

            {/* Latest Detection Result Card */}
            <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white mb-3">
                  Latest Detection Result
                </h2>
                {lastResult ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/25 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] dark:text-[#FCA5A5]">
                          <AlertTriangle className="w-4 h-4" />
                          {lastResult.attackType}
                        </span>
                        <SeverityBadge severity={lastResult.severity} />
                      </div>
                      <p className="text-xs font-mono text-[#0F172A] dark:text-white mt-2 tabular-nums">
                        Alert {lastResult.id} · Detected in {lastResult.detectionLatency}
                      </p>
                      <p className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] mt-1">
                        {lastResult.sourceIp} → {lastResult.destinationIp}:{lastResult.dstPort}
                      </p>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#64748B] dark:text-[#94A3B8]">Confidence</span>
                        <span className="font-mono font-bold text-[#2563EB] tabular-nums">
                          {lastResult.confidence.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B] dark:text-[#94A3B8]">Engine</span>
                        <span className="font-mono text-[#0F172A] dark:text-white">
                          {lastResult.modelUsed}
                        </span>
                      </div>
                    </div>

                    {lastResult.top3 && lastResult.top3.length > 0 && (
                      <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E354E] space-y-1">
                        <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                          Top-3 Probabilities
                        </p>
                        {lastResult.top3.map((t) => (
                          <div key={t.label} className="flex items-center justify-between text-[11px]">
                            <span className="text-[#0F172A] dark:text-slate-200">{t.label}</span>
                            <span className="font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                              {t.probability.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onInspectAlert(lastResult.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#0F2A44] dark:bg-[#2563EB] text-white hover:opacity-95 cursor-pointer"
                    >
                      Inspect in Alerts Center
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0B1B2B] border border-dashed border-[#E2E8F0] dark:border-[#1E354E] p-6 text-center">
                    <CheckCircle2 className="w-6 h-6 text-[#0891B2] mx-auto mb-2" />
                    <p className="text-xs font-medium text-[#0F172A] dark:text-white">
                      No Attack Run Yet
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                      Click any of the 4 Kali attack buttons above to execute a live /predict detection test.
                    </p>
                  </div>
                )}
              </div>

              {recentLabAlerts.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#1E354E]">
                  <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-2">
                    Recent Lab Alerts ({recentLabAlerts.length})
                  </p>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {recentLabAlerts.slice(0, 4).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onInspectAlert(a.id)}
                        className="w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0B1B2B] hover:bg-slate-100 dark:hover:bg-[#0F2A44] text-xs cursor-pointer"
                      >
                        <span className="font-medium text-[#0F172A] dark:text-white truncate">
                          <span className="font-mono text-[#2563EB] mr-1.5">{a.id}</span>
                          {a.attackType}
                        </span>
                        <span className="font-mono text-[11px] text-[#64748B] tabular-nums shrink-0">
                          {a.detectionLatency}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODE B: REAL LAB GUIDE (VMWARE KALI LINUX) */}
      {labMode === 'vmware-guide' && (
        <div className="space-y-4">
          {/* Target IP Customizer */}
          <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                VMware Target Ubuntu IP (Auto-fills All Commands Below)
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Enter your Ubuntu Target VM IP from VMware Host-Only/NAT network
              </p>
            </div>
            <input
              type="text"
              value={targetIpInput}
              onChange={(e) => setTargetIpInput(e.target.value)}
              aria-label="Target VM IP Address"
              className="h-9 px-3 rounded-lg text-xs font-mono bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white w-full sm:w-52 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          {/* 5 Step-by-Step Cards */}
          <div className="space-y-3.5">
            {vmwareSteps.map((item) => (
              <div
                key={item.step}
                className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#0F2A44] dark:bg-[#2563EB] text-white text-xs font-mono font-bold flex items-center justify-center shrink-0">
                      {item.step}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyCommand(item.cmdId, item.command)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:border-[#2563EB] cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    {copiedId === item.cmdId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#059669]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-3.5 rounded-lg bg-[#0B1B2B] border border-slate-800 text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed">
                  {item.command}
                </pre>

                {item.step === 5 && (
                  <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E354E] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-[#0F172A] dark:text-slate-200">
                      <FileSpreadsheet className="w-4 h-4 text-[#0891B2] shrink-0" />
                      <span>
                        Or upload your <span className="font-mono font-semibold">capture_Flow.csv</span> right here to score via <span className="font-mono">POST /predict_batch</span>:
                      </span>
                    </div>
                    <div className="shrink-0">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleUploadCicFlowMeterCsv}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploadingCsv}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#059669] hover:bg-[#047857] text-white cursor-pointer disabled:opacity-55 whitespace-nowrap"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingCsv ? 'Scoring CSV...' : 'Upload CICFlowMeter CSV'}
                      </button>
                    </div>
                  </div>
                )}

                {item.step === 5 && csvUploadSummary && (
                  <div className="rounded-lg bg-[#059669]/10 border border-[#059669]/25 px-3.5 py-2.5 text-xs text-[#059669] dark:text-[#6EE7B7] font-medium">
                    {csvUploadSummary}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
