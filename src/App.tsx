import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { DemoFooter, PageSkeleton, ToastContainer } from './components/shared/UiPrimitives';
import { OverviewPage } from './pages/OverviewPage';
import { InferencePage } from './pages/InferencePage';
import { LiveTrafficPage } from './pages/LiveTrafficPage';
import { AlertsCenterPage } from './pages/AlertsCenterPage';
import { AttackAnalysisPage } from './pages/AttackAnalysisPage';
import { ModelPerformancePage } from './pages/ModelPerformancePage';
import { DatasetExplorerPage } from './pages/DatasetExplorerPage';
import { LabSimulationPage } from './pages/LabSimulationPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  DEFAULT_RENDER_CONFIG,
  acknowledgeAllAlertsApi,
  buildLiveBatchSamples,
  clearLiveFlowsApi,
  createAlertApi,
  deleteAlertApi,
  deleteReportApi,
  fetchBootstrapState,
  ingestLiveBatch,
  persistSettingsAndRenderConfig,
  resetBackendSettings,
  saveReportApi,
  testRenderConnection,
  updateAlertStatusApi,
} from './services/modelApi';
import {
  AlertRecord,
  AlertStatus,
  AppSettings,
  AttackCategory,
  LiveFlowRow,
  LiveSessionStats,
  LiveThroughputPoint,
  PageId,
  RenderApiConfig,
  SavedReportRecord,
  TimeRange,
  ToastMessage,
} from './types/nids';

const DEFAULT_SETTINGS: AppSettings = {
  activeModel: 'XGBoost',
  confidenceThreshold: 0.8,
  alertSensitivity: 'High',
  emailAlerts: true,
  soundAlerts: false,
  theme: 'light',
  refreshIntervalSec: 2,
};

const EMPTY_LIVE_STATS: LiveSessionStats = {
  totalScored: 0,
  benignScored: 0,
  attackScored: 0,
  blockedToday: 0,
  avgLatencyMs: 0,
  attackByCategory: {},
  sourceIpHits: {},
  portHits: {},
};

function playAlertChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // Ignore browser audio restrictions
  }
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [renderConfig, setRenderConfig] = useState<RenderApiConfig>({
    ...DEFAULT_RENDER_CONFIG,
    connectionStatus: 'checking',
  });

  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [focusedAlertId, setFocusedAlertId] = useState<string | null>(null);
  const [selectedAttackCategory, setSelectedAttackCategory] = useState<AttackCategory>('All');

  const [isLiveRunning, setIsLiveRunning] = useState<boolean>(true);
  const [liveSeries, setLiveSeries] = useState<LiveThroughputPoint[]>([]);
  const [liveFlows, setLiveFlows] = useState<LiveFlowRow[]>([]);
  const [liveStats, setLiveStats] = useState<LiveSessionStats>(EMPTY_LIVE_STATS);
  const [liveApiError, setLiveApiError] = useState<string | null>(null);
  const [reports, setReports] = useState<SavedReportRecord[]>([]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const sensorInFlightRef = useRef<boolean>(false);
  const backendWarnedRef = useRef<boolean>(false);
  const startupHealthDoneRef = useRef<boolean>(false);

  const pushToast = useCallback(
    (title: string, description?: string, variant: ToastMessage['variant'] = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Run GET /health against the configured Render backend (with auto-retry while waking up)
  const checkBackendHealthWithRetry = useCallback(
    async (cfg: RenderApiConfig, silent = false, maxAttempts = 2) => {
      if (!cfg.apiUrl.trim()) return;

      setRenderConfig((prev) => ({
        ...prev,
        ...cfg,
        connectionStatus: 'checking',
        lastError: undefined,
      }));

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await testRenderConnection(cfg);
          const checkedAt = new Date().toTimeString().slice(0, 8);
          if (result.ok) {
            const nextCfg: RenderApiConfig = result.renderConfig ?? {
              ...cfg,
              enabled: true,
              connectionStatus: 'connected',
              lastLatencyMs: result.latencyMs,
              lastCheckedAt: checkedAt,
              lastError: undefined,
            };
            setRenderConfig(nextCfg);
            if (!silent) {
              pushToast(
                'Render Backend Online',
                `GET /health OK (${result.latencyMs}ms) · ${
                  nextCfg.backendHealth?.model || 'XGBoost CIC-IDS2017'
                }`,
                'success'
              );
            }
            return;
          }

          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }

          setRenderConfig((prev) => ({
            ...prev,
            ...cfg,
            connectionStatus: 'error',
            lastLatencyMs: result.latencyMs,
            lastCheckedAt: checkedAt,
            lastError: result.error || `HTTP ${result.status}`,
          }));
          if (!silent) {
            pushToast(
              'Backend not reachable — check /health',
              result.error || `Received HTTP ${result.status}`,
              'danger'
            );
          }
        } catch (err) {
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          const message = err instanceof Error ? err.message : 'Unable to reach backend /health.';
          setRenderConfig((prev) => ({
            ...prev,
            ...cfg,
            connectionStatus: 'error',
            lastError: message,
          }));
          if (!silent) {
            pushToast('Backend not reachable — check /health', message, 'danger');
          }
        }
      }
    },
    [pushToast]
  );

  // Hydrate persistent state from Express backend on mount, then immediately verify GET /health
  useEffect(() => {
    let active = true;
    fetchBootstrapState()
      .then((data) => {
        if (!active) return;
        const hydratedSettings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
        const hydratedRender: RenderApiConfig = {
          ...DEFAULT_RENDER_CONFIG,
          ...(data.renderConfig || {}),
          // Never assume Online on startup until real GET /health succeeds
          connectionStatus: 'checking',
        };
        setSettings(hydratedSettings);
        setRenderConfig(hydratedRender);
        if (Array.isArray(data.alerts)) setAlerts(data.alerts);
        if (Array.isArray(data.flows)) setLiveFlows(data.flows);
        if (Array.isArray(data.throughput)) setLiveSeries(data.throughput);
        if (Array.isArray(data.reports)) setReports(data.reports);
        if (data.liveStats) setLiveStats({ ...EMPTY_LIVE_STATS, ...data.liveStats });

        if (!startupHealthDoneRef.current && hydratedRender.apiUrl) {
          startupHealthDoneRef.current = true;
          checkBackendHealthWithRetry(hydratedRender, true, 2);
        }
      })
      .catch((err) => {
        console.error('Bootstrap fetch failed:', err);
      })
      .finally(() => {
        if (active) setIsBootstrapping(false);
      });

    return () => {
      active = false;
    };
  }, [checkBackendHealthWithRetry]);

  // Sync Tailwind v4 .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Responsive tablet collapse
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1100) {
        setSidebarCollapsed(true);
      } else if (window.innerWidth >= 1100) {
        setSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync backend telemetry responses (flows, alerts, throughput, liveStats) into React state
  const syncBackendTelemetry = useCallback(
    (payload: {
      flow?: LiveFlowRow;
      flows?: LiveFlowRow[];
      alert?: AlertRecord;
      alerts?: AlertRecord[];
      throughput?: LiveThroughputPoint[];
      liveStats?: LiveSessionStats;
    }) => {
      if (payload.flows) {
        setLiveFlows(payload.flows);
      } else if (payload.flow) {
        const incomingFlow = payload.flow;
        setLiveFlows((prev) => {
          const deduped = prev.filter((f) => f.id !== incomingFlow.id);
          return [incomingFlow, ...deduped].slice(0, 80);
        });
      }

      if (payload.alerts && payload.alerts.length > 0) {
        const incoming = payload.alerts;
        setAlerts((prev) => {
          const existingIds = new Set(incoming.map((a) => a.id));
          return [...incoming, ...prev.filter((a) => !existingIds.has(a.id))].slice(0, 200);
        });
        if (settings.soundAlerts) playAlertChime();
      } else if (payload.alert) {
        const incomingAlert = payload.alert;
        setAlerts((prev) => {
          const deduped = prev.filter((a) => a.id !== incomingAlert.id);
          return [incomingAlert, ...deduped].slice(0, 200);
        });
        if (settings.soundAlerts) playAlertChime();
      }

      if (payload.throughput) {
        setLiveSeries(payload.throughput);
      }

      if (payload.liveStats) {
        setLiveStats(payload.liveStats);
      }
    },
    [settings.soundAlerts]
  );

  // Send 5 flows to real Render POST /predict_batch (strictly real API — zero demo data)
  const handleTriggerLiveBatch = useCallback(async () => {
    if (sensorInFlightRef.current) return;
    sensorInFlightRef.current = true;
    try {
      const bias =
        settings.alertSensitivity === 'High'
          ? 0.28
          : settings.alertSensitivity === 'Medium'
          ? 0.2
          : 0.14;
      const samples = buildLiveBatchSamples(5, bias);
      const res = await ingestLiveBatch({
        flows: samples,
        createAlertIfAttack: true,
      });
      if (res.ok) {
        setLiveApiError(null);
        backendWarnedRef.current = false;
        syncBackendTelemetry({
          flows: res.flows,
          alerts: res.createdAlerts,
          throughput: res.throughput,
          liveStats: res.liveStats,
        });
        setRenderConfig((prev) => ({
          ...prev,
          connectionStatus: 'connected',
          lastLatencyMs: res.latencyMs,
        }));
      } else {
        const errText = res.error || 'Render /predict_batch failed.';
        setLiveApiError(errText);
        if (!backendWarnedRef.current) {
          backendWarnedRef.current = true;
          pushToast('Render /predict_batch Error', errText, 'danger');
        }
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Unable to reach Render /predict_batch.';
      setLiveApiError(errText);
      if (!backendWarnedRef.current) {
        backendWarnedRef.current = true;
        pushToast('Render /predict_batch Error', errText, 'danger');
      }
    } finally {
      sensorInFlightRef.current = false;
    }
  }, [settings.alertSensitivity, syncBackendTelemetry, pushToast]);

  // Live Traffic Batch Polling Interval (default 2s)
  useEffect(() => {
    if (isBootstrapping || !isLiveRunning) return;
    const intervalMs = Math.max(2, settings.refreshIntervalSec) * 1000;

    const timer = window.setInterval(() => {
      handleTriggerLiveBatch();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isBootstrapping, isLiveRunning, settings.refreshIntervalSec, handleTriggerLiveBatch]);

  const handleSaveSettings = useCallback(
    async (nextSettings: AppSettings, nextRender: RenderApiConfig) => {
      setSettings(nextSettings);
      setRenderConfig(nextRender);
      try {
        const saved = await persistSettingsAndRenderConfig(nextSettings, nextRender);
        if (saved.settings) setSettings(saved.settings);
        if (saved.renderConfig) setRenderConfig(saved.renderConfig);
        backendWarnedRef.current = false;
        pushToast(
          'Settings Saved',
          `Model: ${nextSettings.activeModel} · Refresh: ${nextSettings.refreshIntervalSec}s`,
          'success'
        );
      } catch {
        pushToast('Save Failed', 'Could not persist settings to backend server.', 'danger');
      }
    },
    [pushToast]
  );

  const handleSaveRenderConfig = useCallback(
    async (nextRender: RenderApiConfig) => {
      setRenderConfig(nextRender);
      backendWarnedRef.current = false;
      try {
        const saved = await persistSettingsAndRenderConfig(settings, nextRender);
        if (saved.renderConfig) setRenderConfig(saved.renderConfig);
      } catch {
        // Keep optimistic UI state
      }
    },
    [settings]
  );

  const handleResetDefaults = useCallback(async () => {
    try {
      const res = await resetBackendSettings();
      setSettings(res.settings ?? DEFAULT_SETTINGS);
      setRenderConfig(res.renderConfig ?? DEFAULT_RENDER_CONFIG);
      backendWarnedRef.current = false;
      pushToast(
        'Defaults Restored',
        'AI-Based Network Intrusion Detection System settings reset on backend server.',
        'info'
      );
    } catch {
      setSettings(DEFAULT_SETTINGS);
      setRenderConfig(DEFAULT_RENDER_CONFIG);
      pushToast('Reset Error', 'Restored local defaults; backend unavailable.', 'warning');
    }
  }, [pushToast]);

  const handleTestRenderConnection = useCallback(
    async (overrideConfig?: RenderApiConfig) => {
      const cfg = overrideConfig ?? renderConfig;
      if (!cfg.apiUrl.trim()) {
        pushToast('Missing URL', 'Enter your Render.com model URL first.', 'warning');
        return;
      }
      await checkBackendHealthWithRetry(cfg, false, 1);
    },
    [renderConfig, checkBackendHealthWithRetry, pushToast]
  );

  const handleSelectPage = useCallback(
    (nextPage: PageId) => {
      if (nextPage === activePage) return;
      setIsPageLoading(true);
      setActivePage(nextPage);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      window.setTimeout(() => {
        setIsPageLoading(false);
      }, 120);
    },
    [activePage]
  );

  const handleUpdateAlertStatus = useCallback(
    async (id: string, status: AlertStatus) => {
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      try {
        const res = await updateAlertStatusApi(id, status);
        if (Array.isArray(res.alerts)) setAlerts(res.alerts);
        if (status === 'Acknowledged') {
          pushToast('Alert Acknowledged', `Alert ${id} persisted as Acknowledged.`, 'info');
        } else if (status === 'Resolved') {
          pushToast('Alert Resolved', `Alert ${id} closed and persisted.`, 'success');
        } else if (status === 'Investigating') {
          pushToast('Investigation Started', `Alert ${id} moved to Investigating.`, 'info');
        }
      } catch {
        pushToast('Update Failed', `Could not update status for ${id}.`, 'danger');
      }
    },
    [pushToast]
  );

  const handleDeleteAlert = useCallback(
    async (id: string) => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      try {
        const res = await deleteAlertApi(id);
        if (Array.isArray(res.alerts)) setAlerts(res.alerts);
        pushToast('Alert Deleted', `Alert ${id} permanently removed.`, 'info');
      } catch {
        pushToast('Delete Failed', `Could not delete alert ${id}.`, 'danger');
      }
    },
    [pushToast]
  );

  const handleAcknowledgeAll = useCallback(async () => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.status === 'New' || a.status === 'Investigating' ? { ...a, status: 'Acknowledged' } : a
      )
    );
    try {
      const res = await acknowledgeAllAlertsApi();
      if (Array.isArray(res.alerts)) setAlerts(res.alerts);
      pushToast('Alerts Acknowledged', 'All open alerts have been acknowledged.', 'success');
    } catch {
      pushToast('Action Failed', 'Could not acknowledge all alerts on server.', 'danger');
    }
  }, [pushToast]);

  const handleInspectAlert = useCallback(
    (alertId: string) => {
      setFocusedAlertId(alertId);
      handleSelectPage('alerts');
    },
    [handleSelectPage]
  );

  const handleSelectAttackCategoryFromOverview = useCallback(
    (cat: AttackCategory) => {
      setSelectedAttackCategory(cat);
      handleSelectPage('analysis');
    },
    [handleSelectPage]
  );

  const handleInjectAlert = useCallback(
    async (alert: AlertRecord) => {
      setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
      if (settings.soundAlerts) {
        playAlertChime();
      }
      try {
        const res = await createAlertApi(alert);
        if (Array.isArray(res.alerts)) setAlerts(res.alerts);
        pushToast(
          `${alert.attackType} Logged`,
          `Alert ${alert.id} (${alert.detectionLatency}) saved to Alerts Center.`,
          alert.severity === 'Critical' || alert.severity === 'High' ? 'danger' : 'info'
        );
      } catch {
        pushToast('Alert Save Error', `Could not persist alert ${alert.id}.`, 'danger');
      }
    },
    [pushToast, settings.soundAlerts]
  );

  const handleClearFlows = useCallback(async () => {
    try {
      await clearLiveFlowsApi();
      setLiveFlows([]);
      pushToast('Flow Table Cleared', 'Live flow buffer cleared on backend server.', 'info');
    } catch {
      pushToast('Clear Failed', 'Could not clear flow buffer.', 'danger');
    }
  }, [pushToast]);

  const handleCreateReport = useCallback(
    async (report: Omit<SavedReportRecord, 'generatedAt'>) => {
      try {
        const res = await saveReportApi(report);
        if (Array.isArray(res.reports)) setReports(res.reports);
        pushToast('Report Saved', `${report.title} (${report.id}) persisted to archive.`, 'success');
      } catch {
        pushToast('Report Save Failed', 'Could not persist generated report.', 'danger');
      }
    },
    [pushToast]
  );

  const handleDeleteReport = useCallback(
    async (id: string) => {
      setReports((prev) => prev.filter((r) => r.id !== id));
      try {
        const res = await deleteReportApi(id);
        if (Array.isArray(res.reports)) setReports(res.reports);
        pushToast('Report Deleted', `Report ${id} removed from archive.`, 'info');
      } catch {
        pushToast('Delete Failed', `Could not delete report ${id}.`, 'danger');
      }
    },
    [pushToast]
  );

  const handleSelectActiveModel = useCallback(
    async (modelName: string) => {
      const nextSettings = { ...settings, activeModel: modelName };
      setSettings(nextSettings);
      try {
        await persistSettingsAndRenderConfig(nextSettings, renderConfig);
        pushToast('Active Model Updated', `${modelName} persisted for SOC inference.`, 'info');
      } catch {
        pushToast('Update Failed', 'Could not persist model change.', 'danger');
      }
    },
    [settings, renderConfig, pushToast]
  );

  const unreadAlertCount = alerts.filter(
    (a) => a.status === 'New' || a.status === 'Investigating'
  ).length;

  const recentLabAlerts = alerts.filter(
    (a) => a.id.startsWith('LAB-') || a.isSimulated || a.isLiveApi
  );

  return (
    <div className="min-h-screen bg-[#F1F5F9] dark:bg-[#08121E] text-[#0F172A] dark:text-[#F1F5F9] transition-colors">
      <Sidebar
        activePage={activePage}
        onSelectPage={handleSelectPage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        unreadAlertCount={unreadAlertCount}
        activeModel={settings.activeModel}
        renderConfig={renderConfig}
      />

      <div
        className={`flex flex-col min-h-screen transition-all duration-200 ${
          sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[240px]'
        }`}
      >
        <TopHeader
          activePage={activePage}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          globalSearch={globalSearch}
          onGlobalSearchChange={setGlobalSearch}
          alerts={alerts}
          isLiveRunning={isLiveRunning}
          renderConfig={renderConfig}
          onRetryHealthCheck={() => handleTestRenderConnection(renderConfig)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigateToAlert={handleInspectAlert}
          onNavigatePage={handleSelectPage}
          onAcknowledgeAll={handleAcknowledgeAll}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {isBootstrapping || isPageLoading ? (
            <PageSkeleton />
          ) : (
            <>
              {activePage === 'overview' && (
                <OverviewPage
                  alerts={alerts}
                  activeModel={settings.activeModel}
                  renderConfig={renderConfig}
                  liveStats={liveStats}
                  timeRange={timeRange}
                  isDark={settings.theme === 'dark'}
                  onNavigatePage={handleSelectPage}
                  onInspectAlert={handleInspectAlert}
                  onSelectAttackCategory={handleSelectAttackCategoryFromOverview}
                  onRetryHealthCheck={() => handleTestRenderConnection(renderConfig)}
                />
              )}

              {activePage === 'inference' && (
                <InferencePage
                  renderConfig={renderConfig}
                  activeModel={settings.activeModel}
                  onSaveRenderConfig={handleSaveRenderConfig}
                  onTestRenderConnection={handleTestRenderConnection}
                  onSyncBackendTelemetry={syncBackendTelemetry}
                  onInjectAlert={handleInjectAlert}
                  onNotify={(title, desc, variant) =>
                    pushToast(title, desc, variant ?? 'success')
                  }
                />
              )}

              {activePage === 'live' && (
                <LiveTrafficPage
                  liveSeries={liveSeries}
                  liveFlows={liveFlows}
                  isLiveRunning={isLiveRunning}
                  onToggleLive={() => {
                    setIsLiveRunning((prev) => {
                      const next = !prev;
                      pushToast(
                        next ? 'Live Feed Resumed' : 'Live Feed Paused',
                        next
                          ? `Sending 5 flows every ${settings.refreshIntervalSec}s to POST /predict_batch.`
                          : 'Live flow polling paused for inspection.',
                        'info'
                      );
                      return next;
                    });
                  }}
                  onTriggerSingleSensorFlow={handleTriggerLiveBatch}
                  onClearFlows={handleClearFlows}
                  refreshIntervalSec={settings.refreshIntervalSec}
                  blockedToday={liveStats.blockedToday}
                  renderConfig={renderConfig}
                  liveApiError={liveApiError}
                  onRetryHealthCheck={() => handleTestRenderConnection(renderConfig)}
                  isDark={settings.theme === 'dark'}
                />
              )}

              {activePage === 'alerts' && (
                <AlertsCenterPage
                  alerts={alerts}
                  globalSearch={globalSearch}
                  focusedAlertId={focusedAlertId}
                  onClearFocusedAlert={() => setFocusedAlertId(null)}
                  onUpdateAlertStatus={handleUpdateAlertStatus}
                  onDeleteAlert={handleDeleteAlert}
                  onAcknowledgeAll={handleAcknowledgeAll}
                  onExportSuccess={(msg) => pushToast('Report Exported', msg, 'success')}
                />
              )}

              {activePage === 'analysis' && (
                <AttackAnalysisPage
                  selectedCategory={selectedAttackCategory}
                  onSelectCategory={setSelectedAttackCategory}
                  isDark={settings.theme === 'dark'}
                />
              )}

              {activePage === 'models' && (
                <ModelPerformancePage
                  activeModel={settings.activeModel}
                  onSelectActiveModel={handleSelectActiveModel}
                  isDark={settings.theme === 'dark'}
                />
              )}

              {activePage === 'dataset' && (
                <DatasetExplorerPage isDark={settings.theme === 'dark'} />
              )}

              {activePage === 'lab' && (
                <LabSimulationPage
                  activeModel={settings.activeModel}
                  renderConfig={renderConfig}
                  onSyncBackendTelemetry={syncBackendTelemetry}
                  onInspectAlert={handleInspectAlert}
                  onOpenInferenceSetup={() => handleSelectPage('inference')}
                  onNotify={(title, desc, variant) =>
                    pushToast(title, desc, variant ?? 'success')
                  }
                  recentLabAlerts={recentLabAlerts}
                />
              )}

              {activePage === 'reports' && (
                <ReportsPage
                  alerts={alerts}
                  reports={reports}
                  liveStats={liveStats}
                  activeModel={settings.activeModel}
                  onCreateReport={handleCreateReport}
                  onDeleteReport={handleDeleteReport}
                  onNotify={(title, desc, variant) =>
                    pushToast(title, desc, variant ?? 'success')
                  }
                />
              )}

              {activePage === 'settings' && (
                <SettingsPage
                  settings={settings}
                  renderConfig={renderConfig}
                  onSaveSettings={handleSaveSettings}
                  onTestRenderConnection={handleTestRenderConnection}
                  onResetDefaults={handleResetDefaults}
                />
              )}
            </>
          )}

          <DemoFooter />
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
