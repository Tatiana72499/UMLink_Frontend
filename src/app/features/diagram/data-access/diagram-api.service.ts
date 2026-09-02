import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core';
import {
  CreateDiagramRequest,
  CreateAttributeRequest,
  CreateRelationRequest,
  CreateUmlClassRequest,
  UpdateUmlClassRequest,
  Diagram,
  DiagramDetails,
  UmlClass,
  UmlAttribute,
  UmlRelation,
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

  findDetails(diagramId: string): Observable<DiagramDetails> {
    return this.http.get<DiagramDetails>(`${this.apiUrl}/diagrams/${diagramId}`);
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

  createRelation(diagramId: string, request: CreateRelationRequest): Observable<UmlRelation> {
    return this.http.post<UmlRelation>(`${this.apiUrl}/diagrams/${diagramId}/relations`, request);
  }
}
