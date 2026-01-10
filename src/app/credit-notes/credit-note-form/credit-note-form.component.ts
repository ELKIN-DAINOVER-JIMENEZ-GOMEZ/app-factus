import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { CreditNoteService, CreateCreditNoteRequest, Invoice } from '../../services/credit-note.service';

interface InvoiceItem {
  codigo_producto?: string;
  nombre_producto?: string;
  descripcion?: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje?: number;
  iva_porcentaje?: number;
  product?: number;
}

@Component({
  selector: 'app-credit-note-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, DatePipe],
  templateUrl: './credit-note-form.component.html',
  styleUrls: ['./credit-note-form.component.css']
})
export class CreditNoteFormComponent implements OnInit {
  creditNoteForm!: FormGroup;
  invoices: Invoice[] = [];
  selectedInvoice: Invoice | null = null;
  correctionConcepts: { id: number; name: string; description: string }[] = [];

  isLoading = false;
  isSubmitting = false;
  loadingInvoices = false;

  totals = { subtotal: 0, totalIva: 0, totalDescuentos: 0, total: 0 };

  constructor(
    private fb: FormBuilder,
    private creditNoteService: CreditNoteService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadInvoices();
    this.correctionConcepts = this.creditNoteService.getCorrectionConcepts();
  }

  private initForm(): void {
    this.creditNoteForm = this.fb.group({
      invoiceId: ['', Validators.required],
      concepto_correccion_id: [5, Validators.required],
      motivo_correccion: ['', [Validators.required, Validators.minLength(10)]],
      descripcion_correccion: [''],
      observaciones: [''],
      items: this.fb.array([])
    });
  }

  get items(): FormArray {
    return this.creditNoteForm.get('items') as FormArray;
  }

  private loadInvoices(): void {
    this.loadingInvoices = true;
    this.creditNoteService.getInvoicesForCreditNote().subscribe({
      next: (invoices) => {
        this.invoices = invoices;
        this.loadingInvoices = false;
      },
      error: () => this.loadingInvoices = false
    });
  }

  onInvoiceSelected(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const invoiceId = Number(select.value);
    
    if (!invoiceId) {
      this.selectedInvoice = null;
      this.clearItems();
      return;
    }

    this.selectedInvoice = this.invoices.find(inv => inv.id === invoiceId) || null;
    if (this.selectedInvoice) this.loadInvoiceItems();
  }

  private loadInvoiceItems(): void {
    this.clearItems();
    if (!this.selectedInvoice) return;
    
    let invoiceItems = (this.selectedInvoice as any).invoice_items as InvoiceItem[];
    
    if (!invoiceItems || invoiceItems.length === 0) {
      const factusResponse = (this.selectedInvoice as any).respuesta_factus;
      if (factusResponse?.data?.items && Array.isArray(factusResponse.data.items)) {
        invoiceItems = factusResponse.data.items.map((item: any) => ({
          codigo_producto: item.code_reference || '',
          nombre_producto: item.name || 'Producto',
          descripcion: item.note || item.name || '',
          cantidad: parseFloat(item.quantity) || 1,
          precio_unitario: parseFloat(item.price) || 0,
          descuento_porcentaje: parseFloat(item.discount_rate) || 0,
          iva_porcentaje: parseFloat(item.tax_rate) || 0,
          product: null
        }));
      }
    }
    
    if (!invoiceItems || invoiceItems.length === 0) return;

    invoiceItems.forEach(item => this.addItemFromInvoice(item));
    this.calculateTotals();
  }

  private addItemFromInvoice(item: InvoiceItem): void {
    const itemGroup = this.fb.group({
      codigo_producto: [item.codigo_producto || ''],
      nombre_producto: [item.nombre_producto || item.descripcion || 'Producto', Validators.required],
      cantidad: [item.cantidad, [Validators.required, Validators.min(0.01)]],
      cantidad_max: [item.cantidad],
      precio_unitario: [item.precio_unitario, [Validators.required, Validators.min(0)]],
      descuento_porcentaje: [item.descuento_porcentaje || 0, [Validators.min(0), Validators.max(100)]],
      iva_porcentaje: [item.iva_porcentaje || 0, [Validators.min(0)]],
      productId: [item.product || null],
      incluir: [true]
    });

    itemGroup.valueChanges.subscribe(() => this.calculateTotals());
    this.items.push(itemGroup);
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
    this.calculateTotals();
  }

  private clearItems(): void {
    while (this.items.length > 0) this.items.removeAt(0);
    this.totals = { subtotal: 0, totalIva: 0, totalDescuentos: 0, total: 0 };
  }

  private calculateTotals(): void {
    let subtotal = 0, totalIva = 0, totalDescuentos = 0;

    this.items.controls.forEach(control => {
      const item = control.value;
      if (!item.incluir) return;

      const cantidad = parseFloat(item.cantidad) || 0;
      const precio = parseFloat(item.precio_unitario) || 0;
      const descuentoPct = parseFloat(item.descuento_porcentaje) || 0;
      const ivaPct = parseFloat(item.iva_porcentaje) || 0;

      const subtotalItem = cantidad * precio;
      const descuentoItem = subtotalItem * (descuentoPct / 100);
      const baseGravable = subtotalItem - descuentoItem;
      const ivaItem = baseGravable * (ivaPct / 100);

      subtotal += baseGravable;
      totalDescuentos += descuentoItem;
      totalIva += ivaItem;
    });

    this.totals = { subtotal, totalIva, totalDescuentos, total: subtotal + totalIva };
  }

  getItemTotal(index: number): number {
    const item = this.items.at(index).value;
    const cantidad = parseFloat(item.cantidad) || 0;
    const precio = parseFloat(item.precio_unitario) || 0;
    const descuentoPct = parseFloat(item.descuento_porcentaje) || 0;
    const ivaPct = parseFloat(item.iva_porcentaje) || 0;

    const subtotal = cantidad * precio;
    const descuento = subtotal * (descuentoPct / 100);
    const base = subtotal - descuento;
    return base + (base * (ivaPct / 100));
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  getInvoiceClientName(invoice: any): string {
    if (!invoice) return 'Sin cliente';
    return invoice.client?.nombre_completo || invoice.client?.razon_social || 'Sin cliente';
  }

  getInvoiceNumber(invoice: any): string {
    return invoice?.factus_id || invoice?.numero_factura || 'Sin número';
  }

  getInvoiceItemCount(invoice: any): number {
    return invoice?.invoice_items?.length || 0;
  }

  onSubmit(): void {
    if (this.creditNoteForm.invalid) {
      this.markFormGroupTouched();
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    const includedItems = this.items.controls
      .filter(control => control.value.incluir)
      .map(control => ({
        codigo_producto: control.value.codigo_producto,
        nombre_producto: control.value.nombre_producto,
        cantidad: control.value.cantidad,
        precio_unitario: control.value.precio_unitario,
        descuento_porcentaje: control.value.descuento_porcentaje,
        iva_porcentaje: control.value.iva_porcentaje,
        productId: control.value.productId
      }));

    if (includedItems.length === 0) {
      alert('Debe incluir al menos un item en la nota crédito');
      return;
    }

    const formValue = this.creditNoteForm.value;
    const request: CreateCreditNoteRequest = {
      invoiceId: Number(formValue.invoiceId),
      motivo_correccion: formValue.motivo_correccion,
      concepto_correccion_id: formValue.concepto_correccion_id,
      descripcion_correccion: formValue.descripcion_correccion || formValue.motivo_correccion,
      observaciones: formValue.observaciones,
      items: includedItems
    };

    this.isSubmitting = true;
    this.creditNoteService.createCreditNote(request).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (response.success) {
          const emitNow = confirm('Nota crédito creada exitosamente. ¿Desea emitirla ahora a la DIAN?');
          if (emitNow && response.data?.id) {
            this.emitCreditNote(response.data.id);
          } else {
            this.router.navigate(['/credit-notes']);
          }
        } else {
          alert(`Error: ${response.message}`);
        }
      },
      error: () => {
        alert('Error al crear nota crédito');
        this.isSubmitting = false;
      }
    });
  }

  private emitCreditNote(id: number): void {
    this.isSubmitting = true;
    this.creditNoteService.emitCreditNote(id).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (response.success) {
          alert('Nota crédito emitida exitosamente a la DIAN');
          if (response.data?.data?.credit_note?.public_url) {
            window.open(response.data.data.credit_note.public_url, '_blank');
          }
        } else {
          alert(`Error al emitir: ${response.message}`);
        }
        this.router.navigate(['/credit-notes']);
      },
      error: () => {
        alert('Error al emitir nota crédito');
        this.isSubmitting = false;
        this.router.navigate(['/credit-notes']);
      }
    });
  }

  private markFormGroupTouched(): void {
    Object.values(this.creditNoteForm.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markAllAsTouched(control);
      }
    });
  }

  private markAllAsTouched(group: FormGroup | FormArray): void {
    Object.values(group.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markAllAsTouched(control);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/credit-notes']);
  }
}
