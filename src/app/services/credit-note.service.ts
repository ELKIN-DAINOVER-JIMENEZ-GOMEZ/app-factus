import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../environments/environment';

export interface Client {
  id?: number;
  nombre_completo: string;
  razon_social?: string;
  numero_documento: string;
  email?: string;
}

export interface Invoice {
  id?: number;
  numero_factura?: string;
  factus_id?: string;
  total: number;
  fecha_emision?: string | Date;
  client?: Client;
  invoice_items?: {
    id?: number;
    codigo_producto?: string;
    nombre_producto?: string;
    descripcion?: string;
    cantidad: number;
    precio_unitario: number;
    descuento_porcentaje?: number;
    iva_porcentaje?: number;
    product?: number;
  }[];
}

export interface CreditNoteItem {
  id?: number;
  codigo_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje?: number;
  descuento_valor?: number;
  iva_porcentaje?: number;
  iva_valor?: number;
  ico_porcentaje?: number;
  ico_valor?: number;
  subtotal: number;
  total: number;
  product?: number;
  credit_note?: number;
}

export interface CreditNote {
  id?: number;
  numero_nota?: string;
  prefijo?: string;
  consecutivo?: number;
  fecha_emision: string | Date;
  motivo_correccion: string;
  concepto_correccion_id?: number;
  descripcion_correccion?: string;
  subtotal: number;
  total_iva?: number;
  total_ico?: number;
  total_descuentos?: number;
  total: number;
  estado_local?: string;
  estado_dian?: string;
  factus_id?: string;
  factus_bill_id?: number;
  public_url?: string;
  cude?: string;
  qr_code?: string;
  observaciones?: string;
  client?: Client | number;
  invoice?: Invoice | number;
  credit_note_items?: CreditNoteItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreditNoteStats {
  total: number;
  borradores: number;
  enviadas: number;
  errores: number;
  montoTotal: number;
}

export interface CreateCreditNoteRequest {
  invoiceId: number;
  motivo_correccion: string;
  concepto_correccion_id?: number;
  descripcion_correccion?: string;
  observaciones?: string;
  items: {
    codigo_producto: string;
    nombre_producto: string;
    cantidad: number;
    precio_unitario: number;
    descuento_porcentaje?: number;
    iva_porcentaje?: number;
    productId?: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class CreditNoteService {

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCreditNotes(page: number = 1, pageSize: number = 25, estado?: string): Observable<{
    data: CreditNote[];
    meta: {
      pagination: {
        page: number;
        pageSize: number;
        pageCount: number;
        total: number;
      };
    };
  }> {
    let url = `${this.apiUrl}/api/credit-notes/list?page=${page}&pageSize=${pageSize}`;
    if (estado) {
      url += `&estado=${estado}`;
    }

    return this.http.get<any>(url).pipe(
      catchError(() => of({
        data: [],
        meta: {
          pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 }
        }
      }))
    );
  }

  getCreditNoteById(id: number): Observable<CreditNote | null> {
    return this.http.get<any>(`${this.apiUrl}/api/credit-notes/detail/${id}`).pipe(
      map(response => response.data),
      catchError(() => of(null))
    );
  }

  createCreditNote(data: CreateCreditNoteRequest): Observable<{
    success: boolean;
    message: string;
    data?: CreditNote;
  }> {
    return this.http.post<any>(`${this.apiUrl}/api/credit-notes/create`, data).pipe(
      catchError(error => of({
        success: false,
        message: error.error?.message || 'Error al crear nota crédito'
      }))
    );
  }

  deleteCreditNote(id: number): Observable<{
    success: boolean;
    message: string;
  }> {
    return this.http.delete<any>(`${this.apiUrl}/api/credit-notes/${id}`).pipe(
      map(() => ({
        success: true,
        message: 'Nota crédito eliminada exitosamente'
      })),
      catchError(error => of({
        success: false,
        message: error.error?.message || 'Error al eliminar nota crédito'
      }))
    );
  }

  emitCreditNote(id: number): Observable<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    return this.http.post<any>(`${this.apiUrl}/api/credit-notes/${id}/emit`, {}).pipe(
      catchError(error => of({
        success: false,
        message: error.error?.message || error.error?.error || 'Error al emitir nota crédito'
      }))
    );
  }

  createAndEmitCreditNote(data: CreateCreditNoteRequest): Observable<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    return this.createCreditNote(data).pipe(
      tap(response => {
        if (response.success && response.data?.id) {
          // Nota crédito creada, lista para emitir
        }
      }),
      map(createResponse => {
        if (!createResponse.success || !createResponse.data?.id) {
          return createResponse;
        }
        return createResponse;
      }),
      catchError(error => of({
        success: false,
        message: error.message || 'Error al crear y emitir nota crédito'
      }))
    );
  }

  downloadPDF(id: number): Observable<{
    success: boolean;
    blob?: Blob;
    redirectUrl?: string;
    error?: string;
  }> {
    return this.http.get<any>(`${this.apiUrl}/api/credit-notes/${id}/download-pdf`, {
      observe: 'response',
      responseType: 'json' as 'json'
    }).pipe(
      map(response => {
        if (response.body?.redirectUrl) {
          return {
            success: true,
            redirectUrl: response.body.redirectUrl
          };
        }
        return {
          success: false,
          error: 'Formato de respuesta no reconocido'
        };
      }),
      catchError(error => of({
        success: false,
        error: error.error?.message || 'Error al descargar PDF'
      }))
    );
  }

  downloadPDFAsBlob(id: number): Observable<{
    success: boolean;
    blob?: Blob;
    redirectUrl?: string;
    error?: string;
  }> {
    return this.http.get(`${this.apiUrl}/api/credit-notes/${id}/download-pdf`, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      map(response => {
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('application/pdf')) {
          return {
            success: true,
            blob: response.body as Blob
          };
        }
        
        return {
          success: false,
          error: 'La respuesta no es un PDF'
        };
      }),
      catchError(error => {
        if (error.error instanceof Blob) {
          const reader = new FileReader();
          return new Observable<any>(observer => {
            reader.onload = () => {
              try {
                const json = JSON.parse(reader.result as string);
                if (json.redirectUrl) {
                  observer.next({
                    success: true,
                    redirectUrl: json.redirectUrl
                  });
                } else {
                  observer.next({
                    success: false,
                    error: json.message || 'Error desconocido'
                  });
                }
              } catch {
                observer.next({
                  success: false,
                  error: 'Error procesando respuesta'
                });
              }
              observer.complete();
            };
            reader.readAsText(error.error);
          });
        }

        return of({
          success: false,
          error: error.message || 'Error descargando PDF'
        });
      })
    );
  }

  getStats(): Observable<CreditNoteStats> {
    return this.http.get<any>(`${this.apiUrl}/api/credit-notes/stats`).pipe(
      map(response => response.data),
      catchError(() => of({
        total: 0,
        borradores: 0,
        enviadas: 0,
        errores: 0,
        montoTotal: 0
      }))
    );
  }

  getInvoicesForCreditNote(): Observable<Invoice[]> {
    return this.http.get<any>(`${this.apiUrl}/api/invoices/list?estado=Enviada&pageSize=100`).pipe(
      map(response => response.data || []),
      catchError(() => of([]))
    );
  }

  getCorrectionConcepts(): { id: number; name: string; description: string }[] {
    return [
      { 
        id: 1, 
        name: 'Devolución', 
        description: 'Devolución de parte de los bienes; no aceptación de partes del servicio' 
      },
      { 
        id: 2, 
        name: 'Anulación', 
        description: 'Anulación de factura electrónica' 
      },
      { 
        id: 3, 
        name: 'Rebaja/Descuento', 
        description: 'Rebaja o descuento parcial o total' 
      },
      { 
        id: 4, 
        name: 'Ajuste de precio', 
        description: 'Ajuste de precio' 
      },
      { 
        id: 5, 
        name: 'Otros', 
        description: 'Otros' 
      }
    ];
  }
}
