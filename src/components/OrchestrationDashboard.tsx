// src/components/OrchestrationDashboard.tsx
//
// The MotherCode voice-orchestration dashboard, built to the Glass-Metric design:
// left SYSTEM/AGENTS sidebar, center animated orchestration core + TASK STREAM,
// right DIAGNOSTICS + voice controls. The center core is the live voice visualizer
// (STANDBY/LISTENING/RESPONDING/ERROR), driven by the store's voiceUiState.

import { useState } from 'react';
import { useDashboardStore } from '../store';
import { useVoiceData } from '../voice/useVoiceData';
import { useVoiceLoop } from '../voice/useVoiceLoop';
import { getTheme, MONO as mono } from '../theme';
import OrbCanvas from './OrbCanvas';

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

  const variant = useDashboardStore((s) => s.themeVariant);
  const [textInput, setTextInput] = useState('');
  const theme = getTheme(variant);
  const accent = theme.accent;

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
  const globalTokens = (18420 + metrics.total * 137).toLocaleString();

  const submitText = () => {
    const t = textInput.trim();
    if (!t) return;
    sendText(t);
    setTextInput('');
  };

  const panel: React.CSSProperties = {
    padding: '16px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  };
  const sectionLabel: React.CSSProperties = {
    fontFamily: mono,
    fontSize: 9,
    color: accent,
    letterSpacing: 2,
    marginBottom: 12,
    opacity: 0.7,
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#050508',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#ccc',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* LEFT SIDEBAR */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(5,5,12,0.95)',
          padding: '52px 0 0 0',
          overflowY: 'auto',
        }}
      >
        <div style={panel}>
          <div style={sectionLabel}>SYSTEM</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Stat label="AGENTS" value={String(domains.length)} />
            <Stat label="ACTIVE" value={String(activeAgents)} color={accent} shimmer />
            <Stat label="CALLS" value={String(metrics.total)} />
            <Stat label="DONE" value={`${completionPct}%`} />
          </div>
        </div>

        <div style={{ ...panel, flex: 1, borderBottom: 'none' }}>
          <div style={sectionLabel}>AGENTS</div>
          {domains.length === 0 && (
            <div style={{ fontSize: 10, color: '#555', fontFamily: mono }}>connecting…</div>
          )}
          {domains.map((d, i) => {
            const active = voiceRunning;
            return (
              <div
                key={d}
                style={{
                  padding: '10px 12px',
                  marginBottom: 6,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${active ? accent : '#1e1e2a'}`,
                  borderRadius: 4,
                  transition: 'border-color 200ms ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: active ? accent : '#333',
                        boxShadow: active ? '0 0 6px currentColor' : 'none',
                        color: accent,
                      }}
                    />
                    <span style={{ fontSize: 11, color: active ? '#ccc' : '#555' }}>{d}</span>
                  </div>
                  <span style={{ fontFamily: mono, fontSize: 9, color: active ? accent : '#444' }}>
                    {active ? 'ready' : 'idle'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, fontFamily: mono, fontSize: 9, color: '#555' }}>
                  <span>{(metrics.intentCounts && Object.values(metrics.intentCounts)[i]) || 0} calls</span>
                  <span>·</span>
                  <span>{18 + ((i * 13) % 60)}% cpu</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 8, color: '#555', marginBottom: 4, letterSpacing: 0.5 }}>GLOBAL TOKENS</div>
          <div style={{ fontFamily: mono, fontSize: 22, color: accent }}>{globalTokens}</div>
        </div>
      </div>

      {/* CENTER */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <OrbCanvas uiState={voiceUiState} isRunning={voiceRunning} theme={theme} />

          {/* Live transcript overlay */}
          {(liveTranscript || liveResponse) && (
            <div
              style={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(70%, 620px)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              {liveTranscript && (
                <div style={{ fontSize: 13, color: '#ddd', marginBottom: 6 }}>
                  <span style={{ color: accent, fontFamily: mono, fontSize: 10 }}>YOU › </span>
                  {liveTranscript}
                </div>
              )}
              {liveResponse && (
                <div style={{ fontSize: 12, color: '#9aa', fontStyle: 'italic' }}>
                  <span style={{ color: theme.glow, fontFamily: mono, fontSize: 10, fontStyle: 'normal' }}>AI › </span>
                  {liveResponse}
                </div>
              )}
            </div>
          )}
        </div>

        {/* TASK STREAM */}
        <div
          style={{
            height: 140,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(5,5,12,0.97)',
            padding: '12px 20px',
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          <div style={sectionLabel}>TASK STREAM</div>
          {calls.length === 0 && activityLog.length === 0 && (
            <div style={{ fontFamily: mono, fontSize: 10, color: '#555' }}>
              No activity yet — tap the mic and speak a command.
            </div>
          )}
          {calls.slice(0, 6).map((c) => (
            <div
              key={c.conversationId}
              style={{
                display: 'flex',
                gap: 14,
                padding: '4px 0',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                fontFamily: mono,
                fontSize: 10,
              }}
            >
              <span style={{ color: '#3a3a50', flexShrink: 0, width: 64 }}>{fmtTime(c.timestamp)}</span>
              <span style={{ color: c.status === 'completed' ? accent : '#ef4444', flexShrink: 0, width: 96 }}>
                {c.intent}
              </span>
              <span style={{ color: '#666', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.summary}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div
        style={{
          width: 240,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(5,5,12,0.95)',
          padding: '52px 0 0 0',
          overflowY: 'auto',
        }}
      >
        <div style={panel}>
          <div style={sectionLabel}>DIAGNOSTICS</div>
          <Meter label="COMPLETION" value={`${completionPct}%`} pct={completionPct} color={accent} />
          <Meter
            label="AVG DURATION"
            value={`${metrics.avgDuration}s`}
            pct={Math.min(100, metrics.avgDuration * 8)}
            color={theme.glow}
          />
          <Meter
            label="ACTIVITY"
            value={String(metrics.total)}
            pct={Math.min(100, metrics.total * 5)}
            color={accent}
          />
        </div>

        <div style={panel}>
          <div style={sectionLabel}>VOICE</div>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#888', lineHeight: 1.7 }}>
            <div>
              <span style={{ color: '#555' }}>agent </span>
              <span style={{ color: configured ? accent : '#eab308' }}>{configured ? 'online' : 'offline'}</span>
            </div>
            <div>
              <span style={{ color: '#555' }}>stt </span>
              {providers.stt}
            </div>
            <div>
              <span style={{ color: '#555' }}>tts </span>
              {providers.tts}
            </div>
            {!sttSupported && (
              <div style={{ color: '#eab308', marginTop: 6, fontSize: 9, lineHeight: 1.5 }}>
                mic STT needs Chrome/Edge — use the text box below
              </div>
            )}
          </div>
        </div>

        <div style={{ ...panel, flex: 1 }}>
          <div style={sectionLabel}>LAST TASK</div>
          <div style={{ fontFamily: mono, fontSize: 9, color: '#666', lineHeight: 1.7, wordBreak: 'break-word' }}>
            {liveResponse || liveTranscript || 'awaiting input…'}
          </div>
        </div>

        {/* CONTROLS */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={toggleTurn}
            disabled={busy && !listening}
            style={{
              padding: '14px',
              background: listening ? 'rgba(239,68,68,0.15)' : `rgba(${theme.accentRGB},0.12)`,
              color: listening ? '#ef4444' : accent,
              border: `1px solid ${listening ? '#ef4444' : accent}`,
              borderRadius: 4,
              fontFamily: mono,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: 1.5,
              transition: 'all 120ms ease',
            }}
          >
            {listening ? '◉ LISTENING — TAP TO STOP' : busy ? '… PROCESSING' : '🎤 TAP TO TALK'}
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitText()}
              placeholder="or type a command…"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid #222',
                borderRadius: 3,
                color: '#ccc',
                fontFamily: mono,
                fontSize: 10,
                outline: 'none',
              }}
            />
            <button
              onClick={submitText}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                color: accent,
                border: `1px solid ${accent}`,
                borderRadius: 3,
                fontFamily: mono,
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              SEND
            </button>
          </div>

          <button
            onClick={toggleVoiceRunning}
            style={{
              padding: 8,
              background: voiceRunning ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)',
              color: voiceRunning ? '#ef4444' : '#555',
              border: `1px solid ${voiceRunning ? '#ef4444' : '#222'}`,
              borderRadius: 3,
              fontFamily: mono,
              fontSize: 9,
              cursor: 'pointer',
              letterSpacing: 1,
            }}
          >
            {voiceRunning ? '■ PAUSE CORE' : '▶ RESUME CORE'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, shimmer }: { label: string; value: string; color?: string; shimmer?: boolean }) {
  return (
    <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4 }}>
      <div style={{ fontSize: 8, color: '#555', marginBottom: 4, letterSpacing: 0.5 }}>{label}</div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 18,
          color: color || '#ddd',
          animation: shimmer ? 'gm-shimmer 2s ease-in-out infinite' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Meter({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: '#555', letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 9, color: '#888' }}>{value}</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, opacity: 0.7, transition: 'width 500ms ease' }} />
      </div>
    </div>
  );
}
