import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthServices } from '../../services/auth-services';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html'
})
export class Login implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  loading = false;
  success = false;
  error = '';
  returnUrl = '/invoices';
  showPassword = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthServices,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/invoices';

    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.returnUrl]);
      return;
    }

    this.clearErrorOnInput();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required, Validators.email, Validators.minLength(5)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  private clearErrorOnInput(): void {
    this.loginForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.error) this.error = '';
      });
  }

  onSubmit(): void {
    this.markFormGroupTouched(this.loginForm);

    if (this.loginForm.invalid) return;

    const credentials = {
      identifier: this.loginForm.value.identifier.trim(),
      password: this.loginForm.value.password
    };

    this.loading = true;
    this.error = '';
    this.success = false;

    this.authService.login(credentials)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.success = true;
          this.loading = false;
          setTimeout(() => this.router.navigate([this.returnUrl]), 800);
        },
        error: (error) => {
          this.error = error.message || 'Error al iniciar sesión. Verifica tus credenciales.';
          this.loading = false;
          this.loginForm.patchValue({ password: '' });
          this.focusPassword();
        }
      });
  }

  togglePassword(event?: Event): void {
    event?.preventDefault();
    this.showPassword = !this.showPassword;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private focusPassword(): void {
    setTimeout(() => document.getElementById('password')?.focus(), 100);
  }

  hasError(field: string): boolean {
    const control = this.loginForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  getErrorMessage(field: string): string {
    const control = this.loginForm.get(field);
    if (!control) return '';

    if (control.hasError('required')) {
      return field === 'identifier' ? 'El email es requerido' : 'La contraseña es requerida';
    }
    if (control.hasError('email')) {
      return 'Ingresa un email válido';
    }
    if (control.hasError('minlength')) {
      const min = control.errors?.['minlength'].requiredLength;
      return field === 'identifier' 
        ? `Email muy corto (mínimo ${min} caracteres)` 
        : `Contraseña muy corta (mínimo ${min} caracteres)`;
    }
    return '';
  }

  get f() {
    return this.loginForm.controls;
  }
}