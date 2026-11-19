import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, Calendar, CheckCircle2, ArrowRight, Loader2, Wifi, WifiOff } from 'lucide-react';
import { AlertRecord, PageId, RenderApiConfig, TimeRange } from '../../types/nids';
import { SeverityBadge } from '../shared/UiPrimitives';

interface TopHeaderProps {
  activePage: PageId;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  globalSearch: string;
  onGlobalSearchChange: (val: string) => void;
  alerts: AlertRecord[];
  isLiveRunning: boolean;
  renderConfig: RenderApiConfig;
  onRetryHealthCheck: () => void;
  onOpenMobileMenu: () => void;
  onNavigateToAlert: (alertId: string) => void;
  onNavigatePage: (page: PageId) => void;
  onAcknowledgeAll: () => void;
}

const TIME_RANGES: Array<{ id: TimeRange; label: string }> = [
  { id: '1h', label: 'Last 1h' },
  { id: '6h', label: '6h' },
  { id: '24h', label: '24h' },
  { id: '7d', label: '7 days' },
];

export function TopHeader({
  timeRange,
  onTimeRangeChange,
  globalSearch,
  onGlobalSearchChange,
  alerts,
  isLiveRunning,
  renderConfig,
  onRetryHealthCheck,
  onOpenMobileMenu,
  onNavigateToAlert,
  onNavigatePage,
  onAcknowledgeAll,
}: TopHeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const unreadAlerts = alerts.filter((a) => a.status === 'New' || a.status === 'Investigating');

  const searchMatches =
    globalSearch.trim().length > 0
      ? alerts
          .filter((a) => {
            const q = globalSearch.toLowerCase();
            return (
              a.id.toLowerCase().includes(q) ||
              a.sourceIp.toLowerCase().includes(q) ||
              a.destinationIp.toLowerCase().includes(q) ||
              a.attackType.toLowerCase().includes(q) ||
              a.category.toLowerCase().includes(q)
            );
          })
          .slice(0, 5)
      : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      setSearchFocused(false);
      onNavigatePage('alerts');
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-[#0B1B2B] border-b border-[#E2E8F0] dark:border-[#1E354E] px-4 lg:px-6 flex items-center justify-between gap-3">
      {/* Left: Mobile Menu + Search Bar */}
      <div className="flex items-center gap-3 flex-1 min-w-0 max-w-md">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg text-[#0F172A] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#0F2A44] cursor-pointer shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div ref={searchRef} className="relative flex-1 min-w-0">
          <form onSubmit={handleSearchSubmit}>
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={globalSearch}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => onGlobalSearchChange(e.target.value)}
              placeholder="Search by IP, attack type, or Alert ID..."
              aria-label="Global search by IP, attack type, or Alert ID"
              className="w-full h-9 pl-9 pr-3 rounded-lg text-xs sm:text-sm bg-[#F1F5F9] dark:bg-[#0F2A44] border border-[#E2E8F0] dark:border-[#1E354E] text-[#0F172A] dark:text-slate-100 placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            />
          </form>

          {/* Instant Search Results Dropdown */}
          {searchFocused && globalSearch.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xl overflow-hidden z-50">
              <div className="px-3 py-2 border-b border-[#E2E8F0] dark:border-[#1E354E] flex items-center justify-between text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                <span>Matching Alerts ({searchMatches.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchFocused(false);
                    onNavigatePage('alerts');
                  }}
                  className="text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {searchMatches.length === 0 ? (
                <div className="px-3 py-4 text-xs text-center text-[#64748B] dark:text-[#94A3B8]">
                  No alerts matched "{globalSearch}".
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E354E]">
                  {searchMatches.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => {
                        setSearchFocused(false);
                        onNavigateToAlert(alert.id);
                      }}
                      className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#0F2A44] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] dark:text-white truncate">
                          <span className="font-mono text-[#2563EB] mr-1.5">{alert.id}</span>
                          {alert.attackType}
                        </p>
                        <p className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] truncate">
                          {alert.sourceIp} → {alert.destinationIp}:{alert.dstPort}
                        </p>
                      </div>
                      <SeverityBadge severity={alert.severity} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Live Badge, Time Range, Date, Notifications, User Profile */}
      <div className="flex items-center gap-2.5 lg:gap-3.5 shrink-0">
        {/* Real /health Backend Status */}
        <button
          type="button"
          onClick={
            renderConfig.connectionStatus === 'error' || renderConfig.connectionStatus === 'disconnected'
              ? onRetryHealthCheck
              : () => onNavigatePage('settings')
          }
          title={
            renderConfig.connectionStatus === 'connected'
              ? `Backend online (${renderConfig.apiUrl})`
              : renderConfig.connectionStatus === 'checking'
              ? 'Waking up Render backend (free tier can take up to 50s)'
              : 'Backend offline — click to retry /health'
          }
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            renderConfig.connectionStatus === 'connected'
              ? 'bg-[#059669]/10 text-[#059669] dark:text-[#34D399] border-[#059669]/25'
              : renderConfig.connectionStatus === 'checking'
              ? 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#93C5FD] border-[#2563EB]/25'
              : 'bg-[#DC2626]/10 text-[#DC2626] dark:text-[#FCA5A5] border-[#DC2626]/25'
          }`}
        >
          {renderConfig.connectionStatus === 'checking' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Waking up backend...</span>
            </>
          ) : renderConfig.connectionStatus === 'connected' ? (
            <>
              <Wifi className="w-3.5 h-3.5 shrink-0" />
              <span className="tabular-nums">
                API Online {renderConfig.lastLatencyMs ? `(${renderConfig.lastLatencyMs}ms)` : ''}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>API Offline · Retry</span>
            </>
          )}
        </button>

        {/* Live Monitoring Indicator */}
        <button
          type="button"
          onClick={() => onNavigatePage('live')}
          title="Open Live Traffic Monitor"
          className={`hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isLiveRunning
              ? 'bg-[#059669]/10 text-[#059669] dark:text-[#34D399] border-[#059669]/25'
              : 'bg-[#D97706]/10 text-[#D97706] dark:text-[#FCD34D] border-[#D97706]/25'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isLiveRunning ? 'bg-[#059669]' : 'bg-[#D97706]'
            }`}
          />
          <span>{isLiveRunning ? 'LIVE' : 'PAUSED'}</span>
        </button>

        {/* Time-range selector */}
        <div
          className="hidden lg:flex items-center p-0.5 rounded-lg bg-[#F1F5F9] dark:bg-[#0F2A44] border border-[#E2E8F0] dark:border-[#1E354E]"
          role="group"
          aria-label="Time range selector"
        >
          {TIME_RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTimeRangeChange(item.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                timeRange === item.id
                  ? 'bg-white dark:bg-[#2563EB] text-[#0F172A] dark:text-white shadow-xs'
                  : 'text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Date */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap tabular-nums">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>{todayFormatted}</span>
        </div>

        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative p-2 rounded-lg text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#0F2A44] transition-colors cursor-pointer"
            aria-label={`Notifications (${unreadAlerts.length} active alerts)`}
          >
            <Bell className="w-4 h-4" />
            {unreadAlerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadAlerts.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-[#E2E8F0] dark:border-[#1E354E] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-[#0F172A] dark:text-white">
                    Active Alert Queue
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                    {unreadAlerts.length} unacknowledged alerts
                  </p>
                </div>
                {unreadAlerts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onAcknowledgeAll();
                      setNotifOpen(false);
                    }}
                    className="text-xs font-medium text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ack All
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#E2E8F0] dark:divide-[#1E354E]">
                {unreadAlerts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                    All alerts have been acknowledged or resolved.
                  </div>
                ) : (
                  unreadAlerts.slice(0, 6).map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        onNavigateToAlert(alert.id);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-[#0F2A44] transition-colors flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] dark:text-white truncate">
                          {alert.attackType}
                        </p>
                        <p className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] mt-0.5 truncate">
                          {alert.id} · {alert.sourceIp} → {alert.destinationIp}
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 tabular-nums">
                          {alert.timestamp} · Confidence {alert.confidence}%
                        </p>
                      </div>
                      <SeverityBadge severity={alert.severity} />
                    </button>
                  ))
                )}
              </div>

              <div className="px-4 py-2.5 bg-[#F8FAFC] dark:bg-[#0B1B2B] border-t border-[#E2E8F0] dark:border-[#1E354E]">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    onNavigatePage('alerts');
                  }}
                  className="w-full text-center text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Open Alerts Center
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar & Analyst Identity */}
        <button
          type="button"
          onClick={() => onNavigatePage('settings')}
          className="flex items-center gap-2.5 pl-2.5 border-l border-[#E2E8F0] dark:border-[#1E354E] text-left cursor-pointer hover:opacity-90 transition-opacity shrink-0"
          title="Analyst Profile & Settings"
        >
          <div className="w-8 h-8 rounded-full bg-[#0F2A44] text-white text-xs font-semibold flex items-center justify-center shrink-0 border border-[#2563EB]/40">
            MT
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-semibold text-[#0F172A] dark:text-white whitespace-nowrap">
              Maryam Tahir
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
              Security Analyst
            </p>
          </div>
        </button>
      </div>
    </header>
  );
}
