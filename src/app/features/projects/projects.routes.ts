import { Routes } from '@angular/router';
import { ProjectListPage } from './pages/project-list-page';
import { ProjectDetailPage } from './pages/project-detail-page';

export const PROJECT_ROUTES: Routes = [
  { path: '', component: ProjectListPage },
  { path: ':projectId', component: ProjectDetailPage },
];
