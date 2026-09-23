import { Component, DestroyRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { UiButtonComponent } from '../../../../shared';
import { AssistantCommandResponse, ExecuteAssistantCommandRequest } from '../../../diagram/models/diagram.model';
import { VoiceCommandService } from '../../data-access/voice-command.service';

type VoiceState = 'idle' | 'listening' | 'unsupported' | 'error';

@Component({
  selector: 'app-diagram-assistant-panel',
  imports: [ReactiveFormsModule, UiButtonComponent],
  templateUrl: './diagram-assistant-panel.component.html',
  styleUrl: './diagram-assistant-panel.component.scss',
})
export class DiagramAssistantPanelComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);
  private readonly voice = inject(VoiceCommandService);
  private readonly destroyRef = inject(DestroyRef);
  private voiceSubscription?: Subscription;
  private launcherDrag: { pointerId: number; x: number; y: number; left: number; top: number; width: number; height: number; moved: boolean } | null = null;
  private suppressLauncherClick = false;

  @Input({ required: true }) open = false;
  @Input() isSubmitting = false;
  @Input() errorMessage = '';
  @Input() preview: AssistantCommandResponse | null = null;
  @Input() previewCommand = '';
  @Input() resultMessage = '';
  @Output() closed = new EventEmitter<void>();
  @Output() opened = new EventEmitter<void>();
  @Output() commandRequested = new EventEmitter<ExecuteAssistantCommandRequest>();

  readonly voiceState = signal<VoiceState>('idle');
  readonly voiceMessage = signal('');
  readonly launcherPosition = signal<{ left: number; top: number } | null>(null);
  readonly form = this.formBuilder.nonNullable.group({
    command: ['', [Validators.required, Validators.maxLength(500)]],
  });
  readonly suggestions = [
    'Crear clase Pago',
    'Mover clase Pago a 200, 300',
    'Renombrar clase Pago a Factura',
    'Eliminar clase Pago',
    'Agregar a Pago un atributo llamado total de tipo Double',
    'Crear relación entre Pago y Cliente',
    'Listar clases',
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue && !changes['open'].previousValue) {
      this.form.reset({ command: '' });
      this.voiceState.set('idle');
      this.voiceMessage.set('');
    }
    if (changes['open']?.previousValue && !changes['open'].currentValue) this.stopVoice('');
  }

  submit(confirmed = false): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (confirmed && (!this.preview || this.form.controls.command.value.trim() !== this.previewCommand)) return;
    this.commandRequested.emit({ command: this.form.controls.command.value.trim(), confirmed });
  }

  useSuggestion(value: string): void {
    this.form.controls.command.setValue(value);
    this.form.controls.command.markAsDirty();
  }

  startLauncherDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    const button = event.currentTarget as HTMLButtonElement;
    const rect = button.getBoundingClientRect();
    this.suppressLauncherClick = false;
    this.launcherDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, moved: false };
    button.setPointerCapture?.(event.pointerId);
  }

  moveLauncher(event: PointerEvent): void {
    const drag = this.launcherDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    event.preventDefault();
    this.launcherPosition.set({
      left: Math.max(8, Math.min(window.innerWidth - drag.width - 8, drag.left + dx)),
      top: Math.max(8, Math.min(window.innerHeight - drag.height - 8, drag.top + dy)),
    });
  }

  endLauncherDrag(event: PointerEvent): void {
    if (this.launcherDrag?.pointerId !== event.pointerId) return;
    this.suppressLauncherClick = this.launcherDrag.moved;
    this.launcherDrag = null;
  }

  activateLauncher(): void {
    if (this.suppressLauncherClick) {
      this.suppressLauncherClick = false;
      return;
    }
    this.opened.emit();
  }

  startVoice(): void {
    if (this.voiceState() === 'listening') {
      this.stopVoice('Escucha detenida. Puedes continuar escribiendo o volver a presionar el micrófono.');
      return;
    }
    if (!this.voice.isSupported()) {
      this.voiceState.set('unsupported');
      this.voiceMessage.set('Tu navegador no ofrece reconocimiento de voz. Puedes escribir el comando.');
      return;
    }
    this.voiceState.set('listening');
    this.voiceMessage.set('Escuchando… vuelve a presionar el micrófono para detener.');
    this.voiceSubscription = this.voice.listen().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (transcript) => {
        if (transcript.text) this.form.controls.command.setValue(transcript.text);
        if (transcript.isFinal) {
          this.voiceState.set('idle');
          this.voiceMessage.set('Transcripción lista. Revísala y aplica el cambio.');
        }
      },
      error: () => {
        this.voiceSubscription = undefined;
        this.voiceState.set('error');
        this.voiceMessage.set('No pudimos reconocer la voz. Revisa el permiso del micrófono o escribe el comando.');
      },
      complete: () => {
        this.voiceSubscription = undefined;
        if (this.voiceState() === 'listening') {
          this.voiceState.set('idle');
          this.voiceMessage.set('Escucha finalizada. Puedes volver a presionar el micrófono.');
        }
      },
    });
  }

  private stopVoice(message: string): void {
    this.voice.stop();
    this.voiceSubscription?.unsubscribe();
    this.voiceSubscription = undefined;
    this.voiceState.set('idle');
    this.voiceMessage.set(message);
  }
}
