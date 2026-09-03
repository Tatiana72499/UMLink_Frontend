import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthSessionService } from './core';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly session = inject(AuthSessionService);

  readonly user = this.session.user;

  logout(): void {
    this.session.clear();
    void this.router.navigate(['/auth/login']);
  }

  isEditorActive(url = this.router.url): boolean {
    return /^\/projects\/[^/]+\/diagrams\/[^/]+(?:\/|$)/.test(url);
  }
}
