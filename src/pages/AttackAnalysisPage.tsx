import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  Flame,
  Radar,
  KeyRound,
  Globe,
  Bot,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';
import {
  ATTACK_ANALYSIS_CARDS,
  ATTACK_HEATMAP_DATA,
  ATTACK_HEATMAP_DAYS,
  ATTACK_HEATMAP_HOURS,
  ATTACK_TIMELINE_BY_HOUR,
  ATTACKER_IPS_BY_CATEGORY,
  TARGET_PORTS_DATA,
  formatNumber,
} from '../data/cicIdsData';
import { AttackCategory } from '../types/nids';
import { SeverityBadge } from '../components/shared/UiPrimitives';

interface AttackAnalysisPageProps {
  selectedCategory: AttackCategory;
  onSelectCategory: (cat: AttackCategory) => void;
  isDark: boolean;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'DoS/DDoS': Flame,
  PortScan: Radar,
  'Brute Force': KeyRound,
  'Web Attack': Globe,
  Bot: Bot,
  Infiltration: ShieldAlert,
};

export function AttackAnalysisPage({
  selectedCategory,
  onSelectCategory,
  isDark,
}: AttackAnalysisPageProps) {
  const gridStroke = isDark ? '#1E354E' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0B1B2B' : '#FFFFFF',
    borderColor: isDark ? '#1E354E' : '#E2E8F0',
    borderRadius: '10px',
    fontSize: '12px',
    color: isDark ? '#F1F5F9' : '#0F172A',
  };

  const timelineData = useMemo(() => {
    return ATTACK_TIMELINE_BY_HOUR.map((row) => {
      if (selectedCategory === 'All') {
        const total =
          row['DoS/DDoS'] +
          row.PortScan +
          row['Brute Force'] +
          row['Web Attack'] +
          row.Bot +
          row.Infiltration +
          row.Heartbleed;
        return { hour: row.hour, flows: total };
      }
      if (selectedCategory === 'Infiltration') {
        return { hour: row.hour, flows: row.Infiltration + row.Heartbleed };
      }
      return {
        hour: row.hour,
        flows: row[selectedCategory as keyof typeof row] as number,
      };
    });
  }, [selectedCategory]);

  const heatmapMatrix = ATTACK_HEATMAP_DATA[selectedCategory] || ATTACK_HEATMAP_DATA.All;
  const heatmapMax = useMemo(() => {
    const flat = heatmapMatrix.flat();
    return Math.max(...flat, 1);
  }, [heatmapMatrix]);

  const attackerIps = ATTACKER_IPS_BY_CATEGORY[selectedCategory] || ATTACKER_IPS_BY_CATEGORY.All;

  const targetPorts = useMemo(() => {
    return TARGET_PORTS_DATA.map((p) => {
      let count = p.all;
      if (selectedCategory !== 'All' && selectedCategory !== 'Heartbleed') {
        count = p[selectedCategory];
      } else if (selectedCategory === 'Heartbleed') {
        count = p.port === '443' ? 11 : 0;
      }
      return {
        portLabel: `${p.port} (${p.service})`,
        count,
      };
    }).sort((a, b) => b.count - a.count);
  }, [selectedCategory]);

  const getHeatCellColor = (value: number) => {
    if (value === 0) return isDark ? 'bg-[#0B1B2B]' : 'bg-[#F1F5F9]';
    const ratio = value / heatmapMax;
    if (ratio > 0.75) return 'bg-[#DC2626] text-white';
    if (ratio > 0.45) return 'bg-[#EA580C] text-white';
    if (ratio > 0.2) return 'bg-[#D97706]/85 text-white';
    return 'bg-[#2563EB]/25 dark:bg-[#2563EB]/40 text-[#0F172A] dark:text-white';
  };

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
            Attack Analysis
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Click any attack category card below to filter timeline, hourly heatmap, attacker IPs, and target ports
          </p>
        </div>

        {selectedCategory !== 'All' && (
          <button
            type="button"
            onClick={() => onSelectCategory('All')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Showing: {selectedCategory} · Reset to All
          </button>
        )}
      </div>

      {/* 6 Attack Type Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ATTACK_ANALYSIS_CARDS.map((card) => {
          const Icon = CATEGORY_ICONS[card.category] || ShieldAlert;
          const isSelected = selectedCategory === card.category;
          return (
            <button
              key={card.category}
              type="button"
              onClick={() =>
                onSelectCategory(isSelected ? 'All' : card.category)
              }
              className={`rounded-xl p-4 text-left border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                isSelected
                  ? 'bg-[#2563EB]/[0.06] dark:bg-[#2563EB]/20 border-[#2563EB] ring-1 ring-[#2563EB]'
                  : 'bg-white dark:bg-[#112236] border-[#E2E8F0] dark:border-[#1E354E] hover:border-[#2563EB]/60 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#F1F5F9] dark:bg-[#0F2A44] text-[#0F2A44] dark:text-[#38BDF8]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] dark:text-white truncate">
                      {card.label}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                      {card.dayObserved} · {card.primaryTool}
                    </p>
                  </div>
                </div>
                <SeverityBadge severity={card.severity} />
              </div>

              <div className="flex items-baseline justify-between pt-2 border-t border-[#E2E8F0] dark:border-[#1E354E]">
                <div>
                  <span className="text-xl font-bold text-[#0F172A] dark:text-white tabular-nums">
                    {formatNumber(card.count)}
                  </span>
                  <span className="text-xs text-[#64748B] dark:text-[#94A3B8] ml-1.5 tabular-nums">
                    ({card.sharePercent} share)
                  </span>
                </div>
                <span className="text-xs font-mono font-semibold text-[#0891B2] tabular-nums">
                  {card.trend}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Row 2: Attack Timeline + Attack by Hour Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attack Timeline */}
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Attack Timeline ({selectedCategory === 'All' ? 'All Attack Types' : selectedCategory})
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Hourly attack volume across working hours (09:00 – 17:00)
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="attackTimelineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 11, fill: axisColor }}
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
                <Area
                  type="monotone"
                  dataKey="flows"
                  stroke="#DC2626"
                  strokeWidth={2.2}
                  fill="url(#attackTimelineGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attack by Hour Heatmap */}
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 flex flex-col justify-between">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Attack Intensity by Day & Hour Heatmap
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Filter: {selectedCategory} · Hover cells for exact flow volume
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <div className="grid grid-cols-9 gap-1.5 mb-1.5">
                <div />
                {ATTACK_HEATMAP_HOURS.map((h) => (
                  <div
                    key={h}
                    className="text-center text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8]"
                  >
                    {h.slice(0, 2)}h
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {ATTACK_HEATMAP_DAYS.map((day, rowIdx) => (
                  <div key={day} className="grid grid-cols-9 gap-1.5 items-center">
                    <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] pr-1">
                      {day}
                    </div>
                    {heatmapMatrix[rowIdx].map((val, colIdx) => (
                      <div
                        key={`${day}-${colIdx}`}
                        title={`${day} ${ATTACK_HEATMAP_HOURS[colIdx]}: ${formatNumber(val)} attack flows`}
                        className={`h-8 rounded-md flex items-center justify-center text-[10px] font-mono font-semibold tabular-nums transition-transform hover:scale-[1.03] ${getHeatCellColor(
                          val
                        )}`}
                      >
                        {val === 0 ? '—' : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#1E354E] flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            <span>Intensity Scale</span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-xs bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-slate-300 dark:border-slate-700" />
                None
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-xs bg-[#2563EB]/30" />
                Low
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-xs bg-[#D97706]" />
                Med
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-xs bg-[#EA580C]" />
                High
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-xs bg-[#DC2626]" />
                Peak
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Top Attacker IPs + Target Ports Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Top Attacker IPs ({selectedCategory})
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Most active offensive source addresses observed in filtered category
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={attackerIps}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <YAxis
                  type="category"
                  dataKey="ip"
                  width={110}
                  tick={{ fontSize: 11, fill: axisColor, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: unknown) => [formatNumber(Number(value)), 'Attack Flows']}
                />
                <Bar dataKey="count" fill="#2563EB" radius={[0, 6, 6, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Target Ports Distribution ({selectedCategory})
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Primary service ports targeted (22 SSH, 21 FTP, 80 HTTP, 443 HTTPS, 8080, 445)
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={targetPorts} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="portLabel"
                  tick={{ fontSize: 11, fill: axisColor }}
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
                  formatter={(value: unknown) => [formatNumber(Number(value)), 'Targeted Flows']}
                />
                <Bar dataKey="count" fill="#0891B2" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
