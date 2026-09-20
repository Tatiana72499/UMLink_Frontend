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

  @Input({ required: true }) open = false;
  @Input() isSubmitting = false;
  @Input() errorMessage = '';
  @Input() preview: AssistantCommandResponse | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() opened = new EventEmitter<void>();
  @Output() commandRequested = new EventEmitter<ExecuteAssistantCommandRequest>();

  readonly voiceState = signal<VoiceState>('idle');
  readonly voiceMessage = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    command: ['', [Validators.required, Validators.maxLength(500)]],
  });
  readonly suggestions = [
    'Agrega a Usuario un atributo llamado Nombre',
    'Crea una relación de asociación entre Usuario y Cliente, uno a uno',
    'Cliente hereda de Persona',
    'Quiero una clase para registrar pagos',
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
    this.commandRequested.emit({ command: this.form.controls.command.value.trim(), confirmed });
  }

  useSuggestion(value: string): void {
    this.form.controls.command.setValue(value);
    this.form.controls.command.markAsDirty();
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