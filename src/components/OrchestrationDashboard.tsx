// src/components/OrchestrationDashboard.tsx
//
// The MotherCode voice-orchestration dashboard, reskinned to the Z.E.R.O. "neural
// voice interface" design. Desktop: a top header, left CORTEX MAP + VITALS rail,
// center neural-constellation core, bottom TOOL GRID strip, right SUBTITLE / EVENT
// / VITALS rail, and a BRAIN-CONNECTED control bar. Mobile (<760px or ?mobile=1):
// the same panels stack vertically in a scrollable column with a bottom-tab nav
// (from AppShell) and a sticky control bar.
//
// Enhancements: collapsible + auto-collapsing rails / bottom strip with smooth
// transitions, collapsible CORTEX region chips, a dark/light switch, a mini
// calendar widget, and a fully responsive mobile layout. Layout prefs persist via
// the store (localStorage). Every panel stays wired to the same real backend data.

import { useState } from 'react';
import { useDashboardStore } from '../store';
import { useVoiceData } from '../voice/useVoiceData';
import { useVoiceLoop } from '../voice/useVoiceLoop';
import { getTheme, getSurface, regionFor, THEMES, MONO, type Surface } from '../theme';
import { useViewport } from '../useViewport';
import OrbCanvas from './OrbCanvas';
import CalendarWidget from './CalendarWidget';

function fmtTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
}

export default function OrchestrationDashboard() {
  useVoiceData();
  const { listening, busy, sttSupported, toggleTurn, sendText } = useVoiceLoop();

  const { isMobile, isNarrow } = useViewport();

  const variant = useDashboardStore((s) => s.themeVariant);
  const setThemeVariant = useDashboardStore((s) => s.setThemeVariant);
  const [textInput, setTextInput] = useState('');
  const theme = getTheme(variant);
  const accent = theme.accent;

  // Layout prefs (persisted)
  const darkMode = useDashboardStore((s) => s.darkMode);
  const toggleDarkMode = useDashboardStore((s) => s.toggleDarkMode);
  const leftRailOpen = useDashboardStore((s) => s.leftRailOpen);
  const rightRailOpen = useDashboardStore((s) => s.rightRailOpen);
  const bottomStripOpen = useDashboardStore((s) => s.bottomStripOpen);
  const cortexExpanded = useDashboardStore((s) => s.cortexExpanded);
  const calendarExpanded = useDashboardStore((s) => s.calendarExpanded);
  const toggleLeftRail = useDashboardStore((s) => s.toggleLeftRail);
  const toggleRightRail = useDashboardStore((s) => s.toggleRightRail);
  const toggleBottomStrip = useDashboardStore((s) => s.toggleBottomStrip);
  const toggleCortex = useDashboardStore((s) => s.toggleCortex);
  const toggleCalendar = useDashboardStore((s) => s.toggleCalendar);

  const surf = getSurface(darkMode);
  const labelColor = darkMode ? accent : '#0c4a4f';

  // Desktop rails auto-collapse on narrow viewports without clobbering the
  // persisted pref (effective open = pref && wide). On mobile the rails are not
  // used — panels stack instead, so the desktop prefs are left untouched.
  const leftOpen = leftRailOpen && !isNarrow;
  const rightOpen = rightRailOpen && !isNarrow;

  const voiceUiState = useDashboardStore((s) => s.voiceUiState);
  const voiceRunning = useDashboardStore((s) => s.voiceRunning);
  const toggleVoiceRunning = useDashboardStore((s) => s.toggleVoiceRunning);
  const domains = useDashboardStore((s) => s.voiceDomains);
  const calls = useDashboardStore((s) => s.voiceCalls);
  const metrics = useDashboardStore((s) => s.voiceMetrics);
  const configured = useDashboardStore((s) => s.voiceAgentConfigured);
  const providers = useDashboardStore((s) => s.voiceProviders);
  const liveTranscript = useDashboardStore((s) => s.liveTranscript);
  const liveResponse = useDashboardStore((s) => s.liveResponse);
  const activityLog = useDashboardStore((s) => s.activityLog);

  const activeAgents = voiceRunning ? domains.length : 0;
  const completionPct = metrics.total ? Math.round((metrics.completed / metrics.total) * 100) : 0;
  const fireRate = (1240 + metrics.total * 137).toLocaleString();
  const coherence = configured ? 0.94 : voiceRunning ? 0.71 : 0.42;
  const stateWord =
    voiceUiState === 'AGENT_ERROR' ? 'FLAGGED' : voiceUiState === 'USER_TALKING' ? 'LISTENING' : voiceUiState === 'AI_SPEAKING' ? 'SPEAKING' : voiceRunning ? 'THINKING' : 'STANDBY';

  const submitText = () => {
    const t = textInput.trim();
    if (!t) return;
    sendText(t);
    setTextInput('');
  };

  const subtitles: { who: 'ZERO' | 'USER'; text: string }[] = [];
  if (liveResponse) subtitles.push({ who: 'ZERO', text: liveResponse });
  if (liveTranscript) subtitles.push({ who: 'USER', text: liveTranscript });
  for (const c of calls.slice(0, 6)) {
    subtitles.push({ who: 'USER', text: c.intent.replace(/_/g, ' ') });
    if (c.summary) subtitles.push({ who: 'ZERO', text: c.summary });
  }
  if (subtitles.length === 0) subtitles.push({ who: 'ZERO', text: 'Brain online. Cortex coherent. Awaiting voice…' });

  const chrome = `rgba(${surf.cardRGB},${surf.chromeAlpha})`;

  // ---- panel fragments (composed differently for desktop vs mobile) ----

  const headerEl = (
    <header
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap',
        minHeight: 38,
        padding: isMobile ? '6px 12px' : '0 16px',
        // Push header content below the notch/status bar on mobile (bg stays full-bleed).
        paddingTop: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 6px)' : undefined,
        borderBottom: `1px solid ${surf.border}`,
        background: `rgba(${surf.cardRGB},${Math.min(1, surf.chromeAlpha + 0.1)})`,
        transition: 'background 240ms ease, border-color 240ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, letterSpacing: 3, fontSize: 13, color: accent }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
          Z.E.R.O.
        </span>
        {!isMobile && <span style={{ fontSize: 9.5, letterSpacing: 2, color: surf.muted }}>NEURAL VOICE INTERFACE · v8.07</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 9 : 12 }}>
        <DarkSwitch dark={darkMode} accent={accent} surf={surf} onToggle={toggleDarkMode} />
        <div style={{ display: 'flex', gap: 5 }}>
          {Object.values(THEMES).map((th) => (
            <button
              key={th.id}
              onClick={() => setThemeVariant(th.id)}
              title={th.label}
              style={{ width: 14, height: 14, borderRadius: '50%', background: th.accent, border: `1px solid ${variant === th.id ? (darkMode ? '#fff' : '#04070f') : 'transparent'}`, opacity: variant === th.id ? 1 : 0.45, cursor: 'pointer', padding: 0 }}
            />
          ))}
        </div>
        {!isMobile && (
          <span style={{ fontSize: 9, letterSpacing: 1.5, color: surf.muted }}>
            SESSION <span style={{ color: surf.fg }}>{fmtTime(new Date().toISOString())}</span>
          </span>
        )}
        <span
          style={{
            fontSize: 9,
            letterSpacing: 2,
            padding: '3px 9px',
            borderRadius: 3,
            color: voiceUiState === 'AGENT_ERROR' ? surf.danger : accent,
            border: `1px solid ${voiceUiState === 'AGENT_ERROR' ? surf.danger : accent}`,
            background: `rgba(${theme.accentRGB},0.08)`,
            animation: voiceRunning ? 'z-flicker 2.4s ease-in-out infinite' : undefined,
          }}
        >
          {stateWord}
        </span>
      </div>
    </header>
  );

  const canvasInner = (
    <>
      {/* The neural viewport stays dark in both modes so the constellation reads. */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 46%, rgba(4,7,15,0.40) 0%, rgba(4,7,15,0.78) 60%, rgba(4,7,15,0.9) 100%)', pointerEvents: 'none' }} />
      <OrbCanvas uiState={voiceUiState} isRunning={voiceRunning} theme={theme} domains={domains} />
      {(liveTranscript || liveResponse) && (
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', width: 'min(86%, 640px)', textAlign: 'center', pointerEvents: 'none' }}>
          {liveTranscript && (
            <div style={{ fontSize: isMobile ? 11.5 : 12.5, color: '#dcebeb', marginBottom: 5 }}>
              <span style={{ color: '#7c949c', fontSize: 9 }}>[USER] </span>
              {liveTranscript}
            </div>
          )}
          {liveResponse && (
            <div style={{ fontSize: isMobile ? 11 : 12, color: '#9fc7c4' }}>
              <span style={{ color: accent, fontSize: 9 }}>[ZERO] </span>
              {liveResponse}
            </div>
          )}
        </div>
      )}
    </>
  );

  const lcvePanel = (
    <Panel surf={surf}>
      <SectionLabel color={labelColor}>LCVE — {String(activeAgents).padStart(2, '0')}/{String(domains.length).padStart(2, '0')}</SectionLabel>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: surf.muted, marginBottom: 6 }}>
        <span>▲ {metrics.total}</span>
        <span>▼ {metrics.completed}</span>
      </div>
      <Bar pct={domains.length ? (activeAgents / domains.length) * 100 : 0} color={accent} />
    </Panel>
  );

  const cortexPanel = (
    <Panel surf={surf} grow={!isMobile}>
      <Collapser color={labelColor} muted={surf.muted} title="CORTEX MAP" right={`${activeAgents} / ${domains.length}`} open={cortexExpanded} onToggle={toggleCortex} />
      {domains.length === 0 && <div style={{ fontSize: 10, color: surf.muted }}>connecting…</div>}
      <div style={{ maxHeight: cortexExpanded ? 600 : 0, opacity: cortexExpanded ? 1 : 0, overflow: 'hidden', transition: 'max-height 300ms cubic-bezier(.4,0,.2,1), opacity 200ms ease' }}>
        {domains.map((d, i) => {
          const reg = regionFor(i);
          const live = voiceRunning;
          return (
            <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${surf.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? reg.color : '#2c4651', boxShadow: live ? `0 0 6px ${reg.color}` : 'none', flexShrink: 0, animation: live ? 'z-flicker 3s ease-in-out infinite' : undefined }} />
                <span style={{ fontSize: 10.5, color: live ? surf.fg : surf.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.replace(/_/g, ' ')}</span>
              </div>
              <span style={{ fontSize: 8, letterSpacing: 1, color: live ? reg.color : surf.muted }}>{live ? 'LIVE' : 'IDLE'}</span>
            </div>
          );
        })}
      </div>
      <div style={{ maxHeight: cortexExpanded ? 0 : 140, opacity: cortexExpanded ? 0 : 1, overflow: 'hidden', transition: 'max-height 300ms cubic-bezier(.4,0,.2,1), opacity 200ms ease', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {domains.map((d, i) => {
          const reg = regionFor(i);
          const live = voiceRunning;
          return (
            <span key={d} title={d.replace(/_/g, ' ')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 10, fontSize: 8.5, color: live ? surf.fg : surf.muted, border: `1px solid ${live ? reg.color : surf.borderSolid}`, background: live ? `rgba(${reg.rgb},0.12)` : 'transparent' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: live ? reg.color : '#2c4651' }} />
              {d.replace(/_/g, ' ').slice(0, 9)}
            </span>
          );
        })}
      </div>
    </Panel>
  );

  const vitalsLeftPanel = (
    <Panel surf={surf}>
      <SectionLabel color={labelColor}>VITALS</SectionLabel>
      <Readout surf={surf} label="SYNAPSE LOAD" value={`${completionPct}%`} />
      <Readout surf={surf} label="COHERENCE" value={coherence.toFixed(2)} />
      <Readout surf={surf} label="GLOBAL FIRE" value={`${fireRate} /s`} />
    </Panel>
  );

  const subtitlePanel = (
    <Panel surf={surf}>
      <SectionLabel color={labelColor}>SUBTITLE STREAM</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
        {subtitles.slice(0, 8).map((s, i) => (
          <div key={i} style={{ fontSize: 10, lineHeight: 1.45, color: s.who === 'ZERO' ? (darkMode ? '#bfe3e0' : '#0d4a48') : surf.muted }}>
            <span style={{ color: s.who === 'ZERO' ? accent : surf.muted, fontSize: 8.5 }}>[{s.who}] </span>
            {s.text}
          </div>
        ))}
      </div>
    </Panel>
  );

  const calendarPanel = <CalendarWidget surf={surf} accent={accent} accentRGB={theme.accentRGB} expanded={calendarExpanded} onToggle={toggleCalendar} configured={configured} />;

  const eventLogPanel = (
    <Panel surf={surf} grow={!isMobile}>
      <SectionLabel color={labelColor}>EVENT LOG</SectionLabel>
      {activityLog.length === 0 && <div style={{ fontSize: 9, color: surf.muted }}>no events</div>}
      {activityLog.slice(0, 9).map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '3px 0', fontSize: 8.5 }}>
          <span style={{ color: surf.muted, flexShrink: 0, opacity: 0.7 }}>{fmtTime(e.timestamp)}</span>
          <span style={{ color: surf.muted, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.message}</span>
        </div>
      ))}
    </Panel>
  );

  const vitalsRightPanel = (
    <Panel surf={surf}>
      <SectionLabel color={labelColor}>VITALS</SectionLabel>
      <Readout surf={surf} label="agent" value={configured ? 'online' : 'offline'} valueColor={configured ? accent : '#eab308'} />
      <Readout surf={surf} label="stt" value={providers.stt} />
      <Readout surf={surf} label="tts" value={providers.tts} />
      {!sttSupported && <div style={{ color: '#eab308', marginTop: 6, fontSize: 8.5, lineHeight: 1.5 }}>mic needs Chrome/Edge — use the text box</div>}
    </Panel>
  );

  const toolStrip = (
    <div
      style={{
        height: bottomStripOpen ? 150 : 30,
        flexShrink: 0,
        borderTop: `1px solid ${surf.border}`,
        background: chrome,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'height 280ms cubic-bezier(.4,0,.2,1), background 240ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px 6px', borderBottom: bottomStripOpen ? `1px solid ${surf.border}` : 'none', overflowX: 'auto' }}>
        <button onClick={toggleBottomStrip} title={bottomStripOpen ? 'collapse' : 'expand'} style={{ background: 'transparent', border: 'none', color: accent, cursor: 'pointer', fontSize: 12, padding: '2px 4px', flexShrink: 0, transition: 'transform 240ms ease', transform: bottomStripOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>▾</button>
        <Tab surf={surf} active>NODE {String(activeAgents).padStart(2, '0')}/{String(domains.length).padStart(2, '0')}</Tab>
        <Tab surf={surf}>PARALLEL MIND · {calls.length}</Tab>
        {!isMobile && <Tab surf={surf}>TOOL GRID</Tab>}
        {!isMobile && <Tab surf={surf}>PERSISTENT MEMORY</Tab>}
        <span style={{ marginLeft: 'auto', fontSize: 8, color: surf.muted, letterSpacing: 1, whiteSpace: 'nowrap' }}>{domains.length} TOOLS · {metrics.avgDuration || 0}s</span>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 8, padding: '10px 14px', overflowX: 'auto' }}>
        {calls.length === 0 && <div style={{ fontSize: 10, color: surf.muted, alignSelf: 'center' }}>No mindtools fired yet — tap ENABLE MIC or type a command.</div>}
        {calls.slice(0, 6).map((c, i) => {
          const ok = c.status === 'completed';
          return (
            <div key={c.conversationId} style={{ minWidth: 150, flexShrink: 0, padding: '8px 10px', border: `1px solid ${ok ? `rgba(${theme.accentRGB},0.35)` : `rgba(${surf.dangerRGB},0.5)`}`, borderRadius: 3, background: `rgba(${surf.cardRGB},${surf.chromeAlpha})` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: surf.muted, marginBottom: 5 }}>
                <span>PID-{(0x830 + i).toString(16).toUpperCase()}</span>
                <span style={{ color: ok ? accent : surf.danger }}>{ok ? 'DONE' : 'FAIL'}</span>
              </div>
              <div style={{ fontSize: 10, color: surf.fg, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.intent.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 8.5, color: surf.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.summary}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const footerEl = (
    <footer
      style={{
        flexShrink: 0,
        position: isMobile ? 'sticky' : undefined,
        bottom: isMobile ? 0 : undefined,
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap',
        padding: '8px 12px',
        borderTop: `1px solid ${surf.border}`,
        background: `rgba(${surf.cardRGB},${Math.min(1, surf.chromeAlpha + 0.13)})`,
        transition: 'background 240ms ease, border-color 240ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, letterSpacing: 1.5, color: voiceRunning ? '#3a9d49' : surf.muted }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: voiceRunning ? '#51d75e' : '#33505c', boxShadow: voiceRunning ? '0 0 7px #51d75e' : 'none' }} />
          {voiceRunning ? 'BRAIN CONNECTED' : 'BRAIN PAUSED'}
        </span>
        {!isMobile && <span style={{ fontSize: 8.5, color: surf.muted, letterSpacing: 1 }}>[ SAY "ZERO" ] · SAY "HEY ZERO"</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: isMobile ? '1 1 100%' : undefined, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitText()}
          placeholder="type a command…"
          style={{ width: isMobile ? '100%' : 220, flex: isMobile ? '1 1 100%' : undefined, minHeight: isMobile ? 40 : undefined, padding: '7px 10px', background: `rgba(${surf.bgRGB},0.8)`, border: `1px solid ${surf.borderSolid}`, borderRadius: 3, color: surf.fg, fontFamily: MONO, fontSize: isMobile ? 13 : 10, outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, flex: isMobile ? '1 1 100%' : undefined }}>
          <button onClick={submitText} style={fbtn(accent, theme.accentRGB, isMobile)}>SEND</button>
          <button onClick={toggleTurn} disabled={busy && !listening} style={{ ...fbtn(listening ? surf.danger : accent, listening ? surf.dangerRGB : theme.accentRGB, isMobile), fontWeight: 700, letterSpacing: 1.5, flex: isMobile ? 1 : undefined }}>
            {listening ? '◉ LISTENING' : busy ? '… BUSY' : '🎤 ENABLE MIC'}
          </button>
          <button onClick={toggleVoiceRunning} title={voiceRunning ? 'pause core' : 'resume core'} style={fbtn(voiceRunning ? surf.danger : surf.muted, voiceRunning ? surf.dangerRGB : '124,148,156', isMobile)}>
            {voiceRunning ? '■' : '▶'}
          </button>
        </div>
      </div>
    </footer>
  );

  // ---- assembly ----

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100%', background: 'transparent', fontFamily: MONO, color: surf.fg, position: 'relative' }}>
        {headerEl}
        <div style={{ position: 'relative', width: '100%', height: '42vh', minHeight: 250, flexShrink: 0 }}>{canvasInner}</div>
        {toolStrip}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {cortexPanel}
          {vitalsLeftPanel}
          {subtitlePanel}
          {calendarPanel}
          {eventLogPanel}
          {vitalsRightPanel}
        </div>
        {footerEl}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'transparent', fontFamily: MONO, color: surf.fg, overflow: 'hidden', position: 'relative', transition: 'color 240ms ease' }}>
      {headerEl}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Rail side="left" open={leftOpen} width={214} chrome={chrome} surf={surf} accent={accent} onToggle={toggleLeftRail} label="CORTEX">
          {lcvePanel}
          {cortexPanel}
          {vitalsLeftPanel}
        </Rail>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>{canvasInner}</div>
          {toolStrip}
        </div>

        <Rail side="right" open={rightOpen} width={248} chrome={chrome} surf={surf} accent={accent} onToggle={toggleRightRail} label="STREAMS">
          {subtitlePanel}
          {calendarPanel}
          {eventLogPanel}
          {vitalsRightPanel}
        </Rail>
      </div>
      {footerEl}
    </div>
  );
}

// ---- styling helpers ----

function fbtn(color: string, rgb: string, mobile: boolean): React.CSSProperties {
  return { padding: mobile ? '10px 12px' : '7px 12px', minHeight: mobile ? 40 : undefined, background: `rgba(${rgb},0.1)`, color, border: `1px solid ${color}`, borderRadius: 3, fontFamily: MONO, fontSize: mobile ? 12 : 10, cursor: 'pointer', transition: 'all 140ms ease' };
}

// Collapsible rail wrapper with smooth width transition + collapsed strip (desktop).
function Rail({ side, open, width, chrome, surf, accent, onToggle, label, children }: { side: 'left' | 'right'; open: boolean; width: number; chrome: string; surf: Surface; accent: string; onToggle: () => void; label: string; children: React.ReactNode }) {
  return (
    <aside
      style={{
        width: open ? width : 30,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        [side === 'left' ? 'borderRight' : 'borderLeft']: `1px solid ${surf.border}`,
        background: chrome,
        overflow: 'hidden',
        transition: 'width 280ms cubic-bezier(.4,0,.2,1), background 240ms ease',
      }}
    >
      {open ? (
        <>
          <div style={{ display: 'flex', justifyContent: side === 'left' ? 'flex-end' : 'flex-start', padding: '4px 6px', flexShrink: 0 }}>
            <button onClick={onToggle} title="collapse" style={{ background: 'transparent', border: 'none', color: surf.muted, cursor: 'pointer', fontSize: 11, padding: '2px 6px' }}>
              {side === 'left' ? '◀' : '▶'}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>{children}</div>
        </>
      ) : (
        <button onClick={onToggle} title="expand" style={{ flex: 1, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 12, color: surf.muted }}>
          <span style={{ color: accent, fontSize: 12 }}>{side === 'left' ? '▶' : '◀'}</span>
          <span style={{ writingMode: 'vertical-rl', transform: side === 'right' ? 'rotate(180deg)' : 'none', letterSpacing: 2, fontSize: 9 }}>{label}</span>
        </button>
      )}
    </aside>
  );
}

function DarkSwitch({ dark, accent, surf, onToggle }: { dark: boolean; accent: string; surf: Surface; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={dark ? 'switch to light mode' : 'switch to dark mode'}
      style={{ position: 'relative', width: 38, height: 18, borderRadius: 9, border: `1px solid ${surf.borderSolid}`, background: `rgba(${surf.bgRGB},0.6)`, cursor: 'pointer', padding: 0, flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: 1, left: dark ? 1 : 20, width: 14, height: 14, borderRadius: '50%', background: accent, boxShadow: `0 0 6px ${accent}`, transition: 'left 200ms cubic-bezier(.4,0,.2,1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>
        {dark ? '☾' : '☀'}
      </span>
    </button>
  );
}

function Panel({ children, grow, surf }: { children: React.ReactNode; grow?: boolean; surf: Surface }) {
  return <div style={{ padding: '12px 14px', borderBottom: `1px solid ${surf.border}`, flex: grow ? 1 : undefined }}>{children}</div>;
}

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return <div style={{ fontSize: 9, color, letterSpacing: 2, marginBottom: 10, opacity: 0.85 }}>{children}</div>;
}

function Collapser({ title, right, open, onToggle, color, muted }: { title: string; right?: string; open: boolean; onToggle: () => void; color: string; muted: string }) {
  return (
    <button onClick={onToggle} title={open ? 'collapse' : 'expand'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', padding: 0, marginBottom: 10, cursor: 'pointer' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color, fontSize: 9, transition: 'transform 240ms ease', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
        <span style={{ fontSize: 9, color, letterSpacing: 2, opacity: 0.85 }}>{title}</span>
      </span>
      {right != null && <span style={{ fontSize: 9, color: muted }}>{right}</span>}
    </button>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 3, background: 'rgba(120,150,160,0.18)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, opacity: 0.8, transition: 'width 500ms ease' }} />
    </div>
  );
}

function Readout({ label, value, valueColor, surf }: { label: string; value: string; valueColor?: string; surf: Surface }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0', fontSize: 9.5 }}>
      <span style={{ color: surf.muted, letterSpacing: 1 }}>{label}</span>
      <span style={{ color: valueColor || surf.fg }}>{value}</span>
    </div>
  );
}

function Tab({ children, active, surf }: { children: React.ReactNode; active?: boolean; surf: Surface }) {
  return (
    <span style={{ fontSize: 8.5, letterSpacing: 1, padding: '4px 8px', borderRadius: 3, whiteSpace: 'nowrap', color: active ? surf.bg : surf.muted, background: active ? surf.fg : 'transparent', border: `1px solid ${active ? surf.fg : surf.borderSolid}` }}>
      {children}
    </span>
  );
}
