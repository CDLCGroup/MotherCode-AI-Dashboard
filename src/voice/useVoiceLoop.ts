// src/voice/useVoiceLoop.ts
//
// Orchestrates one conversational turn of the voice loop:
//   mic (STT) -> POST /api/voice/command -> spoken reply (TTS)
// while driving the store's voiceUiState so the Glass-Metric core reflects state.

import { useCallback, useRef, useState } from 'react';
import { useDashboardStore } from '../store';
import { getSpeechProvider } from './providers';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const USER_ID = import.meta.env.VITE_USER_ID || '1';

export function useVoiceLoop() {
  const setVoiceUiState = useDashboardStore((s) => s.setVoiceUiState);
  const setLiveTranscript = useDashboardStore((s) => s.setLiveTranscript);
  const setLiveResponse = useDashboardStore((s) => s.setLiveResponse);
  const addActivityLog = useDashboardStore((s) => s.addActivityLog);
  const voiceProviders = useDashboardStore((s) => s.voiceProviders);

  const provider = getSpeechProvider(voiceProviders);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const startedAtRef = useRef<number>(0);

  const submit = useCallback(
    async (transcript: string, durationSec: number) => {
      if (!transcript.trim()) {
        setVoiceUiState('IDLE');
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(`${API_BASE}/api/voice/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: USER_ID, transcript, durationSec }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const reply: string = data.response || "I didn't catch that.";
        setLiveResponse(reply);
        addActivityLog(`🗣️ "${transcript}" → ${data.intent}`);
        // Speak the reply; core shows RESPONDING until speech ends.
        setVoiceUiState('AI_SPEAKING');
        provider.speak(reply, () => setVoiceUiState('IDLE'));
      } catch (err) {
        console.error('[voiceLoop] submit failed:', err);
        setLiveResponse('Could not reach the voice backend.');
        setVoiceUiState('AGENT_ERROR');
        setTimeout(() => setVoiceUiState('IDLE'), 2500);
      } finally {
        setBusy(false);
      }
    },
    [provider, setVoiceUiState, setLiveResponse, addActivityLog],
  );

  const startTurn = useCallback(() => {
    if (listening || busy) return;
    if (!provider.sttSupported) {
      setVoiceUiState('AGENT_ERROR');
      addActivityLog('🎤 Mic STT unavailable — use the text box (Chrome/Edge needed for voice).');
      setTimeout(() => setVoiceUiState('IDLE'), 2500);
      return;
    }
    provider.cancelSpeak();
    setLiveTranscript('');
    setLiveResponse('');
    setVoiceUiState('USER_TALKING');
    setListening(true);
    startedAtRef.current = Date.now();

    provider.startListening({
      onPartial: (text) => setLiveTranscript(text),
      onFinal: (text) => {
        setListening(false);
        const durationSec = (Date.now() - startedAtRef.current) / 1000;
        setLiveTranscript(text);
        submit(text, durationSec);
      },
      onError: (e) => {
        setListening(false);
        console.warn('[voiceLoop] STT error:', e);
        setVoiceUiState('AGENT_ERROR');
        setTimeout(() => setVoiceUiState('IDLE'), 2000);
      },
      onEnd: () => setListening(false),
    });
  }, [listening, busy, provider, setVoiceUiState, setLiveTranscript, setLiveResponse, addActivityLog, submit]);

  const stopTurn = useCallback(() => {
    provider.stopListening();
    setListening(false);
  }, [provider]);

  const toggleTurn = useCallback(() => {
    if (listening) stopTurn();
    else startTurn();
  }, [listening, startTurn, stopTurn]);

  // Text fallback (typed command) — same backend path, no mic required.
  const sendText = useCallback(
    (text: string) => {
      provider.cancelSpeak();
      setLiveTranscript(text);
      setLiveResponse('');
      setVoiceUiState('USER_TALKING');
      submit(text, 0);
    },
    [provider, setLiveTranscript, setLiveResponse, setVoiceUiState, submit],
  );

  return {
    listening,
    busy,
    sttSupported: provider.sttSupported,
    ttsSupported: provider.ttsSupported,
    startTurn,
    stopTurn,
    toggleTurn,
    sendText,
  };
}
