import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';

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
  private readonly apiUrl = environment.apiUrl;
  
  private clientsUpdatedSource = new Subject<boolean>();
  clientsUpdated$ = this.clientsUpdatedSource.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

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

  createInvoiceComplete(invoice: Invoice): Observable<{ 
    invoice: Invoice; 
    items: InvoiceItem[] 
  }> {
    const invoicePayload = this.prepareInvoicePayload(invoice);

    return this.http.post<SingleResponse<Invoice>>(
      `${this.apiUrl}/api/invoices`,
      { data: invoicePayload },
      { headers: this.getHeaders() }
    ).pipe(
      switchMap(invoiceResponse => {
        const invoiceId = invoiceResponse.data.id!;
        const itemsToCreate = invoice.invoice_items || [];

        if (itemsToCreate.length === 0) {
          return of({ 
            invoice: invoiceResponse.data, 
            items: [] as InvoiceItem[] 
          });
        }

        const itemCreationObservables = itemsToCreate.map((item, index) => 
          this.createSingleItem(invoiceId, item, index)
        );

        return forkJoin(itemCreationObservables).pipe(
          map(createdItems => ({
            invoice: invoiceResponse.data,
            items: createdItems
          }))
        );
      }),
      catchError(error => {
        throw error;
      })
    );
  }

  private createSingleItem(
    invoiceId: number, 
    item: InvoiceItem, 
    index: number
  ): Observable<InvoiceItem> {
    const itemPayload = {
      ...item,
      invoice: invoiceId,
      product: typeof item.product === 'object' ? (item.product as any).id : item.product,
      orden: index + 1
    };

    Object.keys(itemPayload).forEach(key => {
      if ((itemPayload as any)[key] === undefined) {
        delete (itemPayload as any)[key];
      }
    });

    return this.http.post<SingleResponse<InvoiceItem>>(
      `${this.apiUrl}/api/invoice-items`,
      { data: itemPayload },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(error => {
        throw error;
      })
    );
  }

  private prepareInvoicePayload(invoice: Invoice): any {
    const { invoice_items, ...invoiceData } = invoice;

    if (!invoiceData.numero_factura) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      invoiceData.numero_factura = `FV-${timestamp}-${random}`;
    }

    if (typeof invoiceData.client === 'object' && invoiceData.client !== null) {
      invoiceData.client = (invoiceData.client as any).id;
    }

    if (invoiceData.numering_range && typeof invoiceData.numering_range === 'object') {
      invoiceData.numering_range = (invoiceData.numering_range as any).id;
    }

    if (invoiceData.fecha_emision instanceof Date) {
      invoiceData.fecha_emision = invoiceData.fecha_emision.toISOString();
    } else if (typeof invoiceData.fecha_emision === 'string' && !invoiceData.fecha_emision.includes('T')) {
      invoiceData.fecha_emision = new Date(invoiceData.fecha_emision + 'T12:00:00.000Z').toISOString();
    }

    if (invoiceData.fecha_vencimiento) {
      if (invoiceData.fecha_vencimiento instanceof Date) {
        invoiceData.fecha_vencimiento = invoiceData.fecha_vencimiento.toISOString();
      } else if (typeof invoiceData.fecha_vencimiento === 'string' && !invoiceData.fecha_vencimiento.includes('T')) {
        invoiceData.fecha_vencimiento = new Date(invoiceData.fecha_vencimiento + 'T12:00:00.000Z').toISOString();
      }
    }

    Object.keys(invoiceData).forEach(key => {
      if ((invoiceData as any)[key] === undefined) {
        delete (invoiceData as any)[key];
      }
    });

    return invoiceData;
  }

  getInvoices(params?: {
    page?: number;
    pageSize?: number;
    estado?: string;
  }): Observable<PaginatedResponse<Invoice>> {
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
      { headers: this.getHeaders() }
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

  deleteInvoice(id: number | string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/api/invoices/${id}`,
      { headers: this.getHeaders() }
    );
  }

  emitInvoice(invoiceId: number): Observable<EmissionResponse> {
    return this.http.post<EmissionResponse>(
      `${this.apiUrl}/api/factus/emit-invoice`,
      { invoiceId },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  downloadPDF(documentId: string | number): Observable<{ success: boolean; data?: string; error?: string }> {
    return this.http.get<{ success: boolean; data?: string; error?: string }>(
      `${this.apiUrl}/api/factus/download-pdf/${documentId}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  downloadPDFAsBlob(documentId: string | number): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/api/factus/download-pdf/${documentId}?returnBlob=true`,
      { 
        headers: this.getHeaders(),
        responseType: 'blob'
      }
    ).pipe(
      switchMap((response: any) => {
        if (response instanceof Blob && response.type === 'application/json') {
          return new Observable<Blob>(observer => {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const json = JSON.parse(reader.result as string);
                if (json.redirect && json.url) {
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
      catchError(error => {
        throw error;
      })
    );
  }

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

  notifyClientsUpdated(): void {
    this.clientsUpdatedSource.next(true);
  }

  getInvoicesWithoutClient(): Observable<{
    data: {
      invoicesWithoutClient: Array<{
        id: number;
        numero_factura: string;
        fecha_emision: string;
        total: number;
      }>;
      totalWithoutClient: number;
      availableClients: Array<{
        id: number;
        nombre_completo: string;
        numero_documento: string;
      }>;
    };
  }> {
    return this.http.get<any>(
      `${this.apiUrl}/api/invoices/without-client`,
      { headers: this.getHeaders() }
    );
  }

  assignClientToInvoice(invoiceId: number, clientId: number): Observable<{
    data: Invoice;
    message: string;
  }> {
    return this.http.post<any>(
      `${this.apiUrl}/api/invoices/assign-client`,
      { invoiceId, clientId },
      { headers: this.getHeaders() }
    );
  }
}