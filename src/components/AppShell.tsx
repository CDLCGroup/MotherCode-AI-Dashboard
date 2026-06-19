// src/components/AppShell.tsx
//
// Top-level shell hosting one active view. Desktop: a slim left nav rail + global
// theme-variant tabs. Mobile (<760px or ?mobile=1): the nav rail becomes a sticky
// bottom tab bar and the shell stacks in a column. Theme + active view live in
// the store so every view shares the accent.
//
// ?mobile=1 also wraps the whole app in a fixed 390×844 phone frame so a desktop
// browser can render a faithful narrow viewport for verification.

import { useDashboardStore } from '../store';
import { THEMES, getTheme, MONO } from '../theme';
import { useViewport, FRAME_WIDTH, FRAME_HEIGHT } from '../useViewport';
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

  const { isMobile, framed } = useViewport();

  const shell = (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        width: '100%',
        height: '100%',
        background: 'transparent', // TimeBackground video shows through behind the UI
        color: '#ccc',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: MONO,
      }}
    >
      {/* TIME-OF-DAY VIDEO BACKDROP (Day 06:00–18:00 CAT, Night otherwise) */}
      <TimeBackground />

      {/* GLOBAL VARIANT TABS — the voice view renders its own palette swatches in
          its header, so only show these floating tabs on the other views. */}
      <div
        style={{
          position: 'absolute',
          top: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 8px)' : 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          display: activeView === 'voice' ? 'none' : 'flex',
          gap: 6,
        }}
      >
        {Object.values(THEMES).map((th) => (
          <button
            key={th.id}
            onClick={() => setThemeVariant(th.id)}
            style={{
              padding: isMobile ? '4px 9px' : '6px 14px',
              background: variant === th.id ? th.accent : 'rgba(255,255,255,0.05)',
              color: variant === th.id ? '#000' : '#666',
              border: `1px solid ${variant === th.id ? th.accent : '#333'}`,
              borderRadius: 3,
              fontFamily: MONO,
              fontSize: isMobile ? 8 : 10,
              cursor: 'pointer',
              letterSpacing: 1,
              transition: 'all 120ms ease',
            }}
          >
            {th.label}
          </button>
        ))}
      </div>

      {/* NAV — left rail on desktop, bottom tab bar on mobile */}
      <nav
        style={
          isMobile
            ? {
                order: 2,
                flexShrink: 0,
                height: 58,
                width: '100%',
                background: 'rgba(7,13,24,0.97)',
                borderTop: '1px solid rgba(22,50,62,0.6)',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'space-around',
                zIndex: 5,
                // Clear the iOS home indicator / Android gesture bar.
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                boxSizing: 'content-box',
              }
            : {
                width: 64,
                flexShrink: 0,
                background: 'rgba(7,13,24,0.96)',
                borderRight: '1px solid rgba(22,50,62,0.6)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 52,
                gap: 4,
                position: 'relative',
                zIndex: 1,
              }
        }
      >
        {NAV.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              title={item.label}
              style={{
                width: isMobile ? undefined : 52,
                flex: isMobile ? 1 : undefined,
                minHeight: isMobile ? 44 : undefined,
                padding: isMobile ? '6px 0' : '10px 0',
                background: active ? `rgba(${theme.accentRGB},0.12)` : 'transparent',
                border: `1px solid ${active ? accent : 'transparent'}`,
                borderRadius: 6,
                color: active ? accent : '#6a8893',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isMobile ? 2 : 4,
                transition: 'all 120ms ease',
              }}
            >
              <span style={{ fontSize: isMobile ? 18 : 16, lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontFamily: MONO, fontSize: 7, letterSpacing: 0.5 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ACTIVE VIEW */}
      <main style={{ order: isMobile ? 1 : 0, flex: 1, minWidth: 0, minHeight: 0, position: 'relative', zIndex: 1, overflowY: isMobile ? 'auto' : 'hidden' }}>
        {activeView === 'voice' && <OrchestrationDashboard />}
        {activeView === 'history' && <HistoryView />}
        {activeView === 'schedule' && <ScheduleView />}
        {activeView === 'library' && <LibraryView />}
        {activeView === 'settings' && <SettingsView />}
      </main>
    </div>
  );

  if (framed) {
    // Verification frame: render the app at a true 390×844 viewport inside the
    // desktop window so narrow-layout overflow bugs actually surface.
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', position: 'relative', zIndex: 1 }}>
        <div style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT, maxWidth: '100%', maxHeight: '100%', position: 'relative', overflow: 'hidden', boxShadow: '0 0 50px rgba(0,0,0,0.7)', border: '1px solid #16323e' }}>
          {shell}
        </div>
      </div>
    );
  }
  return shell;
}
