import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { FeedbackService } from '../../services/feedback.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css'
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);

  // Modo atual da tela de autenticação.
  // Agora suporta três modos: login, register e reset (redefinição de senha).
  readonly mode = signal<'login' | 'register' | 'reset'>('login');

  readonly loginForm: FormGroup = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly loginError = signal<string | null>(null);
  readonly registerErrors = signal<string[]>([]);

  // Estado para o formulário de redefinição de senha. Contém apenas o e‑mail.
  readonly resetForm: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });
  // Mensagem de erro para o reset, se houver.
  readonly resetError = signal<string | null>(null);

  readonly registerForm: FormGroup = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    email: ['', [Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  });

  switchMode(mode: 'login' | 'register'): void {
    // Resetamos mensagens de erro quando mudamos de modo
    this.loginError.set(null);
    this.registerErrors.set([]);
    this.resetError.set(null);
    // Reseta formulários para estado inicial ao alternar modos
    if (mode === 'login') {
      this.loginForm.reset();
    } else if (mode === 'register') {
      this.registerForm.reset();
    } else if (mode === 'reset') {
      this.resetForm.reset();
    }
    this.mode.set(mode as any);
  }

  submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loginError.set(null);
    const { username, password } = this.loginForm.getRawValue();

    this.auth.login({ username, password }).subscribe({
      next: () => {
        this.feedback.notifySuccess('Login realizado com sucesso!');
        this.router.navigateByUrl('/');
      },
      error: (err) => {
        const message = err?.error?.detail ?? 'Não foi possível realizar o login.';
        this.loginError.set(message);
        this.feedback.notifyError(message);
      }
    });
  }

  /**
   * Envia um pedido de redefinição de senha.
   * Valida o e‑mail e chama o AuthService; exibe mensagens via FeedbackService.
   */
  submitReset(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.resetError.set(null);
    const { email } = this.resetForm.getRawValue();
    // O AuthService deve implementar requestPasswordReset() que retorna um Observable
    (this.auth as any).requestPasswordReset({ email }).subscribe({
      next: () => {
        this.feedback.notifySuccess('E‑mail de redefinição enviado! Verifique sua caixa de entrada.');
        this.switchMode('login');
      },
      error: (err: any) => {
        const message = err?.error?.detail ?? 'Não foi possível enviar o e‑mail de redefinição.';
        this.resetError.set(message);
        this.feedback.notifyError(message);
      }
    });
  }

  submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.registerErrors.set([]);
    const { password, confirmPassword, ...rest } = this.registerForm.getRawValue();
    if (confirmPassword && password !== confirmPassword) {
      const mismatch = 'As senhas informadas não conferem.';
      this.registerErrors.set([mismatch]);
      this.feedback.notifyError(mismatch);
      return;
    }

    this.auth
      .register({
        username: rest.username,
        email: rest.email || undefined,
        password,
        password_confirm: confirmPassword || undefined
      })
      .subscribe({
        next: () => {
          this.feedback.notifySuccess('Cadastro realizado! Faça login para continuar.');
          this.switchMode('login');
          this.loginForm.reset();
          this.registerForm.reset();
          this.registerErrors.set([]);
        },
        error: (err) => {
          const messages = this.extractErrorMessages(err?.error);
          if (messages.length > 0) {
            this.registerErrors.set(messages);
            this.feedback.notifyError(messages[0]);
          } else {
            this.feedback.notifyError('Não foi possível concluir o cadastro.');
          }
        }
      });
  }

  private extractErrorMessages(error: unknown): string[] {
    if (!error || typeof error !== 'object') {
      return [];
    }

    const rawValues = Array.isArray(error) ? error : Object.values(error as Record<string, unknown>);
    const messages: string[] = [];

    for (const value of rawValues) {
      if (typeof value === 'string') {
        messages.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            messages.push(item);
          }
        }
      }
    }

    return messages;
  }
}
