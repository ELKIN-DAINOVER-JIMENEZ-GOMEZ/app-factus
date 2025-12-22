import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthServices } from '../../auth-services';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthServices);
  const token = authService.getToken();

  // No agregar token a peticiones de auth
  const isAuthRequest = req.url.includes('/api/auth/');

  // Clonar request y agregar token si existe
  let authReq = req;
  
  if (token && !isAuthRequest) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Log para debugging (quitar en producción)
  console.log('🔄 HTTP Request:', {
    method: req.method,
    url: req.url,
    hasToken: !!token,
    isAuthRequest
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('❌ HTTP Error:', error);

      // Si es 401 en request no-auth, cerrar sesión
      if (error.status === 401 && !isAuthRequest) {
        console.warn('⚠️ Token inválido, cerrando sesión...');
        authService.logout();
      }

      return throwError(() => error);
    })
  );
};