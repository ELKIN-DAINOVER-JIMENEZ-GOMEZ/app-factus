import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthServices } from '../../services/auth-services';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthServices);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // Guardar URL intentada para redirigir después
  router.navigate(['/login'], { 
    queryParams: { returnUrl: state.url }
  });
  return false;
};