/**
 * Componente de Crear/Editar Producto
 * Ubicación: src/app/components/products/create-product/create-product.component.ts
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ProductService, Product } from '../../services/products.services';

@Component({
  selector: 'app-create-product',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './create-product.html',
  styleUrl: './create-product.css'
})
export class CreateProductComponent implements OnInit {
  productForm!: FormGroup;
  
  // Estados
  loading = false;
  saving = false;
  isEditMode = false;
  productId: string | null = null;
  
  // Datos
  product: Product | null = null;
  
  // Opciones
  tiposProducto: any[] = [];
  unidadesMedida: any[] = [];
  porcentajesIVA: any[] = [];
  
  // Mensajes
  errors: string[] = [];
  successMessage = '';

  // Precio calculado con impuestos
  calculatedPrice = {
    base: 0,
    iva: 0,
    ico: 0,
    total: 0
  };

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Inicializar opciones desde el servicio
    this.tiposProducto = this.productService.TIPOS_PRODUCTO;
    this.unidadesMedida = this.productService.UNIDADES_MEDIDA;
    this.porcentajesIVA = this.productService.PORCENTAJES_IVA;

    // Verificar si es modo edición
    this.productId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.productId;

    this.initForm();

    if (this.isEditMode && this.productId) {
      this.loadProduct(this.productId);
    }

    // Calcular precio con impuestos en tiempo real
    this.productForm.valueChanges.subscribe(() => {
      this.calculatePrice();
    });
  }

  // ============================================
  // INICIALIZACIÓN DEL FORMULARIO
  // ============================================

  initForm(): void {
    this.productForm = this.fb.group({
      // Información básica
      codigo: ['', [Validators.required, Validators.maxLength(50)]],
      nombre: ['', [Validators.required, Validators.maxLength(255)]],
      descripcion: [''],
      tipo: ['producto', Validators.required],
      
      // Precio y unidad
      precio_unitario: [0, [Validators.required, Validators.min(0)]],
      unidad_medida: ['UND', Validators.required],
      unidad_medida_id: [70],
      
      // Códigos
      codigo_unspsc: ['', Validators.maxLength(10)],
      codigo_estandar_id: [1],
      esquema_id: ['1'],
      
      // Impuestos
      iva_porcentaje: [19, [Validators.required, Validators.min(0), Validators.max(100)]],
      aplica_iva: [true],
      ico_porcentaje: [0, [Validators.min(0), Validators.max(100)]],
      aplica_ico: [false],
      ica_porcentaje: [0, [Validators.min(0), Validators.max(100)]],
      aplica_ica: [false],
      
      // Retenciones (opcional)
      retenciones: [[]],
      tributo_id: [1],
      
      // Inventario
      stock_actual: [0, [Validators.min(0)]],
      stock_minimo: [0, [Validators.min(0)]],
      
      // Estado
      activo: [true]
    });

    // Actualizar unidad_medida_id cuando cambie unidad_medida
    this.productForm.get('unidad_medida')?.valueChanges.subscribe(value => {
      const unidad = this.unidadesMedida.find(u => u.value === value);
      if (unidad) {
        this.productForm.patchValue({ unidad_medida_id: unidad.id }, { emitEvent: false });
      }
    });

    // Deshabilitar porcentaje de IVA si no aplica
    this.productForm.get('aplica_iva')?.valueChanges.subscribe(aplica => {
      if (!aplica) {
        this.productForm.patchValue({ iva_porcentaje: 0 }, { emitEvent: false });
      } else {
        this.productForm.patchValue({ iva_porcentaje: 19 }, { emitEvent: false });
      }
    });

    // Deshabilitar porcentaje de ICO si no aplica
    this.productForm.get('aplica_ico')?.valueChanges.subscribe(aplica => {
      if (!aplica) {
        this.productForm.patchValue({ ico_porcentaje: 0 }, { emitEvent: false });
      }
    });
  }

  // ============================================
  // CARGA DE DATOS
  // ============================================

  loadProduct(id: string): void {
    this.loading = true;
    
    this.productService.getProduct(id).subscribe({
      next: (response) => {
        this.product = response.data;
        this.populateForm(this.product);
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error cargando producto:', error);
        this.showError('Error cargando producto: ' + error.message);
        this.loading = false;
      }
    });
  }

  populateForm(product: Product): void {
    this.productForm.patchValue({
      codigo: product.codigo,
      nombre: product.nombre,
      descripcion: product.descripcion,
      tipo: product.tipo,
      precio_unitario: product.precio_unitario,
      unidad_medida: product.unidad_medida,
      unidad_medida_id: product.unidad_medida_id,
      codigo_unspsc: product.codigo_unspsc,
      codigo_estandar_id: product.codigo_estandar_id,
      esquema_id: product.esquema_id,
      iva_porcentaje: product.iva_porcentaje,
      aplica_iva: product.aplica_iva,
      ico_porcentaje: product.ico_porcentaje,
      aplica_ico: product.aplica_ico,
      ica_porcentaje: product.ica_porcentaje,
      aplica_ica: product.aplica_ica,
      retenciones: product.retenciones,
      tributo_id: product.tributo_id,
      stock_actual: product.stock_actual,
      stock_minimo: product.stock_minimo,
      activo: product.activo
    });
  }

  // ============================================
  // GUARDAR
  // ============================================

  async save(): Promise<void> {
    if (!await this.validateForm()) {
      return;
    }

    this.saving = true;
    this.clearMessages();

    const productData = this.prepareProductData();

    if (this.isEditMode && this.productId) {
      // Actualizar
      this.productService.updateProduct(this.productId, productData).subscribe({
        next: () => {
          this.saving = false;
          this.showSuccess('Producto actualizado exitosamente');
          setTimeout(() => {
            this.router.navigate(['/products']);
          }, 1500);
        },
        error: (error) => {
          this.saving = false;
          this.showError('Error actualizando producto: ' + error.message);
        }
      });
    } else {
      // Crear
      this.productService.createProduct(productData).subscribe({
        next: () => {
          this.saving = false;
          this.showSuccess('Producto creado exitosamente');
          setTimeout(() => {
            this.router.navigate(['/products']);
          }, 1500);
        },
        error: (error) => {
          this.saving = false;
          this.showError('Error creando producto: ' + error.message);
        }
      });
    }
  }

  prepareProductData(): Product {
    const formValue = this.productForm.value;

    return {
      codigo: formValue.codigo.trim(),
      nombre: formValue.nombre.trim(),
      descripcion: formValue.descripcion?.trim() || '',
      tipo: formValue.tipo,
      precio_unitario: parseFloat(formValue.precio_unitario),
      unidad_medida: formValue.unidad_medida,
      unidad_medida_id: formValue.unidad_medida_id,
      codigo_unspsc: formValue.codigo_unspsc?.trim() || '',
      codigo_estandar_id: formValue.codigo_estandar_id,
      iva_porcentaje: parseFloat(formValue.iva_porcentaje),
      aplica_iva: formValue.aplica_iva,
      ico_porcentaje: parseFloat(formValue.ico_porcentaje),
      aplica_ico: formValue.aplica_ico,
      ica_porcentaje: parseFloat(formValue.ica_porcentaje),
      aplica_ica: formValue.aplica_ica,
      retenciones: formValue.retenciones || [],
      esquema_id: formValue.esquema_id,
      tributo_id: formValue.tributo_id,
      stock_actual: parseInt(formValue.stock_actual),
      stock_minimo: parseInt(formValue.stock_minimo),
      activo: formValue.activo
    } as Product;
  }

  // ============================================
  // VALIDACIÓN
  // ============================================

  async validateForm(): Promise<boolean> {
    this.clearMessages();

    if (this.productForm.invalid) {
      this.showError('Por favor completa todos los campos requeridos');
      this.markFormGroupTouched(this.productForm);
      return false;
    }

    // Validar código único
    const codigo = this.productForm.value.codigo.trim();
    try {
      const exists = await this.productService.checkCodeExists(
        codigo,
        this.productId || undefined
      ).toPromise();
      
      if (exists) {
        this.showError(`El código "${codigo}" ya está en uso`);
        return false;
      }
    } catch (error) {
      console.error('Error verificando código:', error);
    }

    return true;
  }

  markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  // ============================================
  // CÁLCULOS
  // ============================================

  calculatePrice(): void {
    const precio = parseFloat(this.productForm.value.precio_unitario) || 0;
    const iva = parseFloat(this.productForm.value.iva_porcentaje) || 0;
    const ico = parseFloat(this.productForm.value.ico_porcentaje) || 0;

    this.calculatedPrice = this.productService.calculatePriceWithTax(precio, iva, ico);
  }

  // ============================================
  // UTILIDADES
  // ============================================

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
    if (this.productForm.dirty) {
      if (confirm('¿Estás seguro de cancelar? Se perderán los cambios no guardados.')) {
        this.router.navigate(['/products']);
      }
    } else {
      this.router.navigate(['/products']);
    }
  }

  // ============================================
  // HELPERS PARA EL TEMPLATE
  // ============================================

  isFieldInvalid(fieldName: string): boolean {
    const field = this.productForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.productForm.get(fieldName);
    
    if (field?.errors) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['maxLength']) return `Máximo ${field.errors['maxLength'].requiredLength} caracteres`;
      if (field.errors['min']) return `Valor mínimo: ${field.errors['min'].min}`;
      if (field.errors['max']) return `Valor máximo: ${field.errors['max'].max}`;
    }
    
    return '';
  }
}