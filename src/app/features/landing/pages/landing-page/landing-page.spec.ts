import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LandingPage } from './landing-page';

describe('LandingPage', () => {
  it('presenta una entrada pública con acceso al registro', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(LandingPage);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('modelos claros');
    expect(fixture.nativeElement.textContent).toContain('Crear cuenta');
  });
});
