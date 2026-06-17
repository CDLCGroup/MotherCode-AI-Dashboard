// src/voice/useVoiceData.ts
//
// Keeps the store's voice data in sync with the backend: polls the REST contract
// (/conversations, /metrics, /agent/status) and subscribes to the WebSocket for
// real-time voice_call pushes. Used by the OrchestrationDashboard.

import { useEffect, useCallback } from 'react';
import { useDashboardStore } from '../store';
import type { VoiceCall } from '../store';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export function useVoiceData() {
  const setVoiceCalls = useDashboardStore((s) => s.setVoiceCalls);
  const setVoiceMetrics = useDashboardStore((s) => s.setVoiceMetrics);
  const setVoiceAgentConfigured = useDashboardStore((s) => s.setVoiceAgentConfigured);
  const setVoiceDomains = useDashboardStore((s) => s.setVoiceDomains);
  const setVoiceProviders = useDashboardStore((s) => s.setVoiceProviders);
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
        const status = await statusRes.json();
        setVoiceAgentConfigured(status.configured ?? false);
        setVoiceDomains(status.domains || []);
        if (status.providers) setVoiceProviders(status.providers);
      }
    } catch {
      // backend not reachable yet — silent
    }
  }, [setVoiceCalls, setVoiceMetrics, setVoiceAgentConfigured, setVoiceDomains, setVoiceProviders]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    try {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'voice_call') {
            addVoiceCall(msg.data as VoiceCall);
            addActivityLog(`📞 ${msg.data.intent} · ${msg.data.duration}s`);
            // Refresh metrics so totals stay accurate.
            fetch(`${API_BASE}/api/voice/metrics`)
              .then((r) => (r.ok ? r.json() : null))
              .then((m) => m && setVoiceMetrics(m))
              .catch(() => {});
          }
        } catch {
          /* ignore malformed */
        }
      };
      ws.onerror = () => {};
    } catch {
      /* WS unavailable */
    }
    return () => {
      closed = true;
      if (ws && !closed) ws.close();
      ws?.close();
    };
  }, [addVoiceCall, addActivityLog, setVoiceMetrics]);

  return { refresh: fetchData };
}
