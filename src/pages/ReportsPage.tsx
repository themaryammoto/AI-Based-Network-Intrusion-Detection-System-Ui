import React, { useMemo, useState } from 'react';
import {
  FileText,
  Download,
  Eye,
  Calendar,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Printer,
  Trash2,
} from 'lucide-react';
import {
  ATTACK_DISTRIBUTION,
  DATASET_TOTALS,
  MODEL_METRICS,
  XGBOOST_CONFUSION_MATRIX,
  formatNumber,
} from '../data/cicIdsData';
import { AlertRecord, LiveSessionStats, SavedReportRecord } from '../types/nids';

interface ReportsPageProps {
  alerts: AlertRecord[];
  reports: SavedReportRecord[];
  liveStats: LiveSessionStats;
  activeModel: string;
  onCreateReport: (report: Omit<SavedReportRecord, 'generatedAt'>) => Promise<void>;
  onDeleteReport: (id: string) => Promise<void>;
  onNotify: (
    title: string,
    description: string,
    variant?: 'success' | 'info' | 'warning' | 'danger'
  ) => void;
}

interface ReportTemplate {
  id: 'daily' | 'weekly-model' | 'attack-trend' | 'fpr-analysis';
  title: string;
  subtitle: string;
  frequency: string;
  metricsPreview: Array<{ label: string; value: string }>;
  summaryText: string;
}

export function ReportsPage({
  alerts,
  reports,
  liveStats,
  activeModel,
  onCreateReport,
  onDeleteReport,
  onNotify,
}: ReportsPageProps) {
  const [startDate, setStartDate] = useState('2017-07-03');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportFormat, setExportFormat] = useState<'PDF' | 'CSV'>('PDF');
  const [previewReport, setPreviewReport] = useState<{
    id: string;
    templateId: ReportTemplate['id'];
    title: string;
    range: string;
    summaryText: string;
    metricsPreview: Array<{ label: string; value: string }>;
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const reportTemplates = useMemo<ReportTemplate[]>(() => {
    const totalFlows = DATASET_TOTALS.totalFlows + liveStats.totalScored;
    const totalAttacks = DATASET_TOTALS.attackFlows + liveStats.attackScored;
    const totalBenign = DATASET_TOTALS.benignFlows + liveStats.benignScored;
    const attackPct = totalFlows > 0 ? ((totalAttacks / totalFlows) * 100).toFixed(1) : '19.7';
    const benignPct = totalFlows > 0 ? ((totalBenign / totalFlows) * 100).toFixed(1) : '80.3';
    const openAlerts = alerts.filter((a) => a.status === 'New' || a.status === 'Investigating').length;
    const resolvedAlerts = alerts.filter((a) => a.status === 'Resolved').length;
    const liveLatencyLabel =
      liveStats.totalScored > 0 ? `${liveStats.avgLatencyMs}ms avg` : '2.4s baseline';

    const activeMetric =
      MODEL_METRICS.find((m) => m.name === activeModel) ?? MODEL_METRICS[0];

    return [
      {
        id: 'daily',
        title: 'Daily SOC Summary',
        subtitle:
          'Executive digest of baseline + live ingested flows, detected intrusions, and active alert queue statuses.',
        frequency: 'Daily · Persistent Telemetry',
        metricsPreview: [
          { label: 'Total Flows Analyzed', value: formatNumber(totalFlows) },
          { label: 'Attack Flows Detected', value: `${formatNumber(totalAttacks)} (${attackPct}%)` },
          { label: 'BENIGN Traffic', value: `${formatNumber(totalBenign)} (${benignPct}%)` },
          { label: 'Live Scored / Open Alerts', value: `${formatNumber(liveStats.totalScored)} / ${openAlerts}` },
        ],
        summaryText: `Persistent SOC telemetry reflects ${formatNumber(
          totalFlows
        )} total flows (${formatNumber(
          liveStats.totalScored
        )} scored live this session at ${liveLatencyLabel}). Active queue tracks ${
          alerts.length
        } persisted alerts (${openAlerts} open, ${resolvedAlerts} resolved) monitored under ${activeModel}.`,
      },
      {
        id: 'weekly-model',
        title: 'Weekly Model Benchmark Report',
        subtitle:
          'Comparative evaluation of all 8 ML/DL models including XGBoost confusion matrix, ROC-AUC, and live latency.',
        frequency: 'Weekly · Benchmark Audit',
        metricsPreview: [
          { label: 'Active Detection Model', value: activeMetric.name },
          {
            label: 'Attack Recall / F1',
            value: `${activeMetric.recall}% / ${activeMetric.f1Score}`,
          },
          { label: 'ROC-AUC Score', value: `${activeMetric.rocAuc}` },
          {
            label: 'Test Split Volume',
            value: `${formatNumber(XGBOOST_CONFUSION_MATRIX.testSamples)} flows`,
          },
        ],
        summaryText: `Active model ${activeMetric.name} achieves ${activeMetric.recall}% recall, ${activeMetric.f1Score} F1-score, and ${activeMetric.fpr}% FPR on stratified 80/20 CIC-IDS2017 evaluation. Live inference latency averages ${liveLatencyLabel} across ${formatNumber(
          liveStats.totalScored
        )} scored requests.`,
      },
      {
        id: 'attack-trend',
        title: 'Attack Trend & Taxonomy Report',
        subtitle:
          'Breakdown of DoS/DDoS, PortScan, Brute Force, Web Attacks, Bot, and Infiltration combining baseline and live alerts.',
        frequency: 'Mon–Fri + Live · Taxonomy',
        metricsPreview: [
          {
            label: 'Dominant Vector',
            value: `DoS/DDoS (${formatNumber(
              380688 + (liveStats.attackByCategory['DoS/DDoS'] || 0)
            )})`,
          },
          {
            label: 'Reconnaissance Volume',
            value: `PortScan (${formatNumber(
              158930 + (liveStats.attackByCategory['PortScan'] || 0)
            )})`,
          },
          { label: 'Live Blocked Today', value: formatNumber(liveStats.blockedToday) },
          { label: 'Most Targeted Port', value: 'Port 80 (HTTP)' },
        ],
        summaryText: `Volumetric DoS and DDoS vectors remain the dominant threat surface alongside PortScan reconnaissance. During live monitoring, ${formatNumber(
          liveStats.attackScored
        )} attack flows were flagged and ${formatNumber(
          liveStats.blockedToday
        )} incidents logged to the persistent Alerts Center.`,
      },
      {
        id: 'fpr-analysis',
        title: 'False Positive & Calibration Analysis',
        subtitle:
          'Calibration study on benign traffic misclassifications, confidence threshold tuning, and alert fatigue control.',
        frequency: 'Calibration · Threshold Audit',
        metricsPreview: [
          { label: 'Model Operational FPR', value: `${activeMetric.fpr}% (Target < 2.0%)` },
          { label: 'True Negatives Verified', value: formatNumber(XGBOOST_CONFUSION_MATRIX.tn) },
          { label: 'False Positives Flagged', value: formatNumber(XGBOOST_CONFUSION_MATRIX.fp) },
          { label: 'Precision Maintained', value: `${activeMetric.precision}%` },
        ],
        summaryText: `StandardScaler fitted strictly on training splits combined with configurable confidence thresholding keeps operational false alarms at ${activeMetric.fpr}% while sustaining ${activeMetric.precision}% precision across ${formatNumber(
          totalBenign
        )} benign flows.`,
      },
    ];
  }, [alerts, liveStats, activeModel]);

  const downloadBlob = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async (template: ReportTemplate) => {
    setSavingId(template.id);
    const reportId = `RPT-${Date.now().toString().slice(-4)}`;
    const range = `${startDate} to ${endDate}`;
    try {
      await onCreateReport({
        id: reportId,
        templateId: template.id,
        title: template.title,
        format: exportFormat,
        range,
        summary: template.summaryText,
        metrics: template.metricsPreview,
      });
      setPreviewReport({
        id: reportId,
        templateId: template.id,
        title: template.title,
        range,
        summaryText: template.summaryText,
        metricsPreview: template.metricsPreview,
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleDownloadCsv = (report: {
    templateId: ReportTemplate['id'];
    title: string;
    range: string;
    metricsPreview: Array<{ label: string; value: string }>;
  }) => {
    let csv = '';
    if (report.templateId === 'weekly-model') {
      csv = [
        'Model,Family,Accuracy,Precision,Recall,F1-Score,ROC-AUC,FPR,Inference(ms)',
        ...MODEL_METRICS.map(
          (m) =>
            `${m.name},${m.family},${m.accuracy}%,${m.precision}%,${m.recall}%,${m.f1Score},${m.rocAuc},${m.fpr}%,${m.inferenceTimeMs}`
        ),
      ].join('\n');
    } else if (report.templateId === 'attack-trend') {
      csv = [
        'Attack Type,Category,Baseline Flows,Live Session Flows,Share (%)',
        ...ATTACK_DISTRIBUTION.map(
          (a) =>
            `${a.name},${a.category},${a.value},${liveStats.attackByCategory[a.category] || 0},${a.percent}%`
        ),
      ].join('\n');
    } else {
      csv = [
        'Metric,Value',
        ...report.metricsPreview.map((m) => `"${m.label}","${m.value}"`),
        `"Active Model","${activeModel}"`,
        `"Date Range","${report.range}"`,
        `"Persisted Alerts","${alerts.length}"`,
        `"Live Session Scored Flows","${liveStats.totalScored}"`,
      ].join('\n');
    }
    downloadBlob(csv, `sentinel-ai-${report.templateId}-${endDate}.csv`, 'text/csv;charset=utf-8;');
    onNotify('Report Exported', `${report.title} downloaded as CSV.`, 'success');
  };

  const handleDownloadPdf = (report: {
    templateId: ReportTemplate['id'];
    title: string;
    range: string;
    summaryText: string;
    metricsPreview: Array<{ label: string; value: string }>;
  }) => {
    const htmlDoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>AI-Based Network Intrusion Detection System — ${report.title}</title>
<style>
  body { font-family: Inter, Arial, sans-serif; color: #0F172A; max-width: 820px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
  h1 { color: #0F2A44; margin-bottom: 4px; }
  .meta { color: #64748B; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td { border: 1px solid #E2E8F0; padding: 10px 12px; text-align: left; font-size: 13px; }
  th { background: #F1F5F9; color: #0F2A44; }
  .footer { margin-top: 32px; font-size: 11px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 12px; }
</style>
</head>
<body>
  <h1>AI-Based Network Intrusion Detection System — ${report.title}</h1>
  <div class="meta">Analyst: Maryam Tahir · Active Model: ${activeModel} · Window: ${report.range}</div>
  <p>${report.summaryText}</p>
  <table>
    <thead><tr><th>Metric</th><th>Measured Value</th></tr></thead>
    <tbody>
      ${report.metricsPreview.map((m) => `<tr><td>${m.label}</td><td><strong>${m.value}</strong></td></tr>`).join('')}
    </tbody>
  </table>
  <div class="footer">AI-Based Network Intrusion Detection System · Generated from Persistent SOC Telemetry.</div>
</body>
</html>`;
    downloadBlob(htmlDoc, `sentinel-ai-${report.templateId}-report.html`, 'text/html;charset=utf-8;');
    onNotify('Report Exported', `${report.title} exported as print-ready PDF/HTML report.`, 'success');
  };

  return (
    <div className="space-y-5">
      {/* Header & Date/Format Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
            SOC Reports &amp; Compliance Exports
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Generate, persist, preview, and download executive summaries, model audits, and false positive studies
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] rounded-xl px-3.5 py-2">
          <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Report start date"
            className="text-xs font-mono bg-transparent text-[#0F172A] dark:text-white focus:outline-none"
          />
          <span className="text-xs text-[#64748B]">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="Report end date"
            className="text-xs font-mono bg-transparent text-[#0F172A] dark:text-white focus:outline-none"
          />
          <div className="h-4 w-px bg-[#E2E8F0] dark:bg-[#1E354E]" />
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'PDF' | 'CSV')}
            aria-label="Default export format"
            className="text-xs font-medium bg-transparent text-[#0F172A] dark:text-white focus:outline-none"
          >
            <option value="PDF" className="dark:bg-[#0B1B2B]">Format: PDF</option>
            <option value="CSV" className="dark:bg-[#0B1B2B]">Format: CSV</option>
          </select>
        </div>
      </div>

      {/* 4 Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportTemplates.map((template) => (
          <div
            key={template.id}
            className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#0F2A44]/10 dark:bg-[#2563EB]/20 text-[#0F2A44] dark:text-[#93C5FD] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                      {template.title}
                    </h2>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {template.frequency}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-3 leading-relaxed">
                {template.subtitle}
              </p>

              <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#1E354E]">
                {template.metricsPreview.map((m) => (
                  <div key={m.label}>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{m.label}</p>
                    <p className="text-xs font-semibold font-mono text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#1E354E]">
              <button
                type="button"
                disabled={savingId === template.id}
                onClick={() => handleGenerate(template)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {savingId === template.id ? 'Saving...' : 'Generate & Save'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPreviewReport({
                    id: 'PREVIEW',
                    templateId: template.id,
                    title: template.title,
                    range: `${startDate} to ${endDate}`,
                    summaryText: template.summaryText,
                    metricsPreview: template.metricsPreview,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:bg-slate-50 dark:hover:bg-[#0F2A44] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDownloadPdf({
                    templateId: template.id,
                    title: template.title,
                    range: `${startDate} to ${endDate}`,
                    summaryText: template.summaryText,
                    metricsPreview: template.metricsPreview,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:bg-slate-50 dark:hover:bg-[#0F2A44] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDownloadCsv({
                    templateId: template.id,
                    title: template.title,
                    range: `${startDate} to ${endDate}`,
                    metricsPreview: template.metricsPreview,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:bg-slate-50 dark:hover:bg-[#0F2A44] transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Inline Report Preview Panel */}
      {previewReport && (
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#2563EB]/50 shadow-md p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E2E8F0] dark:border-[#1E354E]">
            <div>
              <p className="text-[11px] font-semibold text-[#2563EB]">
                Report Preview · {previewReport.id}
              </p>
              <h2 className="text-base font-semibold text-[#0F172A] dark:text-white mt-0.5">
                AI-Based Network Intrusion Detection System — {previewReport.title}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5 tabular-nums">
                Prepared by Maryam Tahir · Window: {previewReport.range} · Model: {activeModel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F1F5F9] dark:bg-[#0B1B2B] text-[#0F172A] dark:text-white hover:bg-slate-200 dark:hover:bg-[#0F2A44] cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                aria-label="Close preview"
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#0F172A] dark:text-slate-200 leading-relaxed">
            {previewReport.summaryText}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {previewReport.metricsPreview.map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-[#F8FAFC] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] p-3"
              >
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{item.label}</p>
                <p className="text-sm font-bold font-mono text-[#0F172A] dark:text-white mt-1 tabular-nums">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleDownloadCsv(previewReport)}
              className="px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white cursor-pointer whitespace-nowrap"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPdf(previewReport)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0F2A44] dark:bg-[#2563EB] text-white cursor-pointer whitespace-nowrap"
            >
              Download PDF Report
            </button>
          </div>
        </div>
      )}

      {/* Persistent Report Generation History */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Saved Report Archive
            </h2>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Persisted on the backend server across browser reloads
            </p>
          </div>
          <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums">
            {reports.length} archived
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] dark:border-[#1E354E] text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                <th className="py-2 pr-3">Report ID</th>
                <th className="py-2 px-3">Title</th>
                <th className="py-2 px-3">Date Range</th>
                <th className="py-2 px-3">Format</th>
                <th className="py-2 px-3">Generated</th>
                <th className="py-2 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E]">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#64748B] dark:text-[#94A3B8]">
                    No saved reports yet. Click &ldquo;Generate &amp; Save&rdquo; on any template above.
                  </td>
                </tr>
              ) : (
                reports.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-[#0B1B2B]/60">
                    <td className="py-2.5 pr-3 font-mono font-semibold text-[#2563EB] whitespace-nowrap">
                      {item.id}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#0F172A] dark:text-white">
                      {item.title}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                      {item.range}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#0F172A] dark:text-slate-200">
                      {item.format}
                    </td>
                    <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8] tabular-nums whitespace-nowrap">
                      {item.generatedAt}
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewReport({
                              id: item.id,
                              templateId: item.templateId,
                              title: item.title,
                              range: item.range,
                              summaryText: item.summary,
                              metricsPreview: item.metrics,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-[#F1F5F9] dark:bg-[#0B1B2B] text-[#0F172A] dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#0F2A44] cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteReport(item.id)}
                          aria-label={`Delete report ${item.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
