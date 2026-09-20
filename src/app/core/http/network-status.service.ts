import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';

const NOTICE_DURATION_MS = 6_000;

@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly notice = signal('');
  private noticeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.online.set(true);
      this.showNotice('Conexión recuperada. Puedes continuar trabajando.');
    });
    window.addEventListener('offline', () => {
      this.online.set(false);
      this.showNotice('Sin conexión. Tus cambios no se podrán guardar hasta recuperar la red.');
    });
  }

  report(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      this.online.set(false);
      this.showNotice('No pudimos comunicarnos con el servidor. Revisa tu conexión y vuelve a intentarlo.');
      return;
    }
    if (error instanceof Error && error.name === 'TimeoutError') {
      this.showNotice('La solicitud tardó demasiado. El servidor sigue procesando o no está disponible; puedes reintentar.');
    }
  }

  dismiss(): void {
    if (this.noticeTimeout) clearTimeout(this.noticeTimeout);
    this.noticeTimeout = null;
    this.notice.set('');
  }

  private showNotice(message: string): void {
    this.dismiss();
    this.notice.set(message);
    this.noticeTimeout = setTimeout(() => this.dismiss(), NOTICE_DURATION_MS);
  }
}