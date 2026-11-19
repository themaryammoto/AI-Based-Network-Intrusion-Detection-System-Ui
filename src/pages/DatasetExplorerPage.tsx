import React, { useMemo, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CheckCircle2, FileSpreadsheet, Search, Upload, Sparkles, X } from 'lucide-react';
import {
  DATASET_FILES,
  DATASET_TOTALS,
  PIPELINE_STAGES,
  PREPROCESSING_CHECKLIST,
  formatNumber,
} from '../data/cicIdsData';
import { parseCicCsv } from '../services/modelApi';

interface DatasetExplorerPageProps {
  isDark: boolean;
}

interface UploadedCsvProfile {
  fileName: string;
  rowCount: number;
  columnCount: number;
  whitespaceHeaders: number;
  missingOrInfCells: number;
  duplicateRows: number;
  benignCount: number;
  attackCount: number;
  hasLabelColumn: boolean;
  numericSummary: Array<{ column: string; min: number; mean: number; max: number }>;
}

export function DatasetExplorerPage({ isDark }: DatasetExplorerPageProps) {
  const [fileSearch, setFileSearch] = useState('');
  const [uploadedProfile, setUploadedProfile] = useState<UploadedCsvProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    if (!q) return DATASET_FILES;
    return DATASET_FILES.filter(
      (f) =>
        f.fileName.toLowerCase().includes(q) ||
        f.day.toLowerCase().includes(q) ||
        f.attackTypes.join(' ').toLowerCase().includes(q)
    );
  }, [fileSearch]);

  const handleAnalyzeCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const { headers, rawHeaders, rows } = parseCicCsv(text);
      if (headers.length === 0 || rows.length === 0) return;

      const whitespaceHeaders = rawHeaders.filter((h) => h !== h.trim()).length;
      let missingOrInfCells = 0;
      const seen = new Set<string>();
      let duplicateRows = 0;
      let benignCount = 0;
      let attackCount = 0;

      const labelCol = headers.find((h) => h.toLowerCase() === 'label');
      const numericBuckets: Record<string, number[]> = {};

      rows.forEach((row) => {
        const sig = JSON.stringify(row);
        if (seen.has(sig)) duplicateRows += 1;
        else seen.add(sig);

        headers.forEach((col) => {
          const v = row[col];
          if (
            v === '' ||
            v === null ||
            v === undefined ||
            String(v).toLowerCase() === 'nan' ||
            String(v).toLowerCase() === 'infinity' ||
            String(v).toLowerCase() === 'inf'
          ) {
            missingOrInfCells += 1;
          } else if (typeof v === 'number' && Number.isFinite(v) && col !== labelCol) {
            if (!numericBuckets[col]) numericBuckets[col] = [];
            numericBuckets[col].push(v);
          }
        });

        if (labelCol) {
          const lv = String(row[labelCol] ?? '').trim().toUpperCase();
          if (lv === 'BENIGN' || lv === '0' || lv === 'NORMAL') benignCount += 1;
          else if (lv !== '') attackCount += 1;
        }
      });

      const numericSummary = Object.entries(numericBuckets)
        .slice(0, 8)
        .map(([column, vals]) => {
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          const mean = vals.reduce((acc, n) => acc + n, 0) / vals.length;
          return {
            column,
            min: Number(min.toFixed(2)),
            mean: Number(mean.toFixed(2)),
            max: Number(max.toFixed(2)),
          };
        });

      setUploadedProfile({
        fileName: file.name,
        rowCount: rows.length,
        columnCount: headers.length,
        whitespaceHeaders,
        missingOrInfCells,
        duplicateRows,
        benignCount,
        attackCount,
        hasLabelColumn: Boolean(labelCol),
        numericSummary,
      });
    };
    reader.readAsText(file);
  };

  const gridStroke = isDark ? '#1E354E' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0B1B2B' : '#FFFFFF',
    borderColor: isDark ? '#1E354E' : '#E2E8F0',
    borderRadius: '10px',
    fontSize: '12px',
    color: isDark ? '#F1F5F9' : '#0F172A',
  };

  const chartData = DATASET_FILES.map((f) => ({
    name: f.day.replace(' (Jul ', ' (J'),
    benign: f.benign,
    attack: f.attack,
  }));

  return (
    <div className="space-y-5">
      {/* Header + Live CSV Profiler Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
            Dataset Explorer — CIC-IDS2017 &amp; CSV Profiler
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Canadian Institute for Cybersecurity Intrusion Detection Corpus ({DATASET_TOTALS.dateRange}) + Live CSV Hygiene Analyzer
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Profile Custom CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAnalyzeCsv(f);
            }}
          />
        </div>
      </div>

      {/* Interactive Uploaded CSV Hygiene Profile */}
      {uploadedProfile && (
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#2563EB]/45 shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                  Live CSV Profile: <span className="font-mono text-[#2563EB]">{uploadedProfile.fileName}</span>
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Real-time schema, whitespace, NaN/Inf, duplicate, and numeric feature statistics
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUploadedProfile(null)}
              aria-label="Close CSV profile"
              className="p-1 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
              <p className="text-[11px] text-[#64748B]">Rows</p>
              <p className="text-base font-bold font-mono text-[#0F172A] dark:text-white tabular-nums mt-0.5">
                {formatNumber(uploadedProfile.rowCount)}
              </p>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
              <p className="text-[11px] text-[#64748B]">Columns</p>
              <p className="text-base font-bold font-mono text-[#0F172A] dark:text-white tabular-nums mt-0.5">
                {uploadedProfile.columnCount}
              </p>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
              <p className="text-[11px] text-[#64748B]">Whitespace Headers</p>
              <p className="text-base font-bold font-mono text-[#D97706] tabular-nums mt-0.5">
                {uploadedProfile.whitespaceHeaders}
              </p>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
              <p className="text-[11px] text-[#64748B]">NaN / Inf Cells</p>
              <p className="text-base font-bold font-mono text-[#DC2626] tabular-nums mt-0.5">
                {uploadedProfile.missingOrInfCells}
              </p>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
              <p className="text-[11px] text-[#64748B]">Duplicate Rows</p>
              <p className="text-base font-bold font-mono text-[#0F172A] dark:text-white tabular-nums mt-0.5">
                {uploadedProfile.duplicateRows}
              </p>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] p-3">
              <p className="text-[11px] text-[#64748B]">BENIGN / Attack</p>
              <p className="text-sm font-bold font-mono text-[#059669] tabular-nums mt-1">
                {uploadedProfile.hasLabelColumn
                  ? `${uploadedProfile.benignCount} / ${uploadedProfile.attackCount}`
                  : 'Unlabeled'}
              </p>
            </div>
          </div>

          {uploadedProfile.numericSummary.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] dark:border-[#1E354E] text-[11px] font-semibold text-[#64748B]">
                    <th className="py-2 pr-3">Numeric Feature</th>
                    <th className="py-2 px-3 text-right">Min</th>
                    <th className="py-2 px-3 text-right">Mean</th>
                    <th className="py-2 pl-3 text-right">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E] font-mono">
                  {uploadedProfile.numericSummary.map((s) => (
                    <tr key={s.column}>
                      <td className="py-1.5 pr-3 text-[#0F172A] dark:text-white">{s.column}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{s.min}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-[#2563EB]">{s.mean}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums">{s.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards (5 metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[
          { label: 'CSV Capture Files', value: `${DATASET_TOTALS.totalFiles} Files`, sub: '1 per day / time slot' },
          { label: 'Total Flow Rows', value: formatNumber(DATASET_TOTALS.totalFlows), sub: 'Exact combined records' },
          { label: 'Columns / Schema', value: `${DATASET_TOTALS.totalColumns} Columns`, sub: '78 features + 1 Label' },
          { label: 'Dataset Size', value: `${DATASET_TOTALS.totalSizeMb} MB`, sub: 'Compressed CSV corpus' },
          { label: 'Capture Window', value: DATASET_TOTALS.dateRange, sub: 'Mon–Fri, 9 AM – 5 PM' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-4"
          >
            <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              {stat.label}
            </p>
            <p className="text-lg font-bold text-[#0F172A] dark:text-white mt-1 tabular-nums">
              {stat.value}
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Class Imbalance Visual + Stacked Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Class Imbalance Profile
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              4.08 : 1 ratio of BENIGN to Attack flows requires weighted training &amp; Recall focus
            </p>

            <div className="mt-5">
              <div className="h-9 w-full rounded-lg overflow-hidden flex border border-[#E2E8F0] dark:border-[#1E354E]">
                <div
                  className="bg-[#059669] h-full flex items-center justify-center text-xs font-bold text-white tabular-nums"
                  style={{ width: `${DATASET_TOTALS.benignPercent}%` }}
                >
                  BENIGN {DATASET_TOTALS.benignPercent}%
                </div>
                <div
                  className="bg-[#DC2626] h-full flex items-center justify-center text-xs font-bold text-white tabular-nums"
                  style={{ width: `${DATASET_TOTALS.attackPercent}%` }}
                >
                  {DATASET_TOTALS.attackPercent}%
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-[#E2E8F0] dark:border-[#1E354E]">
                <span className="flex items-center gap-2 font-medium text-[#0F172A] dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#059669]" />
                  BENIGN Flows
                </span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                  {formatNumber(DATASET_TOTALS.benignFlows)} (80.3%)
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#E2E8F0] dark:border-[#1E354E]">
                <span className="flex items-center gap-2 font-medium text-[#0F172A] dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#DC2626]" />
                  Attack Flows
                </span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                  {formatNumber(DATASET_TOTALS.attackFlows)} (19.7%)
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Rarest Attack Class</span>
                <span className="font-mono font-semibold text-[#DC2626] tabular-nums">
                  Heartbleed (11) · Infiltration (36)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Per-Capture BENIGN vs Attack Volume
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Distribution across all 8 CIC-IDS2017 working-hour capture files
            </p>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: axisColor }}
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
                    name === 'benign' ? 'BENIGN' : 'Attack',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="benign" name="BENIGN" stackId="a" fill="#059669" />
                <Bar dataKey="attack" name="Attack" stackId="a" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 8 CSV Files Table */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] dark:border-[#1E354E] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#2563EB]" />
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                CIC-IDS2017 CSV Corpus Breakdown (8 Files)
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Exact row totals verifying 2,273,097 BENIGN + 557,646 Attack = 2,830,743 rows
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="Search CSV file or attack..."
              aria-label="Search dataset files"
              className="w-full h-8 pl-8 pr-3 rounded-lg text-xs bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] dark:bg-[#0B1B2B] border-b border-[#E2E8F0] dark:border-[#1E354E] text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-3 text-right">Rows</th>
                <th className="py-3 px-3 text-right">BENIGN</th>
                <th className="py-3 px-3 text-right">Attack</th>
                <th className="py-3 px-4">Attack Types Included</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E] text-xs">
              {filteredFiles.map((file) => (
                <tr
                  key={file.fileName}
                  className="hover:bg-slate-50 dark:hover:bg-[#0F2A44]/60 transition-colors"
                >
                  <td className="py-3 px-4">
                    <p className="font-mono font-semibold text-[#0F172A] dark:text-white">
                      {file.shortName}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {file.day} · {file.sizeMb} MB
                    </p>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                    {formatNumber(file.rows)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[#059669] dark:text-[#34D399] tabular-nums">
                    {formatNumber(file.benign)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono font-semibold tabular-nums ${
                      file.attack > 0
                        ? 'text-[#DC2626] dark:text-[#FCA5A5]'
                        : 'text-[#64748B] dark:text-[#94A3B8]'
                    }`}
                  >
                    {formatNumber(file.attack)}
                  </td>
                  <td className="py-3 px-4 text-[#0F172A] dark:text-slate-200">
                    {file.attackTypes.join(' · ')}
                  </td>
                </tr>
              ))}
              {filteredFiles.length === DATASET_FILES.length && (
                <tr className="bg-[#F8FAFC] dark:bg-[#0B1B2B] font-semibold">
                  <td className="py-3 px-4 text-[#0F172A] dark:text-white">
                    Total Combined Dataset (8 Files)
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[#0F172A] dark:text-white tabular-nums">
                    {formatNumber(DATASET_TOTALS.totalFlows)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[#059669] tabular-nums">
                    {formatNumber(DATASET_TOTALS.benignFlows)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[#DC2626] tabular-nums">
                    {formatNumber(DATASET_TOTALS.attackFlows)}
                  </td>
                  <td className="py-3 px-4 text-[#64748B] dark:text-[#94A3B8]">
                    80.3% BENIGN · 19.7% Attack
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preprocessing Checklist + Pipeline Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
            Data Preprocessing &amp; Hygiene Checklist
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5 mb-4">
            Leakage-free preparation pipeline executed prior to model training
          </p>

          <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E]">
            {PREPROCESSING_CHECKLIST.map((item) => (
              <div key={item.id} className="py-3 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
                      {item.title}
                    </p>
                    <code className="text-[11px] font-mono text-[#2563EB] dark:text-[#93C5FD] bg-[#F1F5F9] dark:bg-[#0B1B2B] px-2 py-0.5 rounded">
                      {item.codeHint}
                    </code>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
            End-to-End NIDS Pipeline
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5 mb-4">
            6 operational stages from PCAP capture to live alerting
          </p>

          <ol className="space-y-3">
            {PIPELINE_STAGES.map((stage) => (
              <li
                key={stage.step}
                className="flex items-start gap-3 pb-3 border-b last:border-b-0 border-[#E2E8F0] dark:border-[#1E354E]"
              >
                <span className="w-6 h-6 rounded-md bg-[#0F2A44] dark:bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                  {stage.step}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
                    {stage.name}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                    {stage.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
