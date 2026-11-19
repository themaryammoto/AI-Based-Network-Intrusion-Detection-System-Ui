import React, { useMemo, useState, useEffect } from 'react';
import {
  Search,
  CheckCheck,
  Download,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Check,
  ShieldCheck,
  RotateCcw,
  Trash2,
  Eye,
} from 'lucide-react';
import { AlertRecord, AlertStatus, Severity } from '../types/nids';
import { SeverityBadge, StatusBadge } from '../components/shared/UiPrimitives';

interface AlertsCenterPageProps {
  alerts: AlertRecord[];
  globalSearch: string;
  focusedAlertId: string | null;
  onClearFocusedAlert: () => void;
  onUpdateAlertStatus: (id: string, status: AlertStatus) => void;
  onDeleteAlert: (id: string) => void;
  onAcknowledgeAll: () => void;
  onExportSuccess: (message: string) => void;
}

type SortField = 'timestamp' | 'id' | 'attackType' | 'sourceIp' | 'severity' | 'confidence' | 'status';

const SEVERITY_ORDER: Record<Severity, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function triggerCsvDownload(filename: string, rows: AlertRecord[]) {
  const headers = [
    'Alert ID',
    'Date',
    'Time',
    'Attack Type',
    'Category',
    'Source IP',
    'Destination IP',
    'Dst Port',
    'Severity',
    'Status',
    'Confidence (%)',
    'Model',
    'Latency',
    'Flow Duration',
    'Fwd Packets',
    'Bwd Packets',
    'Flow Bytes/s',
    'Recommended Action',
  ];

  const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;

  const csvLines = [
    headers.join(','),
    ...rows.map((a) =>
      [
        a.id,
        a.date,
        a.timestamp,
        a.attackType,
        a.category,
        a.sourceIp,
        a.destinationIp,
        a.dstPort,
        a.severity,
        a.status,
        a.confidence,
        a.modelUsed,
        a.detectionLatency,
        a.features.flowDuration,
        a.features.totalFwdPackets,
        a.features.totalBwdPackets,
        a.features.flowBytesPerSec,
        a.recommendedAction,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AlertsCenterPage({
  alerts,
  globalSearch,
  focusedAlertId,
  onClearFocusedAlert,
  onUpdateAlertStatus,
  onDeleteAlert,
  onAcknowledgeAll,
  onExportSuccess,
}: AlertsCenterPageProps) {
  const [severityFilter, setSeverityFilter] = useState<'All' | Severity>('All');
  const [attackTypeFilter, setAttackTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | AlertStatus>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(focusedAlertId);
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (focusedAlertId) {
      setExpandedId(focusedAlertId);
      setSeverityFilter('All');
      setAttackTypeFilter('All');
      setStatusFilter('All');
      setDateFilter('All');
      setLocalSearch('');
      onClearFocusedAlert();
    }
  }, [focusedAlertId, onClearFocusedAlert]);

  const effectiveSearch = (localSearch || globalSearch).trim().toLowerCase();

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(alerts.map((a) => a.date))).sort().reverse();
  }, [alerts]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(alerts.map((a) => a.category))).sort();
  }, [alerts]);

  const summaryCounts = useMemo(() => {
    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'Critical').length,
      high: alerts.filter((a) => a.severity === 'High').length,
      medium: alerts.filter((a) => a.severity === 'Medium').length,
      low: alerts.filter((a) => a.severity === 'Low').length,
      resolved: alerts.filter((a) => a.status === 'Resolved').length,
    };
  }, [alerts]);

  const filteredAndSorted = useMemo(() => {
    const filtered = alerts.filter((a) => {
      if (severityFilter !== 'All' && a.severity !== severityFilter) return false;
      if (attackTypeFilter !== 'All' && a.category !== attackTypeFilter) return false;
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      if (dateFilter !== 'All' && a.date !== dateFilter) return false;
      if (effectiveSearch) {
        const hay = `${a.id} ${a.attackType} ${a.category} ${a.sourceIp} ${a.destinationIp} ${a.severity} ${a.status}`.toLowerCase();
        if (!hay.includes(effectiveSearch)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'severity') {
        cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      } else if (sortField === 'confidence') {
        cmp = a.confidence - b.confidence;
      } else {
        cmp = String(a[sortField]).localeCompare(String(b[sortField]));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [alerts, severityFilter, attackTypeFilter, statusFilter, dateFilter, effectiveSearch, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const resetAllFilters = () => {
    setSeverityFilter('All');
    setAttackTypeFilter('All');
    setStatusFilter('All');
    setDateFilter('All');
    setLocalSearch('');
  };

  const summaryButtons = [
    {
      label: 'Total Alerts',
      count: summaryCounts.total,
      active: severityFilter === 'All' && statusFilter === 'All',
      onClick: () => {
        setSeverityFilter('All');
        setStatusFilter('All');
      },
      accent: 'text-[#0F172A] dark:text-white',
    },
    {
      label: 'Critical',
      count: summaryCounts.critical,
      active: severityFilter === 'Critical',
      onClick: () => {
        setStatusFilter('All');
        setSeverityFilter(severityFilter === 'Critical' ? 'All' : 'Critical');
      },
      accent: 'text-[#DC2626]',
    },
    {
      label: 'High',
      count: summaryCounts.high,
      active: severityFilter === 'High',
      onClick: () => {
        setStatusFilter('All');
        setSeverityFilter(severityFilter === 'High' ? 'All' : 'High');
      },
      accent: 'text-[#EA580C]',
    },
    {
      label: 'Medium',
      count: summaryCounts.medium,
      active: severityFilter === 'Medium',
      onClick: () => {
        setStatusFilter('All');
        setSeverityFilter(severityFilter === 'Medium' ? 'All' : 'Medium');
      },
      accent: 'text-[#D97706]',
    },
    {
      label: 'Low',
      count: summaryCounts.low,
      active: severityFilter === 'Low',
      onClick: () => {
        setStatusFilter('All');
        setSeverityFilter(severityFilter === 'Low' ? 'All' : 'Low');
      },
      accent: 'text-[#2563EB]',
    },
    {
      label: 'Resolved',
      count: summaryCounts.resolved,
      active: statusFilter === 'Resolved',
      onClick: () => {
        setSeverityFilter('All');
        setStatusFilter(statusFilter === 'Resolved' ? 'All' : 'Resolved');
      },
      accent: 'text-[#059669]',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page Header & Bulk Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
            Alerts Center
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Triage intrusion alerts, inspect extracted 78-feature flow vectors, and track analyst resolution
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAcknowledgeAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#0F2A44] transition-colors cursor-pointer whitespace-nowrap"
          >
            <CheckCheck className="w-3.5 h-3.5 text-[#0891B2]" />
            Acknowledge All
          </button>
          <button
            type="button"
            onClick={() => {
              triggerCsvDownload('sentinel-ai-alerts-export.csv', filteredAndSorted);
              onExportSuccess(`Exported ${filteredAndSorted.length} alerts to CSV`);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Filter Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryButtons.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={`rounded-xl p-3.5 text-left border transition-all cursor-pointer ${
              item.active
                ? 'bg-[#0F2A44]/5 dark:bg-[#2563EB]/15 border-[#2563EB] shadow-xs'
                : 'bg-white dark:bg-[#112236] border-[#E2E8F0] dark:border-[#1E354E] hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              {item.label}
            </p>
            <p className={`text-xl font-bold mt-1 tabular-nums ${item.accent}`}>{item.count}</p>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-1">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filter ID, IP, attack..."
              aria-label="Filter alerts"
              className="w-full h-9 pl-8 pr-3 rounded-lg text-xs bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'All' | Severity)}
            aria-label="Filter by severity"
            className="h-9 px-3 rounded-lg text-xs bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="All">Severity: All</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={attackTypeFilter}
            onChange={(e) => setAttackTypeFilter(e.target.value)}
            aria-label="Filter by attack type"
            className="h-9 px-3 rounded-lg text-xs bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="All">Attack Type: All</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | AlertStatus)}
            aria-label="Filter by status"
            className="h-9 px-3 rounded-lg text-xs bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="All">Status: All</option>
            <option value="New">New</option>
            <option value="Investigating">Investigating</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="Resolved">Resolved</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filter by date"
            className="h-9 px-3 rounded-lg text-xs bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="All">Date: All Dates</option>
            {uniqueDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs overflow-hidden">
        {filteredAndSorted.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
              No alerts found for this filter
            </p>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
              Try clearing active search terms or adjusting severity, attack type, and status filters.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#0F2A44] text-white hover:bg-[#16385A] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-[#0B1B2B] border-b border-[#E2E8F0] dark:border-[#1E354E] text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  <th className="py-3 pl-4 pr-2 w-8" />
                  <th className="py-3 px-2">
                    <button
                      type="button"
                      onClick={() => toggleSort('id')}
                      className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                    >
                      Alert ID <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-2">
                    <button
                      type="button"
                      onClick={() => toggleSort('timestamp')}
                      className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                    >
                      Date / Time <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-2">
                    <button
                      type="button"
                      onClick={() => toggleSort('attackType')}
                      className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                    >
                      Attack Type <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-2">
                    <button
                      type="button"
                      onClick={() => toggleSort('sourceIp')}
                      className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                    >
                      Source → Destination <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-2">
                    <button
                      type="button"
                      onClick={() => toggleSort('severity')}
                      className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                    >
                      Severity <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('confidence')}
                      className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                    >
                      Confidence <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('status')}
                      className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                    >
                      Status <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E] text-xs">
                {filteredAndSorted.map((alert) => {
                  const isExpanded = expandedId === alert.id;
                  return (
                    <React.Fragment key={alert.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded
                            ? 'bg-[#2563EB]/[0.05] dark:bg-[#2563EB]/15'
                            : 'hover:bg-slate-50 dark:hover:bg-[#0F2A44]/70'
                        }`}
                      >
                        <td className="py-3 pl-4 pr-2 text-[#64748B]">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#2563EB]" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </td>
                        <td className="py-3 px-2 font-mono font-semibold text-[#2563EB] whitespace-nowrap">
                          {alert.id}
                          {alert.isSimulated && (
                            <span className="ml-1.5 text-[10px] font-sans font-semibold text-[#0891B2]">
                              Lab
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums whitespace-nowrap">
                          {alert.date} · {alert.timestamp}
                        </td>
                        <td className="py-3 px-2 font-medium text-[#0F172A] dark:text-white whitespace-nowrap">
                          {alert.attackType}
                        </td>
                        <td className="py-3 px-2 font-mono text-[#0F172A] dark:text-slate-200 whitespace-nowrap">
                          {alert.sourceIp} → {alert.destinationIp}:{alert.dstPort}
                        </td>
                        <td className="py-3 px-2">
                          <SeverityBadge severity={alert.severity} />
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                          {alert.confidence.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          <StatusBadge status={alert.status} />
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#F8FAFC] dark:bg-[#0B1B2B]/90">
                          <td colSpan={8} className="p-4 sm:p-5">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                              {/* Flow Feature Telemetry */}
                              <div className="lg:col-span-2 space-y-3">
                                <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
                                  Extracted CIC-IDS2017 Flow Features ({alert.features.protocol} · Port{' '}
                                  {alert.features.dstPort})
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                  <div className="rounded-lg bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
                                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                      Flow Duration
                                    </p>
                                    <p className="font-mono font-semibold text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                                      {alert.features.flowDuration}
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
                                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                      Total Packets (Fwd / Bwd)
                                    </p>
                                    <p className="font-mono font-semibold text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                                      {alert.features.totalFwdPackets} / {alert.features.totalBwdPackets}
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
                                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                      Packet Length Mean
                                    </p>
                                    <p className="font-mono font-semibold text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                                      {alert.features.packetLengthMean}
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
                                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                      Flow Bytes/s
                                    </p>
                                    <p className="font-mono font-semibold text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                                      {alert.features.flowBytesPerSec}
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
                                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                      Flow Packets/s
                                    </p>
                                    <p className="font-mono font-semibold text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                                      {alert.features.flowPacketsPerSec}
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
                                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                      Init_Win_bytes_forward
                                    </p>
                                    <p className="font-mono font-semibold text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                                      {alert.features.initWinBytesFwd}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Confidence + Recommended Action + Buttons */}
                              <div className="space-y-3 flex flex-col justify-between">
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-[#0F172A] dark:text-white">
                                      Model Confidence ({alert.modelUsed})
                                    </span>
                                    <span className="font-mono font-bold text-[#2563EB] tabular-nums">
                                      {alert.confidence.toFixed(1)}% · {alert.detectionLatency}
                                    </span>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-[#2563EB]"
                                      style={{ width: `${alert.confidence}%` }}
                                    />
                                  </div>

                                  {alert.top3 && alert.top3.length > 0 && (
                                    <div className="pt-1.5 space-y-1.5">
                                      <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                                        Top-3 Class Probabilities (Model Output)
                                      </p>
                                      {alert.top3.map((item) => (
                                        <div key={item.label} className="space-y-0.5">
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-medium text-[#0F172A] dark:text-slate-200">
                                              {item.label}
                                            </span>
                                            <span className="font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                                              {item.probability.toFixed(1)}%
                                            </span>
                                          </div>
                                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${
                                                item.label.toLowerCase() === 'normal' ||
                                                item.label.toLowerCase() === 'benign'
                                                  ? 'bg-[#059669]'
                                                  : 'bg-[#DC2626]'
                                              }`}
                                              style={{ width: `${Math.min(100, item.probability)}%` }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="pt-1">
                                    <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                                      Recommended Action
                                    </p>
                                    <p className="text-xs text-[#0F172A] dark:text-slate-200 mt-1 leading-relaxed">
                                      {alert.recommendedAction}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E2E8F0] dark:border-[#1E354E]">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateAlertStatus(alert.id, 'Investigating');
                                    }}
                                    disabled={alert.status === 'Investigating' || alert.status === 'Resolved'}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:bg-slate-50 dark:hover:bg-[#0F2A44] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-[#D97706]" />
                                    Investigate
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateAlertStatus(alert.id, 'Acknowledged');
                                    }}
                                    disabled={alert.status === 'Acknowledged' || alert.status === 'Resolved'}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:bg-slate-50 dark:hover:bg-[#0F2A44] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5 text-[#0891B2]" />
                                    Acknowledge
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateAlertStatus(alert.id, 'Resolved');
                                    }}
                                    disabled={alert.status === 'Resolved'}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#059669] hover:bg-[#047857] text-white disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Mark Resolved
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerCsvDownload(`${alert.id}-detail.csv`, [alert]);
                                      onExportSuccess(`Exported alert ${alert.id} detail CSV`);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:bg-slate-50 dark:hover:bg-[#0F2A44] cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Export
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteAlert(alert.id);
                                      setExpandedId(null);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#112236] border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
