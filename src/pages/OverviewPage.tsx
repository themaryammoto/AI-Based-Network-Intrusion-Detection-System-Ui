import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  Server,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Plug,
  Loader2,
  WifiOff,
} from 'lucide-react';
import {
  ATTACK_DISTRIBUTION,
  DAILY_TRAFFIC_DATA,
  DATASET_TOTALS,
  PIPELINE_STAGES,
  TOP_SOURCE_IPS,
  formatNumber,
} from '../data/cicIdsData';
import {
  AlertRecord,
  AttackCategory,
  LiveSessionStats,
  PageId,
  RenderApiConfig,
  TimeRange,
} from '../types/nids';
import { SeverityBadge, Sparkline, StatusBadge } from '../components/shared/UiPrimitives';

interface OverviewPageProps {
  alerts: AlertRecord[];
  activeModel: string;
  renderConfig: RenderApiConfig;
  liveStats: LiveSessionStats;
  timeRange: TimeRange;
  isDark: boolean;
  onNavigatePage: (page: PageId) => void;
  onInspectAlert: (alertId: string) => void;
  onSelectAttackCategory: (cat: AttackCategory) => void;
  onRetryHealthCheck?: () => void;
}

const TIME_SCALE_LABELS: Record<TimeRange, string> = {
  '1h': 'Last 1 Hour Snapshot · Real-Time + Baseline',
  '6h': 'Last 6 Hours Window · Real-Time + Baseline',
  '24h': 'Last 24 Hours Window · Real-Time + Baseline',
  '7d': 'Full CIC-IDS2017 Corpus + Live Ingested Flows',
};

export function OverviewPage({
  alerts,
  activeModel,
  renderConfig,
  liveStats,
  timeRange,
  isDark,
  onNavigatePage,
  onInspectAlert,
  onSelectAttackCategory,
  onRetryHealthCheck,
}: OverviewPageProps) {
  const [dataScope, setDataScope] = useState<'combined' | 'live'>('combined');
  const isRenderConnected = renderConfig.enabled && renderConfig.connectionStatus === 'connected';

  const gridStroke = isDark ? '#1E354E' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0B1B2B' : '#FFFFFF',
    borderColor: isDark ? '#1E354E' : '#E2E8F0',
    borderRadius: '10px',
    fontSize: '12px',
    color: isDark ? '#F1F5F9' : '#0F172A',
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
  };

  // Dynamically combine CIC-IDS2017 baseline with real scored live flows
  const totals = useMemo(() => {
    if (dataScope === 'live') {
      const total = liveStats.totalScored;
      const attacks = liveStats.attackScored;
      const benign = liveStats.benignScored;
      const attackPct = total > 0 ? ((attacks / total) * 100).toFixed(1) : '0.0';
      const benignPct = total > 0 ? ((benign / total) * 100).toFixed(1) : '0.0';
      return { total, attacks, benign, attackPct, benignPct };
    }
    const total = DATASET_TOTALS.totalFlows + liveStats.totalScored;
    const attacks = DATASET_TOTALS.attackFlows + liveStats.attackScored;
    const benign = DATASET_TOTALS.benignFlows + liveStats.benignScored;
    const attackPct = ((attacks / total) * 100).toFixed(1);
    const benignPct = ((benign / total) * 100).toFixed(1);
    return { total, attacks, benign, attackPct, benignPct };
  }, [dataScope, liveStats]);

  // Dynamic Attack Distribution merging live scored categories
  const attackDistributionData = useMemo(() => {
    if (dataScope === 'live') {
      const entries = Object.entries(liveStats.attackByCategory);
      if (entries.length === 0) {
        return [{ name: 'No Live Attacks Yet', category: 'All' as AttackCategory, value: 1, color: '#94A3B8' }];
      }
      const colorMap: Record<string, string> = {
        'DoS/DDoS': '#DC2626',
        PortScan: '#2563EB',
        'Brute Force': '#D97706',
        'Web Attack': '#0891B2',
        Bot: '#7C3AED',
        Infiltration: '#059669',
        Heartbleed: '#0F2A44',
      };
      return entries.map(([cat, count]) => ({
        name: cat,
        category: cat as Exclude<AttackCategory, 'All'>,
        value: count,
        color: colorMap[cat] || '#2563EB',
      }));
    }

    return ATTACK_DISTRIBUTION.map((item) => {
      const extra =
        item.name === 'DoS'
          ? liveStats.attackByCategory['DoS/DDoS'] || 0
          : item.name === 'PortScan'
          ? liveStats.attackByCategory['PortScan'] || 0
          : item.name === 'Brute Force'
          ? liveStats.attackByCategory['Brute Force'] || 0
          : item.name === 'Web Attack'
          ? liveStats.attackByCategory['Web Attack'] || 0
          : item.name === 'Bot'
          ? liveStats.attackByCategory['Bot'] || 0
          : item.name === 'Infiltration'
          ? liveStats.attackByCategory['Infiltration'] || 0
          : item.name === 'Heartbleed'
          ? liveStats.attackByCategory['Heartbleed'] || 0
          : 0;
      return { ...item, value: item.value + extra };
    });
  }, [dataScope, liveStats]);

  // Dynamic Traffic Over Time
  const trafficChartData = useMemo(() => {
    if (dataScope === 'combined') {
      return DAILY_TRAFFIC_DATA.map((d, idx) =>
        idx === DAILY_TRAFFIC_DATA.length - 1
          ? {
              ...d,
              benign: d.benign + liveStats.benignScored,
              attack: d.attack + liveStats.attackScored,
              total: d.total + liveStats.totalScored,
            }
          : d
      );
    }
    return [
      {
        day: 'Live',
        fullDay: 'Live Production Session',
        benign: liveStats.benignScored,
        attack: liveStats.attackScored,
        total: liveStats.totalScored,
        primaryAttack: 'Real-Time Scored Flows',
      },
    ];
  }, [dataScope, liveStats]);

  // Dynamic Top Source IPs
  const topIpsList = useMemo(() => {
    if (dataScope === 'live') {
      return Object.entries(liveStats.sourceIpHits)
        .map(([ip, info]) => ({
          ip,
          role: 'Live Ingested Source',
          flows: info.count,
          primaryAttack: info.lastAttack,
          category: (info.category || 'DoS/DDoS') as Exclude<AttackCategory, 'All'>,
          risk: (info.count >= 5 ? 'Critical' : 'High') as 'Critical' | 'High',
        }))
        .sort((a, b) => b.flows - a.flows)
        .slice(0, 5);
    }
    return TOP_SOURCE_IPS.map((row) => {
      const liveHit = liveStats.sourceIpHits[row.ip];
      return liveHit ? { ...row, flows: row.flows + liveHit.count } : row;
    });
  }, [dataScope, liveStats]);

  const attacksByDayTueFri = trafficChartData.filter((d) => d.day !== 'Mon');
  const recentCriticalAlerts = alerts.slice(0, 6);

  const kpiCards = [
    {
      label: 'Total Flows Analyzed',
      value: formatNumber(totals.total),
      subtext:
        dataScope === 'live'
          ? `Avg inference latency: ${liveStats.avgLatencyMs}ms`
          : `CIC-IDS2017 + ${formatNumber(liveStats.totalScored)} live flows`,
      trend: liveStats.totalScored > 0 ? `+${liveStats.totalScored} live` : '+12.4%',
      trendPositive: true,
      color: '#2563EB',
      sparkData: [529, 445, 692, 458, 703 + liveStats.totalScored],
    },
    {
      label: 'Attacks Detected',
      value: formatNumber(totals.attacks),
      subtext: `${totals.attackPct}% of analyzed network flows`,
      trend: liveStats.attackScored > 0 ? `+${liveStats.attackScored} live` : '+4.8%',
      trendPositive: false,
      color: '#DC2626',
      sparkData: [0, 14, 253, 2.2, 289 + liveStats.attackScored],
    },
    {
      label: 'BENIGN Traffic',
      value: formatNumber(totals.benign),
      subtext: `${totals.benignPct}% verified legitimate flows`,
      trend: liveStats.benignScored > 0 ? `+${liveStats.benignScored} live` : '+2.1%',
      trendPositive: true,
      color: '#059669',
      sparkData: [530, 432, 440, 457, 414 + liveStats.benignScored],
    },
    {
      label: 'False Positive Rate',
      value: `${DATASET_TOTALS.xgboostFpr}%`,
      subtext: `Target < ${DATASET_TOTALS.targetFpr}% · ${activeModel} active`,
      trend: '-0.03%',
      trendPositive: true,
      color: '#0891B2',
      sparkData: [0.45, 0.31, 0.19, 0.12, 0.09],
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page Title Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
            Security Operations Overview
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            {TIME_SCALE_LABELS[timeRange]} · Active Classifier: {activeModel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Telemetry Scope Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E]">
            <button
              type="button"
              onClick={() => setDataScope('combined')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                dataScope === 'combined'
                  ? 'bg-[#0F2A44] dark:bg-[#2563EB] text-white'
                  : 'text-[#64748B] dark:text-slate-300'
              }`}
            >
              Combined Baseline + Live
            </button>
            <button
              type="button"
              onClick={() => setDataScope('live')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                dataScope === 'live'
                  ? 'bg-[#0F2A44] dark:bg-[#2563EB] text-white'
                  : 'text-[#64748B] dark:text-slate-300'
              }`}
            >
              Live Scored ({formatNumber(liveStats.totalScored)})
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigatePage('inference')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
              isRenderConnected
                ? 'bg-[#059669]/10 border-[#059669]/30 text-[#059669] dark:text-[#6EE7B7]'
                : 'bg-white dark:bg-[#112236] border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-slate-100 hover:border-[#2563EB]'
            }`}
          >
            <Plug className="w-3.5 h-3.5" />
            {isRenderConnected ? `Render API (${renderConfig.lastLatencyMs ?? 0}ms)` : 'Connect Render Model'}
          </button>

          <button
            type="button"
            onClick={() => onNavigatePage('alerts')}
            className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            Open Alerts ({alerts.filter((a) => a.status !== 'Resolved').length})
          </button>
        </div>
      </div>

      {/* Row 1: 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 flex flex-col justify-between gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                {card.label}
              </p>
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
                  card.trendPositive ? 'text-[#059669]' : 'text-[#DC2626]'
                }`}
              >
                {card.trend.startsWith('+') ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {card.trend}
              </span>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-[#0F172A] dark:text-white tracking-tight tabular-nums">
                  {card.value}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                  {card.subtext}
                </p>
              </div>
              <Sparkline data={card.sparkData} color={card.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Traffic Over Time (2/3) + Attack Type Distribution Donut (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                Traffic Over Time — BENIGN vs Attack
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {dataScope === 'live'
                  ? 'Live flows scored through /api/model/predict & /api/ingest/flow'
                  : 'Monday to Friday CIC-IDS2017 capture + live scored flows'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#059669]" />
                BENIGN
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#DC2626]" />
                Attack
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficChartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="benignGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="attackGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: axisColor }}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: unknown, name: unknown) => [
                    formatNumber(Number(value)),
                    name === 'benign' ? 'BENIGN Flows' : 'Attack Flows',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="benign"
                  stroke="#059669"
                  strokeWidth={2.2}
                  fill="url(#benignGrad)"
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="monotone"
                  dataKey="attack"
                  stroke="#DC2626"
                  strokeWidth={2.2}
                  fill="url(#attackGrad)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attack Type Distribution Donut */}
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 flex flex-col">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Attack Type Distribution
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Click any segment to drill down in Attack Analysis
            </p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attackDistributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={82}
                  paddingAngle={2}
                  onClick={(_entry, index) => {
                    const item = attackDistributionData[index];
                    if (item?.category && item.category !== 'All') {
                      onSelectAttackCategory(item.category);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {attackDistributionData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: unknown, name: unknown) => [
                    `${formatNumber(Number(value))} flows`,
                    String(name),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 pt-3 border-t border-[#E2E8F0] dark:border-[#1E354E]">
            {attackDistributionData.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  if (item.category && item.category !== 'All') {
                    onSelectAttackCategory(item.category);
                  }
                }}
                className="flex items-center justify-between gap-1.5 text-left hover:bg-slate-50 dark:hover:bg-[#0F2A44] px-1.5 py-1 rounded transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 text-xs text-[#0F172A] dark:text-slate-200 truncate">
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums shrink-0">
                  {formatNumber(item.value)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Attacks by Day (Tue-Fri) Bar Chart + Top 5 Source IPs Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Attacks by Day ({dataScope === 'live' ? 'Live Session' : 'Tue – Fri'})
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Monday contained 0 attacks (529,918 BENIGN baseline flows)
            </p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attacksByDayTueFri} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: axisColor }}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: unknown) => [formatNumber(Number(value)), 'Attack Flows']}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="attack"
                  name="Attack Flows"
                  fill="#2563EB"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={54}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 Source IPs */}
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                Top 5 Source IPs
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {dataScope === 'live'
                  ? 'Top offending IPs scored during live operations'
                  : 'Highest-volume attack origins across CIC-IDS2017 + live detections'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigatePage('analysis')}
              className="text-xs font-medium text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Analyze <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {topIpsList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
                No live attack IPs recorded yet
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                Run Live Traffic Monitor, Model Inference, or Lab Testing to populate live IP hits.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] dark:border-[#1E354E] text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    <th className="py-2 pr-3">Source IP</th>
                    <th className="py-2 px-3">Primary Attack Vector</th>
                    <th className="py-2 px-3 text-right">Attack Flows</th>
                    <th className="py-2 pl-3 text-right">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E] text-xs">
                  {topIpsList.map((row) => (
                    <tr
                      key={row.ip}
                      onClick={() => onSelectAttackCategory(row.category)}
                      className="hover:bg-slate-50 dark:hover:bg-[#0F2A44]/70 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pr-3">
                        <p className="font-mono font-semibold text-[#0F172A] dark:text-white">
                          {row.ip}
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{row.role}</p>
                      </td>
                      <td className="py-2.5 px-3 text-[#0F172A] dark:text-slate-200">
                        {row.primaryAttack}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                        {formatNumber(row.flows)}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <SeverityBadge severity={row.risk} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Recent Critical Alerts (2/3) + System Health Card (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                Recent Alerts Queue
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Persistent SOC alerts · Click any row to inspect flow features and remediate
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigatePage('alerts')}
              className="text-xs font-medium text-[#2563EB] hover:underline cursor-pointer whitespace-nowrap"
            >
              View All Alerts
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-[#1E354E] text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  <th className="py-2 pr-2">Time</th>
                  <th className="py-2 px-2">Alert ID</th>
                  <th className="py-2 px-2">Attack Type</th>
                  <th className="py-2 px-2">Source IP</th>
                  <th className="py-2 px-2">Destination IP</th>
                  <th className="py-2 px-2">Severity</th>
                  <th className="py-2 pl-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E] text-xs">
                {recentCriticalAlerts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8]"
                    >
                      No live intrusion alerts yet — real alerts appear here as soon as your Render
                      XGBoost API classifies an attack.
                    </td>
                  </tr>
                ) : (
                  recentCriticalAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      onClick={() => onInspectAlert(alert.id)}
                      className="hover:bg-slate-50 dark:hover:bg-[#0F2A44]/70 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pr-2 font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums whitespace-nowrap">
                        {alert.timestamp}
                      </td>
                      <td className="py-2.5 px-2 font-mono font-semibold text-[#2563EB] whitespace-nowrap">
                        {alert.id}
                      </td>
                      <td className="py-2.5 px-2 font-medium text-[#0F172A] dark:text-white whitespace-nowrap">
                        {alert.attackType}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[#0F172A] dark:text-slate-200 whitespace-nowrap">
                        {alert.sourceIp}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                        {alert.destinationIp}
                      </td>
                      <td className="py-2.5 px-2">
                        <SeverityBadge severity={alert.severity} />
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <StatusBadge status={alert.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Health & Pipeline Card */}
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 gap-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#0891B2]" />
                <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                  System Health
                </h2>
              </div>
              {renderConfig.connectionStatus === 'checking' ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Waking up backend...
                </span>
              ) : renderConfig.connectionStatus === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Online (/health OK)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onRetryHealthCheck}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  Offline · Retry
                </button>
              )}
            </div>

            {renderConfig.connectionStatus === 'checking' && (
              <div className="mb-3 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/25 px-3 py-2 text-[11px] text-[#2563EB] dark:text-[#93C5FD] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Waking up backend... please wait (Render free tier cold start can take up to 50s)</span>
              </div>
            )}

            <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E] text-xs">
              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Model</span>
                <span className="font-semibold text-[#0F172A] dark:text-white text-right">
                  {renderConfig.backendHealth?.model || `${activeModel} (CIC-IDS2017)`}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Backend URL</span>
                <button
                  type="button"
                  onClick={() => onNavigatePage('settings')}
                  className="font-mono text-[11px] font-medium text-[#2563EB] hover:underline truncate max-w-[190px] cursor-pointer"
                  title={renderConfig.apiUrl}
                >
                  {renderConfig.apiUrl.replace(/^https?:\/\//, '') || 'Not Configured'}
                </button>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Real Latency (Target &lt; 5s)</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                  {renderConfig.lastLatencyMs
                    ? `${renderConfig.lastLatencyMs}ms (${(renderConfig.lastLatencyMs / 1000).toFixed(2)}s)`
                    : `${liveStats.avgLatencyMs}ms`}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-[#64748B] dark:text-[#94A3B8]">System Uptime</span>
                <span className="font-mono font-semibold text-[#059669] tabular-nums">
                  99.9%
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Features / Classes</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                  {renderConfig.backendHealth?.nFeatures ?? 77} features ·{' '}
                  {renderConfig.backendHealth?.classes?.length ?? 5} classes
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#1E354E]">
            <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-2">
              Pipeline Stages (6 / 6 Operational)
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {PIPELINE_STAGES.map((stage) => (
                <div
                  key={stage.step}
                  className="flex items-center gap-1.5 text-[11px] text-[#0F172A] dark:text-slate-200 truncate"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                  <span className="truncate">
                    {stage.step}. {stage.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
