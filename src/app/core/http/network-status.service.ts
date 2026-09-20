import { Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly notice = signal('');

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => { this.online.set(true); this.notice.set('Conexión recuperada. Puedes continuar trabajando.'); });
    window.addEventListener('offline', () => { this.online.set(false); this.notice.set('Sin conexión. Tus cambios no se podrán guardar hasta recuperar la red.'); });
  }

  report(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      this.online.set(false);
      this.notice.set('No pudimos comunicarnos con el servidor. Revisa tu conexión y vuelve a intentarlo.');
      return;
    }
    if (error instanceof Error && error.name === 'TimeoutError') this.notice.set('La solicitud tardó demasiado. El servidor sigue procesando o no está disponible; puedes reintentar.');
  }

  dismiss(): void { this.notice.set(''); }
}
