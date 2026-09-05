import { inject, Injectable, signal } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import { AuthSessionService, WEB_SOCKET_URL } from '../../../core';
import { CollaborationParticipant, DiagramEvent, EphemeralDiagramEventType, isDiagramEvent } from '../models/diagram-event.model';

export type CollaborationConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

@Injectable({ providedIn: 'root' })
export class CollaborationWebSocketService {
  private readonly authSession = inject(AuthSessionService);
  private readonly webSocketUrl = inject(WEB_SOCKET_URL);
  private client: Client | null = null;
  private connectedDiagramId: string | null = null;
  private hasConnected = false;
  private readonly eventSubject = new Subject<DiagramEvent>();

  readonly state = signal<CollaborationConnectionState>('disconnected');
  readonly participants = signal<CollaborationParticipant[]>([]);
  readonly events$ = this.eventSubject.asObservable();

  connect(diagramId: string): void {
    if (this.connectedDiagramId === diagramId && this.client?.active) return;
    this.disconnect();

    const token = this.authSession.token();
    if (!token) {
      this.state.set('error');
      return;
    }

    this.connectedDiagramId = diagramId;
    this.hasConnected = false;
    this.participants.set([]);
    this.state.set('connecting');
    this.client = new Client({
      brokerURL: this.webSocketUrl,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 3_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      onConnect: () => {
        this.hasConnected = true;
        this.state.set('connected');
        this.client?.subscribe(`/topic/diagrams/${diagramId}`, (message) => this.handleMessage(message));
        this.publishPresence('PRESENCE_JOINED');
      },
      onStompError: () => this.state.set('error'),
      onWebSocketClose: () => {
        this.state.set(this.client?.active && this.hasConnected ? 'reconnecting' : 'disconnected');
      },
    });
    this.client.activate();
  }

  disconnect(): void {
    if (this.client?.connected) this.publishPresence('PRESENCE_LEFT');
    void this.client?.deactivate();
    this.client = null;
    this.connectedDiagramId = null;
    this.hasConnected = false;
    this.participants.set([]);
    this.state.set('disconnected');
  }

  publishEphemeral(type: EphemeralDiagramEventType, payload: Record<string, unknown> | null): void {
    if (!this.client?.connected || !this.connectedDiagramId) return;
    this.client.publish({
      destination: '/app/diagram-events',
      body: JSON.stringify({ diagramId: this.connectedDiagramId, type, payload, actor: null }),
    });
  }

  private publishPresence(type: 'PRESENCE_JOINED' | 'PRESENCE_LEFT'): void {
    if (!this.client?.connected || !this.connectedDiagramId) return;
    this.client.publish({
      destination: '/app/diagram-events',
      body: JSON.stringify({ diagramId: this.connectedDiagramId, type, payload: null, actor: null }),
    });
  }

  private handleMessage(message: IMessage): void {
    const parsed = this.parseEvent(message.body);
    if (!parsed) return;
    const actor = parsed.actor;
    if (parsed.type === 'PRESENCE_JOINED' && actor) {
      this.participants.update((participants) => participants.some((item) => item.userId === actor.userId)
        ? participants
        : [...participants, actor]);
    }
    if (parsed.type === 'PRESENCE_LEFT' && actor) {
      this.participants.update((participants) => participants.filter((item) => item.userId !== actor.userId));
    }
    this.eventSubject.next(parsed);
  }

  private parseEvent(body: string): DiagramEvent | null {
    try {
      const parsed: unknown = JSON.parse(body);
      return isDiagramEvent(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
