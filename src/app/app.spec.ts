import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should hide the main navigation without a session', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')).toBeNull();
  });

  it('should render the main navigation with a session', async () => {
    localStorage.setItem(
      'umlink.auth-session',
      JSON.stringify({ token: 'token', userId: 'id', name: 'Tatiana', email: 'tatiana@example.com' }),
    );
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('header nav a').length).toBe(2);
  });

  it('should identify a diagram route as the active editor', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance.isEditorActive('/projects/project-1/diagrams/diagram-1')).toBe(true);
    expect(fixture.componentInstance.isEditorActive('/projects')).toBe(false);
  });
});
