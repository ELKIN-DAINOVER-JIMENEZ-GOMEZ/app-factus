import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, SlicePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CreditNoteService, CreditNote, CreditNoteStats } from '../../services/credit-note.service';

@Component({
  selector: 'app-credit-note-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePipe, SlicePipe],
  templateUrl: './credit-note-list.component.html',
  styleUrls: ['./credit-note-list.component.css']
})
export class CreditNoteListComponent implements OnInit {
  creditNotes: CreditNote[] = [];
  stats: CreditNoteStats = { total: 0, borradores: 0, enviadas: 0, errores: 0, montoTotal: 0 };

  currentPage = 1;
  pageSize = 25;
  totalPages = 1;
  totalItems = 0;
  estadoFiltro = '';

  isLoading = false;
  isDownloading: Record<number, boolean> = {};

  showPdfModal = false;
  pdfModalData: { creditNoteId?: number; numero?: string; publicUrl?: string } = {};

  constructor(private creditNoteService: CreditNoteService) {}

  ngOnInit(): void {
    this.loadCreditNotes();
    this.loadStats();
  }

  loadCreditNotes(): void {
    this.isLoading = true;
    this.creditNoteService.getCreditNotes(this.currentPage, this.pageSize, this.estadoFiltro)
      .subscribe({
        next: (response) => {
          this.creditNotes = response.data;
          this.totalItems = response.meta.pagination.total;
          this.totalPages = response.meta.pagination.pageCount;
          this.isLoading = false;
        },
        error: () => this.isLoading = false
      });
  }

  loadStats(): void {
    this.creditNoteService.getStats().subscribe({
      next: (stats) => this.stats = stats,
      error: () => {}
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadCreditNotes();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadCreditNotes();
    }
  }

  emitCreditNote(creditNote: CreditNote): void {
    if (!creditNote.id) return;

    if (!confirm(`¿Está seguro de emitir la nota crédito ${creditNote.numero_nota} a la DIAN?`)) return;

    this.isLoading = true;
    this.creditNoteService.emitCreditNote(creditNote.id).subscribe({
      next: (response) => {
        if (response.success) {
          alert('Nota crédito emitida exitosamente');
          if (response.data?.data?.credit_note?.public_url) {
            this.showPdfModalDialog({
              creditNoteId: creditNote.id,
              numero: creditNote.numero_nota,
              publicUrl: response.data.data.credit_note.public_url
            });
          }
          this.loadCreditNotes();
          this.loadStats();
        } else {
          alert(`Error: ${response.message}`);
        }
        this.isLoading = false;
      },
      error: () => {
        alert('Error al emitir nota crédito');
        this.isLoading = false;
      }
    });
  }

  downloadPDF(creditNote: CreditNote): void {
    if (!creditNote.id) return;

    if (creditNote.public_url) {
      window.open(creditNote.public_url, '_blank');
      return;
    }

    this.isDownloading[creditNote.id] = true;
    this.creditNoteService.downloadPDF(creditNote.id).subscribe({
      next: (response) => {
        if (response.success) {
          if (response.redirectUrl) {
            window.open(response.redirectUrl, '_blank');
          } else if (response.blob) {
            const url = window.URL.createObjectURL(response.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `NotaCredito_${creditNote.numero_nota}.pdf`;
            link.click();
            window.URL.revokeObjectURL(url);
          }
        } else {
          alert(`Error: ${response.error}`);
        }
        this.isDownloading[creditNote.id!] = false;
      },
      error: () => {
        alert('Error al descargar PDF');
        this.isDownloading[creditNote.id!] = false;
      }
    });
  }

  deleteCreditNote(creditNote: CreditNote): void {
    if (!creditNote.id) return;

    if (creditNote.estado_local !== 'Borrador') {
      alert('Solo se pueden eliminar notas crédito en estado Borrador');
      return;
    }

    if (!confirm(`¿Está seguro de eliminar la nota crédito ${creditNote.numero_nota || 'sin número'}? Esta acción no se puede deshacer.`)) return;

    this.isLoading = true;
    this.creditNoteService.deleteCreditNote(creditNote.id).subscribe({
      next: (response) => {
        if (response.success) {
          alert('Nota crédito eliminada exitosamente');
          this.loadCreditNotes();
          this.loadStats();
        } else {
          alert(`Error: ${response.message}`);
        }
        this.isLoading = false;
      },
      error: () => {
        alert('Error al eliminar nota crédito');
        this.isLoading = false;
      }
    });
  }

  showPdfModalDialog(data: { creditNoteId?: number; numero?: string; publicUrl?: string }): void {
    this.pdfModalData = data;
    this.showPdfModal = true;
  }

  closePdfModal(): void {
    this.showPdfModal = false;
    this.pdfModalData = {};
  }

  openPdfInNewTab(): void {
    if (this.pdfModalData.publicUrl) {
      window.open(this.pdfModalData.publicUrl, '_blank');
      this.closePdfModal();
    }
  }

  getEstadoClass(estado: string): string {
    const classes: Record<string, string> = {
      'Enviada': 'badge-success',
      'Borrador': 'badge-warning',
      'Error': 'badge-danger'
    };
    return classes[estado] || 'badge-secondary';
  }

  getClientName(creditNote: CreditNote): string {
    if (!creditNote.client) return 'Sin cliente';
    if (typeof creditNote.client === 'number') return `Cliente #${creditNote.client}`;
    return creditNote.client.nombre_completo || creditNote.client.razon_social || 'Sin nombre';
  }

  getInvoiceNumber(creditNote: CreditNote): string {
    if (!creditNote.invoice) return 'Sin factura';
    if (typeof creditNote.invoice === 'number') return `Factura #${creditNote.invoice}`;
    return (creditNote.invoice as any).numero_factura || (creditNote.invoice as any).factus_id || 'Sin número';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  getPageNumbers(): number[] {
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
}
