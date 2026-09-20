export type DiagramEventType = 'PRESENCE_JOINED' | 'PRESENCE_LEFT' | 'DIAGRAM_CHANGED' | 'DRAWING_PREVIEW' | 'DRAWING_PREVIEW_CLEARED' | 'ELEMENT_INTERACTION' | 'CLASS_POSITION_PREVIEW';

export type EphemeralDiagramEventType = 'DRAWING_PREVIEW' | 'DRAWING_PREVIEW_CLEARED' | 'ELEMENT_INTERACTION' | 'CLASS_POSITION_PREVIEW';

export interface CollaborationParticipant {
  userId: string;
  name: string;
}

export interface DiagramEvent<TPayload = unknown> {
  diagramId: string;
  type: DiagramEventType;
  payload: TPayload | null;
  actor: CollaborationParticipant | null;
}

export function isDiagramEvent(value: unknown): value is DiagramEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return typeof event['diagramId'] === 'string'
    && (event['type'] === 'PRESENCE_JOINED' || event['type'] === 'PRESENCE_LEFT' || event['type'] === 'DIAGRAM_CHANGED'
      || event['type'] === 'DRAWING_PREVIEW' || event['type'] === 'DRAWING_PREVIEW_CLEARED' || event['type'] === 'ELEMENT_INTERACTION' || event['type'] === 'CLASS_POSITION_PREVIEW');
}
