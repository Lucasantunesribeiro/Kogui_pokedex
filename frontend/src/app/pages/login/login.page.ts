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

  readonly mode = signal<'login' | 'register'>('login');

  readonly loginForm: FormGroup = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly loginError = signal<string | null>(null);
  readonly registerErrors = signal<string[]>([]);

  readonly registerForm: FormGroup = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    email: ['', [Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  });

  switchMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
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
