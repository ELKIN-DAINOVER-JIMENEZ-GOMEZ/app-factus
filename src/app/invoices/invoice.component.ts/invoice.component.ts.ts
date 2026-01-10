import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { 
  InvoiceService, 
  Client, 
  Product, 
  Invoice, 
  InvoiceItem 
} from '../../services/invoice.service.ts';

interface FormInvoiceItem extends InvoiceItem {
  _tempId?: string;
}

@Component({
  selector: 'app-create-invoice',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  templateUrl: './invoice.component.html',
})
export class CreateInvoiceComponent implements OnInit {
  invoiceForm!: FormGroup;

  loading = false;
  saving = false;
  emitting = false;
  downloading = false;

  clients: Client[] = [];
  products: Product[] = [];
  selectedClient: Client | null = null;

  emittedInvoiceId: number | null = null;
  emittedDocumentId: string | null = null;

  searchingClients = false;
  searchingProducts = false;
  clientSearch = '';
  productSearch = '';

  showClientModal = false;
  showProductModal = false;
  showPdfModal = false;
  currentItemIndex: number | null = null;

  errors: string[] = [];
  successMessage = '';

  tiposOperacion = [
    { value: 'Contado', label: 'Contado' },
    { value: 'Credito', label: 'Crédito' },
    { value: 'Venta', label: 'Venta' },
    { value: 'Exportacion', label: 'Exportación' }
  ];

  formasPago = [
    { value: 'Efectivo', label: 'Efectivo' },
    { value: 'Credito', label: 'Crédito' },
    { value: 'Tarjeta', label: 'Tarjeta' },
    { value: 'Transferencia', label: 'Transferencia' },
    { value: 'Cheque', label: 'Cheque' }
  ];

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadClients();
    this.loadProducts();
    this.invoiceService.clientsUpdated$.subscribe(updated => {
      if (updated) this.loadClients();
    });
  }

  private initForm(): void {
    this.invoiceForm = this.fb.group({
      client: [null, Validators.required],
      fecha_emision: [new Date().toISOString().split('T')[0], Validators.required],
      fecha_vencimiento: [''],
      tipo_operacion: ['Contado', Validators.required],
      forma_pago: ['Efectivo', Validators.required],
      medio_pago: [''],
      observaciones: [''],
      invoice_items: this.fb.array([]),
      subtotal: [0],
      total_iva: [0],
      total_ico: [0],
      total_descuentos: [0],
      total: [0]
    });

    this.addItem();
  }

  get items(): FormArray {
    return this.invoiceForm.get('invoice_items') as FormArray;
  }

  getItemControls() {
    return this.items.controls;
  }

  loadClients(search?: string): void {
    this.searchingClients = true;
    this.invoiceService.getClients({ search: search || '', pageSize: 50 }).subscribe({
      next: (response) => {
        this.clients = response.data;
        this.searchingClients = false;
      },
      error: (error) => {
        this.searchingClients = false;
        this.showError('Error cargando clientes: ' + error.message);
      }
    });
  }

  loadProducts(search?: string): void {
    this.searchingProducts = true;
    this.invoiceService.getProducts({ search: search || '', pageSize: 100 }).subscribe({
      next: (response) => {
        this.products = response.data;
        this.searchingProducts = false;
      },
      error: (error) => {
        this.searchingProducts = false;
        this.showError('Error cargando productos: ' + error.message);
      }
    });
  }

  onClientChange(event: any): void {
    const clientId = parseInt(event.target.value);
    this.selectedClient = this.clients.find(c => c.id === clientId) || null;
  }

  openClientModal(): void {
    this.showClientModal = true;
    this.clientSearch = '';
  }

  closeClientModal(): void {
    this.showClientModal = false;
  }

  selectClient(client: Client): void {
    this.selectedClient = client;
    this.invoiceForm.patchValue({ client: client.id });
    this.closeClientModal();
  }

  onClientSearch(): void {
    this.loadClients(this.clientSearch);
  }

  private createItemFormGroup(item?: Partial<FormInvoiceItem>): FormGroup {
    return this.fb.group({
      _tempId: [item?._tempId || this.generateTempId()],
      product: [item?.product || null, Validators.required],
      codigo_producto: [item?.codigo_producto || '', Validators.required],
      nombre_producto: [item?.nombre_producto || '', Validators.required],
      descripcion: [item?.descripcion || ''],
      cantidad: [item?.cantidad || 1, [Validators.required, Validators.min(0.01)]],
      precio_unitario: [item?.precio_unitario || 0, [Validators.required, Validators.min(0)]],
      descuento_porcentaje: [item?.descuento_porcentaje || 0, [Validators.min(0), Validators.max(100)]],
      descuento_valor: [item?.descuento_valor || 0],
      subtotal: [item?.subtotal || 0],
      iva_porcentaje: [item?.iva_porcentaje || 19, [Validators.min(0), Validators.max(100)]],
      iva_valor: [item?.iva_valor || 0],
      ico_porcentaje: [item?.ico_porcentaje || 0, [Validators.min(0), Validators.max(100)]],
      ico_valor: [item?.ico_valor || 0],
      total_item: [item?.total_item || 0],
      orden: [item?.orden || this.items.length + 1],
      unidad_medida: [item?.unidad_medida || 'UND'],
      unidad_medida_id: [item?.unidad_medida_id || 70],
      codigo_estandar: [item?.codigo_estandar || ''],
      codigo_estandar_id: [item?.codigo_estandar_id || 1],
      esquema_id: [item?.esquema_id || '1'],
      es_excluido: [item?.es_excluido || false],
      tributo_id: [item?.tributo_id || 1]
    });
  }

  addItem(): void {
    this.items.push(this.createItemFormGroup());
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
      this.calculateTotals();
    } else {
      this.showError('Debe haber al menos un ítem');
    }
  }

  duplicateItem(index: number): void {
    const item = this.items.at(index).value;
    const newItem = { ...item, _tempId: this.generateTempId() };
    this.items.insert(index + 1, this.createItemFormGroup(newItem));
  }

  openProductModal(index: number): void {
    this.currentItemIndex = index;
    this.showProductModal = true;
    this.productSearch = '';
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.currentItemIndex = null;
  }

  selectProduct(product: Product): void {
    if (this.currentItemIndex === null) return;

    const itemGroup = this.items.at(this.currentItemIndex) as FormGroup;
    
    itemGroup.patchValue({
      product: product.id,
      codigo_producto: product.codigo,
      nombre_producto: product.nombre,
      descripcion: product.descripcion || '',
      precio_unitario: product.precio_unitario,
      iva_porcentaje: product.iva_porcentaje,
      ico_porcentaje: product.ico_porcentaje || 0,
      unidad_medida: product.unidad_medida,
      unidad_medida_id: product.unidad_medida_id,
      es_excluido: !product.aplica_iva
    });

    this.calculateItemTotals(this.currentItemIndex);
    this.closeProductModal();
  }

  onProductSearch(): void {
    this.loadProducts(this.productSearch);
  }

  calculateItemTotals(index: number): void {
    const itemGroup = this.items.at(index) as FormGroup;
    const itemValue = itemGroup.value;

    const calculated = this.invoiceService.calculateItemTotals(itemValue);

    itemGroup.patchValue({
      descuento_valor: calculated.descuento_valor,
      subtotal: calculated.subtotal,
      iva_valor: calculated.iva_valor,
      ico_valor: calculated.ico_valor,
      total_item: calculated.total_item
    }, { emitEvent: false });

    this.calculateTotals();
  }

  calculateTotals(): void {
    const items = this.items.value as InvoiceItem[];
    const totals = this.invoiceService.calculateInvoiceTotals(items);

    this.invoiceForm.patchValue({
      subtotal: totals.subtotal,
      total_iva: totals.total_iva,
      total_ico: totals.total_ico,
      total_descuentos: totals.total_descuentos,
      total: totals.total
    }, { emitEvent: false });
  }

  saveAsDraft(): void {
    if (!this.validateForm()) return;

    this.saving = true;
    this.clearMessages();
    const invoiceData = this.prepareInvoiceData();

    this.invoiceService.createInvoiceComplete(invoiceData).subscribe({
      next: (response) => {
        this.saving = false;
        this.showSuccess(`¡Factura guardada! ID: ${response.invoice.id}, Items: ${response.items.length}`);
        setTimeout(() => this.router.navigate(['/invoices', response.invoice.id]), 1500);
      },
      error: (error) => {
        this.saving = false;
        this.showError('Error guardando factura: ' + this.extractDetailedError(error));
      }
    });
  }

  saveAndEmit(): void {
    if (!this.validateForm()) return;

    const preValidation = this.validateBeforeEmission();
    if (!preValidation.valid) {
      this.showError(preValidation.message);
      return;
    }

    this.emitting = true;
    this.clearMessages();
    const invoiceData = this.prepareInvoiceData();

    this.invoiceService.createInvoiceComplete(invoiceData).subscribe({
      next: (response) => {
        const invoiceId = response.invoice.id!;
        this.invoiceService.emitInvoice(invoiceId).subscribe({
          next: (emissionResponse) => {
            this.emitting = false;
            if (emissionResponse.success) {
              this.emittedInvoiceId = invoiceId;
              const factusNumber = 
                emissionResponse.data?.number ||
                emissionResponse.data?.data?.bill?.number ||
                emissionResponse.data?.documentId ||
                emissionResponse.data?.data?.bill?.id ||
                emissionResponse.data?.id;
              
              if (factusNumber) {
                this.emittedDocumentId = String(factusNumber);
                this.showPdfModal = true;
              } else {
                this.showError('Factura emitida pero no se pudo obtener el número de Factus para descargar el PDF');
              }
              this.showSuccess('¡Factura emitida exitosamente a la DIAN!');
            } else {
              this.showError('Factura guardada pero error en emisión: ' + emissionResponse.error);
              setTimeout(() => this.router.navigate(['/invoices', invoiceId]), 3000);
            }
          },
          error: (error) => {
            this.emitting = false;
            this.showError('Factura guardada pero error en emisión: ' + this.extractDetailedError(error));
            setTimeout(() => this.router.navigate(['/invoices', invoiceId]), 3000);
          }
        });
      },
      error: (error) => {
        this.emitting = false;
        this.showError('Error creando factura: ' + this.extractDetailedError(error));
      }
    });
  }

  private validateForm(): boolean {
    this.clearMessages();

    if (this.invoiceForm.invalid) {
      this.showError('Por favor completa todos los campos requeridos');
      this.markFormGroupTouched(this.invoiceForm);
      return false;
    }

    if (this.items.length === 0) {
      this.showError('Debe agregar al menos un ítem');
      return false;
    }

    // Validar items
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i).value;
      
      if (!item.product) {
        this.showError(`El ítem ${i + 1} debe tener un producto seleccionado`);
        return false;
      }
      
      if (!item.codigo_producto || !item.nombre_producto) {
        this.showError(`El ítem ${i + 1} está incompleto`);
        return false;
      }
      
      if (item.cantidad <= 0) {
        this.showError(`El ítem ${i + 1} debe tener cantidad mayor a 0`);
        return false;
      }
      
      if (item.precio_unitario <= 0) {
        this.showError(`El ítem ${i + 1} debe tener precio mayor a 0`);
        return false;
      }
    }

    if (this.invoiceForm.value.total <= 0) {
      this.showError('El total debe ser mayor a 0');
      return false;
    }

    if (!this.invoiceForm.value.client) {
      this.showError('Debes seleccionar un cliente');
      return false;
    }

    return true;
  }

  validateBeforeEmission(): { valid: boolean; message: string } {
    const invoiceData = this.prepareInvoiceData();

    if (!invoiceData.client) {
      return {
        valid: false,
        message: '❌ Debes seleccionar un cliente'
      };
    }

    if (!invoiceData.invoice_items || invoiceData.invoice_items.length === 0) {
      return {
        valid: false,
        message: '❌ Debes agregar al menos un producto'
      };
    }

    for (let i = 0; i < invoiceData.invoice_items.length; i++) {
      const item = invoiceData.invoice_items[i];
      
      if (!item.product) {
        return {
          valid: false,
          message: `❌ Item ${i + 1} no tiene producto`
        };
      }

      if (!item.codigo_producto || !item.nombre_producto) {
        return { valid: false, message: `Item ${i + 1} está incompleto` };
      }
    }

    return { valid: true, message: '' };
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private prepareInvoiceData(): Invoice {
    const formValue = this.invoiceForm.value;

    const invoice_items = formValue.invoice_items.map((item: any, index: number) => {
      const { _tempId, ...cleanItem } = item;
      
      const productId = typeof cleanItem.product === 'object' 
        ? cleanItem.product?.id 
        : cleanItem.product;

      return {
        ...cleanItem,
        product: productId,
        orden: index + 1,
        cantidad: Number(cleanItem.cantidad),
        precio_unitario: Number(cleanItem.precio_unitario),
        descuento_porcentaje: Number(cleanItem.descuento_porcentaje || 0),
        descuento_valor: Number(cleanItem.descuento_valor || 0),
        subtotal: Number(cleanItem.subtotal),
        iva_porcentaje: Number(cleanItem.iva_porcentaje || 0),
        iva_valor: Number(cleanItem.iva_valor || 0),
        ico_porcentaje: Number(cleanItem.ico_porcentaje || 0),
        ico_valor: Number(cleanItem.ico_valor || 0),
        total_item: Number(cleanItem.total_item),
      };
    });

    // Manejar correctamente el clientId
    let clientId: number | undefined;
    
    if (typeof formValue.client === 'object' && formValue.client !== null) {
      clientId = formValue.client.id;
    } else if (typeof formValue.client === 'number') {
      clientId = formValue.client;
    } else if (typeof formValue.client === 'string' && formValue.client.trim() !== '') {
      const parsed = parseInt(formValue.client, 10);
      clientId = isNaN(parsed) ? undefined : parsed;
    }
    
    if (!clientId && this.selectedClient?.id) {
      clientId = this.selectedClient.id;
    }

    const invoice: Invoice = {
      client: clientId,
      fecha_emision: formValue.fecha_emision,
      fecha_vencimiento: formValue.fecha_vencimiento || formValue.fecha_emision,
      tipo_operacion: formValue.tipo_operacion,
      forma_pago: formValue.forma_pago,
      medio_pago: formValue.medio_pago || formValue.forma_pago,
      observaciones: formValue.observaciones || '',
      subtotal: Number(formValue.subtotal),
      total_iva: Number(formValue.total_iva || 0),
      total_ico: Number(formValue.total_ico || 0),
      total_descuentos: Number(formValue.total_descuentos || 0),
      total: Number(formValue.total),
      estado_local: 'Borrador',
      enviar_email: false,
      invoice_items
    };

    return invoice;
  }

  // ============================================
  // UTILIDADES
  // ============================================

  generateTempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value || 0);
  }

  clearMessages(): void {
    this.errors = [];
    this.successMessage = '';
  }

  showError(message: string): void {
    this.errors = [message];
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showSuccess(message: string): void {
    this.successMessage = message;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private extractDetailedError(error: any): string {
    if (error.status === 409 || error.error?.statusCode === 409) {
      return 'Existe una factura pendiente por enviar a la DIAN. Ingrese al panel de Factus y envíe o cancele la factura pendiente antes de crear una nueva.';
    }

    const errorText = JSON.stringify(error).toLowerCase();
    if (errorText.includes('factura pendiente') || errorText.includes('pendiente por enviar')) {
      return 'Existe una factura pendiente por enviar a la DIAN. Ingrese al panel de Factus y envíe o cancele la factura pendiente antes de crear una nueva.';
    }

    if (error.error?.error?.message) return error.error.error.message;
    if (typeof error.error?.error === 'string') return error.error.error;
    if (error.error?.message) return error.error.message;
    if (typeof error.error === 'string') return error.error;
    if (error.message) return error.message;

    return `Error desconocido (Status: ${error.status || 'N/A'})`;
  }

  cancel(): void {
    if (confirm('¿Estás seguro de cancelar? Se perderán los cambios no guardados.')) {
      this.router.navigate(['/invoices']);
    }
  }

  downloadInvoicePDF(): void {
    const documentId = this.emittedDocumentId || this.emittedInvoiceId;
    
    if (!documentId) {
      this.showError('No hay factura emitida para descargar. Por favor emite la factura primero.');
      return;
    }

    this.downloading = true;

    setTimeout(() => {
      this.invoiceService.downloadPDFAsBlob(documentId).subscribe({
        next: (blob: Blob) => {
          this.downloading = false;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `factura-${documentId}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          this.showSuccess('PDF descargado exitosamente');
          this.closePdfModal();
        },
        error: (error) => {
          this.downloading = false;
          const errorMessage = error.error?.error || error.error?.message || error.message || this.extractDetailedError(error);
          this.showError('Error descargando PDF: ' + errorMessage + '. Intenta nuevamente en unos segundos.');
        }
      });
    }, 2000);
  }

  closePdfModal(): void {
    this.showPdfModal = false;
    if (this.emittedInvoiceId) {
      this.router.navigate(['/invoices', this.emittedInvoiceId]);
    } else {
      this.router.navigate(['/invoices']);
    }
  }
}