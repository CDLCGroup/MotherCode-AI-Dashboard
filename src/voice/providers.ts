// src/voice/providers.ts
//
// Provider abstraction for the voice loop. The default implementation uses the
// browser's built-in Web Speech API (SpeechRecognition for STT + speechSynthesis
// for TTS) so the loop works TODAY with zero API keys. The premium ElevenLabs/
// Deepgram path is wired server-side (POST /api/voice/tts, /api/voice/transcribe)
// and exposed here behind the same interface — flip to it once keys are present.

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

let _provider: SpeechProvider | null = null;

/**
 * Resolve the active speech provider. Today this is always the browser provider;
 * the `providers` arg (from GET /api/voice/agent/status) is reserved so a future
 * ServerSpeechProvider (Deepgram/ElevenLabs) can be selected when keys exist.
 */
export function getSpeechProvider(_providers?: { stt: string; tts: string }): SpeechProvider {
  if (!_provider) _provider = new BrowserSpeechProvider();
  return _provider;
}
