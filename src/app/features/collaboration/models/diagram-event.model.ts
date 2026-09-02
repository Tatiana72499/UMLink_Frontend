export interface DiagramEvent<TPayload = unknown> {
  diagramId: string;
  type: string;
  payload: TPayload;
}
