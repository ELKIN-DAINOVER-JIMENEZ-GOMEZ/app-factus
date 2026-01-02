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
  _tempId?: string; // ID temporal para el formulario
}

@Component({
  selector: 'app-create-invoice',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.css']
})




export class CreateInvoiceComponent implements OnInit {
  invoiceForm!: FormGroup;
  
  // Estados
  loading = false;
  saving = false;
  emitting = false;
  
  // Datos
  clients: Client[] = [];
  products: Product[] = [];
  selectedClient: Client | null = null;
  
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
  }

  // ============================================
  // INICIALIZACIÓN DEL FORMULARIO
  // ============================================

  initForm(): void {
    this.invoiceForm = this.fb.group({
      // Cliente
      client: [null, Validators.required],
      
      // Fechas
      fecha_emision: [new Date().toISOString().split('T')[0], Validators.required],
      fecha_vencimiento: [''],
      
      // Tipo de operación
      tipo_operacion: ['Contado', Validators.required],
      forma_pago: ['Efectivo', Validators.required],
      medio_pago: [''],
      
      // Observaciones
      observaciones: [''],
      
      // Items (array de items)
      invoice_items: this.fb.array([]),
      
      // Totales (calculados automáticamente)
      subtotal: [0],
      total_iva: [0],
      total_ico: [0],
      total_descuentos: [0],
      total: [0]
    });

    // Agregar primer item vacío
    this.addItem();
  }

  // ============================================
  // GETTERS PARA EL FORMULARIO
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
  // GUARDAR Y EMITIR
  // ============================================

  saveAsDraft(): void {
    if (!this.validateForm()) return;

    this.saving = true;
    this.clearMessages();

    const invoiceData = this.prepareInvoiceData();

    this.invoiceService.createInvoice(invoiceData).subscribe({
      next: (response) => {
        this.saving = false;
        this.showSuccess('Factura guardada como borrador');
        setTimeout(() => {
          this.router.navigate(['/invoices', response.data.id]);
        }, 1500);
      },
      error: (error) => {
        this.saving = false;
        this.showError('Error guardando factura: ' + error.message);
      }
    });
  }

  saveAndEmit(): void {
    if (!this.validateForm()) return;

    this.emitting = true;
    this.clearMessages();

    const invoiceData = this.prepareInvoiceData();

    // Primero guardar
    this.invoiceService.createInvoice(invoiceData).subscribe({
      next: (response) => {
        const invoiceId = response.data.id!;
        console.log(`✅ Factura creada con ID ${invoiceId}, emitiendo...`);

        // Luego emitir
        this.invoiceService.emitInvoice(invoiceId).subscribe({
          next: (emissionResponse) => {
            this.emitting = false;
            if (emissionResponse.success) {
              this.showSuccess('¡Factura emitida exitosamente a la DIAN!');
              setTimeout(() => {
                this.router.navigate(['/invoices', invoiceId]);
              }, 2000);
            } else {
              this.showError('Error emitiendo factura: ' + emissionResponse.error);
            }
          },
          error: (error) => {
            this.emitting = false;
            this.showError('Error emitiendo factura: ' + error.message);
          }
        });
      },
      error: (error) => {
        this.emitting = false;
        this.showError('Error guardando factura: ' + error.message);
      }
    });
  }

  // ============================================
  // PREPARACIÓN DE DATOS
  // ============================================

  prepareInvoiceData(): Invoice {
    const formValue = this.invoiceForm.value;

    // Preparar items (eliminar campos temporales)
    const invoice_items = formValue.invoice_items.map((item: any, index: number) => {
      const { _tempId, ...cleanItem } = item;
      return {
        ...cleanItem,
        orden: index + 1
      };
    });

    return {
      client: formValue.client,
      fecha_emision: formValue.fecha_emision,
      fecha_vencimiento: formValue.fecha_vencimiento || formValue.fecha_emision,
      tipo_operacion: formValue.tipo_operacion,
      forma_pago: formValue.forma_pago,
      medio_pago: formValue.medio_pago || formValue.forma_pago,
      observaciones: formValue.observaciones,
      subtotal: formValue.subtotal,
      total_iva: formValue.total_iva,
      total_ico: formValue.total_ico,
      total_descuentos: formValue.total_descuentos,
      total: formValue.total,
      estado_local: 'Borrador',
      enviar_email: false,
      invoice_items
    } as Invoice;
  }

  // ============================================
  // VALIDACIÓN
  // ============================================

  validateForm(): boolean {
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

    // Validar que todos los items tengan producto
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i).value;
      if (!item.product || !item.codigo_producto) {
        this.showError(`El ítem ${i + 1} debe tener un producto seleccionado`);
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
      this.showError('El total de la factura debe ser mayor a 0');
      return false;
    }

    return true;
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
    }).format(value);
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

  cancel(): void {
    if (confirm('¿Estás seguro de cancelar? Se perderán los cambios no guardados.')) {
      this.router.navigate(['/invoices']);
    }
  }
}