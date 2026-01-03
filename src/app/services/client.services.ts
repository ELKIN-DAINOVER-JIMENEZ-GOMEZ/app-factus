/**
 * Servicio de Clientes para Angular (Simplificado)
 * Ubicación: src/app/services/client.service.ts
 * 
 * ✅ Ya no necesita agregar headers manualmente
 * ✅ El interceptor lo hace automáticamente
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Interfaces (mantener las mismas)
export interface Client {
  id?:string;
  nombre_completo: string;
  tipo_documento: 'CC' | 'NIT' | 'CE' | 'TI' | 'PP' | 'PEP';
  numero_documento: string;
  digito_verificacion?: string;
  razon_social?: string;
  nombre_comercial?: string;
  email: string;
  telefono?: string;
  direccion: string;
  ciudad: string;
  ciudad_codigo: string;
  departamento?: string;
  codigo_postal?: string;
  tipo_persona: 'Natural' | 'Juridica';
  regimen_fiscal: 'responsable_iva' | 'no_responsable_iva' | 'gran_contribuyente' | 'simple';
  responsabilidades_fiscales?: any[];
  activo: boolean;
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface ClientResponse {
  data: Client;
  meta?: any;
}

export interface ClientListResponse {
  data: Client[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private apiUrl = environment.apiUrl || 'http://localhost:1337';
  
  private clientsUpdated = new BehaviorSubject<boolean>(false);
  public clientsUpdated$ = this.clientsUpdated.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * 📋 Listar clientes
   * ✅ Ya no necesita headers - el interceptor los agrega
   */
  getClients(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: string;
    activo?: boolean;
  }): Observable<ClientListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('pagination[page]', params.page.toString());
    if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    
    if (params?.search) {
      queryParams.append('filters[$or][0][nombre_completo][$containsi]', params.search);
      queryParams.append('filters[$or][1][numero_documento][$containsi]', params.search);
      queryParams.append('filters[$or][2][email][$containsi]', params.search);
    }
    
    if (params?.activo !== undefined) {
      queryParams.append('filters[activo][$eq]', params.activo.toString());
    }

    const url = `${this.apiUrl}/api/clients?${queryParams.toString()}`;
    console.log('📤 GET:', url);

    // ✅ Sin headers - el interceptor los agrega automáticamente
    return this.http.get<ClientListResponse>(url).pipe(
      tap(response => {
        console.log('✅ Clientes obtenidos:', response.data.length);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * 🔍 Obtener cliente por ID
   */
  getClient(id: string): Observable<ClientResponse> {
    return this.http.get<ClientResponse>(
      `${this.apiUrl}/api/clients/${id}`
    ).pipe(
      tap(() => console.log(`✅ Cliente ${id} obtenido`)),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * ➕ Crear cliente
   */
  createClient(client: Client): Observable<ClientResponse> {
    console.log('📝 Creando cliente...', client);

    const payload = {
      data: {
        ...client,
        activo: client.activo !== undefined ? client.activo : true,
        publishedAt: new Date().toISOString()
      }
    };

    return this.http.post<ClientResponse>(
      `${this.apiUrl}/api/clients`,
      payload
    ).pipe(
      tap((response) => {
        console.log('✅ Cliente creado:', response.data.id);
        this.clientsUpdated.next(true);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * ✏️ Actualizar cliente
   */
  updateClient(id: string, client: Partial<Client>): Observable<ClientResponse> {
    console.log(`✏️ Actualizando cliente ${id}...`);

    const payload = { data: client };

    return this.http.put<ClientResponse>(
      `${this.apiUrl}/api/clients/${id}`,
      payload
    ).pipe(
      tap(() => {
        console.log(`✅ Cliente ${id} actualizado`);
        this.clientsUpdated.next(true);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * 🗑️ Eliminar cliente (soft delete)
   */
  deleteClient(id: string): Observable<any> {
    return this.updateClient(id, { activo: false });
  }

  /**
   * ✅ Verificar si un documento ya existe
   */
  checkDocumentExists(numeroDocumento: string, excludeId?: string): Observable<boolean> {
    const queryParams = new URLSearchParams();
    queryParams.append('filters[numero_documento][$eq]', numeroDocumento);
    
    if (excludeId) {
      queryParams.append('filters[id][$ne]', excludeId.toString());
    }

    return this.http.get<ClientListResponse>(
      `${this.apiUrl}/api/clients?${queryParams.toString()}`
    ).pipe(
      map(response => response.data.length > 0),
      catchError(() => throwError(() => new Error('Error verificando documento')))
    );
  }

  /**
   * ✅ Verificar si un email ya existe
   */
  checkEmailExists(email: string, excludeId?: number): Observable<boolean> {
    const queryParams = new URLSearchParams();
    queryParams.append('filters[email][$eq]', email.toLowerCase());
    
    if (excludeId) {
      queryParams.append('filters[id][$ne]', excludeId.toString());
    }

    return this.http.get<ClientListResponse>(
      `${this.apiUrl}/api/clients?${queryParams.toString()}`
    ).pipe(
      map(response => response.data.length > 0),
      catchError(() => throwError(() => new Error('Error verificando email')))
    );
  }

  /**
   * 🔢 Calcular dígito de verificación para NIT
   */
  calculateDigitoVerificacion(nit: string): string {
    const nitClean = nit.replace(/\D/g, '');
    const primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    
    let sum = 0;
    for (let i = 0; i < nitClean.length && i < primos.length; i++) {
      sum += parseInt(nitClean[nitClean.length - 1 - i]) * primos[i];
    }
    
    const residuo = sum % 11;
    const dv = residuo > 1 ? 11 - residuo : residuo;
    
    return dv.toString();
  }

  /**
   * 🔔 Notificar actualización de clientes
   */
  notifyClientsUpdated(): void {
    this.clientsUpdated.next(true);
  }

  /**
   * ❌ Manejo de errores mejorado
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Error desconocido';

    console.error('❌ Error HTTP:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      error: error.error
    });

    if (error.error instanceof ErrorEvent) {
      // Error del cliente (red)
      errorMessage = `Error de red: ${error.error.message}`;
    } else {
      // Error del servidor
      if (error.status === 0) {
        errorMessage = '❌ No se pudo conectar con el servidor. Verifica que Strapi esté ejecutándose en http://localhost:1337';
      } else if (error.status === 403) {
        errorMessage = '🚫 Acceso denegado. Verifica los permisos en Strapi (Settings → Roles → Authenticated → Client)';
      } else if (error.status === 401) {
        errorMessage = '🔐 Token inválido o expirado. Por favor inicia sesión nuevamente.';
      } else if (error.error?.error?.message) {
        errorMessage = error.error.error.message;
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = `Error ${error.status}: ${error.statusText}`;
      }

      // Traducir mensajes comunes
      const translations: { [key: string]: string } = {
        'already taken': 'El documento o email ya está registrado',
        'Forbidden': 'No tienes permisos para realizar esta acción',
        'Unauthorized': 'Sesión expirada. Inicia sesión nuevamente.'
      };

      for (const [key, value] of Object.entries(translations)) {
        if (errorMessage.includes(key)) {
          errorMessage = value;
          break;
        }
      }
    }

    console.error('❌ Error procesado:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}