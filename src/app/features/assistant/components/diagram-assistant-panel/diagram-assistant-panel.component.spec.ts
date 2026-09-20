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
});
