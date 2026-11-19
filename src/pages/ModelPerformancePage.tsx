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
  BarChart,
  Bar,
} from 'recharts';
import { Award, CheckCircle2, Info, ArrowUpDown } from 'lucide-react';
import {
  FEATURE_IMPORTANCE_DATA,
  MODEL_METRICS,
  PR_CURVE_DATA,
  ROC_CURVE_DATA,
  XGBOOST_CONFUSION_MATRIX,
  formatNumber,
} from '../data/cicIdsData';

interface ModelPerformancePageProps {
  activeModel: string;
  onSelectActiveModel: (modelName: string) => void;
  isDark: boolean;
}

type ModelSortKey = 'accuracy' | 'precision' | 'recall' | 'f1Score' | 'rocAuc' | 'fpr' | 'inferenceTimeMs';

export function ModelPerformancePage({
  activeModel,
  onSelectActiveModel,
  isDark,
}: ModelPerformancePageProps) {
  const [familyFilter, setFamilyFilter] = useState<'All' | 'Core' | 'Unsupervised'>('All');
  const [sortKey, setSortKey] = useState<ModelSortKey>('f1Score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const gridStroke = isDark ? '#1E354E' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0B1B2B' : '#FFFFFF',
    borderColor: isDark ? '#1E354E' : '#E2E8F0',
    borderRadius: '10px',
    fontSize: '12px',
    color: isDark ? '#F1F5F9' : '#0F172A',
  };

  const displayedModels = useMemo(() => {
    const list = MODEL_METRICS.filter((m) => {
      if (familyFilter === 'Core') return m.family !== 'Unsupervised';
      if (familyFilter === 'Unsupervised') return m.family === 'Unsupervised';
      return true;
    });
    return [...list].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [familyFilter, sortKey, sortDir]);

  const handleSort = (key: ModelSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'fpr' || key === 'inferenceTimeMs' ? 'asc' : 'desc');
    }
  };

  const cm = XGBOOST_CONFUSION_MATRIX;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
            Model Performance & Evaluation
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Stratified 80/20 CIC-IDS2017 benchmark across 8 ML/DL models · Active Deployment: {activeModel}
          </p>
        </div>

        <div className="flex items-center p-0.5 rounded-lg bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E]">
          {(
            [
              { id: 'All', label: 'All Models (8)' },
              { id: 'Core', label: 'Supervised & DL (6)' },
              { id: 'Unsupervised', label: 'Anomaly (2)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFamilyFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                familyFilter === tab.id
                  ? 'bg-[#0F2A44] dark:bg-[#2563EB] text-white'
                  : 'text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Target Benchmarks Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Attack Recall Target', target: '≥ 95.0%', achieved: '99.69%', met: true },
          { label: 'XGBoost Accuracy / F1', target: 'F1 ≥ 0.950', achieved: '99.87% / 99.66%', met: true },
          { label: 'False Positive Rate', target: '< 2.0%', achieved: '0.09%', met: true },
          { label: 'End-to-End Alert Latency', target: '< 5.0s', achieved: '< 1.2s', met: true },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-4 flex items-center justify-between gap-2"
          >
            <div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{item.label}</p>
              <p className="text-lg font-bold text-[#0F172A] dark:text-white tabular-nums mt-0.5">
                {item.achieved}
              </p>
              <p className="text-[11px] text-[#059669] font-medium mt-0.5">Goal: {item.target}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0" />
          </div>
        ))}
      </div>

      {/* Primary Metric Note Box */}
      <div className="rounded-xl bg-[#0F2A44]/[0.04] dark:bg-[#0F2A44]/60 border border-[#0F2A44]/15 dark:border-[#2563EB]/30 px-4 py-3.5 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 leading-relaxed">
          <span className="font-semibold">Evaluation Priority:</span> Recall is primary because a
          missed attack is more costly than a false alarm. XGBoost achieves{' '}
          <span className="font-mono font-semibold">99.87%</span> accuracy and{' '}
          <span className="font-mono font-semibold">99.69%</span> attack recall while maintaining a{' '}
          <span className="font-mono font-semibold">0.09%</span> false positive rate (well below the
          2% SOC target).
        </p>
      </div>

      {/* Model Comparison Table */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E2E8F0] dark:border-[#1E354E] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Model Comparison Matrix
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Click column headers to sort · Click "Set Active" to deploy model in dashboard telemetry
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] dark:bg-[#0B1B2B] border-b border-[#E2E8F0] dark:border-[#1E354E] text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('accuracy')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                  >
                    Accuracy <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('precision')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                  >
                    Precision <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('recall')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                  >
                    Recall <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('f1Score')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                  >
                    F1-Score <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('rocAuc')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                  >
                    ROC-AUC <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('fpr')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                  >
                    FPR <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('inferenceTimeMs')}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                  >
                    Inference <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E] text-xs">
              {displayedModels.map((model) => {
                const isDeployed = activeModel === model.name;
                return (
                  <tr
                    key={model.id}
                    className={
                      model.isBest
                        ? 'bg-[#2563EB]/[0.05] dark:bg-[#2563EB]/15'
                        : 'hover:bg-slate-50 dark:hover:bg-[#0F2A44]/60 transition-colors'
                    }
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#0F172A] dark:text-white">
                          {model.name}
                        </span>
                        {model.isBest && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#059669]/15 text-[#059669] dark:text-[#6EE7B7] border border-[#059669]/25">
                            <Award className="w-3 h-3" />
                            Best Model
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                        {model.family}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                      {model.accuracy.toFixed(model.isBest ? 2 : 1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#0F172A] dark:text-slate-200 tabular-nums">
                      {model.precision.toFixed(model.isBest ? 2 : 1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-[#059669] dark:text-[#34D399] tabular-nums">
                      {model.recall.toFixed(model.isBest ? 2 : 1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                      {(model.f1Score * 100).toFixed(2)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#0F172A] dark:text-slate-200 tabular-nums">
                      {model.rocAuc.toFixed(3)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-semibold tabular-nums ${
                        model.fpr < 2.0 ? 'text-[#059669]' : 'text-[#D97706]'
                      }`}
                    >
                      {model.fpr.toFixed(model.isBest ? 2 : 1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums whitespace-nowrap">
                      {model.inferenceTimeMs.toFixed(1)} ms
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectActiveModel(model.name)}
                        disabled={isDeployed}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          isDeployed
                            ? 'bg-[#059669]/15 text-[#059669] dark:text-[#6EE7B7] cursor-default'
                            : 'bg-white dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:border-[#2563EB]'
                        }`}
                      >
                        {isDeployed ? 'Active' : 'Set Active'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Confusion Matrix + Feature Importance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* XGBoost Confusion Matrix */}
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              XGBoost Confusion Matrix (20% Held-Out Test Split)
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
              Evaluated on {formatNumber(cm.testSamples)} stratified test flows (no data leakage)
            </p>
          </div>

          <div className="mt-5">
            <div className="grid grid-cols-3 gap-2.5 items-center text-center">
              <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                Actual ↓ / Predicted →
              </div>
              <div className="text-xs font-semibold text-[#0F172A] dark:text-white py-1">
                Predicted BENIGN
              </div>
              <div className="text-xs font-semibold text-[#0F172A] dark:text-white py-1">
                Predicted ATTACK
              </div>

              {/* Row 1: Actual BENIGN */}
              <div className="text-xs font-semibold text-[#0F172A] dark:text-white text-right pr-2">
                Actual BENIGN
              </div>
              <div className="rounded-xl p-4 bg-[#059669]/15 dark:bg-[#059669]/25 border border-[#059669]/30">
                <p className="text-[11px] font-semibold text-[#059669] dark:text-[#6EE7B7]">
                  True Negative (TN)
                </p>
                <p className="text-xl font-bold text-[#0F172A] dark:text-white mt-1 tabular-nums">
                  {formatNumber(cm.tn)}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-slate-300 mt-0.5 tabular-nums">
                  99.91% of Benign
                </p>
              </div>
              <div className="rounded-xl p-4 bg-[#D97706]/12 dark:bg-[#D97706]/20 border border-[#D97706]/30">
                <p className="text-[11px] font-semibold text-[#B45309] dark:text-[#FCD34D]">
                  False Positive (FP)
                </p>
                <p className="text-xl font-bold text-[#0F172A] dark:text-white mt-1 tabular-nums">
                  {formatNumber(cm.fp)}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-slate-300 mt-0.5 tabular-nums">
                  Calibrated FPR 0.09%
                </p>
              </div>

              {/* Row 2: Actual ATTACK */}
              <div className="text-xs font-semibold text-[#0F172A] dark:text-white text-right pr-2">
                Actual ATTACK
              </div>
              <div className="rounded-xl p-4 bg-[#DC2626]/12 dark:bg-[#DC2626]/20 border border-[#DC2626]/30">
                <p className="text-[11px] font-semibold text-[#DC2626] dark:text-[#FCA5A5]">
                  False Negative (FN)
                </p>
                <p className="text-xl font-bold text-[#0F172A] dark:text-white mt-1 tabular-nums">
                  {formatNumber(cm.fn)}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-slate-300 mt-0.5 tabular-nums">
                  0.31% Missed Attacks
                </p>
              </div>
              <div className="rounded-xl p-4 bg-[#2563EB]/15 dark:bg-[#2563EB]/25 border border-[#2563EB]/35">
                <p className="text-[11px] font-semibold text-[#2563EB] dark:text-[#93C5FD]">
                  True Positive (TP)
                </p>
                <p className="text-xl font-bold text-[#0F172A] dark:text-white mt-1 tabular-nums">
                  {formatNumber(cm.tp)}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-slate-300 mt-0.5 tabular-nums">
                  99.69% Attack Recall
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#1E354E] flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
            <span>Accuracy: 99.87%</span>
            <span>Precision: 99.63%</span>
            <span>Recall: 99.69%</span>
            <span>F1-Score: 99.66%</span>
            <span>ROC-AUC: 0.999</span>
          </div>
        </div>

        {/* Top 10 Feature Importance */}
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              XGBoost Feature Importance (Top 10 of 77 Features)
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Normalized gain importance across CIC-IDS2017 flow attributes
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={FEATURE_IMPORTANCE_DATA}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 0.16]}
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                />
                <YAxis
                  type="category"
                  dataKey="feature"
                  width={150}
                  tick={{ fontSize: 11, fill: axisColor, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: unknown) => [
                    `${(Number(value) * 100).toFixed(1)}% Gain`,
                    'Importance',
                  ]}
                />
                <Bar dataKey="importance" fill="#0891B2" radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: ROC Curve + Precision-Recall Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              ROC Curve Comparison (TPR vs FPR)
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              XGBoost AUC = 0.999 vs Random Forest (0.991), LSTM (0.989), Logistic Regression (0.931)
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ROC_CURVE_DATA} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="fpr"
                  type="number"
                  domain={[0, 1]}
                  tick={{ fontSize: 11, fill: axisColor }}
                  label={{ value: 'False Positive Rate', position: 'insideBottomRight', offset: -2, fontSize: 11, fill: axisColor }}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 11, fill: axisColor }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="xgboost" name="XGBoost (0.999)" stroke="#2563EB" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="rf" name="Random Forest (0.991)" stroke="#059669" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lstm" name="LSTM (0.989)" stroke="#7C3AED" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lr" name="Logistic Reg (0.931)" stroke="#D97706" strokeWidth={1.8} dot={false} />
                <Line type="linear" dataKey="baseline" name="Random Baseline" stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Precision–Recall Curve
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Critical for imbalanced intrusion detection (19.7% attack class prevalence)
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={PR_CURVE_DATA} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="recall"
                  type="number"
                  domain={[0, 1]}
                  tick={{ fontSize: 11, fill: axisColor }}
                  label={{ value: 'Recall', position: 'insideBottomRight', offset: -2, fontSize: 11, fill: axisColor }}
                />
                <YAxis domain={[0.3, 1]} tick={{ fontSize: 11, fill: axisColor }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="xgboost" name="XGBoost" stroke="#2563EB" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="rf" name="Random Forest" stroke="#059669" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lstm" name="LSTM" stroke="#7C3AED" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lr" name="Logistic Reg" stroke="#D97706" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
