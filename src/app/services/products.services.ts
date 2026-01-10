import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';

export interface Product {
  id?: string;
  documentId?: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo: 'producto' | 'servicio';
  precio_unitario: number;
  unidad_medida: 'UND' | 'KG' | 'LB' | 'MT' | 'M2' | 'M3' | 'LT' | 'GL' | 'HR' | 'DIA';
  unidad_medida_id: number;
  codigo_unspsc?: string;
  codigo_estandar_id: number;
  iva_porcentaje: number;
  aplica_iva: boolean;
  ico_porcentaje: number;
  aplica_ico: boolean;
  ica_porcentaje: number;
  aplica_ica: boolean;
  retenciones?: any[];
  esquema_id: string;
  tributo_id: number;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
}

export interface ProductResponse {
  data: Product;
  meta?: any;
}

export interface ProductListResponse {
  data: Product[];
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
export class ProductService {
  private readonly apiUrl = environment.apiUrl || 'http://localhost:1337';
  
  private productsUpdated = new BehaviorSubject<boolean>(false);
  public productsUpdated$ = this.productsUpdated.asObservable();

  readonly TIPOS_PRODUCTO = [
    { value: 'producto', label: 'Producto' },
    { value: 'servicio', label: 'Servicio' }
  ];

  readonly UNIDADES_MEDIDA = [
    { value: 'UND', label: 'Unidad (UND)', id: 70 },
    { value: 'KG', label: 'Kilogramo (KG)', id: 28 },
    { value: 'LB', label: 'Libra (LB)', id: 14 },
    { value: 'MT', label: 'Metro (MT)', id: 59 },
    { value: 'M2', label: 'Metro Cuadrado (M2)', id: 26 },
    { value: 'M3', label: 'Metro Cúbico (M3)', id: 11 },
    { value: 'LT', label: 'Litro (LT)', id: 94 },
    { value: 'GL', label: 'Galón (GL)', id: 21 },
    { value: 'HR', label: 'Hora (HR)', id: 57 },
    { value: 'DIA', label: 'Día (DIA)', id: 404 }
  ];

  readonly PORCENTAJES_IVA = [
    { value: 0, label: '0% - Excluido' },
    { value: 5, label: '5%' },
    { value: 19, label: '19% - Tarifa general' }
  ];

  constructor(private http: HttpClient) {}

  getProducts(params?: {
    page?: number;
    pageSize?: number;
    sort?: string;
    filters?: any;
    search?: string;
  }): Observable<ProductListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('pagination[page]', params.page.toString());
    if (params?.pageSize) queryParams.append('pagination[pageSize]', params.pageSize.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    
    if (params?.search) {
      queryParams.append('filters[$or][0][nombre][$containsi]', params.search);
      queryParams.append('filters[$or][1][codigo][$containsi]', params.search);
      queryParams.append('filters[$or][2][descripcion][$containsi]', params.search);
    }

    if (params?.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        queryParams.append(`filters[${key}][$eq]`, String(value));
      });
    }

    return this.http.get<ProductListResponse>(
      `${this.apiUrl}/api/products?${queryParams.toString()}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  getProduct(id: string): Observable<ProductResponse> {
    return this.http.get<ProductResponse>(
      `${this.apiUrl}/api/products/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  createProduct(product: Product): Observable<ProductResponse> {
    const payload = {
      data: {
        ...product,
        activo: true,
        publishedAt: new Date().toISOString()
      }
    };

    return this.http.post<ProductResponse>(
      `${this.apiUrl}/api/products`,
      payload,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => this.productsUpdated.next(true)),
      catchError(this.handleError)
    );
  }

  updateProduct(id: string, product: Partial<Product>): Observable<ProductResponse> {
    const payload = { data: product };

    return this.http.put<ProductResponse>(
      `${this.apiUrl}/api/products/${id}`,
      payload,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => this.productsUpdated.next(true)),
      catchError(this.handleError)
    );
  }

  deleteProduct(id: string): Observable<any> {
    return this.deleteProductPermanently(id);
  }

  deleteProductPermanently(id: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/api/products/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => this.productsUpdated.next(true)),
      catchError(this.handleError)
    );
  }

  searchProducts(query: string): Observable<Product[]> {
    return this.getProducts({
      search: query,
      pageSize: 20
    }).pipe(
      map(response => response.data)
    );
  }

  getLowStockProducts(): Observable<Product[]> {
    return this.http.get<ProductListResponse>(
      `${this.apiUrl}/api/products?` +
      `filters[$where][stock_actual][$lte]=$[stock_minimo]` +
      `&filters[activo][$eq]=true` +
      `&sort=stock_actual:asc`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  checkCodeExists(codigo: string, excludeId?: string): Observable<boolean> {
    const queryParams = new URLSearchParams();
    queryParams.append('filters[codigo][$eq]', codigo);
    
    if (excludeId) {
      queryParams.append('filters[id][$ne]', excludeId);
    }

    return this.http.get<ProductListResponse>(
      `${this.apiUrl}/api/products?${queryParams.toString()}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => response.data.length > 0),
      catchError(() => throwError(() => new Error('Error verificando código')))
    );
  }

  updateStock(id: string, quantity: number, operation: 'add' | 'subtract' | 'set'): Observable<ProductResponse> {
    return this.getProduct(id).pipe(
      switchMap((response: ProductResponse) => {
        const currentStock = response.data.stock_actual || 0;
        let newStock: number;

        switch (operation) {
          case 'add':
            newStock = currentStock + quantity;
            break;
          case 'subtract':
            newStock = Math.max(0, currentStock - quantity);
            break;
          case 'set':
            newStock = quantity;
            break;
        }

        return this.updateProduct(id, { stock_actual: newStock });
      }),
      catchError(this.handleError)
    );
  }

  getProductStats(): Observable<{
    total: number;
    activos: number;
    productos: number;
    servicios: number;
    stockBajo: number;
  }> {
    return this.getProducts({ pageSize: 1000 }).pipe(
      map(response => {
        const products = response.data;
        return {
          total: products.length,
          activos: products.filter(p => p.activo).length,
          productos: products.filter(p => p.tipo === 'producto').length,
          servicios: products.filter(p => p.tipo === 'servicio').length,
          stockBajo: products.filter(p => 
            p.tipo === 'producto' && 
            p.stock_actual <= p.stock_minimo
          ).length
        };
      }),
      catchError(this.handleError)
    );
  }

  calculatePriceWithTax(price: number, ivaPercent: number, icoPercent: number = 0): {
    base: number;
    iva: number;
    ico: number;
    total: number;
  } {
    const base = price;
    const iva = (base * ivaPercent) / 100;
    const ico = (base * icoPercent) / 100;
    const total = base + iva + ico;

    return {
      base: this.round(base),
      iva: this.round(iva),
      ico: this.round(ico),
      total: this.round(total)
    };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
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

    return throwError(() => new Error(errorMessage));
  }
}