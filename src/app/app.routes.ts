import { Routes } from '@angular/router';
import { authGuard } from './core';
import { LandingPage } from './features/landing';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LandingPage },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((module) => module.AUTH_ROUTES),
  },
  {
    path: 'shared/projects/:shareToken',
    loadComponent: () =>
      import('./features/projects/pages/shared-project-page').then((module) => module.SharedProjectPage),
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
  { path: '**', redirectTo: '' },
];
