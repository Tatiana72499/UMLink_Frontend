import { Routes } from '@angular/router';
import { AuthPage } from './pages/auth-page';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: AuthPage, data: { mode: 'login' } },
  { path: 'register', component: AuthPage, data: { mode: 'register' } },
];
