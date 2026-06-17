// src/voice/providers.ts
//
// Provider abstraction for the voice loop. Two concrete providers:
//   - BrowserSpeechProvider: Web Speech API (SpeechRecognition + speechSynthesis),
//     the no-key default that runs today.
//   - ServerSpeechProvider: premium path — MediaRecorder audio -> POST
//     /api/voice/transcribe (Deepgram STT), and POST /api/voice/tts (ElevenLabs)
//     -> play the returned audio.
//
// `getSpeechProvider(providers)` returns a hybrid that routes EACH capability
// (STT, TTS) to the server when the backend reports a premium provider for it,
// and to the browser otherwise — so a Deepgram-only or ElevenLabs-only setup
// still works, and everything degrades gracefully with no keys.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ListenHandlers {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
}

export interface SpeechProvider {
  readonly name: string;
  readonly sttSupported: boolean;
  readonly ttsSupported: boolean;
  startListening(handlers: ListenHandlers): void;
  stopListening(): void;
  speak(text: string, onDone?: () => void): void;
  cancelSpeak(): void;
}

// --- Minimal ambient typings for the (still vendor-prefixed) Web Speech API ---
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Browser-native provider. STT via SpeechRecognition (Chrome/Edge), TTS via
 * speechSynthesis (broad support). No network keys required.
 */
export class BrowserSpeechProvider implements SpeechProvider {
  readonly name = 'browser-speech';
  private recognition: SpeechRecognitionLike | null = null;

  get sttSupported(): boolean {
    return getRecognitionCtor() !== null;
  }
  get ttsSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  startListening(handlers: ListenHandlers): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      handlers.onError?.('SpeechRecognition is not supported in this browser (use Chrome/Edge).');
      return;
    }
    this.stopListening();
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) handlers.onPartial?.(interim);
      if (finalText) handlers.onPartial?.(finalText);
    };
    rec.onerror = (e) => handlers.onError?.(e.error || 'speech recognition error');
    rec.onend = () => {
      if (finalText.trim()) handlers.onFinal(finalText.trim());
      handlers.onEnd?.();
      this.recognition = null;
    };

    this.recognition = rec;
    try {
      rec.start();
    } catch (err) {
      handlers.onError?.(String(err));
    }
  }

  stopListening(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  speak(text: string, onDone?: () => void): void {
    if (!this.ttsSupported || !text) {
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.pitch = 1.0;
    utter.onend = () => onDone?.();
    utter.onerror = () => onDone?.();
    window.speechSynthesis.speak(utter);
  }

  cancelSpeak(): void {
    if (this.ttsSupported) window.speechSynthesis.cancel();
  }
}

/**
 * Server provider. STT: capture mic with MediaRecorder, POST the recording to
 * /api/voice/transcribe (Deepgram). TTS: POST text to /api/voice/tts (ElevenLabs)
 * and play the returned MP3. Falls back via the hybrid wrapper if a call fails.
 */
export class ServerSpeechProvider implements SpeechProvider {
  readonly name = 'server-speech';
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private aborted = false;

  get sttSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window !== 'undefined' &&
      'MediaRecorder' in window
    );
  }
  get ttsSupported(): boolean {
    return typeof window !== 'undefined' && 'Audio' in window;
  }

  async startListening(handlers: ListenHandlers): Promise<void> {
    if (!this.sttSupported) {
      handlers.onError?.('Microphone capture not supported in this browser.');
      return;
    }
    this.aborted = false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      handlers.onError?.('Microphone permission denied.');
      return;
    }
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(this.stream);
    this.recorder = rec;

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = async () => {
      this.releaseStream();
      if (this.aborted) {
        handlers.onEnd?.();
        return;
      }
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      if (blob.size === 0) {
        handlers.onError?.('No audio captured.');
        handlers.onEnd?.();
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': blob.type || 'audio/webm' },
          body: blob,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const transcript = (data.transcript || '').trim();
        if (transcript) handlers.onFinal(transcript);
        else handlers.onError?.('No speech detected.');
      } catch (err) {
        handlers.onError?.(`STT failed: ${String(err)}`);
      } finally {
        handlers.onEnd?.();
      }
    };

    rec.start();
  }

  stopListening(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }

  async speak(text: string, onDone?: () => void): Promise<void> {
    if (!text) {
      onDone?.();
      return;
    }
    this.cancelSpeak();
    try {
      const res = await fetch(`${API_BASE}/api/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.audio = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        onDone?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        onDone?.();
      };
      await audio.play();
    } catch (err) {
      console.warn('[ServerSpeechProvider] TTS failed, falling back to browser:', err);
      // Graceful fallback so a reply is always spoken.
      new BrowserSpeechProvider().speak(text, onDone);
    }
  }

  cancelSpeak(): void {
    if (this.audio) {
      try {
        this.audio.pause();
      } catch {
        /* noop */
      }
      this.audio = null;
    }
  }

  abort(): void {
    this.aborted = true;
    this.stopListening();
    this.releaseStream();
  }
}

/**
 * Hybrid provider: routes STT and TTS independently to the server or the browser
 * based on the backend-reported providers, with browser fallback.
 */
class HybridProvider implements SpeechProvider {
  readonly name = 'hybrid';
  private browser = new BrowserSpeechProvider();
  private server = new ServerSpeechProvider();
  private useServerStt: boolean;
  private useServerTts: boolean;

  constructor(providers?: { stt: string; tts: string }) {
    this.useServerStt = providers?.stt === 'deepgram' && this.server.sttSupported;
    this.useServerTts = providers?.tts === 'elevenlabs' && this.server.ttsSupported;
  }

  get sttSupported(): boolean {
    return this.useServerStt ? this.server.sttSupported : this.browser.sttSupported;
  }
  get ttsSupported(): boolean {
    return this.useServerTts ? this.server.ttsSupported : this.browser.ttsSupported;
  }

  startListening(handlers: ListenHandlers): void {
    (this.useServerStt ? this.server : this.browser).startListening(handlers);
  }
  stopListening(): void {
    this.server.stopListening();
    this.browser.stopListening();
  }
  speak(text: string, onDone?: () => void): void {
    (this.useServerTts ? this.server : this.browser).speak(text, onDone);
  }
  cancelSpeak(): void {
    this.server.cancelSpeak();
    this.browser.cancelSpeak();
  }
}

let _provider: HybridProvider | null = null;
let _signature = '';

/**
 * Resolve the active speech provider for the given backend provider report.
 * Rebuilds when the provider mix changes (e.g. once keys are detected).
 */
export function getSpeechProvider(providers?: { stt: string; tts: string }): SpeechProvider {
  const sig = `${providers?.stt || 'browser'}|${providers?.tts || 'browser'}`;
  if (!_provider || sig !== _signature) {
    _provider = new HybridProvider(providers);
    _signature = sig;
  }
  return _provider;
}
