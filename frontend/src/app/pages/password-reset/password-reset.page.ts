import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { FeedbackService } from '../../services/feedback.service';

@Component({
  selector: 'app-password-reset-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './password-reset.page.html',
  styleUrl: './password-reset.page.css'
})
export class PasswordResetPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly form = this.fb.nonNullable.group({
    current_password: ['', [Validators.required]],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    new_password_confirm: ['', [Validators.required]]
  });

  readonly loading = signal(false);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.new_password !== value.new_password_confirm) {
      this.feedback.notifyError('A nova senha e a confirmação devem ser iguais.');
      return;
    }

    this.loading.set(true);
    this.auth.changePassword(value).subscribe({
      next: () => {
        this.feedback.notifySuccess('Senha atualizada com sucesso.');
        this.form.reset();
        this.loading.set(false);
      },
      error: (err) => {
        const detail = err?.error?.detail ?? err?.error?.new_password?.[0] ?? 'Não foi possível alterar a senha.';
        this.feedback.notifyError(detail);
        this.loading.set(false);
      }
    });
  }
}
