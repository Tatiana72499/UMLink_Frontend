export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerName: string;
  version: number;
  createdAt: string;
}
export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest extends CreateProjectRequest {
  version: number;
}

export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export interface ProjectMember { id: string; userId: string; name: string; email: string; role: ProjectRole; }
export interface AddProjectMemberRequest { email: string; role: Exclude<ProjectRole, 'OWNER'>; }
