import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { VoiceCommandService } from '../../data-access/voice-command.service';
import { DiagramAssistantPanelComponent } from './diagram-assistant-panel.component';

describe('DiagramAssistantPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagramAssistantPanelComponent],
      providers: [{ provide: VoiceCommandService, useValue: { isSupported: () => false, listen: () => of() } }],
    }).compileComponents();
  });

  it('emite el comando escrito para que el editor lo valide', () => {
    const fixture = TestBed.createComponent(DiagramAssistantPanelComponent);
    const component = fixture.componentInstance;
    component.open = true;
    const emitted: unknown[] = [];
    component.commandRequested.subscribe((command) => emitted.push(command));

    component.form.controls.command.setValue('crear clase Pago');
    component.submit();

    expect(emitted).toEqual([{ command: 'crear clase Pago', confirmed: false }]);
  });

  it('mantiene la alternativa de texto cuando el navegador no soporta voz', () => {
    const fixture = TestBed.createComponent(DiagramAssistantPanelComponent);
    const component = fixture.componentInstance;

    component.startVoice();

    expect(component.voiceState()).toBe('unsupported');
    expect(component.voiceMessage()).toContain('Puedes escribir');
  });

  it('muestra un lanzador compacto cuando la barra está oculta', () => {
    const fixture = TestBed.createComponent(DiagramAssistantPanelComponent);
    const component = fixture.componentInstance;
    let opened = false;
    component.opened.subscribe(() => { opened = true; });

    fixture.detectChanges();
    const launcher = fixture.nativeElement.querySelector('.assistant-launcher') as HTMLButtonElement | null;
    launcher?.click();

    expect(opened).toBe(true);
  });

  it('no confirma una instrucción diferente de la previsualizada', () => {
    const fixture = TestBed.createComponent(DiagramAssistantPanelComponent);
    const component = fixture.componentInstance;
    component.preview = { action: 'DELETE_CLASS', summary: 'Eliminar Pago', requiresConfirmation: true };
    component.previewCommand = 'eliminar clase Pago';
    const emitted: unknown[] = [];
    component.commandRequested.subscribe((command) => emitted.push(command));

    component.form.controls.command.setValue('eliminar clase Cliente');
    component.submit(true);
    expect(emitted).toEqual([]);

    component.form.controls.command.setValue('eliminar clase Pago');
    component.submit(true);
    expect(emitted).toEqual([{ command: 'eliminar clase Pago', confirmed: true }]);
  });

  it('permite arrastrar el botón sin abrir el asistente', () => {
    const fixture = TestBed.createComponent(DiagramAssistantPanelComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const launcher = fixture.nativeElement.querySelector('.assistant-launcher') as HTMLButtonElement;
    vi.spyOn(launcher, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 110, 44));
    Object.defineProperty(launcher, 'setPointerCapture', { configurable: true, value: vi.fn() });
    let opened = false;
    component.opened.subscribe(() => { opened = true; });

    launcher.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: 120, clientY: 120 }));
    launcher.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 170, clientY: 170 }));
    launcher.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 170, clientY: 170 }));
    launcher.click();

    expect(component.launcherPosition()).toEqual({ left: 150, top: 150 });
    expect(opened).toBe(false);
  });
});
