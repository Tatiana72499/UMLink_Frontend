import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthSessionService } from '../../../core';
import { AuthApiService } from '../data-access/auth-api.service';
import { LoginRequest, RegisterRequest } from '../models/auth.model';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AuthApiService);
  private readonly session = inject(AuthSessionService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly returnUrl = this.sharedReturnUrl(this.route.snapshot.queryParamMap?.get('returnUrl') ?? null);

  readonly mode = (this.route.snapshot.data['mode'] as AuthMode | undefined) ?? 'login';
  readonly isRegistering = computed(() => this.mode === 'register');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly emailServerError = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(8)]],
  });

  constructor() {
    if (!this.isRegistering()) {
      this.form.controls.name.clearValidators();
      this.form.controls.name.updateValueAndValidity();
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.emailServerError.set('');
    const { name, email, password } = this.form.getRawValue();
    const request = this.isRegistering()
      ? this.api.register({ name, email, password } satisfies RegisterRequest)
      : this.api.login({ email, password } satisfies LoginRequest);

    request.subscribe({
      next: (response) => {
        this.session.save(response);
        void this.router.navigateByUrl(this.returnUrl ?? '/projects');
      },
      error: (error: HttpErrorResponse) => {
        this.showRequestError(error);
        this.isSubmitting.set(false);
      },
    });
  }

  nameError(): string {
    const errors = this.form.controls.name.errors;
    if (!this.form.controls.name.touched || !errors) {
      return '';
    }
    return errors['required'] ? 'El nombre es obligatorio.' : 'El nombre puede tener como máximo 120 caracteres.';
  }

  emailError(): string {
    if (this.emailServerError()) {
      return this.emailServerError();
    }
    const errors = this.form.controls.email.errors;
    if (!this.form.controls.email.touched || !errors) {
      return '';
    }
    if (errors['required']) {
      return 'El correo electrónico es obligatorio.';
    }
    if (errors['email']) {
      return 'Escribe un correo electrónico válido, por ejemplo: nombre@correo.com.';
    }
    return 'El correo puede tener como máximo 160 caracteres.';
  }

  passwordError(): string {
    const errors = this.form.controls.password.errors;
    if (!this.form.controls.password.touched || !errors) {
      return '';
    }
    if (errors['required']) {
      return 'La contraseña es obligatoria.';
    }
    if (errors['minlength']) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    return 'La contraseña puede tener como máximo 8 caracteres.';
  }

  clearEmailServerError(): void {
    this.emailServerError.set('');
  }

  private sharedReturnUrl(value: string | null): string | null {
    return value?.startsWith('/projects/') && !value.startsWith('//') ? value : null;
  }

  private showRequestError(error: HttpErrorResponse): void {
    const message = typeof error.error?.error === 'string' ? error.error.error : '';
    if (this.isRegistering() && message.toLowerCase().includes('correo')) {
      this.emailServerError.set(message);
      return;
    }
    this.errorMessage.set(this.isRegistering()
      ? 'No pudimos crear tu cuenta. Revisa los datos e inténtalo nuevamente.'
      : 'Correo o contraseña incorrectos. Inténtalo nuevamente.');
  }
}
