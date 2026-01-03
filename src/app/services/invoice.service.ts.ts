/**
 * Servicio de Facturas para Angular
 * Ubicación: src/app/services/invoice.service.ts
 * 
 * Maneja todas las operaciones CRUD de facturas
 * y la comunicación con Strapi + Factus API
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ============================================
// INTERFACES
// ============================================

export interface Client {
  id: string;
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
}

export interface Product {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo: 'producto' | 'servicio';
  precio_unitario: number;
  unidad_medida: string;
  unidad_medida_id: number;
  codigo_unspsc?: string;
  codigo_estandar_id?: number;
  iva_porcentaje: number;
  aplica_iva: boolean;
  ico_porcentaje?: number;
  aplica_ico?: boolean;
  stock_actual?: number;
  activo: boolean;
}

export interface InvoiceItem {
  id?: string;
  codigo_producto: string;
  nombre_producto: string;
  descripcion?: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  descuento_valor: number;
  subtotal: number;
  iva_porcentaje: number;
  iva_valor: number;
  ico_porcentaje: number;
  ico_valor: number;
  total_item: number;
  orden: number;
  unidad_medida: string;
  unidad_medida_id: number;
  codigo_estandar?: string;
  codigo_estandar_id: number;
  esquema_id: string;
  es_excluido: boolean;
  tributo_id: number;
  product?: number; // ID del producto
}

export interface Invoice {
  id?: string;
  numero_factura?: string;
  prefijo?: string;
  consecutivo?: number;
  fecha_emision: Date | string;
  fecha_vencimiento?: Date | string;
  tipo_operacion: 'Venta' | 'Credito' | 'Contado' | 'Exportacion';
  forma_pago: 'Efectivo' | 'Credito' | 'Tarjeta' | 'Transferencia' | 'Cheque';
  medio_pago?: string;
  subtotal: number;
  total_iva: number;
  total_ico: number;
  total_descuentos: number;
  total: number;
  observaciones?: string;
  estado_local: 'Borrador' | 'Enviada' | 'Aceptada' | 'Rechazada' | 'Anulada';
  estado_dian?: string;
  factus_id?: string;
  factus_cude?: string;
  factus_qr?: string;
  url_pdf?: string;
  url_xml?: string;
  respuesta_factus?: any;
  errores_factus?: any;
  fecha_envio_dian?: Date | string;
  intentos_envio?: number;
  enviar_email?: boolean;
  client: number; // ID del cliente
  invoice_items?: InvoiceItem[];
}

export interface InvoiceResponse {
  data: Invoice;
  meta?: any;
}

export interface InvoiceListResponse {
  data: Invoice[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface EmissionResponse {
  success: boolean;
  message: string;
  data?: {
    id?: number;
    document_id?: string;
    status?: string;
    cufe?: string;
    cude?: string;
    qr_code?: string;
    pdf_url?: string;
    xml_url?: string;
  };
  error?: string;
  timestamp?: string;
}

// ============================================
// SERVICE
// ============================================

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private apiUrl = environment.apiUrl || 'http://localhost:1337';
  
  // Subject para actualizar lista de facturas
  private invoicesUpdated = new BehaviorSubject<boolean>(false);
  public invoicesUpdated$ = this.invoicesUpdated.asObservable();
  
  // Subject para actualizar lista de clientes (desde create-client)
  private clientsUpdatedSubject = new BehaviorSubject<boolean>(false);
  public clientsUpdated$ = this.clientsUpdatedSubject.asObservable();

  constructor(private http: HttpClient) {
    // Escuchar cambios del ClientService
    // Se conectará automáticamente cuando se use el ClientService
  }

  // ============================================
  // MÉTODOS CRUD DE FACTURAS
  // ============================================

  /**
   * 📋 Listar facturas con filtros y paginación
   */
  getInvoices(params?: {
    page?: number;
    pageSize?: number;
    sort?: string;
    filters?: any;
  }): Observable<InvoiceListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('pagination[page]', params.page.toString());
    if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    
    // Populate relations
    queryParams.append('populate[client]', 'true');
    queryParams.append('populate[invoice_items][populate][product]', 'true');

    return this.http.get<InvoiceListResponse>(
      `${this.apiUrl}/api/invoices?${queryParams.toString()}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => console.log('✅ Facturas obtenidas')),
      catchError(this.handleError)
    );
  }

  /**
   * 🔍 Obtener factura por ID
   */
  getInvoice(id: number): Observable<InvoiceResponse> {
    return this.http.get<InvoiceResponse>(
      `${this.apiUrl}/api/invoices/${id}?populate[client]=true&populate[invoice_items][populate][product]=true`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => console.log(`✅ Factura ${id} obtenida`)),
      catchError(this.handleError)
    );
  }

  /**
   * ➕ Crear factura (sin enviar a DIAN)
   */
  createInvoice(invoice: Invoice): Observable<InvoiceResponse> {
    console.log('📝 Creando factura...', invoice);

    const payload = {
      data: {
        ...invoice,
        estado_local: 'Borrador',
        publishedAt: new Date().toISOString()
      }
    };

    return this.http.post<InvoiceResponse>(
      `${this.apiUrl}/api/invoices`,
      payload,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap((response) => {
        console.log('✅ Factura creada:', response.data.id);
        this.invoicesUpdated.next(true);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✏️ Actualizar factura
   */
  updateInvoice(id: string, invoice: Partial<Invoice>): Observable<InvoiceResponse> {
    console.log(`✏️ Actualizando factura ${id}...`);

    const payload = {
      data: invoice
    };

    return this.http.put<InvoiceResponse>(
      `${this.apiUrl}/api/invoices/${id}`,
      payload,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        console.log(`✅ Factura ${id} actualizada`);
        this.invoicesUpdated.next(true);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * 🗑️ Eliminar factura
   */
  deleteInvoice(id: string): Observable<any> {
    console.log(`🗑️ Eliminando factura ${id}...`);

    return this.http.delete(
      `${this.apiUrl}/api/invoices/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        console.log(`✅ Factura ${id} eliminada`);
        this.invoicesUpdated.next(true);
      }),
      catchError(this.handleError)
    );
  }

  // ============================================
  // OPERACIONES CON FACTUS API
  // ============================================

  /**
   * 📤 Emitir factura a Factus/DIAN
   */
  emitInvoice(id: string): Observable<EmissionResponse> {
    console.log(`📤 Emitiendo factura ${id} a Factus...`);

    return this.http.post<EmissionResponse>(
      `${this.apiUrl}/api/factus/emit-invoice/${id}`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap((response) => {
        if (response.success) {
          console.log('✅ Factura emitida exitosamente');
          this.invoicesUpdated.next(true);
        } else {
          console.error('❌ Error emitiendo factura:', response.error);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * 📄 Descargar PDF de factura
   */
  downloadPDF(factusId: string): Observable<Blob> {
    console.log(`📄 Descargando PDF de factura ${factusId}...`);

    return this.http.get(
      `${this.apiUrl}/api/factus/download-pdf/${factusId}`,
      {
        headers: this.getAuthHeaders(),
        responseType: 'blob'
      }
    ).pipe(
      tap(() => console.log('✅ PDF descargado')),
      catchError(this.handleError)
    );
  }

  /**
   * 📄 Descargar XML de factura
   */
  downloadXML(factusId: string): Observable<Blob> {
    console.log(`📄 Descargando XML de factura ${factusId}...`);

    return this.http.get(
      `${this.apiUrl}/api/factus/download-xml/${factusId}`,
      {
        headers: this.getAuthHeaders(),
        responseType: 'blob'
      }
    ).pipe(
      tap(() => console.log('✅ XML descargado')),
      catchError(this.handleError)
    );
  }

  /**
   * 🔍 Consultar estado en Factus
   */
  getInvoiceStatus(factusId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/api/factus/invoice-status/${factusId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // ============================================
  // CLIENTES Y PRODUCTOS
  // ============================================

  /**
   * 👥 Listar clientes
   */
  getClients(params?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Observable<{ data: Client[]; meta?: any }> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('pagination[page]', params.page.toString());
    if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
    if (params?.search) {
      queryParams.append('filters[nombre_completo][$containsi]', params.search);
    }
    
    queryParams.append('filters[activo][$eq]', 'true');
    queryParams.append('sort', 'nombre_completo:asc');

    return this.http.get<{ data: Client[]; meta?: any }>(
      `${this.apiUrl}/api/clients?${queryParams.toString()}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * 📦 Listar productos
   */
  getProducts(params?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Observable<{ data: Product[]; meta?: any }> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('pagination[page]', params.page.toString());
    if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
    if (params?.search) {
      queryParams.append('filters[$or][0][nombre][$containsi]', params.search);
      queryParams.append('filters[$or][1][codigo][$containsi]', params.search);
    }
    
    queryParams.append('filters[activo][$eq]', 'true');
    queryParams.append('sort', 'nombre:asc');

    return this.http.get<{ data: Product[]; meta?: any }>(
      `${this.apiUrl}/api/products?${queryParams.toString()}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // ============================================
  // MÉTODOS AUXILIARES
  // ============================================

  /**
   * 🧮 Calcular totales de factura
   */
  calculateInvoiceTotals(items: InvoiceItem[]): {
    subtotal: number;
    total_iva: number;
    total_ico: number;
    total_descuentos: number;
    total: number;
  } {
    let subtotal = 0;
    let total_iva = 0;
    let total_ico = 0;
    let total_descuentos = 0;

    items.forEach(item => {
      subtotal += item.subtotal;
      total_iva += item.iva_valor;
      total_ico += item.ico_valor;
      total_descuentos += item.descuento_valor;
    });

    const total = subtotal + total_iva + total_ico - total_descuentos;

    return {
      subtotal: this.round(subtotal),
      total_iva: this.round(total_iva),
      total_ico: this.round(total_ico),
      total_descuentos: this.round(total_descuentos),
      total: this.round(total)
    };
  }

  /**
   * 🧮 Calcular totales de un item
   */
  calculateItemTotals(item: Partial<InvoiceItem>): InvoiceItem {
    const cantidad = item.cantidad || 0;
    const precio_unitario = item.precio_unitario || 0;
    const descuento_porcentaje = item.descuento_porcentaje || 0;
    const iva_porcentaje = item.iva_porcentaje || 0;
    const ico_porcentaje = item.ico_porcentaje || 0;

    // Subtotal = cantidad * precio
    const subtotal = cantidad * precio_unitario;

    // Descuento
    const descuento_valor = (subtotal * descuento_porcentaje) / 100;

    // Base para impuestos (después de descuento)
    const base_impuestos = subtotal - descuento_valor;

    // IVA
    const iva_valor = (base_impuestos * iva_porcentaje) / 100;

    // ICO (Impuesto al consumo)
    const ico_valor = (base_impuestos * ico_porcentaje) / 100;

    // Total del item
    const total_item = base_impuestos + iva_valor + ico_valor;

    return {
      ...item,
      cantidad,
      precio_unitario,
      descuento_porcentaje,
      descuento_valor: this.round(descuento_valor),
      subtotal: this.round(subtotal),
      iva_porcentaje,
      iva_valor: this.round(iva_valor),
      ico_porcentaje,
      ico_valor: this.round(ico_valor),
      total_item: this.round(total_item)
    } as InvoiceItem;
  }

  /**
   * 🔢 Redondear a 2 decimales
   */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * 🔐 Headers con autenticación
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * ❌ Manejo de errores
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      // Error del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del servidor
      if (error.error?.error?.message) {
        errorMessage = error.error.error.message;
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = `Error ${error.status}: ${error.statusText}`;
      }
    }

    console.error('❌ Error en InvoiceService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}