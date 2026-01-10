import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ProductService, Product } from '../../services/products.services';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './product-list.html',
  styleUrl: './product-list.css'
})
export class ProductListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  products: Product[] = [];
  stats: any = null;

  currentPage = 1;
  pageSize = 20;
  totalProducts = 0;
  totalPages = 0;

  searchTerm = '';
  filterType = '';
  filterStatus = '';

  loading = false;
  Math = Math;

  constructor(
    private productService: ProductService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadStats();
    this.productService.productsUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(updated => {
        if (updated) {
          this.loadProducts();
          this.loadStats();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProducts(): void {
    this.loading = true;
    const params: any = { page: this.currentPage, pageSize: this.pageSize, sort: 'nombre:asc' };

    if (this.searchTerm) params.search = this.searchTerm;

    const filters: any = {};
    if (this.filterType) filters.tipo = this.filterType;
    if (this.filterStatus) filters.activo = this.filterStatus === 'true';
    if (Object.keys(filters).length > 0) params.filters = filters;

    this.productService.getProducts(params).subscribe({
      next: (response) => {
        this.products = response.data;
        this.totalProducts = response.meta.pagination.total;
        this.totalPages = response.meta.pagination.pageCount;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  private loadStats(): void {
    this.productService.getProductStats().subscribe({
      next: (stats) => this.stats = stats,
      error: () => {}
    });
  }

  search(): void {
    this.currentPage = 1;
    this.loadProducts();
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadProducts();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterType = '';
    this.filterStatus = '';
    this.currentPage = 1;
    this.loadProducts();
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  createProduct(): void {
    this.router.navigate(['/products/create']);
  }

  editProduct(product: Product): void {
    const productId = (product as any).documentId || product.id;
    this.router.navigate(['/products/edit', productId]);
  }

  viewProduct(product: Product): void {
    const productId = (product as any).documentId || product.id;
    this.router.navigate(['/products', productId]);
  }

  deleteProduct(product: Product): void {
    if (!confirm(`¿Estás seguro de eliminar "${product.nombre}"?\n\nEsta acción eliminará el producto permanentemente.`)) return;

    const productId = (product as any).documentId || product.id;
    this.productService.deleteProduct(productId!).subscribe({
      next: () => {
        alert('Producto eliminado exitosamente');
        this.loadProducts();
        this.loadStats();
      },
      error: (error) => alert('Error eliminando producto: ' + (error.message || 'Intenta de nuevo'))
    });
  }

  toggleProductStatus(product: Product): void {
    const newStatus = !product.activo;
    const action = newStatus ? 'activar' : 'desactivar';
    
    if (!confirm(`¿Estás seguro de ${action} "${product.nombre}"?`)) return;

    this.productService.updateProduct(product.id!, { activo: newStatus }).subscribe({
      next: () => {
        this.loadProducts();
        this.loadStats();
      },
      error: (error) => alert(`Error ${action}ndo producto: ` + error.message)
    });
  }

  duplicateProduct(product: Product): void {
    if (!confirm(`¿Deseas crear una copia de "${product.nombre}"?`)) return;

    const newProduct: Product = {
      ...product,
      id: undefined,
      codigo: product.codigo + '-COPY',
      nombre: product.nombre + ' (Copia)',
      activo: false
    };

    this.productService.createProduct(newProduct).subscribe({
      next: (response) => {
        this.loadProducts();
        this.loadStats();
        this.editProduct(response.data);
      },
      error: (error) => alert('Error duplicando producto: ' + error.message)
    });
  }

  formatCurrency(value: number): string {
    // Formatear con separador de miles (punto) para Colombia
    return '$ ' + new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  getStockStatusClass(product: Product): string {
    if (product.tipo === 'servicio') return '';
    
    if (product.stock_actual === 0) {
      return 'text-red-600 font-bold';
    } else if (product.stock_actual <= product.stock_minimo) {
      return 'text-orange-600 font-semibold';
    }
    
    return 'text-gray-900';
  }

  getStockStatusText(product: Product): string {
    if (product.tipo === 'servicio') return '-';
    
    if (product.stock_actual === 0) {
      return 'Agotado';
    } else if (product.stock_actual <= product.stock_minimo) {
      return `⚠️ ${product.stock_actual}`;
    }
    
    return product.stock_actual.toString();
  }

  getTipoLabel(tipo: string): string {
    return tipo === 'producto' ? 'Producto' : 'Servicio';
  }

  getTipoClass(tipo: string): Record<string, boolean> {
    return {
      'bg-green-100 text-green-800': tipo === 'producto',
      'bg-blue-100 text-blue-800': tipo === 'servicio'
    };
  }

  getStatusLabel(activo: boolean): string {
    return activo ? 'Activo' : 'Inactivo';
  }

  getStatusClass(activo: boolean): Record<string, boolean> {
    return {
      'bg-green-100 text-green-800': activo,
      'bg-gray-100 text-gray-800': !activo
    };
  }

  exportToCSV(): void {
    // Generar CSV con todos los productos
    const headers = ['Código', 'Nombre', 'Tipo', 'Precio', 'Stock', 'IVA %', 'Estado'];
    const rows = this.products.map(p => [
      p.codigo,
      p.nombre,
      this.getTipoLabel(p.tipo),
      p.precio_unitario,
      p.tipo === 'producto' ? p.stock_actual : '-',
      p.iva_porcentaje,
      this.getStatusLabel(p.activo)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  printList(): void {
    window.print();
  }
}