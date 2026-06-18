// src/components/AppShell.tsx
//
// Top-level shell: a slim nav rail + global theme-variant tabs, hosting one
// active view. The voice/orchestration dashboard is the home view; History,
// Schedule, Library and Settings sit beside it. Theme + active view live in the
// store so every view shares the accent.

import { useDashboardStore } from '../store';
import { THEMES, getTheme, MONO } from '../theme';
import TimeBackground from './TimeBackground';
import OrchestrationDashboard from './OrchestrationDashboard';
import HistoryView from './views/HistoryView';
import ScheduleView from './views/ScheduleView';
import LibraryView from './views/LibraryView';
import SettingsView from './views/SettingsView';

const NAV: { id: string; icon: string; label: string }[] = [
  { id: 'voice', icon: '🎙', label: 'VOICE' },
  { id: 'history', icon: '🕑', label: 'HISTORY' },
  { id: 'schedule', icon: '🗓', label: 'SCHEDULE' },
  { id: 'library', icon: '▦', label: 'LIBRARY' },
  { id: 'settings', icon: '⚙', label: 'SETTINGS' },
];

export default function AppShell() {
  const activeView = useDashboardStore((s) => s.activeView);
  const setActiveView = useDashboardStore((s) => s.setActiveView);
  const variant = useDashboardStore((s) => s.themeVariant);
  const setThemeVariant = useDashboardStore((s) => s.setThemeVariant);
  const theme = getTheme(variant);
  const accent = theme.accent;

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: 'transparent', // TimeBackground video shows through behind the UI
        color: '#ccc',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* TIME-OF-DAY VIDEO BACKDROP (Day 06:00–18:00 CAT, Night otherwise) */}
      <TimeBackground />

      {/* GLOBAL VARIANT TABS */}
      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 200, display: 'flex', gap: 6 }}>
        {Object.values(THEMES).map((th) => (
          <button
            key={th.id}
            onClick={() => setThemeVariant(th.id)}
            style={{
              padding: '6px 14px',
              background: variant === th.id ? th.accent : 'rgba(255,255,255,0.05)',
              color: variant === th.id ? '#000' : '#666',
              border: `1px solid ${variant === th.id ? th.accent : '#333'}`,
              borderRadius: 3,
              fontFamily: MONO,
              fontSize: 10,
              cursor: 'pointer',
              letterSpacing: 1,
              transition: 'all 120ms ease',
            }}
          >
            {th.label}
          </button>
        ))}
      </div>

      {/* NAV RAIL */}
      <nav
        style={{
          width: 64,
          flexShrink: 0,
          background: 'rgba(5,5,12,0.98)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 52,
          gap: 4,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {NAV.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              title={item.label}
              style={{
                width: 52,
                padding: '10px 0',
                background: active ? `rgba(${theme.accentRGB},0.12)` : 'transparent',
                border: `1px solid ${active ? accent : 'transparent'}`,
                borderRadius: 6,
                color: active ? accent : '#666',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'all 120ms ease',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontFamily: MONO, fontSize: 7, letterSpacing: 0.5 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ACTIVE VIEW */}
      <main style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        {activeView === 'voice' && <OrchestrationDashboard />}
        {activeView === 'history' && <HistoryView />}
        {activeView === 'schedule' && <ScheduleView />}
        {activeView === 'library' && <LibraryView />}
        {activeView === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
