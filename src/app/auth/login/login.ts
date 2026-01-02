import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthServices } from '../../services/auth-services';
import { Subject, takeUntil } from 'rxjs';
import { trigger, transition, style, animate, keyframes } from '@angular/animations';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  animations: [
    // Animación fade in para mensajes
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ]),
    
    // Animación shake para errores
    trigger('shake', [
      transition(':enter', [
        animate('500ms ease-in-out', keyframes([
          style({ transform: 'translateX(0)', offset: 0 }),
          style({ transform: 'translateX(-10px)', offset: 0.2 }),
          style({ transform: 'translateX(10px)', offset: 0.4 }),
          style({ transform: 'translateX(-10px)', offset: 0.6 }),
          style({ transform: 'translateX(10px)', offset: 0.8 }),
          style({ transform: 'translateX(0)', offset: 1 })
        ]))
      ])
    ])
  ]
})
export class Login implements OnInit, OnDestroy {
  // Form y estado
  loginForm!: FormGroup;
  loading = false;
  success = false;
  error = '';
  returnUrl = '/dashboard';
  showPassword = false;
  
  // Subject para cleanup de subscripciones
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthServices,
    private router: Router,
    private route: ActivatedRoute
  ) {
    console.log('🔧 Login Component inicializado');
  }

  ngOnInit(): void {
    console.log('🚀 Login Component - ngOnInit');

    // Inicializar formulario con validaciones
    this.loginForm = this.fb.group({
      identifier: ['', [
        Validators.required, 
        Validators.email,
        Validators.minLength(5)
      ]],
      password: ['', [
        Validators.required, 
        Validators.minLength(6)
      ]]
    });

    // Obtener URL de retorno de query params
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    console.log('📍 Return URL:', this.returnUrl);

    // Si ya está autenticado, redirigir inmediatamente
    if (this.authService.isLoggedIn()) {
      console.log('✅ Usuario ya autenticado, redirigiendo...');
      this.router.navigate([this.returnUrl]);
      return;
    }

    // Limpiar error cuando el usuario escribe
    this.loginForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.error) {
          this.error = '';
        }
      });

    // Log de estado del formulario (solo en desarrollo)
    if (!this.isProduction()) {
      this.loginForm.statusChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(status => {
          console.log('📝 Form status:', status);
        });
    }
  }

  ngOnDestroy(): void {
    console.log('🧹 Login Component - cleanup');
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * 📤 Submit del formulario
   */
  onSubmit(): void {
    console.log('📤 Intentando submit del formulario...');

    // Marcar todos los campos como touched para mostrar errores
    this.markFormGroupTouched(this.loginForm);

    // Validar formulario
    if (this.loginForm.invalid) {
      console.warn('⚠️ Formulario inválido:', this.getFormErrors());
      return;
    }

    // Preparar datos
    const credentials = {
      identifier: this.loginForm.value.identifier.trim(),
      password: this.loginForm.value.password
    };

    console.log('🔐 Intentando login con:', credentials.identifier);

    // Actualizar UI
    this.loading = true;
    this.error = '';
    this.success = false;

    // Llamar al servicio de autenticación
    this.authService.login(credentials)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ Login exitoso:', {
            user: response.user.email,
            id: response.user.id
          });

          // Mostrar mensaje de éxito
          this.success = true;
          this.loading = false;

          // Esperar un momento antes de redirigir
          setTimeout(() => {
            console.log('🔄 Redirigiendo a:', this.returnUrl);
            this.router.navigate([this.returnUrl]);
          }, 800);
        },
        error: (error) => {
          console.error('❌ Error en login:', error);

          // Mostrar mensaje de error
          this.error = error.message || 'Error al iniciar sesión. Verifica tus credenciales.';
          this.loading = false;
          this.success = false;

          // Limpiar contraseña por seguridad
          this.loginForm.patchValue({ password: '' });

          // Focus en el campo de contraseña
          setTimeout(() => {
            const passwordInput = document.getElementById('password');
            passwordInput?.focus();
          }, 100);
        }
      });
  }

  /**
   * 👁️ Toggle mostrar/ocultar contraseña
   */
  togglePassword(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.showPassword = !this.showPassword;
    console.log('👁️ Password visible:', this.showPassword);
  }

  /**
   * 🧪 Llenar con credenciales demo
   */
  fillDemo(): void {
    console.log('🧪 Llenando credenciales demo...');
    
    this.loginForm.patchValue({
      identifier: 'admin@factus.com',
      password: 'Admin123'
    });

    // Marcar campos como touched
    this.loginForm.markAllAsTouched();

    // Focus en el botón de submit
    setTimeout(() => {
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitBtn?.focus();
    }, 100);
  }

  /**
   * ✅ Marcar todos los campos como touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * 🔍 Verificar si un campo tiene error
   */
  hasError(field: string, error?: string): boolean {
    const control = this.loginForm.get(field);
    if (!control) return false;

    // Si se especifica un error particular
    if (error) {
      return control.hasError(error) && (control.dirty || control.touched);
    }

    // Cualquier error
    return control.invalid && (control.dirty || control.touched);
  }

  /**
   * 📝 Obtener mensaje de error específico
   */
  getErrorMessage(field: string): string {
    const control = this.loginForm.get(field);
    if (!control) return '';

    // Errores de required
    if (control.hasError('required')) {
      return field === 'identifier' 
        ? 'El email es requerido' 
        : 'La contraseña es requerida';
    }

    // Errores de email
    if (control.hasError('email')) {
      return 'Ingresa un email válido';
    }

    // Errores de minlength
    if (control.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return field === 'identifier'
        ? `Email muy corto (mínimo ${minLength} caracteres)`
        : `Contraseña muy corta (mínimo ${minLength} caracteres)`;
    }

    return '';
  }

  /**
   * 🔍 Obtener todos los errores del formulario (debugging)
   */
  private getFormErrors(): any {
    const errors: any = {};
    
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      if (control && control.invalid) {
        errors[key] = control.errors;
      }
    });

    return errors;
  }

  /**
   * 🔧 Verificar si está en producción
   */
  private isProduction(): boolean {
    // Puedes importar environment si lo tienes configurado
    return false; // Cambiar según tu configuración
  }

  /**
   * 🎨 Obtener clase CSS para el campo
   */
  getFieldClass(field: string): string {
    const control = this.loginForm.get(field);
    if (!control) return '';

    if (control.invalid && (control.dirty || control.touched)) {
      return 'border-red-500 focus:border-red-500 focus:ring-red-100';
    }

    if (control.valid && control.touched) {
      return 'border-green-500 focus:border-green-500 focus:ring-green-100';
    }

    return 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100';
  }

  // ============================================
  // GETTERS PARA TEMPLATE
  // ============================================

  /**
   * Acceso rápido a los controles del formulario
   */
  get f() {
    return this.loginForm.controls;
  }

  /**
   * Verificar si el formulario es válido
   */
  get isFormValid(): boolean {
    return this.loginForm.valid;
  }

  /**
   * Verificar si hay algún campo con error
   */
  get hasAnyError(): boolean {
    return this.loginForm.invalid && this.loginForm.touched;
  }

  /**
   * Estado del botón de submit
   */
  get submitButtonDisabled(): boolean {
    return this.loading || this.success || this.loginForm.invalid;
  }
}