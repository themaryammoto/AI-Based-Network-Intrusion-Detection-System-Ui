import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  Sun,
  Moon,
  Volume2,
  Mail,
  Sliders,
  Cpu,
  Plug,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { AppSettings, PayloadFormat, RenderApiConfig } from '../types/nids';
import { MODEL_METRICS } from '../data/cicIdsData';

interface SettingsPageProps {
  settings: AppSettings;
  renderConfig: RenderApiConfig;
  onSaveSettings: (next: AppSettings, nextRender: RenderApiConfig) => Promise<void> | void;
  onTestRenderConnection: (cfg: RenderApiConfig) => Promise<void>;
  onResetDefaults: () => Promise<void> | void;
}

export function SettingsPage({
  settings,
  renderConfig,
  onSaveSettings,
  onTestRenderConnection,
  onResetDefaults,
}: SettingsPageProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [renderDraft, setRenderDraft] = useState<RenderApiConfig>(renderConfig);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    setRenderDraft(renderConfig);
  }, [renderConfig]);

  const handleThemeSwitch = (theme: 'light' | 'dark') => {
    const updated = { ...draft, theme };
    setDraft(updated);
    onSaveSettings(updated, renderDraft);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanedRender: RenderApiConfig = {
        ...renderDraft,
        apiUrl: renderDraft.apiUrl.trim().replace(/\/+$/, ''),
        healthPath: renderDraft.healthPath.trim() || '/health',
        predictPath: renderDraft.predictPath.trim() || '/predict',
        apiKey: (renderDraft.apiKey ?? '').trim(),
        enabled: Boolean(renderDraft.apiUrl.trim()) && renderDraft.enabled,
      };
      setRenderDraft(cleanedRender);
      await onSaveSettings(draft, cleanedRender);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
            System &amp; Model Deployment Settings
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Configure your Render.com Kaggle model API, confidence thresholds, notifications, and workspace theme
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onResetDefaults()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white hover:bg-slate-50 dark:hover:bg-[#0F2A44] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Render.com Kaggle Model API Configuration */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E354E]">
          <div className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-[#2563EB]" />
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                Render.com Kaggle Model Endpoint
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Model health and inference requests connect directly to the Render API.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            {renderDraft.connectionStatus === 'connected' && (
              <span className="inline-flex items-center gap-1 text-[#059669] tabular-nums">
                <CheckCircle2 className="w-4 h-4" />
                Connected ({renderDraft.lastLatencyMs ?? 0}ms)
              </span>
            )}
            {renderDraft.connectionStatus === 'error' && (
              <span className="inline-flex items-center gap-1 text-[#DC2626]">
                <AlertCircle className="w-4 h-4" />
                Unreachable
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
              Route Live Traffic, Inference &amp; Lab Testing to Render.com Model
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Every live traffic flow, CSV batch row, and lab attack test is scored exclusively by your Render.com XGBoost API (zero demo fallback).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={renderDraft.enabled}
            onClick={() => setRenderDraft({ ...renderDraft, enabled: !renderDraft.enabled })}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
              renderDraft.enabled ? 'bg-[#059669]' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                renderDraft.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label
              htmlFor="settings-render-url"
              className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5"
            >
              Render Service URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="settings-render-url"
                type="url"
                value={renderDraft.apiUrl}
                onChange={(e) =>
                  setRenderDraft({
                    ...renderDraft,
                    apiUrl: e.target.value,
                    enabled: e.target.value.trim().length > 0 ? true : renderDraft.enabled,
                  })
                }
                placeholder="https://sentinel-ai-nids-backend.onrender.com"
                className="flex-1 h-10 px-3 rounded-lg text-xs font-mono bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <button
                type="button"
                disabled={!renderDraft.apiUrl.trim() || renderDraft.connectionStatus === 'checking'}
                onClick={() => onTestRenderConnection(renderDraft)}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-xs font-semibold bg-[#0F2A44] hover:bg-[#16385A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    renderDraft.connectionStatus === 'checking' ? 'animate-spin' : ''
                  }`}
                />
                Test Connection
              </button>
            </div>
            {renderDraft.lastError && (
              <p className="text-[11px] text-[#DC2626] dark:text-[#FCA5A5] mt-1.5">
                {renderDraft.lastError}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="settings-render-apikey"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#64748B]" />
              Optional API Bearer Token (Authorization Header)
            </label>
            <input
              id="settings-render-apikey"
              type="password"
              value={renderDraft.apiKey ?? ''}
              onChange={(e) => setRenderDraft({ ...renderDraft, apiKey: e.target.value })}
              placeholder="Leave blank if your Render FastAPI endpoint is public"
              className="w-full h-9 px-3 rounded-lg text-xs font-mono bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
              Predict Endpoint Path
            </label>
            <input
              type="text"
              value={renderDraft.predictPath}
              onChange={(e) => setRenderDraft({ ...renderDraft, predictPath: e.target.value })}
              placeholder="/predict"
              className="w-full h-9 px-3 rounded-lg text-xs font-mono bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
              Health Check Path
            </label>
            <input
              type="text"
              value={renderDraft.healthPath}
              onChange={(e) => setRenderDraft({ ...renderDraft, healthPath: e.target.value })}
              placeholder="/health"
              className="w-full h-9 px-3 rounded-lg text-xs font-mono bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
              Request JSON Format
            </label>
            <select
              value={renderDraft.payloadFormat}
              onChange={(e) =>
                setRenderDraft({ ...renderDraft, payloadFormat: e.target.value as PayloadFormat })
              }
              className="w-full h-9 px-3 rounded-lg text-xs bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white"
            >
              <option value="wrapped_object">{`Wrapped Object: { "features": { ... } }`}</option>
              <option value="flat_object">{`Flat JSON Object: { "Flow Duration": ... }`}</option>
              <option value="feature_array">{`Ordered Array: { "features": [ ... ] }`}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
              Cold-Start Timeout (Render Free Tier)
            </label>
            <select
              value={renderDraft.timeoutSec}
              onChange={(e) =>
                setRenderDraft({ ...renderDraft, timeoutSec: Number(e.target.value) })
              }
              className="w-full h-9 px-3 rounded-lg text-xs bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white"
            >
              <option value={15}>15 seconds (Paid / Always-On)</option>
              <option value={45}>45 seconds (Standard Cold Start)</option>
              <option value={55}>55 seconds (Render Free Tier Default)</option>
              <option value={60}>60 seconds (Extended Cold Start)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Detection Engine Configuration */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E354E]">
          <Cpu className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
            Inference Engine &amp; Thresholds
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="model-select"
              className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5"
            >
              Active Detection Model Label
            </label>
            <select
              id="model-select"
              value={draft.activeModel}
              onChange={(e) => setDraft({ ...draft, activeModel: e.target.value })}
              className="w-full h-10 px-3 rounded-lg text-xs font-medium bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              {MODEL_METRICS.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} {m.isBest ? '(Recommended · 99.69% Recall)' : `(F1: ${m.f1Score})`}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
              XGBoost is the default production model (99.87% Accuracy, 99.69% Attack Recall, 0.09% FPR).
            </p>
          </div>

          <div>
            <label
              htmlFor="refresh-select"
              className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5"
            >
              Live Feed Ingestion Interval
            </label>
            <select
              id="refresh-select"
              value={draft.refreshIntervalSec}
              onChange={(e) =>
                setDraft({ ...draft, refreshIntervalSec: Number(e.target.value) })
              }
              className="w-full h-10 px-3 rounded-lg text-xs font-medium bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value={2}>Every 2 seconds (Default · 5 flows/batch)</option>
              <option value={3}>Every 3 seconds</option>
              <option value={5}>Every 5 seconds (Standard)</option>
              <option value={10}>Every 10 seconds (Low Bandwidth)</option>
            </select>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
              Controls live sensor polling cadence sent through POST /predict_batch.
            </p>
          </div>
        </div>

        {/* Confidence Threshold Slider */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="confidence-slider"
              className="text-xs font-semibold text-[#0F172A] dark:text-white"
            >
              Alert Confidence Threshold
            </label>
            <span className="font-mono text-sm font-bold text-[#2563EB] tabular-nums">
              {draft.confidenceThreshold.toFixed(2)} ({Math.round(draft.confidenceThreshold * 100)}%)
            </span>
          </div>
          <input
            id="confidence-slider"
            type="range"
            min={0.5}
            max={0.99}
            step={0.01}
            value={draft.confidenceThreshold}
            onChange={(e) =>
              setDraft({ ...draft, confidenceThreshold: Number(e.target.value) })
            }
            className="w-full accent-[#2563EB] cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] mt-1">
            <span>0.50 (Max Recall)</span>
            <span>0.80 (Balanced Default)</span>
            <span>0.99 (Strictest FPR)</span>
          </div>
        </div>

        {/* Alert Sensitivity */}
        <div className="pt-2">
          <p className="text-xs font-semibold text-[#0F172A] dark:text-white mb-2">
            Alert Sensitivity Profile
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {(['Low', 'Medium', 'High'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setDraft({ ...draft, alertSensitivity: level })}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  draft.alertSensitivity === level
                    ? 'bg-[#0F2A44] dark:bg-[#2563EB] text-white border-transparent'
                    : 'bg-[#F8FAFC] dark:bg-[#0B1B2B] text-[#0F172A] dark:text-slate-200 border-[#E2E8F0] dark:border-[#1E354E] hover:border-[#2563EB]'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications & Appearance */}
      <div className="rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E354E]">
          <Sliders className="w-4 h-4 text-[#0891B2]" />
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">
            Alert Channels &amp; Interface Theme
          </h2>
        </div>

        {/* Email Alerts Toggle */}
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 text-[#64748B] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
                Email Alerts (Critical &amp; High)
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Dispatch automated incident summaries to analyst inbox (maryam.tahir@soc.local)
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.emailAlerts}
            onClick={() => setDraft({ ...draft, emailAlerts: !draft.emailAlerts })}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
              draft.emailAlerts ? 'bg-[#2563EB]' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                draft.emailAlerts ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Sound Alert Toggle */}
        <div className="flex items-center justify-between gap-4 py-2 border-t border-[#E2E8F0] dark:border-[#1E354E]">
          <div className="flex items-start gap-3">
            <Volume2 className="w-4 h-4 text-[#64748B] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
                Audible SOC Chime
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Play a subtle acoustic notification tone when a Critical intrusion is detected
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.soundAlerts}
            onClick={() => setDraft({ ...draft, soundAlerts: !draft.soundAlerts })}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
              draft.soundAlerts ? 'bg-[#2563EB]' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                draft.soundAlerts ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Theme Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-t border-[#E2E8F0] dark:border-[#1E354E]">
          <div>
            <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
              Dashboard Theme Mode
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Switch between Light SOC Canvas (#F1F5F9) and Night Operations Dark Mode
            </p>
          </div>
          <div className="flex items-center p-1 rounded-lg bg-[#F1F5F9] dark:bg-[#0B1B2B] border border-[#E2E8F0] dark:border-[#1E354E] shrink-0">
            <button
              type="button"
              onClick={() => handleThemeSwitch('light')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                draft.theme === 'light'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] dark:text-slate-300'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Light
            </button>
            <button
              type="button"
              onClick={() => handleThemeSwitch('dark')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                draft.theme === 'dark'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] dark:text-slate-300'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              Dark
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
