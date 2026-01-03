/**
 * HTTP Interceptor para Autenticación
 * Ubicación: src/app/interceptors/auth.interceptor.ts
 * 
 * Agrega automáticamente el token JWT a todas las peticiones HTTP
 */

import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  
  constructor(private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // 🔍 Obtener token del localStorage
    const token = localStorage.getItem('jwt_token');
    
    // 📝 Log para debugging (eliminar en producción)
    if (token) {
      console.log('🔐 Token encontrado:', token.substring(0, 30) + '...');
    } else {
      console.warn('⚠️ No hay token JWT en localStorage');
    }

    // 🔐 Clonar la petición y agregar el token
    let clonedReq = req;
    
    if (token) {
      clonedReq = req.clone({
        setHeaders: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Token agregado a:', req.url);
    }

    // 🚀 Enviar la petición
    return next.handle(clonedReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // ❌ Si es error 401 o 403, redirigir al login
        if (error.status === 401 || error.status === 403) {
          console.error('🚫 Token inválido o expirado. Redirigiendo al login...');
          
          // Limpiar localStorage
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('current_user');
          
          // Redirigir al login
          this.router.navigate(['/login']);
        }
        
        return throwError(() => error);
      })
    );
  }
}