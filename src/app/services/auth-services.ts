
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../environments/environment';


// INTERFACES

export interface User {
  id: number;
  username: string;
  email: string;
  blocked: boolean;
  confirmed: boolean;
  provider?: string;
  createdAt?: string;
  updatedAt?: string;
  role?: {
    id: number;
    name: string;
    description: string;
    type: string;
  };
}

export interface AuthResponse {
  jwt: string;
  user: User;
}

export interface LoginCredentials {
  identifier: string; // email o username
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface StrapiError {
  data: any;
  error: {
    status: number;
    name: string;
    message: string;
    details?: any;
  };
}

// ============================================
// SERVICE
// ============================================

@Injectable({
  providedIn: 'root'
})
export class AuthServices {
  // API URL base (Strapi)
  private apiUrl = environment.apiUrl || 'http://localhost:1337';
  
  // Subject para el usuario actual
  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Subject para el estado de autenticación
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Verificar token al iniciar (opcional, puede ser pesado)
    // this.checkToken();
  }

  // ============================================
  // MÉTODOS DE AUTENTICACIÓN
  // ============================================

  /**
   * 🔐 Login con Strapi
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    console.log('🔐 Intentando login con:', credentials.identifier);

    return this.http.post<AuthResponse>(
      `${this.apiUrl}/api/auth/local`,
      {
        identifier: credentials.identifier.trim(),
        password: credentials.password
      },
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }
    ).pipe(
      tap(response => {
        console.log('✅ Respuesta de Strapi:', response);
        this.setSession(response);
        console.log('✅ Login exitoso:', response.user.email);
      }),
      catchError(error => {
        console.error('❌ Error en login:', error);
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * 📝 Registro en Strapi
   */
  register(data: RegisterData): Observable<AuthResponse> {
    console.log('📝 Intentando registro con:', data.email);

    return this.http.post<AuthResponse>(
      `${this.apiUrl}/api/auth/local/register`,
      {
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password
      },
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }
    ).pipe(
      tap(response => {
        console.log('✅ Registro exitoso:', response.user.email);
        this.setSession(response);
      }),
      catchError(error => {
        console.error('❌ Error en registro:', error);
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * 🚪 Logout
   */
  logout(): void {
    console.log('🚪 Cerrando sesión...');
    
    // Limpiar localStorage
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('current_user');
    
    // Actualizar subjects
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    
    // Redirigir al login
    this.router.navigate(['/login']);
    
    console.log('👋 Sesión cerrada');
  }

  /**
   * 🔄 Refrescar información del usuario
   */
  refreshUser(): Observable<User> {
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('No hay token disponible'));
    }

    return this.http.get<User>(
      `${this.apiUrl}/api/users/me`,
      {
        headers: this.getAuthHeaders()
      }
    ).pipe(
      tap(user => {
        console.log('🔄 Usuario actualizado:', user);
        this.currentUserSubject.next(user);
        localStorage.setItem('current_user', JSON.stringify(user));
      }),
      catchError(error => {
        console.error('❌ Error refrescando usuario:', error);
        
        // Si el token es inválido, cerrar sesión
        if (error.status === 401 || error.status === 403) {
          console.warn('⚠️ Token inválido, cerrando sesión...');
          this.logout();
        }
        
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * 🔑 Verificar si el token es válido
   */
  checkToken(): void {
    const token = this.getToken();
    
    if (!token) {
      console.log(' No hay token almacenado');
      return;
    }

    console.log('🔍 Verificando token...');
    
    this.refreshUser().subscribe({
      next: () => {
        this.isAuthenticatedSubject.next(true);
        console.log('✅ Token válido');
      },
      error: () => {
        console.warn('⚠️ Token inválido o expirado');
        this.logout();
      }
    });
  }

  /**
   * 📧 Olvidé mi contraseña
   */
  forgotPassword(email: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/auth/forgot-password`,
      { email: email.trim().toLowerCase() },
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }
    ).pipe(
      tap(() => {
        console.log('📧 Email de recuperación enviado a:', email);
      }),
      catchError(error => {
        console.error('❌ Error enviando email:', error);
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * 🔄 Resetear contraseña
   */
  resetPassword(code: string, password: string, passwordConfirmation: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/auth/reset-password`,
      {
        code,
        password,
        passwordConfirmation
      },
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json'
        })
      }
    ).pipe(
      tap(() => {
        console.log('✅ Contraseña actualizada');
      }),
      catchError(error => {
        console.error('❌ Error actualizando contraseña:', error);
        return throwError(() => this.handleError(error));
      })
    );
  }

  // ============================================
  // MÉTODOS AUXILIARES
  // ============================================

  /**
   * 💾 Guardar sesión
   */
  private setSession(authResponse: AuthResponse): void {
    console.log('💾 Guardando sesión...');
    
    // Guardar en localStorage
    localStorage.setItem('jwt_token', authResponse.jwt);
    localStorage.setItem('current_user', JSON.stringify(authResponse.user));
    
    // Actualizar subjects
    this.currentUserSubject.next(authResponse.user);
    this.isAuthenticatedSubject.next(true);
    
    console.log('✅ Sesión guardada');
  }

  /**
   * 🎫 Obtener token
   */
  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  /**
   * ✅ Verificar si hay token
   */
  private hasToken(): boolean {
    return !!this.getToken();
  }

  /**
   * 👤 Obtener usuario del storage
   */
  private getUserFromStorage(): User | null {
    try {
      const userStr = localStorage.getItem('current_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('❌ Error parseando usuario del storage:', error);
      return null;
    }
  }

  /**
   * 👤 Obtener usuario actual
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * ✅ Verificar si está autenticado (síncrono)
   */
  isLoggedIn(): boolean {
    return this.isAuthenticatedSubject.value && !!this.getToken();
  }

  /**
   * 🔍 Verificar rol del usuario
   */
  hasRole(roleName: string): boolean {
    const user = this.getCurrentUser();
    if (!user?.role) return false;
    
    return user.role.name.toLowerCase() === roleName.toLowerCase() ||
           user.role.type.toLowerCase() === roleName.toLowerCase();
  }

  /**
   * 🔧 Headers con autorización
   */
  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * ❌ Manejo de errores mejorado para Strapi
   */
  private handleError(error: HttpErrorResponse): Error {
    console.log('🔍 Procesando error:', error);
    
    let message = 'Error desconocido';

    // Error de red o sin respuesta del servidor
    if (error.error instanceof ErrorEvent) {
      message = `Error de red: ${error.error.message}`;
      console.error('❌ Error de red:', error.error.message);
    } 
    // Error HTTP del servidor
    else if (error.error) {
      // Formato de error de Strapi v4
      if (error.error.error) {
        const strapiError = error.error.error;
        message = strapiError.message || strapiError.name || 'Error del servidor';
        
        // Detalles adicionales si existen
        if (strapiError.details) {
          console.error('📋 Detalles del error:', strapiError.details);
        }
      }
      // Formato alternativo
      else if (error.error.message) {
        if (Array.isArray(error.error.message)) {
          // Formato: { message: [{ messages: [{ message: "..." }] }] }
          message = error.error.message[0]?.messages?.[0]?.message || error.error.message[0]?.message || 'Error del servidor';
        } else {
          message = error.error.message;
        }
      }
      // Si es un string directo
      else if (typeof error.error === 'string') {
        message = error.error;
      }
    }
    // Error sin body
    else if (error.message) {
      message = error.message;
    }

    // Traducir mensajes comunes de Strapi al español
    const translations: { [key: string]: string } = {
      // Errores de login
      'Invalid identifier or password': 'Email o contraseña incorrectos',
      'Your account email is not confirmed': 'Tu cuenta no ha sido confirmada. Revisa tu email.',
      'Your account has been blocked by an administrator': 'Tu cuenta ha sido bloqueada',
      
      // Errores de registro
      'Email or Username are already taken': 'El email o usuario ya está registrado',
      'Email is already taken': 'El email ya está registrado',
      'Username already taken': 'El nombre de usuario ya está en uso',
      'email must be a valid email': 'El email no es válido',
      'password must be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
      
      // Errores de autenticación
      'Unauthorized': 'No autorizado. Inicia sesión nuevamente.',
      'Forbidden': 'No tienes permisos para realizar esta acción',
      
      // Errores de red
      'Network Error': 'Error de conexión. Verifica tu internet.',
      'timeout': 'La petición tardó demasiado. Intenta nuevamente.',
    };

    // Buscar traducción
    const translatedMessage = translations[message] || message;

    console.error('❌ Error final:', translatedMessage);

    return new Error(translatedMessage);
  }

  /**
   * 🧪 Test de conexión con Strapi
   */
  testConnection(): Observable<boolean> {
    return this.http.get(`${this.apiUrl}/api/users/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(() => true),
      catchError(() => {
        return throwError(() => new Error('No se pudo conectar con el servidor'));
      })
    );
  }
}
