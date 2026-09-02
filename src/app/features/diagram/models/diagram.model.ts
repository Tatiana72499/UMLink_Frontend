export type RelationType =
  | 'ASSOCIATION'
  | 'AGGREGATION'
  | 'COMPOSITION'
  | 'GENERALIZATION'
  | 'REALIZATION'
  | 'DEPENDENCY';
export interface Diagram {
  id: string;
  projectId: string;
  name: string;
  version: number;
  createdAt: string;
}

export interface CreateDiagramRequest {
  name: string;
}

export interface DiagramDetails {
  diagram: Diagram;
  classes: UmlClass[];
  relations: UmlRelation[];
}

export interface CreateUmlClassRequest {
  name: string;
  positionX: number;
  positionY: number;
}
export interface UpdateUmlClassRequest {
  name: string;
  positionX: number;
  positionY: number;
}
export interface UmlClass {
  id: string;
  diagramId: string;
  name: string;
  positionX: number;
  positionY: number;
  version: number;
  attributes: UmlAttribute[];
}

export interface UmlAttribute {
  id: string;
  umlClassId: string;
  name: string;
  dataType: string;
  visibility: string;
}

export interface CreateAttributeRequest {
  name: string;
  dataType: string;
  visibility: string;
}
export interface UmlRelation {
  id: string;
  diagramId: string;
  sourceClassId: string;
  targetClassId: string;
  type: RelationType;
  sourceCardinality: string | null;
  targetCardinality: string | null;
}

export interface CreateRelationRequest {
  sourceClassId: string;
  targetClassId: string;
  type: RelationType;
  sourceCardinality: string | null;
  targetCardinality: string | null;
}
