import { TestBed } from '@angular/core/testing';
import { AuthSessionService, WEB_SOCKET_URL } from '../../../core';
import { CollaborationWebSocketService } from './collaboration-websocket.service';

describe('CollaborationWebSocketService', () => {
  it('no abre una conexión cuando la sesión no tiene JWT', () => {
    TestBed.configureTestingModule({
      providers: [
        CollaborationWebSocketService,
        { provide: AuthSessionService, useValue: { token: () => null } },
        { provide: WEB_SOCKET_URL, useValue: 'ws://localhost:8080/ws' },
      ],
    });
    const service = TestBed.inject(CollaborationWebSocketService);

    service.connect('diagram-1');

    expect(service.state()).toBe('error');
  });
});
