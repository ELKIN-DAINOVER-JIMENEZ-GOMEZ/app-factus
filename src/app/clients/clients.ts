import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ClientService, Client, Municipality } from '../services/client.services';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { of, Subject } from 'rxjs';

@Component({
  selector: 'app-create-client',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './clients.html'
})
export class CreateClientComponent implements OnInit, OnDestroy {
  @ViewChild('municipalityInput') municipalityInput!: ElementRef;
  
  clientForm!: FormGroup;
  
  loading = false;
  saving = false;
  checkingDocument = false;
  checkingEmail = false;
  documentExists = false;
  emailExists = false;
  autoCalculatedDV = '';
  errors: string[] = [];
  successMessage = '';

  municipalitySearch = '';
  municipalitySuggestions: Municipality[] = [];
  showMunicipalitySuggestions = false;
  loadingMunicipalities = false;
  selectedMunicipality: Municipality | null = null;
  highlightedIndex = -1;
  
  private destroy$ = new Subject<void>();

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

  ciudades: any[] = [];

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.setupValidations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.clientForm = this.fb.group({
      nombre_completo: ['', [Validators.required, Validators.maxLength(255)]],
      tipo_documento: ['CC', Validators.required],
      numero_documento: ['', [Validators.required, Validators.maxLength(20)]],
      digito_verificacion: [''],
      razon_social: ['', Validators.maxLength(255)],
      nombre_comercial: ['', Validators.maxLength(255)],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', Validators.maxLength(20)],
      direccion: ['', [Validators.required, Validators.maxLength(500)]],
      ciudad: ['', Validators.required],
      ciudad_codigo: ['', Validators.required],
      departamento: [''],
      codigo_postal: ['', Validators.maxLength(10)],
      tipo_persona: ['Natural', Validators.required],
      regimen_fiscal: ['responsable_iva', Validators.required],
      activo: [true],
      notas: ['']
    });

    this.setupConditionalValidations();
  }

  private setupValidations(): void {
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
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (exists) => {
        this.checkingDocument = false;
        this.documentExists = exists;
        if (exists) {
          this.clientForm.get('numero_documento')?.setErrors({ duplicate: true });
        }
      },
      error: () => this.checkingDocument = false
    });

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
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (exists) => {
        this.checkingEmail = false;
        this.emailExists = exists;
        if (exists) {
          this.clientForm.get('email')?.setErrors({ duplicate: true });
        }
      },
      error: () => this.checkingEmail = false
    });

    this.clientForm.get('tipo_documento')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(tipo => {
        if (tipo === 'NIT') {
          const numero = this.clientForm.get('numero_documento')?.value;
          if (numero) this.calculateDV(numero);
        } else {
          this.autoCalculatedDV = '';
          this.clientForm.get('digito_verificacion')?.setValue('');
        }
      });

    this.clientForm.get('numero_documento')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(numero => {
        if (this.clientForm.get('tipo_documento')?.value === 'NIT' && numero) {
          this.calculateDV(numero);
        }
      });
  }

  private setupConditionalValidations(): void {
    this.clientForm.get('tipo_persona')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(tipo => {
        const razonSocialControl = this.clientForm.get('razon_social');
        
        if (tipo === 'Juridica') {
          razonSocialControl?.setValidators([Validators.required, Validators.maxLength(255)]);
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

  private calculateDV(nit: string): void {
    const dv = this.clientService.calculateDigitoVerificacion(nit);
    this.autoCalculatedDV = dv;
    this.clientForm.get('digito_verificacion')?.setValue(dv);
  }

  onCiudadChange(event: any): void {
    // Legacy - usar selectMunicipality() en su lugar
  }

  save(): void {
    if (!this.validateForm()) return;

    this.saving = true;
    this.clearMessages();

    this.clientService.createClient(this.prepareClientData()).subscribe({
      next: (response) => {
        this.saving = false;
        this.showSuccess('Cliente creado exitosamente');
        this.clientService.notifyClientsUpdated();
        setTimeout(() => this.router.navigate(['/clients', response.data.id]), 1500);
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

    this.clientService.createClient(this.prepareClientData()).subscribe({
      next: () => {
        this.saving = false;
        this.showSuccess('Cliente creado exitosamente');
        this.clientService.notifyClientsUpdated();
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

  private prepareClientData(): Client {
    const f = this.clientForm.value;
    return {
      nombre_completo: f.nombre_completo.trim(),
      tipo_documento: f.tipo_documento,
      numero_documento: f.numero_documento.trim(),
      digito_verificacion: f.digito_verificacion?.trim() || undefined,
      razon_social: f.razon_social?.trim() || undefined,
      nombre_comercial: f.nombre_comercial?.trim() || undefined,
      email: f.email.trim().toLowerCase(),
      telefono: f.telefono?.trim() || undefined,
      direccion: f.direccion.trim(),
      ciudad: f.ciudad,
      ciudad_codigo: f.ciudad_codigo,
      departamento: f.departamento || undefined,
      codigo_postal: f.codigo_postal?.trim() || undefined,
      tipo_persona: f.tipo_persona,
      regimen_fiscal: f.regimen_fiscal,
      responsabilidades_fiscales: [],
      activo: f.activo,
      notas: f.notas?.trim() || undefined
    };
  }

  private validateForm(): boolean {
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

    if (this.clientForm.get('tipo_documento')?.value === 'NIT' && 
        !this.clientForm.get('digito_verificacion')?.value) {
      this.showError('El dígito de verificación es requerido para NIT');
      return false;
    }

    return true;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  onMunicipalitySearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.municipalitySearch = input.value;
    this.highlightedIndex = -1;

    if (this.municipalitySearch.length < 2) {
      this.municipalitySuggestions = [];
      this.showMunicipalitySuggestions = false;
      return;
    }

    this.loadingMunicipalities = true;
    this.showMunicipalitySuggestions = true;

    this.clientService.searchMunicipalities(this.municipalitySearch)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (municipalities) => {
          this.municipalitySuggestions = municipalities;
          this.loadingMunicipalities = false;
        },
        error: () => {
          this.loadingMunicipalities = false;
          this.municipalitySuggestions = [];
        }
      });
  }

  selectMunicipality(municipality: Municipality): void {
    this.selectedMunicipality = municipality;
    this.municipalitySearch = municipality.name;
    
    this.clientForm.patchValue({
      ciudad: municipality.name,
      ciudad_codigo: municipality.id.toString(),
      departamento: municipality.department
    });

    this.showMunicipalitySuggestions = false;
    this.municipalitySuggestions = [];
    this.highlightedIndex = -1;
  }

  onMunicipalityKeydown(event: KeyboardEvent): void {
    if (!this.showMunicipalitySuggestions || this.municipalitySuggestions.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.municipalitySuggestions.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.highlightedIndex >= 0) {
          this.selectMunicipality(this.municipalitySuggestions[this.highlightedIndex]);
        }
        break;
      case 'Escape':
        this.showMunicipalitySuggestions = false;
        this.highlightedIndex = -1;
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.municipality-autocomplete')) {
      this.showMunicipalitySuggestions = false;
    }
  }

  clearMunicipality(): void {
    this.selectedMunicipality = null;
    this.municipalitySearch = '';
    this.clientForm.patchValue({
      ciudad: '',
      ciudad_codigo: '',
      departamento: ''
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.clientForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.clientForm.get(fieldName);
    if (!field?.errors) return '';
    
    if (field.errors['required']) return 'Este campo es requerido';
    if (field.errors['email']) return 'Email inválido';
    if (field.errors['maxLength']) return 'Texto demasiado largo';
    if (field.errors['duplicate']) return 'Ya existe en el sistema';
    
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