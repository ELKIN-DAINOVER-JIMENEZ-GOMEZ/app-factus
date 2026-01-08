/**
 * Servicio de Facturas - VERSIÓN TOTALMENTE CORREGIDA
 * Ubicación: src/app/services/invoice.service.ts
 * 
 * FIXES PRINCIPALES:
 * ✅ Creación de factura e items en flujo secuencial correcto
 * ✅ Manejo correcto de relaciones para Strapi v4
 * ✅ Mejor logging para debugging
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';

// ============================================
// INTERFACES
// ============================================

export interface Client {
  id?: number;
  nombre_completo: string;
  tipo_documento: string;
  numero_documento: string;
  digito_verificacion?: string;
  razon_social?: string;
  nombre_comercial?: string;
  email: string;
  telefono?: string;
  direccion: string;
  ciudad?: string;
  ciudad_codigo?: string;
  departamento?: string;
  codigo_postal?: string;
  tipo_persona?: 'Natural' | 'Juridica';
  regimen_fiscal?: string;
  activo?: boolean;
}

export interface Product {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo?: 'producto' | 'servicio';
  precio_unitario: number;
  unidad_medida?: string;
  unidad_medida_id?: number;
  codigo_unspsc?: string;
  iva_porcentaje?: number;
  aplica_iva?: boolean;
  ico_porcentaje?: number;
  aplica_ico?: boolean;
  stock_actual?: number;
  activo?: boolean;
}

export interface InvoiceItem {
  id?: number;
  product?: number;
  codigo_producto: string;
  nombre_producto: string;
  descripcion?: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje?: number;
  descuento_valor?: number;
  subtotal: number;
  iva_porcentaje?: number;
  iva_valor?: number;
  ico_porcentaje?: number;
  ico_valor?: number;
  total_item: number;
  orden?: number;
  unidad_medida?: string;
  unidad_medida_id?: number;
  codigo_estandar?: string;
  codigo_estandar_id?: number;
  esquema_id?: string;
  es_excluido?: boolean;
  tributo_id?: number;
  invoice?: number; // ⚠️ Para vincular al invoice
}

export interface Invoice {
  id?: number;
  numero_factura?: string;
  prefijo?: string;
  consecutivo?: number;
  fecha_emision: string | Date;
  fecha_vencimiento?: string | Date;
  tipo_operacion: string;
  forma_pago?: string;
  medio_pago?: string;
  subtotal: number;
  total_iva?: number;
  total_ico?: number;
  total_descuentos?: number;
  total: number;
  observaciones?: string;
  estado_local?: 'Borrador' | 'Enviada' | 'Aceptada' | 'Rechazada' | 'Anulada';
  estado_dian?: string;
  factus_id?: string;
  factus_cude?: string;
  factus_qr?: string;
  url_pdf?: string;
  url_xml?: string;
  enviar_email?: boolean;
  client?: number;
  invoice_items?: InvoiceItem[];
  numering_range?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface SingleResponse<T> {
  data: T;
  meta?: any;
}

export interface EmissionResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private apiUrl = environment.apiUrl;
  
  private clientsUpdatedSource = new Subject<boolean>();
  clientsUpdated$ = this.clientsUpdatedSource.asObservable();

  constructor(private http: HttpClient) {}

  // ============================================
  // HEADERS CON AUTENTICACIÓN
  // ============================================

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // ============================================
  // CLIENTES
  // ============================================

  getClients(params?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PaginatedResponse<Client>> {
    const queryParams: any = {
      'pagination[page]': params?.page || 1,
      'pagination[pageSize]': params?.pageSize || 25,
      'sort': 'nombre_completo:asc'
    };

    if (params?.search) {
      queryParams['filters[$or][0][nombre_completo][$containsi]'] = params.search;
      queryParams['filters[$or][1][numero_documento][$containsi]'] = params.search;
    }

    return this.http.get<PaginatedResponse<Client>>(
      `${this.apiUrl}/api/clients`,
      { 
        headers: this.getHeaders(),
        params: queryParams
      }
    );
  }

  // ============================================
  // PRODUCTOS
  // ============================================

  getProducts(params?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PaginatedResponse<Product>> {
    const queryParams: any = {
      'pagination[page]': params?.page || 1,
      'pagination[pageSize]': params?.pageSize || 100,
      'sort': 'nombre:asc'
    };

    if (params?.search) {
      queryParams['filters[$or][0][nombre][$containsi]'] = params.search;
      queryParams['filters[$or][1][codigo][$containsi]'] = params.search;
    }

    return this.http.get<PaginatedResponse<Product>>(
      `${this.apiUrl}/api/products`,
      { 
        headers: this.getHeaders(),
        params: queryParams
      }
    );
  }

  // ============================================
  // FACTURAS - MÉTODO PRINCIPAL CORREGIDO
  // ============================================

  /**
   * 🆕 MÉTODO CORRECTO: Crear factura con items en secuencia
   * Este es el ÚNICO método que debes usar desde el componente
   */
  createInvoiceComplete(invoice: Invoice): Observable<{ 
    invoice: Invoice; 
    items: InvoiceItem[] 
  }> {
    console.log('📦 [SERVICE] Iniciando creación completa de factura...');
    console.log('📋 Invoice data:', invoice);

    // PASO 1: Preparar payload de la factura (SIN items)
    const invoicePayload = this.prepareInvoicePayload(invoice);
    console.log('✅ Payload de factura preparado:', invoicePayload);

    // PASO 2: Crear la factura primero
    return this.http.post<SingleResponse<Invoice>>(
      `${this.apiUrl}/api/invoices`,
      { data: invoicePayload },
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        console.log('✅ [1/2] Factura creada con ID:', response.data.id);
      }),
      
      // PASO 3: Crear los items uno por uno
      switchMap(invoiceResponse => {
        const invoiceId = invoiceResponse.data.id!;
        const itemsToCreate = invoice.invoice_items || [];

        if (itemsToCreate.length === 0) {
          console.log('⚠️ No hay items para crear');
          return of({ 
            invoice: invoiceResponse.data, 
            items: [] as InvoiceItem[] 
          });
        }

        console.log(`📦 [2/2] Creando ${itemsToCreate.length} items...`);

        // Crear todos los items en paralelo
        const itemCreationObservables = itemsToCreate.map((item, index) => 
          this.createSingleItem(invoiceId, item, index)
        );

        return forkJoin(itemCreationObservables).pipe(
          map(createdItems => ({
            invoice: invoiceResponse.data,
            items: createdItems
          })),
          tap(result => {
            console.log(`✅ Factura completa creada:`, {
              invoiceId: result.invoice.id,
              itemsCount: result.items.length
            });
          })
        );
      }),

      catchError(error => {
        console.error('❌ Error en createInvoiceComplete:', error);
        throw error;
      })
    );
  }

  /**
   * 🔧 Crear un item individual
   */
  private createSingleItem(
    invoiceId: number, 
    item: InvoiceItem, 
    index: number
  ): Observable<InvoiceItem> {
    console.log(`  📦 Creando item ${index + 1}:`, item.nombre_producto);

    const itemPayload = {
      ...item,
      invoice: invoiceId, // ⚠️ CRÍTICO: Vincular al invoice
      product: typeof item.product === 'object' ? (item.product as any).id : item.product,
      orden: index + 1
    };

    // Limpiar campos undefined
    Object.keys(itemPayload).forEach(key => {
      if ((itemPayload as any)[key] === undefined) {
        delete (itemPayload as any)[key];
      }
    });

    console.log(`  📤 Payload del item ${index + 1}:`, itemPayload);

    return this.http.post<SingleResponse<InvoiceItem>>(
      `${this.apiUrl}/api/invoice-items`,
      { data: itemPayload },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data),
      tap(createdItem => {
        console.log(`  ✅ Item ${index + 1} creado con ID:`, createdItem.id);
      }),
      catchError(error => {
        console.error(`  ❌ Error creando item ${index + 1}:`, error);
        throw error;
      })
    );
  }

  /**
   * 🔧 Preparar payload de factura (sin items)
   */
  private prepareInvoicePayload(invoice: Invoice): any {
    const { invoice_items, ...invoiceData } = invoice;

    // 🆕 Generar número de factura único si no existe
    if (!invoiceData.numero_factura) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      invoiceData.numero_factura = `FV-${timestamp}-${random}`;
      console.log('🔢 Número de factura generado:', invoiceData.numero_factura);
    }

    // Asegurar que client sea solo el ID
    if (typeof invoiceData.client === 'object' && invoiceData.client !== null) {
      invoiceData.client = (invoiceData.client as any).id;
    }

    // Asegurar que numering_range sea solo el ID
    if (invoiceData.numering_range && typeof invoiceData.numering_range === 'object') {
      invoiceData.numering_range = (invoiceData.numering_range as any).id;
    }

    // Convertir fechas a ISO string SIN agregar 'T00:00:00.000Z'
    // Strapi puede manejar formatos de fecha simples
    if (invoiceData.fecha_emision instanceof Date) {
      invoiceData.fecha_emision = invoiceData.fecha_emision.toISOString();
    } else if (typeof invoiceData.fecha_emision === 'string' && !invoiceData.fecha_emision.includes('T')) {
      // Si es string sin hora, agregar la hora
      invoiceData.fecha_emision = new Date(invoiceData.fecha_emision + 'T12:00:00.000Z').toISOString();
    }

    if (invoiceData.fecha_vencimiento) {
      if (invoiceData.fecha_vencimiento instanceof Date) {
        invoiceData.fecha_vencimiento = invoiceData.fecha_vencimiento.toISOString();
      } else if (typeof invoiceData.fecha_vencimiento === 'string' && !invoiceData.fecha_vencimiento.includes('T')) {
        invoiceData.fecha_vencimiento = new Date(invoiceData.fecha_vencimiento + 'T12:00:00.000Z').toISOString();
      }
    }

    // Limpiar campos undefined
    Object.keys(invoiceData).forEach(key => {
      if ((invoiceData as any)[key] === undefined) {
        delete (invoiceData as any)[key];
      }
    });

    return invoiceData;
  }

  // ============================================
  // FACTURAS - OTRAS OPERACIONES
  // ============================================

  getInvoices(params?: {
    page?: number;
    pageSize?: number;
    estado?: string;
  }): Observable<PaginatedResponse<Invoice>> {
    // Usar la ruta personalizada que no requiere autenticación de Strapi
    const queryParams: any = {
      page: params?.page || 1,
      pageSize: params?.pageSize || 25,
    };

    if (params?.estado) {
      queryParams.estado = params.estado;
    }

    return this.http.get<PaginatedResponse<Invoice>>(
      `${this.apiUrl}/api/invoices/list`,
      { 
        headers: this.getHeaders(),
        params: queryParams
      }
    );
  }

  getInvoice(id: number): Observable<SingleResponse<Invoice>> {
    return this.http.get<SingleResponse<Invoice>>(
      `${this.apiUrl}/api/invoices/detail/${id}`,
      {
        headers: this.getHeaders()
      }
    );
  }

  updateInvoice(id: number, invoice: Partial<Invoice>): Observable<SingleResponse<Invoice>> {
    const payload = this.prepareInvoicePayload(invoice as Invoice);
    
    return this.http.put<SingleResponse<Invoice>>(
      `${this.apiUrl}/api/invoices/${id}`,
      { data: payload },
      { headers: this.getHeaders() }
    );
  }

  deleteInvoice(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/api/invoices/${id}`,
      { headers: this.getHeaders() }
    );
  }

  // ============================================
  // EMISIÓN A FACTUS
  // ============================================

  emitInvoice(invoiceId: number): Observable<EmissionResponse> {
    console.log(`🚀 [SERVICE] Emitiendo factura ${invoiceId} a Factus...`);

    return this.http.post<EmissionResponse>(
      `${this.apiUrl}/api/factus/emit-invoice`,
      { invoiceId },
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          console.log('✅ Factura emitida exitosamente');
        } else {
          console.error('❌ Error emitiendo factura:', response.error);
        }
      }),
      catchError(error => {
        console.error('❌ ERROR HTTP en emit-invoice:', error);
        throw error;
      })
    );
  }

  // ============================================
  // DESCARGAR PDF
  // ============================================

  /**
   * Descargar PDF de una factura emitida
   * @param documentId - ID del documento de Factus
   */
  downloadPDF(documentId: string | number): Observable<{ success: boolean; data?: string; error?: string }> {
    console.log(`📥 [SERVICE] Descargando PDF del documento ${documentId}...`);

    return this.http.get<{ success: boolean; data?: string; error?: string }>(
      `${this.apiUrl}/api/factus/download-pdf/${documentId}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          console.log('✅ PDF descargado exitosamente');
        } else {
          console.error('❌ Error descargando PDF:', response.error);
        }
      }),
      catchError(error => {
        console.error('❌ ERROR HTTP en download-pdf:', error);
        throw error;
      })
    );
  }

  /**
   * Descargar PDF como archivo (blob)
   * @param documentId - ID del documento de Factus
   */
  downloadPDFAsBlob(documentId: string | number): Observable<Blob> {
    console.log(`📥 [SERVICE] Descargando PDF como archivo del documento ${documentId}...`);

    return this.http.get(
      `${this.apiUrl}/api/factus/download-pdf/${documentId}?returnBlob=true`,
      { 
        headers: this.getHeaders(),
        responseType: 'blob'
      }
    ).pipe(
      switchMap((response: any) => {
        // Verificar si la respuesta es JSON con una URL de redirección
        if (response instanceof Blob && response.type === 'application/json') {
          // Convertir blob a texto para verificar si es una redirección
          return new Observable<Blob>(observer => {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const json = JSON.parse(reader.result as string);
                if (json.redirect && json.url) {
                  // Abrir la URL en una nueva pestaña
                  console.log('🔗 Redirigiendo a URL pública:', json.url);
                  window.open(json.url, '_blank');
                  observer.error({ message: 'redirect', url: json.url });
                } else {
                  observer.next(response);
                  observer.complete();
                }
              } catch {
                observer.next(response);
                observer.complete();
              }
            };
            reader.readAsText(response);
          });
        }
        return of(response);
      }),
      tap(() => {
        console.log('✅ Archivo PDF descargado exitosamente');
      }),
      catchError(error => {
        console.error('❌ ERROR HTTP en download-pdf-blob:', error);
        throw error;
      })
    );
  }

  // ============================================
  // CÁLCULOS
  // ============================================

  calculateItemTotals(item: InvoiceItem): {
    descuento_valor: number;
    subtotal: number;
    iva_valor: number;
    ico_valor: number;
    total_item: number;
  } {
    const cantidad = item.cantidad || 0;
    const precioUnitario = item.precio_unitario || 0;
    const descuentoPorcentaje = item.descuento_porcentaje || 0;
    const ivaPorcentaje = item.iva_porcentaje || 0;
    const icoPorcentaje = item.ico_porcentaje || 0;

    const precioBruto = cantidad * precioUnitario;
    const descuentoValor = (precioBruto * descuentoPorcentaje) / 100;
    const subtotal = precioBruto - descuentoValor;
    const ivaValor = !item.es_excluido ? (subtotal * ivaPorcentaje) / 100 : 0;
    const icoValor = (subtotal * icoPorcentaje) / 100;
    const totalItem = subtotal + ivaValor + icoValor;

    return {
      descuento_valor: Math.round(descuentoValor * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      iva_valor: Math.round(ivaValor * 100) / 100,
      ico_valor: Math.round(icoValor * 100) / 100,
      total_item: Math.round(totalItem * 100) / 100
    };
  }

  calculateInvoiceTotals(items: InvoiceItem[]): {
    subtotal: number;
    total_iva: number;
    total_ico: number;
    total_descuentos: number;
    total: number;
  } {
    let subtotal = 0;
    let totalIva = 0;
    let totalIco = 0;
    let totalDescuentos = 0;

    items.forEach(item => {
      subtotal += item.subtotal || 0;
      totalIva += item.iva_valor || 0;
      totalIco += item.ico_valor || 0;
      totalDescuentos += item.descuento_valor || 0;
    });

    const total = subtotal + totalIva + totalIco;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      total_iva: Math.round(totalIva * 100) / 100,
      total_ico: Math.round(totalIco * 100) / 100,
      total_descuentos: Math.round(totalDescuentos * 100) / 100,
      total: Math.round(total * 100) / 100
    };
  }

  // ============================================
  // NOTIFICACIONES
  // ============================================

  notifyClientsUpdated(): void {
    this.clientsUpdatedSource.next(true);
  }
}