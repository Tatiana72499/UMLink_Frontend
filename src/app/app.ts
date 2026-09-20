import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthSessionService, NetworkStatusService } from './core';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly session = inject(AuthSessionService);
  readonly network = inject(NetworkStatusService);

  readonly user = this.session.user;
  readonly profileOpen = signal(false);

  toggleProfile(): void {
    this.profileOpen.update((open) => !open);
  }

  logout(): void {
    this.profileOpen.set(false);
    this.session.clear();
    void this.router.navigate(['/auth/login']);
  }

  isEditorActive(url = this.router.url): boolean {
    return /^\/projects\/[^/]+\/diagrams\/[^/]+(?:\/|$)/.test(url);
  }
}
