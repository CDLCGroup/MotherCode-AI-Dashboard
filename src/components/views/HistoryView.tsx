// src/components/views/HistoryView.tsx
// Full voice-command history with search + intent filter. Backed by
// GET /api/voice/conversations (in-memory on the backend — works keyless).

import { useEffect, useMemo, useState } from 'react';
import { useDashboardStore } from '../../store';
import type { VoiceCall } from '../../store';
import { getTheme, MONO } from '../../theme';
import ViewChrome from './ViewChrome';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_EMOJI: Record<string, string> = {
  completed: '✅',
  failed: '❌',
  in_progress: '⏳',
  unknown: '❓',
};

export default function HistoryView() {
  const variant = useDashboardStore((s) => s.themeVariant);
  const theme = getTheme(variant);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/voice/conversations?limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCalls(data.conversations || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  const intents = useMemo(() => ['all', ...Array.from(new Set(calls.map((c) => c.intent)))], [calls]);

  const filtered = useMemo(
    () =>
      calls.filter((c) => {
        if (intent !== 'all' && c.intent !== intent) return false;
        if (query && !`${c.summary} ${c.intent}`.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [calls, intent, query],
  );

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #222',
    borderRadius: 4,
    color: '#ccc',
    fontFamily: MONO,
    fontSize: 11,
    outline: 'none',
  };

  return (
    <ViewChrome
      title="COMMAND HISTORY"
      subtitle={`${filtered.length} of ${calls.length} commands`}
      actions={
        <button onClick={load} style={{ ...inputStyle, cursor: 'pointer', color: theme.accent, borderColor: theme.accent }}>
          ⟳ REFRESH
        </button>
      }
    >
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search transcripts…"
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <select value={intent} onChange={(e) => setIntent(e.target.value)} style={inputStyle}>
          {intents.map((i) => (
            <option key={i} value={i} style={{ background: '#0a0a12' }}>
              {i === 'all' ? 'all intents' : i}
            </option>
          ))}
        </select>
      </div>

      {loading && calls.length === 0 && <Empty text="loading…" />}
      {error && calls.length === 0 && <Empty text="backend unreachable — is it running on :3001?" />}
      {!loading && !error && filtered.length === 0 && <Empty text="no commands match — speak or type one on the VOICE tab" />}

      {filtered.length > 0 && (
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
          {filtered.map((c, i) => (
            <div
              key={c.conversationId}
              style={{
                display: 'flex',
                gap: 14,
                padding: '12px 14px',
                alignItems: 'flex-start',
                background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span style={{ fontSize: 16 }}>{STATUS_EMOJI[c.status] || '📞'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      color: theme.accent,
                      border: `1px solid ${theme.accent}`,
                      borderRadius: 3,
                      padding: '1px 6px',
                    }}
                  >
                    {c.intent}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: '#555' }}>
                    {new Date(c.timestamp).toLocaleString()}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: '#555', marginLeft: 'auto' }}>{c.duration}s</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>{c.summary}</p>
                <p style={{ margin: '4px 0 0', fontFamily: MONO, fontSize: 9, color: '#3a3a50' }}>{c.conversationId}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ViewChrome>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#555', fontFamily: MONO, fontSize: 12 }}>{text}</div>
  );
}
