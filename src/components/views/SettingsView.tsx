// src/components/views/SettingsView.tsx
// Read-only status of agents, voice providers, and integrations + how to enable
// the premium paths. This view never collects credentials or runs auth flows —
// keys belong in backend/.env, set by the operator.

import { useEffect, useState } from 'react';
import { useDashboardStore } from '../../store';
import { getTheme, MONO } from '../../theme';
import ViewChrome from './ViewChrome';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AgentStatus {
  configured: boolean;
  agentCount: number;
  domains: string[];
  providers: { stt: string; tts: string };
  router?: { configured: boolean; engine: string; model: string };
  google?: { configured: boolean; authorized: boolean };
  slack?: { configured: boolean };
  social?: { configured: boolean };
  finance?: { configured: boolean; provider: string };
}

interface Integration {
  integration_type: string;
  status: string;
  last_sync_at: string | null;
}

export default function SettingsView() {
  const variant = useDashboardStore((s) => s.themeVariant);
  const theme = getTheme(variant);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [noDb, setNoDb] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/voice/agent/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null));
    fetch(`${API_BASE}/api/integrations`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setIntegrations(d?.integrations ?? []);
        setNoDb(d?.source === 'memory');
      })
      .catch(() => setNoDb(true));
  }, []);

  const sttPremium = status?.providers.stt === 'deepgram';
  const ttsPremium = status?.providers.tts === 'elevenlabs';

  return (
    <ViewChrome title="SETTINGS" subtitle="status & configuration — set keys in backend/.env">
      <Section theme={theme} title="ORCHESTRATOR">
        <Row theme={theme} label="MotherCode agent" ok={!!status?.configured} value={status?.configured ? 'online' : 'offline'} />
        <Row theme={theme} label="Registered agents" ok={(status?.agentCount ?? 0) > 0} value={`${status?.agentCount ?? 0} domains`} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {(status?.domains || []).map((d) => (
            <span key={d} style={{ fontFamily: MONO, fontSize: 9, color: '#888', border: '1px solid #222', borderRadius: 3, padding: '2px 7px' }}>
              {d}
            </span>
          ))}
        </div>
        <Row
          theme={theme}
          label="Intent router"
          ok={!!status?.router?.configured}
          value={status?.router ? (status.router.engine === 'llm' ? status.router.model : 'regex (keyless)') : '—'}
          accentValue={status?.router?.engine === 'llm'}
        />
        {status?.router?.engine !== 'llm' && (
          <Note>
            Routing uses the keyless regex router. Set <code style={codeStyle}>ANTHROPIC_API_KEY</code> (or{' '}
            <code style={codeStyle}>CLAUDE_API_KEY</code>) in <code style={codeStyle}>backend/.env</code> to route with{' '}
            <code style={codeStyle}>{status?.router?.model || 'claude-opus-4-8'}</code>.
          </Note>
        )}
      </Section>

      <Section theme={theme} title="CONNECTIONS">
        <Row
          theme={theme}
          label="Google (Calendar + Gmail)"
          ok={!!status?.google?.authorized}
          value={!status?.google?.configured ? 'no keys' : status?.google?.authorized ? 'authorized' : 'needs sign-in'}
        />
        {status?.google?.configured && !status?.google?.authorized && (
          <Note>
            OAuth keys present, account not linked. Visit{' '}
            <a href={`${API_BASE}/auth/google`} target="_blank" rel="noreferrer" style={{ ...codeStyle, color: theme.accent }}>
              {API_BASE}/auth/google
            </a>{' '}
            to authorize Calendar + Gmail.
          </Note>
        )}
        {!status?.google?.configured && (
          <Note>
            Set <code style={codeStyle}>GOOGLE_CLIENT_ID</code> / <code style={codeStyle}>GOOGLE_CLIENT_SECRET</code> in{' '}
            <code style={codeStyle}>backend/.env</code> (see <code style={codeStyle}>SETUP-google.md</code>).
          </Note>
        )}
        <Row theme={theme} label="Slack (subagent chat)" ok={!!status?.slack?.configured} value={status?.slack?.configured ? 'connected' : 'no token'} />
        <Row theme={theme} label="Buffer (social posting)" ok={!!status?.social?.configured} value={status?.social?.configured ? 'connected' : 'no token'} />
        <Row
          theme={theme}
          label={`Finance (${status?.finance?.provider || 'paystack'})`}
          ok={!!status?.finance?.configured}
          value={status?.finance?.configured ? 'connected' : 'no key'}
        />
        {!status?.finance?.configured && (
          <Note>
            Set <code style={codeStyle}>PAYSTACK_SECRET_KEY</code> in <code style={codeStyle}>backend/.env</code> to report
            real balance + revenue. Until then the finance agent says "connect Paystack" and never invents numbers.
          </Note>
        )}
      </Section>

      <Section theme={theme} title="VOICE PROVIDERS">
        <Row theme={theme} label="Speech-to-text" ok value={status?.providers.stt || '—'} accentValue={sttPremium} />
        <Row theme={theme} label="Text-to-speech" ok value={status?.providers.tts || '—'} accentValue={ttsPremium} />
        {!sttPremium && !ttsPremium && (
          <Note>
            Default is the browser Web Speech API (no keys). To upgrade: set{' '}
            <code style={codeStyle}>DEEPGRAM_API_KEY</code> for STT and{' '}
            <code style={codeStyle}>ELEVENLABS_API_KEY</code> + <code style={codeStyle}>ELEVENLABS_VOICE_ID</code> for TTS
            in <code style={codeStyle}>backend/.env</code>, then restart the backend.
          </Note>
        )}
        {(sttPremium || ttsPremium) && (
          <Note>
            Premium providers active{sttPremium ? ' · Deepgram STT' : ''}{ttsPremium ? ' · ElevenLabs TTS' : ''}.
            {ttsPremium && (
              <>
                {' '}Note: <code style={codeStyle}>[professional]</code>/library ElevenLabs voices need a paid plan —
                if the configured voice is paid-only, TTS auto-falls back to a free premade voice until you upgrade.
              </>
            )}
          </Note>
        )}
      </Section>

      <Section theme={theme} title="INTEGRATIONS">
        {noDb && (
          <Note>
            No database connected — integration records aren't tracked. Start Postgres
            (<code style={codeStyle}>docker-compose up -d</code> + <code style={codeStyle}>npm run migrate</code>) to enable them.
          </Note>
        )}
        {!noDb && integrations.length === 0 && <Note>No integrations connected yet.</Note>}
        {integrations.map((it) => (
          <Row key={it.integration_type} theme={theme} label={it.integration_type} ok={it.status === 'connected'} value={it.status} />
        ))}
      </Section>
    </ViewChrome>
  );
}

const codeStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  color: '#bbb',
  background: 'rgba(255,255,255,0.05)',
  padding: '1px 5px',
  borderRadius: 3,
};

function Section({ title, theme, children }: { title: string; theme: ReturnType<typeof getTheme>; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22, maxWidth: 720 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: theme.accent, letterSpacing: 2, marginBottom: 10, opacity: 0.8 }}>{title}</div>
      <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '14px 16px', background: 'rgba(255,255,255,0.015)' }}>
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  ok,
  accentValue,
  theme,
}: {
  label: string;
  value: string;
  ok: boolean;
  accentValue?: boolean;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#bbb' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? theme.accent : '#eab308', boxShadow: ok ? `0 0 6px ${theme.accent}` : 'none' }} />
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: accentValue ? theme.accent : '#888' }}>{value}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '12px 0 0', fontSize: 11, color: '#777', lineHeight: 1.6 }}>{children}</p>;
}
