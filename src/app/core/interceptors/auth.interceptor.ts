import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthServices } from '../../auth-services';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthServices);
  const token = authService.getToken();

  // No agregar token a peticiones de login/register
  const skipAuth = req.url.includes('/auth/');

  if (token && !skipAuth) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req);
};