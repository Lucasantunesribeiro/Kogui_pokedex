import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { FeedbackService } from '../../services/feedback.service';

@Component({
  selector: 'app-password-reset-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './password-reset.page.html',
  styleUrl: './password-reset.page.css'
})
export class PasswordResetPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly mode = signal<'change' | 'request' | 'confirm'>('change');
  readonly uid = signal<string | null>(null);
  readonly token = signal<string | null>(null);

  readonly changeForm = this.fb.nonNullable.group({
    current_password: ['', [Validators.required]],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    new_password_confirm: ['', [Validators.required]]
  });

  readonly requestForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  readonly confirmForm = this.fb.nonNullable.group({
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    new_password_confirm: ['', [Validators.required]]
  });

  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());
  readonly pageTitle = computed(() => {
    switch (this.mode()) {
      case 'request': return 'Redefinir Senha';
      case 'confirm': return 'Nova Senha';
      default: return 'Alterar Senha';
    }
  });

  ngOnInit(): void {
    const url = this.router.url;
    const params = this.route.snapshot.paramMap;

    if (url.includes('/password-reset')) {
      const uid = params.get('uid');
      const token = params.get('token');

      if (uid && token) {
        this.mode.set('confirm');
        this.uid.set(uid);
        this.token.set(token);
      } else {
        this.mode.set('request');
      }
    } else {
      this.mode.set('change');
    }
  }

  submitChange(): void {
    if (this.changeForm.invalid) {
      this.changeForm.markAllAsTouched();
      return;
    }

    const value = this.changeForm.getRawValue();
    if (value.new_password !== value.new_password_confirm) {
      this.feedback.notifyError('A nova senha e a confirmação devem ser iguais.');
      return;
    }

    this.loading.set(true);
    this.auth.changePassword(value).subscribe({
      next: () => {
        this.feedback.notifySuccess('Senha atualizada com sucesso.');
        this.changeForm.reset();
        this.loading.set(false);
      },
      error: (err) => {
        const detail = err?.error?.detail ?? err?.error?.new_password?.[0] ?? 'Não foi possível alterar a senha.';
        this.feedback.notifyError(detail);
        this.loading.set(false);
      }
    });
  }

  submitRequest(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    const email = this.requestForm.getRawValue().email;
    this.loading.set(true);

    this.auth.requestPasswordReset(email).subscribe({
      next: (response) => {
        this.feedback.notifySuccess(response.detail);
        this.requestForm.reset();
        this.loading.set(false);
      },
      error: (err) => {
        const detail = err?.error?.email?.[0] ?? err?.error?.detail ?? 'Não foi possível enviar o e-mail.';
        this.feedback.notifyError(detail);
        this.loading.set(false);
      }
    });
  }

  submitConfirm(): void {
    if (this.confirmForm.invalid) {
      this.confirmForm.markAllAsTouched();
      return;
    }

    const value = this.confirmForm.getRawValue();
    if (value.new_password !== value.new_password_confirm) {
      this.feedback.notifyError('A nova senha e a confirmação devem ser iguais.');
      return;
    }

    const uid = this.uid();
    const token = this.token();
    if (!uid || !token) {
      this.feedback.notifyError('Link de redefinição inválido.');
      return;
    }

    this.loading.set(true);
    this.auth.confirmPasswordReset({
      uid,
      token,
      new_password: value.new_password,
      new_password_confirm: value.new_password_confirm
    }).subscribe({
      next: (response) => {
        this.feedback.notifySuccess(response.detail);
        this.router.navigate(['/login']);
      },
      error: (err) => {
        const detail = err?.error?.new_password?.[0] ?? err?.error?.token?.[0] ?? err?.error?.uid?.[0] ?? err?.error?.detail ?? 'Não foi possível redefinir a senha.';
        this.feedback.notifyError(detail);
        this.loading.set(false);
      }
    });
  }
}
