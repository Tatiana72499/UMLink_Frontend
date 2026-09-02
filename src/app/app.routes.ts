import { Routes } from '@angular/router';
import { authGuard } from './core';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((module) => module.AUTH_ROUTES),
  },
  {
    path: 'projects/:projectId/diagrams/:diagramId',
    loadChildren: () =>
      import('./features/diagram/diagram.routes').then((module) => module.DIAGRAM_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'projects',
    loadChildren: () =>
      import('./features/projects/projects.routes').then((module) => module.PROJECT_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'diagram',
    loadChildren: () =>
      import('./features/diagram/diagram.routes').then((module) => module.DIAGRAM_ROUTES),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'projects' },
];
