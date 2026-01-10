import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InvoiceService } from '../../services/invoice.service.ts';

interface Invoice {
  id: number;
  documentId?: string;
  numero_factura?: string;
  factus_id?: string;
  fecha_emision: string;
  fecha_vencimiento?: string;
  estado_local: string;
  estado_dian?: string;
  subtotal: number;
  total_iva: number;
  total: number;
  client?: {
    id: number;
    nombre_completo: string;
    numero_documento: string;
    email: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './invoice-list.component.html',
})
export class InvoiceListComponent implements OnInit {
  invoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  Math = Math;

  loading = false;
  searchTerm = '';
  statusFilter = '';
  dateFrom = '';
  dateTo = '';

  currentPage = 1;
  pageSize = 10;
  totalItems = 0;

  stats = { total: 0, enviadas: 0, pendientes: 0, rechazadas: 0, totalMonto: 0 };

  constructor(
    private invoiceService: InvoiceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loading = true;
    this.invoiceService.getInvoices({
      page: this.currentPage,
      pageSize: this.pageSize,
      estado: this.statusFilter || undefined
    }).subscribe({
      next: (response: any) => {
        const rawData = response.data || [];
        this.invoices = rawData.map((item: any) => ({
          id: item.id,
          documentId: item.documentId,
          numero_factura: item.numero_factura,
          factus_id: item.factus_id,
          fecha_emision: item.fecha_emision,
          fecha_vencimiento: item.fecha_vencimiento,
          estado_local: item.estado_local,
          estado_dian: item.estado_dian,
          subtotal: item.subtotal || 0,
          total_iva: item.total_iva || 0,
          total: item.total || 0,
          client: item.client,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }));
        this.totalItems = response.meta?.pagination?.total || this.invoices.length;
        this.filteredInvoices = [...this.invoices];
        this.calculateStats();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.invoices = [];
        this.filteredInvoices = [];
      }
    });
  }

  private calculateStats(): void {
    this.stats = {
      total: this.invoices.length,
      enviadas: this.invoices.filter(i => i.estado_local === 'Enviada').length,
      pendientes: this.invoices.filter(i => i.estado_local === 'Pendiente' || i.estado_local === 'Borrador').length,
      rechazadas: this.invoices.filter(i => i.estado_local === 'Rechazada').length,
      totalMonto: this.invoices.reduce((sum, i) => sum + (i.total || 0), 0)
    };
  }

  applyFilters(): void {
    this.filteredInvoices = this.invoices.filter(invoice => {
      // Filtro por búsqueda
      const matchesSearch = !this.searchTerm || 
        invoice.numero_factura?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        invoice.factus_id?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        invoice.client?.nombre_completo?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        invoice.client?.numero_documento?.includes(this.searchTerm);
      
      // Filtro por estado
      const matchesStatus = !this.statusFilter || invoice.estado_local === this.statusFilter;
      
      // Filtro por fecha
      let matchesDate = true;
      if (this.dateFrom) {
        matchesDate = matchesDate && new Date(invoice.fecha_emision) >= new Date(this.dateFrom);
      }
      if (this.dateTo) {
        matchesDate = matchesDate && new Date(invoice.fecha_emision) <= new Date(this.dateTo);
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }

  onSearch(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.filteredInvoices = [...this.invoices];
  }

  createInvoice(): void {
    this.router.navigate(['/invoices/create']);
  }

  viewInvoice(invoice: Invoice): void {
    this.router.navigate(['/invoices', invoice.id]);
  }

  downloadPDF(invoice: Invoice): void {
    const documentId = invoice.factus_id || invoice.id;
    this.invoiceService.downloadPDFAsBlob(documentId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `factura-${invoice.factus_id || invoice.numero_factura || invoice.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: () => alert('Error descargando el PDF. La factura puede no estar emitida aún.')
    });
  }

  deleteInvoice(invoice: Invoice): void {
    if (!confirm(`¿Estás seguro de eliminar la factura ${invoice.numero_factura || 'FAC-' + invoice.id}?\n\nEsta acción no se puede deshacer.`)) return;

    this.loading = true;
    const deleteId = invoice.documentId || invoice.id;
    
    this.invoiceService.deleteInvoice(deleteId as any).subscribe({
      next: () => {
        this.invoices = this.invoices.filter(i => i.id !== invoice.id);
        this.filteredInvoices = this.filteredInvoices.filter(i => i.id !== invoice.id);
        this.totalItems = this.invoices.length;
        this.calculateStats();
        this.loading = false;
        alert('Factura eliminada exitosamente');
      },
      error: () => {
        this.loading = false;
        alert('Error al eliminar la factura. Por favor intenta de nuevo.');
      }
    });
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'Enviada': 'bg-green-100 text-green-800',
      'Pendiente': 'bg-yellow-100 text-yellow-800',
      'Borrador': 'bg-yellow-100 text-yellow-800',
      'Rechazada': 'bg-red-100 text-red-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value || 0);
  }

  formatDate(date: string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Paginación
  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadInvoices();
    }
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }
}
