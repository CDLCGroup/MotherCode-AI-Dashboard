import { useEffect, useCallback } from 'react';
import { useDashboardStore } from '../store';
import type { VoiceCall } from '../store';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

const intentColors: Record<string, string> = {
  order: 'text-green-400 bg-green-400',
  support: 'text-blue-400 bg-blue-400',
  inquiry: 'text-cyan-400 bg-cyan-400',
  cancellation: 'text-red-400 bg-red-400',
  booking: 'text-purple-400 bg-purple-400',
  general: 'text-neon-yellow bg-neon-yellow',
};

const statusEmoji: Record<string, string> = {
  completed: '✅',
  failed: '❌',
  in_progress: '⏳',
  unknown: '❓',
};

function CallRow({ call }: { call: VoiceCall }) {
  const [color, bg] = (intentColors[call.intent] || intentColors.general).split(' ');
  const time = new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-start gap-3 py-3 border-b border-neon-yellow border-opacity-10 last:border-0 hover:bg-neon-gray hover:bg-opacity-20 px-2 rounded transition-colors">
      <span className="text-xl mt-0.5">{statusEmoji[call.status] || '📞'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-opacity-20 ${color} ${bg} bg-opacity-10`}>
            {call.intent.toUpperCase()}
          </span>
          <span className="text-neon-yellow text-opacity-50 text-xs">{time}</span>
          <span className="text-neon-yellow text-opacity-50 text-xs ml-auto">{call.duration}s</span>
        </div>
        <p className="text-neon-yellow text-opacity-70 text-xs mt-1 truncate">
          {call.summary || 'No summary available'}
        </p>
        <p className="text-neon-yellow text-opacity-30 text-xs font-mono mt-0.5 truncate">
          {call.conversationId}
        </p>
      </div>
    </div>
  );
}

export default function VoiceCallLog() {
  const voiceCalls = useDashboardStore((s) => s.voiceCalls);
  const voiceMetrics = useDashboardStore((s) => s.voiceMetrics);
  const voiceAgentConfigured = useDashboardStore((s) => s.voiceAgentConfigured);
  const setVoiceCalls = useDashboardStore((s) => s.setVoiceCalls);
  const setVoiceMetrics = useDashboardStore((s) => s.setVoiceMetrics);
  const setVoiceAgentConfigured = useDashboardStore((s) => s.setVoiceAgentConfigured);
  const addVoiceCall = useDashboardStore((s) => s.addVoiceCall);
  const addActivityLog = useDashboardStore((s) => s.addActivityLog);

  const fetchData = useCallback(async () => {
    try {
      const [convsRes, metricsRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/voice/conversations?limit=20`),
        fetch(`${API_BASE}/api/voice/metrics`),
        fetch(`${API_BASE}/api/voice/agent/status`),
      ]);

      if (convsRes.ok) {
        const data = await convsRes.json();
        setVoiceCalls(data.conversations || []);
      }
      if (metricsRes.ok) {
        setVoiceMetrics(await metricsRes.json());
      }
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setVoiceAgentConfigured(statusData.configured ?? false);
      }
    } catch {
      // API not reachable yet — silent fail
    }
  }, [setVoiceCalls, setVoiceMetrics, setVoiceAgentConfigured]);

  // Poll on mount, then every 30 seconds
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Listen for real-time WebSocket updates
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'voice_call') {
          addVoiceCall(msg.data as VoiceCall);
          addActivityLog(`📞 Voice call: ${msg.data.intent} — ${msg.data.duration}s`);
          setVoiceMetrics({
            ...voiceMetrics,
            total: voiceMetrics.total + 1,
            completed:
              msg.data.status === 'completed'
                ? voiceMetrics.completed + 1
                : voiceMetrics.completed,
          });
        }
      } catch {
        // ignore malformed WS messages
      }
    };

    return () => ws.close();
  }, [addVoiceCall, addActivityLog, voiceMetrics, setVoiceMetrics]);

  const topIntent = Object.entries(voiceMetrics.intentCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="neon-box bg-gradient-to-br from-neon-black to-neon-gray rounded-lg border border-neon-yellow border-opacity-30 p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold neon-text">Voice Call Log</h2>
          <p className="text-xs text-neon-yellow text-opacity-50 mt-0.5">
            411 Labs · ElevenLabs Agent
            <span
              className={`ml-2 inline-block w-1.5 h-1.5 rounded-full ${
                voiceAgentConfigured ? 'bg-green-400' : 'bg-yellow-400'
              }`}
            />
          </p>
        </div>
        <button
          onClick={fetchData}
          className="neon-button text-xs px-3 py-1 rounded hover:neon-glow transition-all"
        >
          REFRESH
        </button>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-neon-black bg-opacity-50 rounded p-2 text-center border border-neon-yellow border-opacity-10">
          <p className="text-neon-yellow text-xl font-bold">{voiceMetrics.total}</p>
          <p className="text-neon-yellow text-opacity-50 text-xs">Total Calls</p>
        </div>
        <div className="bg-neon-black bg-opacity-50 rounded p-2 text-center border border-neon-yellow border-opacity-10">
          <p className="text-green-400 text-xl font-bold">{voiceMetrics.completed}</p>
          <p className="text-neon-yellow text-opacity-50 text-xs">Completed</p>
        </div>
        <div className="bg-neon-black bg-opacity-50 rounded p-2 text-center border border-neon-yellow border-opacity-10">
          <p className="text-cyan-400 text-xl font-bold">{voiceMetrics.avgDuration}s</p>
          <p className="text-neon-yellow text-opacity-50 text-xs">Avg Duration</p>
        </div>
      </div>

      {topIntent && (
        <p className="text-xs text-neon-yellow text-opacity-50 mb-3">
          Top intent:{' '}
          <span className="text-neon-yellow font-semibold">
            {topIntent[0]} ({topIntent[1]})
          </span>
        </p>
      )}

      {/* Call list */}
      <div className="flex-1 overflow-y-auto max-h-64">
        {voiceCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-neon-yellow text-opacity-30 text-sm">
            <span className="text-3xl mb-2">📞</span>
            <p>No voice calls yet</p>
            <p className="text-xs mt-1">
              Webhook: <code className="font-mono">POST /api/voice/webhook</code>
            </p>
          </div>
        ) : (
          voiceCalls.map((call) => (
            <CallRow key={call.conversationId} call={call} />
          ))
        )}
      </div>
    </div>
  );
}
