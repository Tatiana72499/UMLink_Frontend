import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';

export const authGuard: CanActivateFn = () => {
  const session = inject(AuthSessionService);
  return session.isAuthenticated() ? true : inject(Router).createUrlTree(['/auth/login']);
};
