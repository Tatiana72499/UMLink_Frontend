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

export interface UpdateDiagramRequest extends CreateDiagramRequest {
  version: number;
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
  fillColor: string | null;
}
export interface UpdateUmlClassRequest {
  name: string;
  positionX: number;
  positionY: number;
  fillColor: string | null;
}
export interface UmlClass {
  id: string;
  diagramId: string;
  name: string;
  positionX: number;
  positionY: number;
  fillColor: string | null;
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

export type AttributeDataType =
  | 'STRING'
  | 'INTEGER'
  | 'LONG'
  | 'DOUBLE'
  | 'BOOLEAN'
  | 'UUID'
  | 'LOCAL_DATE'
  | 'LOCAL_DATE_TIME';

export interface CreateAttributeRequest {
  name: string;
  dataType: AttributeDataType;
  visibility: string;
}
export interface UpdateAttributeRequest extends CreateAttributeRequest {}
export interface UmlRelation {
  id: string;
  diagramId: string;
  sourceClassId: string;
  targetClassId: string;
  type: RelationType;
  label: string | null;
  sourceCardinality: string | null;
  targetCardinality: string | null;
  bendX?: number | null;
  bendY?: number | null;
  associationClassId?: string | null;
  alignmentPoints?: RelationAlignmentPoint[];
}

export interface RelationAlignmentPoint { x: number; y: number; }

export interface CreateRelationRequest {
  sourceClassId: string;
  targetClassId: string;
  type: RelationType;
  label: string | null;
  sourceCardinality: string | null;
  targetCardinality: string | null;
  bendX?: number | null;
  bendY?: number | null;
  associationClassId?: string | null;
  alignmentPoints?: RelationAlignmentPoint[];
}

export interface CreateAssociationClassRequest {
  sourceClassId: string;
  targetClassId: string;
  name: string;
  positionX: number;
  positionY: number;
  fillColor: string | null;
  label: string | null;
}

export interface AssociationClassResponse {
  umlClass: UmlClass;
  relation: UmlRelation;
}

export interface UpdateRelationCardinalityRequest {
  sourceCardinality: string;
  targetCardinality: string;
}
export interface UpdateRelationRequest extends CreateRelationRequest {}
