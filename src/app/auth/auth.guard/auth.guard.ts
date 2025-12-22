import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthServices } from '../../auth-services';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthServices);
  const router = inject(Router);

  console.log('🔐 Auth Guard - Verificando acceso...');

  if (authService.isLoggedIn()) {
    console.log('✅ Usuario autenticado');
    return true;
  }

  console.warn('⚠️ Usuario no autenticado, redirigiendo a login');
  
  // Guardar URL intentada para redirigir después del login
  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url }
  });
  
  return false;
};