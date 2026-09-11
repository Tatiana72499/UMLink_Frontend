import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core';
import {
  CreateDiagramRequest,
  CreateAttributeRequest,
  AssociationClassResponse,
  CreateAssociationClassRequest,
  CreateRelationRequest,
  CreateUmlClassRequest,
  UpdateUmlClassRequest,
  UpdateRelationCardinalityRequest,
  UpdateRelationRequest,
  UpdateAttributeRequest,
  UpdateDiagramRequest,
  Diagram,
  DiagramImagePreview,
  DiagramActivity,
  DiagramDrawing,
  DiagramDetails,
  UmlClass,
  UmlAttribute,
  UmlOperation,
  CreateUmlOperationRequest,
  UpdateUmlOperationRequest,
  UmlRelation,
  InterchangeFormat,
} from '../models/diagram.model';

@Injectable({ providedIn: 'root' })
export class DiagramApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  findByProject(projectId: string): Observable<Diagram[]> {
    return this.http.get<Diagram[]>(`${this.apiUrl}/projects/${projectId}/diagrams`);
  }

  create(projectId: string, request: CreateDiagramRequest): Observable<Diagram> {
    return this.http.post<Diagram>(`${this.apiUrl}/projects/${projectId}/diagrams`, request);
  }

  update(diagramId: string, request: UpdateDiagramRequest): Observable<Diagram> {
    return this.http.put<Diagram>(`${this.apiUrl}/diagrams/${diagramId}`, request);
  }

  delete(diagramId: string, version: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/diagrams/${diagramId}`, { params: { version } });
  }

  findDetails(diagramId: string): Observable<DiagramDetails> {
    return this.http.get<DiagramDetails>(`${this.apiUrl}/diagrams/${diagramId}`);
  }

  export(diagramId: string, format: InterchangeFormat): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/diagrams/${diagramId}/export`, {
      params: { format },
      responseType: 'blob',
    });
  }

  generateBackend(diagramId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/diagrams/${diagramId}/generate/backend`, {
      responseType: 'blob',
    });
  }

  import(projectId: string, file: File): Observable<Diagram> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<Diagram>(`${this.apiUrl}/projects/${projectId}/diagrams/import`, body);
  }

  previewImage(projectId: string, file: File): Observable<DiagramImagePreview> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<DiagramImagePreview>(`${this.apiUrl}/projects/${projectId}/diagrams/ai/image-preview`, body);
  }

  findActivity(diagramId: string): Observable<DiagramActivity[]> {
    return this.http.get<DiagramActivity[]>(`${this.apiUrl}/diagrams/${diagramId}/activity`);
  }

  createDrawing(diagramId: string, svgPath: string): Observable<DiagramDrawing> {
    return this.http.post<DiagramDrawing>(`${this.apiUrl}/diagrams/${diagramId}/drawings`, { svgPath });
  }

  deleteDrawing(diagramId: string, drawingId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/diagrams/${diagramId}/drawings/${drawingId}`);
  }

  clearDrawings(diagramId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/diagrams/${diagramId}/drawings`);
  }

  createClass(diagramId: string, request: CreateUmlClassRequest): Observable<UmlClass> {
    return this.http.post<UmlClass>(`${this.apiUrl}/diagrams/${diagramId}/classes`, request);
  }

  updateClass(classId: string, request: UpdateUmlClassRequest): Observable<UmlClass> {
    return this.http.put<UmlClass>(`${this.apiUrl}/classes/${classId}`, request);
  }

  createAttribute(classId: string, request: CreateAttributeRequest): Observable<UmlAttribute> {
    return this.http.post<UmlAttribute>(`${this.apiUrl}/classes/${classId}/attributes`, request);
  }

  updateAttribute(attributeId: string, request: UpdateAttributeRequest): Observable<UmlAttribute> {
    return this.http.put<UmlAttribute>(`${this.apiUrl}/attributes/${attributeId}`, request);
  }

  deleteAttribute(attributeId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/attributes/${attributeId}`);
  }

  createOperation(classId: string, request: CreateUmlOperationRequest): Observable<UmlOperation> {
    return this.http.post<UmlOperation>(`${this.apiUrl}/classes/${classId}/operations`, request);
  }

  updateOperation(operationId: string, request: UpdateUmlOperationRequest): Observable<UmlOperation> {
    return this.http.put<UmlOperation>(`${this.apiUrl}/operations/${operationId}`, request);
  }

  deleteOperation(operationId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/operations/${operationId}`);
  }

  createRelation(diagramId: string, request: CreateRelationRequest): Observable<UmlRelation> {
    return this.http.post<UmlRelation>(`${this.apiUrl}/diagrams/${diagramId}/relations`, request);
  }

  createAssociationClass(
    diagramId: string,
    request: CreateAssociationClassRequest,
  ): Observable<AssociationClassResponse> {
    return this.http.post<AssociationClassResponse>(`${this.apiUrl}/diagrams/${diagramId}/association-classes`, request);
  }

  updateRelationCardinality(
    relationId: string,
    request: UpdateRelationCardinalityRequest,
  ): Observable<UmlRelation> {
    return this.http.put<UmlRelation>(`${this.apiUrl}/relations/${relationId}/cardinality`, request);
  }

  updateRelation(relationId: string, request: UpdateRelationRequest): Observable<UmlRelation> {
    return this.http.put<UmlRelation>(`${this.apiUrl}/relations/${relationId}`, request);
  }

  deleteRelation(relationId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/relations/${relationId}`);
  }

  deleteClass(classId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/classes/${classId}`);
  }
}
