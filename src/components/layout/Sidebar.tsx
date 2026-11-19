import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Bell,
  Radar,
  Cpu,
  Database,
  Terminal,
  FileBarChart2,
  Settings,
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
  Plug,
} from 'lucide-react';
import { PageId, RenderApiConfig } from '../../types/nids';

interface SidebarProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  unreadAlertCount: number;
  activeModel: string;
  renderConfig: RenderApiConfig;
}

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'inference', label: 'Model Inference', icon: Plug },
  { id: 'live', label: 'Live Traffic Monitor', icon: Activity },
  { id: 'alerts', label: 'Alerts Center', icon: Bell },
  { id: 'analysis', label: 'Attack Analysis', icon: Radar },
  { id: 'models', label: 'Model Performance', icon: Cpu },
  { id: 'dataset', label: 'Dataset Explorer', icon: Database },
  { id: 'lab', label: 'Lab Simulation', icon: Terminal },
  { id: 'reports', label: 'Reports', icon: FileBarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  activePage,
  onSelectPage,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  unreadAlertCount,
  activeModel,
  renderConfig,
}: SidebarProps) {
  const handleNavClick = (id: PageId) => {
    onSelectPage(id);
    onCloseMobile();
  };

  const isRenderConnected = renderConfig.enabled && renderConfig.connectionStatus === 'connected';

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[1px] md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen bg-[#0B1B2B] text-slate-200 border-r border-slate-800/80 flex flex-col transition-all duration-200 ease-out
          ${mobileOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full md:translate-x-0'}
          ${collapsed ? 'md:w-[72px]' : 'md:w-[240px]'}
        `}
        aria-label="Primary Navigation"
      >
        {/* Brand Header */}
        <div className="min-h-16 py-2.5 px-3.5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => handleNavClick('overview')}
            className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-lg"
          >
            <div className="w-9 h-9 rounded-lg bg-[#0F2A44] border border-slate-700/80 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-[#38BDF8]" />
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white tracking-tight truncate">
                  Sentinel AI
                </p>
                <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">
                  AI-Based Network Intrusion Detection System
                </p>
              </div>
            )}
          </button>

          {/* Mobile Close */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const showLabel = !collapsed || mobileOpen;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap
                  ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:bg-[#0F2A44] hover:text-white'
                  }
                  ${collapsed && !mobileOpen ? 'justify-center px-2' : ''}
                `}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {showLabel && <span className="truncate flex-1 text-left">{item.label}</span>}
                {showLabel && item.id === 'alerts' && unreadAlertCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-[11px] font-semibold rounded tabular-nums ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#DC2626] text-white'
                    }`}
                  >
                    {unreadAlertCount}
                  </span>
                )}
                {showLabel && item.id === 'inference' && isRenderConnected && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#059669]/25 text-[#34D399]'
                    }`}
                  >
                    API
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Active Engine Summary + Collapse Toggle */}
        <div className="border-t border-slate-800/80 p-3 shrink-0 space-y-2">
          {(!collapsed || mobileOpen) && (
            <button
              type="button"
              onClick={() => handleNavClick('inference')}
              className="w-full text-left rounded-lg bg-[#0F2A44]/90 hover:bg-[#16385A] border border-slate-700/60 px-3 py-2.5 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Inference API</span>
                <span className={isRenderConnected ? 'text-[#34D399] font-medium' : 'text-[#38BDF8] font-medium'}>
                  {isRenderConnected ? 'Render Live' : 'Local Engine'}
                </span>
              </div>
              <p className="text-xs font-semibold text-white mt-0.5 truncate">{activeModel}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate tabular-nums">
                {isRenderConnected
                  ? `Connected · ${renderConfig.lastLatencyMs ?? 0}ms`
                  : 'Connect Render URL for Kaggle model'}
              </p>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:flex w-full items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-[#0F2A44] transition-colors cursor-pointer"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
