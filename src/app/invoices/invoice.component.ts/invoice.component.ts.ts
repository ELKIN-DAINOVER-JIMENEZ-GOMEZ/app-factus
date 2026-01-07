/**
 * Componente de Crear Factura - VERSIÓN FINAL CORREGIDA
 * Ubicación: src/app/components/invoices/create-invoice.component.ts
 * 
 * CAMBIOS PRINCIPALES:
 * ✅ Usa el nuevo método createInvoiceComplete()
 * ✅ Mejor manejo de errores con detalles
 * ✅ Validación mejorada
 * ✅ Logging detallado para debugging
 */

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
  
  // Estados
  loading = false;
  saving = false;
  emitting = false;
  downloading = false;
  
  // Datos
  clients: Client[] = [];
  products: Product[] = [];
  selectedClient: Client | null = null;
  emittedInvoiceId: number | null = null;
  emittedDocumentId: string | null = null;
  
  // Búsqueda
  searchingClients = false;
  searchingProducts = false;
  clientSearch = '';
  productSearch = '';
  
  // Modales
  showClientModal = false;
  showProductModal = false;
  currentItemIndex: number | null = null;
  
  // Errores
  errors: string[] = [];
  successMessage = '';

  // Opciones para selects
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
      if (updated) {
        this.loadClients();
      }
    });
  }

  // ============================================
  // INICIALIZACIÓN DEL FORMULARIO
  // ============================================

  initForm(): void {
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

  // ============================================
  // GETTERS
  // ============================================

  get items(): FormArray {
    return this.invoiceForm.get('invoice_items') as FormArray;
  }

  getItemControls() {
    return this.items.controls;
  }

  // ============================================
  // CARGA DE DATOS
  // ============================================

  loadClients(search?: string): void {
    this.searchingClients = true;
    
    this.invoiceService.getClients({ 
      search: search || '', 
      pageSize: 50 
    }).subscribe({
      next: (response) => {
        this.clients = response.data;
        this.searchingClients = false;
        console.log('✅ Clientes cargados:', this.clients.length);
      },
      error: (error) => {
        console.error('❌ Error cargando clientes:', error);
        this.searchingClients = false;
        this.showError('Error cargando clientes: ' + error.message);
      }
    });
  }

  loadProducts(search?: string): void {
    this.searchingProducts = true;
    
    this.invoiceService.getProducts({ 
      search: search || '', 
      pageSize: 100 
    }).subscribe({
      next: (response) => {
        this.products = response.data;
        this.searchingProducts = false;
        console.log('✅ Productos cargados:', this.products.length);
      },
      error: (error) => {
        console.error('❌ Error cargando productos:', error);
        this.searchingProducts = false;
        this.showError('Error cargando productos: ' + error.message);
      }
    });
  }

  // ============================================
  // MANEJO DE CLIENTE
  // ============================================

  onClientChange(event: any): void {
    const clientId = parseInt(event.target.value);
    this.selectedClient = this.clients.find(c => c.id === clientId) || null;
    console.log('Cliente seleccionado:', this.selectedClient);
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

  // ============================================
  // MANEJO DE ITEMS
  // ============================================

  createItemFormGroup(item?: Partial<FormInvoiceItem>): FormGroup {
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

  // ============================================
  // SELECCIÓN DE PRODUCTO
  // ============================================

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

  // ============================================
  // CÁLCULOS
  // ============================================

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

  // ============================================
  // 🆕 GUARDAR - MÉTODO CORREGIDO
  // ============================================

  saveAsDraft(): void {
    console.log('💾 Iniciando guardado como borrador...');
    
    if (!this.validateForm()) {
      console.log('❌ Validación fallida');
      return;
    }

    this.saving = true;
    this.clearMessages();

    const invoiceData = this.prepareInvoiceData();
    console.log('📦 Datos preparados:', invoiceData);

    // ✅ USAR EL NUEVO MÉTODO
    this.invoiceService.createInvoiceComplete(invoiceData).subscribe({
      next: (response) => {
        this.saving = false;
        console.log('✅ Factura guardada completa:', response);
        this.showSuccess(`¡Factura guardada! ID: ${response.invoice.id}, Items: ${response.items.length}`);
        setTimeout(() => {
          this.router.navigate(['/invoices', response.invoice.id]);
        }, 1500);
      },
      error: (error) => {
        this.saving = false;
        console.error('❌ Error guardando factura:', error);
        const errorMessage = this.extractDetailedError(error);
        this.showError('Error guardando factura: ' + errorMessage);
      }
    });
  }

  // ============================================
  // 🆕 GUARDAR Y EMITIR - MÉTODO CORREGIDO
  // ============================================

  saveAndEmit(): void {
    console.log('🚀 Iniciando guardado y emisión...');
    
    if (!this.validateForm()) {
      console.log('❌ Validación fallida');
      return;
    }

    // Validación adicional antes de emitir
    const preValidation = this.validateBeforeEmission();
    if (!preValidation.valid) {
      this.showError(preValidation.message);
      return;
    }

    this.emitting = true;
    this.clearMessages();

    const invoiceData = this.prepareInvoiceData();
    console.log('📦 Datos a guardar y emitir:', invoiceData);

    // PASO 1: Crear factura completa con items
    this.invoiceService.createInvoiceComplete(invoiceData).subscribe({
      next: (response) => {
        const invoiceId = response.invoice.id!;
        console.log(`✅ [1/2] Factura ${invoiceId} creada con ${response.items.length} items`);
        console.log('📤 [2/2] Emitiendo a DIAN...');

        // PASO 2: Emitir a Factus
        this.invoiceService.emitInvoice(invoiceId).subscribe({
          next: (emissionResponse) => {
            this.emitting = false;
            if (emissionResponse.success) {
              console.log('✅ Factura emitida exitosamente');
              // Guardar el ID de la factura y documento para descarga de PDF
              this.emittedInvoiceId = invoiceId;
              if (emissionResponse.data?.documentId) {
                this.emittedDocumentId = emissionResponse.data.documentId;
              }
              this.showSuccess('¡Factura emitida exitosamente a la DIAN! ✅ Puedes descargar el PDF');
              // No navegar inmediatamente, permite al usuario descargar el PDF primero
              setTimeout(() => {
                this.router.navigate(['/invoices', invoiceId]);
              }, 5000);
            } else {
              console.error('❌ Error en emisión:', emissionResponse.error);
              this.showError('Factura guardada pero error en emisión: ' + emissionResponse.error);
              // Aún así navegar a la factura
              setTimeout(() => {
                this.router.navigate(['/invoices', invoiceId]);
              }, 3000);
            }
          },
          error: (error) => {
            this.emitting = false;
            console.error('❌ Error emitiendo:', error);
            const errorMessage = this.extractDetailedError(error);
            this.showError('Factura guardada pero error en emisión: ' + errorMessage);
            // Navegar a la factura de todas formas
            setTimeout(() => {
              this.router.navigate(['/invoices', invoiceId]);
            }, 3000);
          }
        });
      },
      error: (error) => {
        this.emitting = false;
        console.error('❌ Error creando factura:', error);
        const errorMessage = this.extractDetailedError(error);
        this.showError('Error creando factura: ' + errorMessage);
      }
    });
  }

  // ============================================
  // VALIDACIÓN
  // ============================================

  validateForm(): boolean {
    this.clearMessages();

    if (this.invoiceForm.invalid) {
      console.log('❌ Formulario inválido');
      console.log('Errores:', this.getFormValidationErrors());
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
        return {
          valid: false,
          message: `❌ Item ${i + 1} está incompleto`
        };
      }
    }

    return { valid: true, message: '' };
  }

  markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getFormValidationErrors(): any[] {
    const errors: any[] = [];
    Object.keys(this.invoiceForm.controls).forEach(key => {
      const control = this.invoiceForm.get(key);
      if (control && control.errors) {
        errors.push({ field: key, errors: control.errors });
      }
    });
    return errors;
  }

  // ============================================
  // PREPARACIÓN DE DATOS
  // ============================================

  prepareInvoiceData(): Invoice {
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

    const clientId = typeof formValue.client === 'object' 
      ? formValue.client?.id 
      : Number(formValue.client);

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

  extractDetailedError(error: any): string {
    console.log('🔍 Extrayendo error detallado:', error);

    // Estructura típica de error de Strapi
    if (error.error) {
      if (error.error.error) {
        if (error.error.error.message) {
          return error.error.error.message;
        }
        if (typeof error.error.error === 'string') {
          return error.error.error;
        }
      }
      
      if (error.error.message) {
        return error.error.message;
      }
      
      if (typeof error.error === 'string') {
        return error.error;
      }
    }

    if (error.message) {
      return error.message;
    }

    return `Error desconocido (Status: ${error.status || 'N/A'})`;
  }

  cancel(): void {
    if (confirm('¿Estás seguro de cancelar? Se perderán los cambios no guardados.')) {
      this.router.navigate(['/invoices']);
    }
  }

  // ============================================
  // DESCARGAR PDF
  // ============================================

  /**
   * Descargar el PDF de la factura emitida
   */
  downloadInvoicePDF(): void {
    if (!this.emittedDocumentId && !this.emittedInvoiceId) {
      this.showError('No hay factura emitida para descargar. Por favor emite la factura primero.');
      return;
    }

    const documentId = this.emittedDocumentId || this.emittedInvoiceId;
    console.log(`📥 Descargando PDF del documento ${documentId}...`);

    this.downloading = true;

    this.invoiceService.downloadPDFAsBlob(documentId!).subscribe({
      next: (blob: Blob) => {
        this.downloading = false;
        
        // Crear URL y descargar el archivo
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `factura-${this.emittedInvoiceId || documentId}.pdf`;
        document.body.appendChild(link);
        link.click();
        
        // Limpiar recursos
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log('✅ PDF descargado exitosamente');
        this.showSuccess('PDF descargado exitosamente');
      },
      error: (error) => {
        this.downloading = false;
        console.error('❌ Error descargando PDF:', error);
        const errorMessage = this.extractDetailedError(error);
        this.showError('Error descargando PDF: ' + errorMessage);
      }
    });
  }
}