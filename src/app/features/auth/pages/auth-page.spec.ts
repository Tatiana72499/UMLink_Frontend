import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthSessionService } from '../../../core';
import { AuthApiService } from '../data-access/auth-api.service';
import { AuthResponse } from '../models/auth.model';
import { AuthPage } from './auth-page';

describe('AuthPage', () => {
  const response: AuthResponse = {
    token: 'jwt-token',
    userId: 'user-id',
    name: 'Tatiana',
    email: 'tatiana@example.com',
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [
        provideRouter([{ path: 'projects', component: AuthPage }]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { mode: 'login' } } } },
        { provide: AuthApiService, useValue: { login: () => of(response), register: () => of(response) } },
      ],
    }).compileComponents();
  });

  it('does not require a name when logging in', () => {
    const fixture = TestBed.createComponent(AuthPage);
    const component = fixture.componentInstance;
    component.form.setValue({ name: '', email: response.email, password: 'clave12' });

    expect(component.form.valid).toBe(true);
  });

  it('stores the received session after a successful login', () => {
    const fixture = TestBed.createComponent(AuthPage);
    const component = fixture.componentInstance;
    component.form.setValue({ name: '', email: response.email, password: 'clave12' });

    component.submit();

    expect(TestBed.inject(AuthSessionService).token()).toBe(response.token);
  });
});
