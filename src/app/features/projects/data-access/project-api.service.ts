import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core';
import { AddProjectMemberRequest, CreateProjectRequest, Project, ProjectMember, ProjectRole, ProjectShareLink, UpdateProjectRequest } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  findAll(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiUrl}/projects`);
  }

  findById(projectId: string): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/projects/${projectId}`);
  }


  findSharedByToken(shareToken: string): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/shared/projects/${shareToken}`);
  }
  getShareLink(projectId: string): Observable<ProjectShareLink> {
    return this.http.get<ProjectShareLink>(`${this.apiUrl}/projects/${projectId}/share-link`);
  }
  create(request: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>(`${this.apiUrl}/projects`, request);
  }

  update(projectId: string, request: UpdateProjectRequest): Observable<Project> {
    return this.http.put<Project>(`${this.apiUrl}/projects/${projectId}`, request);
  }

  delete(projectId: string, version: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/projects/${projectId}`, { params: { version } });
  }
  findMembers(projectId: string): Observable<ProjectMember[]> { return this.http.get<ProjectMember[]>(`${this.apiUrl}/projects/${projectId}/members`); }
  addMember(projectId: string, request: AddProjectMemberRequest): Observable<ProjectMember> { return this.http.post<ProjectMember>(`${this.apiUrl}/projects/${projectId}/members`, request); }
  updateMember(projectId: string, memberId: string, role: Exclude<ProjectRole, 'OWNER'>): Observable<ProjectMember> { return this.http.put<ProjectMember>(`${this.apiUrl}/projects/${projectId}/members/${memberId}`, { role }); }
  removeMember(projectId: string, memberId: string): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/projects/${projectId}/members/${memberId}`); }
}
