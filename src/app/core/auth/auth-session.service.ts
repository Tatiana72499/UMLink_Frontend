import { Injectable, computed, signal } from '@angular/core';
import { AuthResponse } from '../../features/auth/models/auth.model';

const SESSION_KEY = 'umlink.auth-session';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly session = signal<AuthResponse | null>(this.readStoredSession());

  readonly user = computed(() => this.session());
  readonly isAuthenticated = computed(() => this.session() !== null);

  save(session: AuthResponse): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.session.set(session);
  }

  clear(): void {
    localStorage.removeItem(SESSION_KEY);
    this.session.set(null);
  }

  token(): string | null {
    return this.session()?.token ?? null;
  }

  private readStoredSession(): AuthResponse | null {
    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) {
      return null;
    }

    try {
      return JSON.parse(rawSession) as AuthResponse;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}
