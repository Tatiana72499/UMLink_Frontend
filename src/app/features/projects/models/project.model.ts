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
