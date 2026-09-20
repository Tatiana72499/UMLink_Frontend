import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VoiceTranscript } from '../models/voice-command.model';

interface RecognitionAlternative { transcript: string; }
interface RecognitionResult { isFinal: boolean; [index: number]: RecognitionAlternative; }
interface RecognitionResultList { length: number; [index: number]: RecognitionResult; }
interface RecognitionResultEvent extends Event { resultIndex: number; results: RecognitionResultList; }
interface RecognitionErrorEvent extends Event { error: string; }
interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
interface BrowserSpeechRecognitionConstructor { new (): BrowserSpeechRecognition; }
type SpeechWindow = Window & typeof globalThis & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

@Injectable({ providedIn: 'root' })
export class VoiceCommandService {
  private activeRecognition: BrowserSpeechRecognition | null = null;

  isSupported(): boolean {
    return this.constructorForBrowser() !== undefined;
  }

  stop(): boolean {
    const recognition = this.activeRecognition;
    if (!recognition) return false;
    this.activeRecognition = null;
    recognition.abort();
    return true;
  }

  listen(): Observable<VoiceTranscript> {
    return new Observable<VoiceTranscript>((subscriber) => {
      const Constructor = this.constructorForBrowser();
      if (!Constructor) {
        subscriber.error(new Error('El reconocimiento de voz no está disponible en este navegador.'));
        return undefined;
      }
      this.stop();
      const recognition = new Constructor();
      this.activeRecognition = recognition;
      const release = () => {
        if (this.activeRecognition === recognition) this.activeRecognition = null;
      };
      recognition.lang = 'es-BO';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let transcript = '';
        let isFinal = false;
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          transcript += event.results[index][0].transcript;
          isFinal = event.results[index].isFinal;
        }
        subscriber.next({ text: transcript.trim(), isFinal });
      };
      recognition.onerror = (event) => {
        release();
        subscriber.error(new Error(event.error));
      };
      recognition.onend = () => {
        release();
        subscriber.complete();
      };
      recognition.start();
      return () => {
        if (this.activeRecognition === recognition) {
          this.activeRecognition = null;
          recognition.abort();
        }
      };
    });
  }

  private constructorForBrowser(): BrowserSpeechRecognitionConstructor | undefined {
    if (typeof window === 'undefined') return undefined;
    const browserWindow = window as SpeechWindow;
    return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
  }
}