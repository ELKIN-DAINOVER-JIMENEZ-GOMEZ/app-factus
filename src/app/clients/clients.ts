/**
 * Componente de Crear Cliente
 * Ubicación: src/app/components/clients/create-client/create-client.component.ts
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ClientService, Client } from '../services/client.services';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-create-client',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './clients.html',
  
})
export class CreateClientComponent implements OnInit {
  clientForm!: FormGroup;
  
  // Estados
  loading = false;
  saving = false;
  
  // Validaciones asíncronas
  checkingDocument = false;
  checkingEmail = false;
  documentExists = false;
  emailExists = false;
  
  // Dígito de verificación automático
  autoCalculatedDV = '';
  
  // Errores
  errors: string[] = [];
  successMessage = '';

  // Opciones para selects
  tiposDocumento = [
    { value: 'CC', label: 'Cédula de Ciudadanía' },
    { value: 'NIT', label: 'NIT' },
    { value: 'CE', label: 'Cédula de Extranjería' },
    { value: 'TI', label: 'Tarjeta de Identidad' },
    { value: 'PP', label: 'Pasaporte' },
    { value: 'PEP', label: 'PEP' }
  ];

  tiposPersona = [
    { value: 'Natural', label: 'Persona Natural' },
    { value: 'Juridica', label: 'Persona Jurídica' }
  ];

  regimenesFiscales = [
    { value: 'responsable_iva', label: 'Responsable de IVA' },
    { value: 'no_responsable_iva', label: 'No Responsable de IVA' },
    { value: 'gran_contribuyente', label: 'Gran Contribuyente' },
    { value: 'simple', label: 'Régimen Simple' }
  ];

  // Ciudades principales de Colombia (puedes expandir esto)
  ciudades = [
    { nombre: 'Bogotá D.C.', codigo: '11001', departamento: 'Cundinamarca' },
    { nombre: 'Medellín', codigo: '05001', departamento: 'Antioquia' },
    { nombre: 'Cali', codigo: '76001', departamento: 'Valle del Cauca' },
    { nombre: 'Barranquilla', codigo: '08001', departamento: 'Atlántico' },
    { nombre: 'Cartagena', codigo: '13001', departamento: 'Bolívar' },
    { nombre: 'Cúcuta', codigo: '54001', departamento: 'Norte de Santander' },
    { nombre: 'Bucaramanga', codigo: '68001', departamento: 'Santander' },
    { nombre: 'Pereira', codigo: '66001', departamento: 'Risaralda' },
    { nombre: 'Santa Marta', codigo: '47001', departamento: 'Magdalena' },
    { nombre: 'Ibagué', codigo: '73001', departamento: 'Tolima' },
    { nombre: 'Pasto', codigo: '52001', departamento: 'Nariño' },
    { nombre: 'Manizales', codigo: '17001', departamento: 'Caldas' },
    { nombre: 'Villavicencio', codigo: '50001', departamento: 'Meta' },
    { nombre: 'Valledupar', codigo: '20001', departamento: 'Cesar' }
  ];

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.setupValidations();
  }

  // ============================================
  // INICIALIZACIÓN DEL FORMULARIO
  // ============================================

  initForm(): void {
    this.clientForm = this.fb.group({
      // Información básica
      nombre_completo: ['', [Validators.required, Validators.maxLength(255)]],
      tipo_documento: ['CC', Validators.required],
      numero_documento: ['', [Validators.required, Validators.maxLength(20)]],
      digito_verificacion: [''],
      
      // Información jurídica (opcional para personas naturales)
      razon_social: ['', Validators.maxLength(255)],
      nombre_comercial: ['', Validators.maxLength(255)],
      
      // Contacto
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', Validators.maxLength(20)],
      
      // Dirección
      direccion: ['', [Validators.required, Validators.maxLength(500)]],
      ciudad: ['', Validators.required],
      ciudad_codigo: ['', Validators.required],
      departamento: [''],
      codigo_postal: ['', Validators.maxLength(10)],
      
      // Clasificación fiscal
      tipo_persona: ['Natural', Validators.required],
      regimen_fiscal: ['responsable_iva', Validators.required],
      
      // Otros
      activo: [true],
      notas: ['']
    });

    // Configurar validaciones condicionales
    this.setupConditionalValidations();
  }

  // ============================================
  // VALIDACIONES
  // ============================================

  setupValidations(): void {
    // Validación de documento duplicado
    this.clientForm.get('numero_documento')?.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(value => {
        if (!value || value.length < 5) {
          this.documentExists = false;
          return of(false);
        }
        this.checkingDocument = true;
        return this.clientService.checkDocumentExists(value);
      })
    ).subscribe({
      next: (exists) => {
        this.checkingDocument = false;
        this.documentExists = exists;
        if (exists) {
          this.clientForm.get('numero_documento')?.setErrors({ duplicate: true });
        }
      },
      error: () => {
        this.checkingDocument = false;
      }
    });

    // Validación de email duplicado
    this.clientForm.get('email')?.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(value => {
        if (!value || !this.clientForm.get('email')?.valid) {
          this.emailExists = false;
          return of(false);
        }
        this.checkingEmail = true;
        return this.clientService.checkEmailExists(value);
      })
    ).subscribe({
      next: (exists) => {
        this.checkingEmail = false;
        this.emailExists = exists;
        if (exists) {
          this.clientForm.get('email')?.setErrors({ duplicate: true });
        }
      },
      error: () => {
        this.checkingEmail = false;
      }
    });

    // Calcular DV automáticamente para NIT
    this.clientForm.get('tipo_documento')?.valueChanges.subscribe(tipo => {
      if (tipo === 'NIT') {
        const numero = this.clientForm.get('numero_documento')?.value;
        if (numero) {
          this.calculateDV(numero);
        }
      } else {
        this.autoCalculatedDV = '';
        this.clientForm.get('digito_verificacion')?.setValue('');
      }
    });

    this.clientForm.get('numero_documento')?.valueChanges.subscribe(numero => {
      if (this.clientForm.get('tipo_documento')?.value === 'NIT' && numero) {
        this.calculateDV(numero);
      }
    });
  }

  setupConditionalValidations(): void {
    // Si es persona jurídica, razón social es requerida
    this.clientForm.get('tipo_persona')?.valueChanges.subscribe(tipo => {
      const razonSocialControl = this.clientForm.get('razon_social');
      
      if (tipo === 'Juridica') {
        razonSocialControl?.setValidators([Validators.required, Validators.maxLength(255)]);
        // Para personas jurídicas, sugerir NIT
        if (this.clientForm.get('tipo_documento')?.value === 'CC') {
          this.clientForm.get('tipo_documento')?.setValue('NIT');
        }
      } else {
        razonSocialControl?.setValidators([Validators.maxLength(255)]);
        razonSocialControl?.setValue('');
      }
      
      razonSocialControl?.updateValueAndValidity();
    });
  }

  // ============================================
  // MÉTODOS DE CÁLCULO
  // ============================================

  calculateDV(nit: string): void {
    const dv = this.clientService.calculateDigitoVerificacion(nit);
    this.autoCalculatedDV = dv;
    this.clientForm.get('digito_verificacion')?.setValue(dv);
  }

  // ============================================
  // MANEJO DE CIUDAD
  // ============================================

  onCiudadChange(event: any): void {
    const ciudadNombre = event.target.value;
    const ciudad = this.ciudades.find(c => c.nombre === ciudadNombre);
    
    if (ciudad) {
      this.clientForm.patchValue({
        ciudad_codigo: ciudad.codigo,
        departamento: ciudad.departamento
      });
    }
  }

  // ============================================
  // GUARDAR
  // ============================================

  save(): void {
    if (!this.validateForm()) return;

    this.saving = true;
    this.clearMessages();

    const clientData = this.prepareClientData();

    this.clientService.createClient(clientData).subscribe({
      next: (response) => {
        this.saving = false;
        this.showSuccess('Cliente creado exitosamente');
        
        // Notificar que se actualizó la lista de clientes
        this.clientService.notifyClientsUpdated();
        
        setTimeout(() => {
          this.router.navigate(['/clients', response.data.id]);
        }, 1500);
      },
      error: (error) => {
        this.saving = false;
        this.showError('Error creando cliente: ' + error.message);
      }
    });
  }

  saveAndNew(): void {
    if (!this.validateForm()) return;

    this.saving = true;
    this.clearMessages();

    const clientData = this.prepareClientData();

    this.clientService.createClient(clientData).subscribe({
      next: (response) => {
        this.saving = false;
        this.showSuccess('Cliente creado exitosamente');
        
        // Notificar que se actualizó la lista de clientes
        this.clientService.notifyClientsUpdated();
        
        // Resetear formulario para crear otro
        setTimeout(() => {
          this.clientForm.reset({
            tipo_documento: 'CC',
            tipo_persona: 'Natural',
            regimen_fiscal: 'responsable_iva',
            activo: true
          });
          this.clearMessages();
        }, 1500);
      },
      error: (error) => {
        this.saving = false;
        this.showError('Error creando cliente: ' + error.message);
      }
    });
  }

  // ============================================
  // PREPARACIÓN DE DATOS
  // ============================================

  prepareClientData(): Client {
    const formValue = this.clientForm.value;

    return {
      nombre_completo: formValue.nombre_completo.trim(),
      tipo_documento: formValue.tipo_documento,
      numero_documento: formValue.numero_documento.trim(),
      digito_verificacion: formValue.digito_verificacion?.trim() || undefined,
      razon_social: formValue.razon_social?.trim() || undefined,
      nombre_comercial: formValue.nombre_comercial?.trim() || undefined,
      email: formValue.email.trim().toLowerCase(),
      telefono: formValue.telefono?.trim() || undefined,
      direccion: formValue.direccion.trim(),
      ciudad: formValue.ciudad,
      ciudad_codigo: formValue.ciudad_codigo,
      departamento: formValue.departamento || undefined,
      codigo_postal: formValue.codigo_postal?.trim() || undefined,
      tipo_persona: formValue.tipo_persona,
      regimen_fiscal: formValue.regimen_fiscal,
      responsabilidades_fiscales: [],
      activo: formValue.activo,
      notas: formValue.notas?.trim() || undefined
    };
  }

  // ============================================
  // VALIDACIÓN
  // ============================================

  validateForm(): boolean {
    this.clearMessages();

    if (this.clientForm.invalid) {
      this.showError('Por favor completa todos los campos requeridos correctamente');
      this.markFormGroupTouched(this.clientForm);
      return false;
    }

    if (this.documentExists) {
      this.showError('El número de documento ya está registrado');
      return false;
    }

    if (this.emailExists) {
      this.showError('El email ya está registrado');
      return false;
    }

    // Validación específica para NIT
    if (this.clientForm.get('tipo_documento')?.value === 'NIT') {
      if (!this.clientForm.get('digito_verificacion')?.value) {
        this.showError('El dígito de verificación es requerido para NIT');
        return false;
      }
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

  isFieldInvalid(fieldName: string): boolean {
    const field = this.clientForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.clientForm.get(fieldName);
    
    if (field?.errors) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['email']) return 'Email inválido';
      if (field.errors['maxLength']) return 'Texto demasiado largo';
      if (field.errors['duplicate']) return 'Ya existe en el sistema';
    }
    
    return '';
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
    if (this.clientForm.dirty) {
      if (confirm('¿Estás seguro de cancelar? Se perderán los cambios no guardados.')) {
        this.router.navigate(['/clients']);
      }
    } else {
      this.router.navigate(['/clients']);
    }
  }
}