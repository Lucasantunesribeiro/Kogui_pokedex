import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed, effect } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);

  readonly form: FormGroup = this.fb.nonNullable.group({
    current_password: ['', [Validators.required]],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    new_password_confirm: ['', [Validators.required]],
  });

  // UI state
  showCurrent = false;
  showNew = false;
  showConfirm = false;

  readonly error = signal<string | null>(null);

  // Força da senha (0–4)
  readonly strength = computed(() => this.passwordStrength(this.form.get('new_password')!.value || ''));
  readonly strengthLabel = computed(() => {
    const s = this.strength();
    return s <= 1 ? 'fraca' : s === 2 ? 'média' : s === 3 ? 'forte' : 'muito forte';
  });

  // Mismatch
  mismatch = false;
  constructor() {
    effect(() => {
      const np = this.form.get('new_password')!.value || '';
      const cp = this.form.get('new_password_confirm')!.value || '';
      this.mismatch = !!np && !!cp && np !== cp;
    });
  }

  touched(ctrl: string): boolean {
    const c = this.form.get(ctrl);
    return !!c && (c.touched || c.dirty);
  }

  toggle(which: 'current' | 'new' | 'confirm'): void {
    if (which === 'current') this.showCurrent = !this.showCurrent;
    if (which === 'new') this.showNew = !this.showNew;
    if (which === 'confirm') this.showConfirm = !this.showConfirm;
  }

  submit(): void {
    if (this.form.invalid || this.mismatch) {
      this.form.markAllAsTouched();
      return;
    }
    const { current_password, new_password, new_password_confirm } = this.form.getRawValue();

    this.error.set(null);
    this.auth.changePassword({ current_password, new_password, new_password_confirm }).subscribe({
      next: () => {
        this.feedback.notifySuccess('Senha alterada com sucesso!');
        this.router.navigateByUrl('/');
      },
      error: (err) => {
        const msg = err?.error?.detail || 'Não foi possível alterar a senha.';
        this.error.set(msg);
        this.feedback.notifyError(msg);
      }
    });
  }

  private passwordStrength(value: string): number {
    let score = 0;
    if (!value) return score;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    return Math.min(score, 4);
  }
}
