import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AppMessageService } from '../services/app-message.service';

export const adminGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const messageService = inject(AppMessageService);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (authService.isAdmin()) {
    return true;
  }

  messageService.show('Access denied', 'error');
  return router.createUrlTree(['/projects']);
};
