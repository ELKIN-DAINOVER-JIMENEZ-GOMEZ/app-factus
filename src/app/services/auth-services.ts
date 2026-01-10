import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../environments/environment';

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
  identifier: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthServices {
  private apiUrl = environment.apiUrl || 'http://localhost:1337';
  
  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/api/auth/local`,
      {
        identifier: credentials.identifier.trim(),
        password: credentials.password
      },
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => this.setSession(response)),
      catchError(error => throwError(() => this.handleError(error)))
    );
  }

  register(data: RegisterData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/api/auth/local/register`,
      {
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password
      },
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => this.setSession(response)),
      catchError(error => throwError(() => this.handleError(error)))
    );
  }

  logout(): void {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('current_user');
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  refreshUser(): Observable<User> {
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('No hay token disponible'));
    }

    return this.http.get<User>(
      `${this.apiUrl}/api/users/me`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(user => {
        this.currentUserSubject.next(user);
        localStorage.setItem('current_user', JSON.stringify(user));
      }),
      catchError(error => {
        if (error.status === 401 || error.status === 403) {
          this.logout();
        }
        return throwError(() => this.handleError(error));
      })
    );
  }

  checkToken(): void {
    const token = this.getToken();
    if (!token) return;

    this.refreshUser().subscribe({
      next: () => this.isAuthenticatedSubject.next(true),
      error: () => this.logout()
    });
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/auth/forgot-password`,
      { email: email.trim().toLowerCase() },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => this.handleError(error)))
    );
  }

  resetPassword(code: string, password: string, passwordConfirmation: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/auth/reset-password`,
      { code, password, passwordConfirmation },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => this.handleError(error)))
    );
  }

  private setSession(authResponse: AuthResponse): void {
    localStorage.setItem('jwt_token', authResponse.jwt);
    localStorage.setItem('current_user', JSON.stringify(authResponse.user));
    this.currentUserSubject.next(authResponse.user);
    this.isAuthenticatedSubject.next(true);
  }

  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  private hasToken(): boolean {
    return !!this.getToken();
  }

  private getUserFromStorage(): User | null {
    try {
      const userStr = localStorage.getItem('current_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return this.isAuthenticatedSubject.value && !!this.getToken();
  }

  hasRole(roleName: string): boolean {
    const user = this.getCurrentUser();
    if (!user?.role) return false;
    return user.role.name.toLowerCase() === roleName.toLowerCase() ||
           user.role.type.toLowerCase() === roleName.toLowerCase();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private handleError(error: HttpErrorResponse): Error {
    let message = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      message = `Error de red: ${error.error.message}`;
    } else if (error.error?.error) {
      message = error.error.error.message || error.error.error.name || 'Error del servidor';
    } else if (error.error?.message) {
      message = Array.isArray(error.error.message)
        ? error.error.message[0]?.messages?.[0]?.message || error.error.message[0]?.message || 'Error del servidor'
        : error.error.message;
    } else if (typeof error.error === 'string') {
      message = error.error;
    } else if (error.message) {
      message = error.message;
    }

    const translations: Record<string, string> = {
      'Invalid identifier or password': 'Email o contraseña incorrectos',
      'Your account email is not confirmed': 'Tu cuenta no ha sido confirmada. Revisa tu email.',
      'Your account has been blocked by an administrator': 'Tu cuenta ha sido bloqueada',
      'Email or Username are already taken': 'El email o usuario ya está registrado',
      'Email is already taken': 'El email ya está registrado',
      'Username already taken': 'El nombre de usuario ya está en uso',
      'email must be a valid email': 'El email no es válido',
      'password must be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
      'Unauthorized': 'No autorizado. Inicia sesión nuevamente.',
      'Forbidden': 'No tienes permisos para realizar esta acción',
      'Network Error': 'Error de conexión. Verifica tu internet.',
      'timeout': 'La petición tardó demasiado. Intenta nuevamente.'
    };

    return new Error(translations[message] || message);
  }

  testConnection(): Observable<boolean> {
    return this.http.get(`${this.apiUrl}/api/users/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(() => true),
      catchError(() => throwError(() => new Error('No se pudo conectar con el servidor')))
    );
  }
}
