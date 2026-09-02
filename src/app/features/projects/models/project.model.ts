export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerName: string;
  createdAt: string;
}
export interface CreateProjectRequest {
  name: string;
  description?: string;
}
