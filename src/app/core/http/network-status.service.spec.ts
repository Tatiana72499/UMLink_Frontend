import { HttpErrorResponse } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkStatusService } from './network-status.service';

describe('NetworkStatusService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('oculta automáticamente un aviso transitorio después de seis segundos', () => {
    const service = new NetworkStatusService();

    service.report(new HttpErrorResponse({ status: 0 }));
    expect(service.notice()).toContain('No pudimos comunicarnos');

    vi.advanceTimersByTime(6_000);
    expect(service.notice()).toBe('');
  });

  it('reinicia el tiempo cuando llega un nuevo aviso', () => {
    const service = new NetworkStatusService();
    service.report(new Error('first'));
    service.report(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));

    vi.advanceTimersByTime(5_999);
    expect(service.notice()).toContain('La solicitud tardó demasiado');

    vi.advanceTimersByTime(1);
    expect(service.notice()).toBe('');
  });
});