import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService, UserProfile } from '../../services/auth.service';
import { FeedbackService } from '../../services/feedback.service';

interface CreateUserPayload {
  username: string;
  email?: string;
  password: string;
  password_confirm: string;
  is_staff: boolean;
}

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.css'
})
export class AdminUsersPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly actionLoading = signal(false);
  readonly users = signal<UserProfile[]>([]);
  readonly showCreateForm = signal(false);
  readonly editingUser = signal<UserProfile | null>(null);

  readonly createForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirm: ['', [Validators.required]],
    is_staff: [false]
  });

  readonly editForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.email]],
    is_staff: [false]
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.auth.listUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const message = err?.error?.detail ?? 'Não foi possível carregar os usuários.';
        this.feedback.notifyError(message);
      }
    });
  }

  toggleCreateForm(): void {
    this.showCreateForm.set(!this.showCreateForm());
    if (this.showCreateForm()) {
      this.createForm.reset();
      this.editingUser.set(null);
    }
  }

  startEditUser(user: UserProfile): void {
    this.editingUser.set(user);
    this.showCreateForm.set(false);
    this.editForm.patchValue({
      username: user.username,
      email: user.email || '',
      is_staff: user.is_staff
    });
  }

  cancelEdit(): void {
    this.editingUser.set(null);
    this.editForm.reset();
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    if (value.password !== value.password_confirm) {
      this.feedback.notifyError('A senha e a confirmação devem ser iguais.');
      return;
    }

    this.actionLoading.set(true);
    this.auth.createUser(value).subscribe({
      next: () => {
        this.feedback.notifySuccess('Usuário criado com sucesso.');
        this.createForm.reset();
        this.showCreateForm.set(false);
        this.loadUsers();
        this.actionLoading.set(false);
      },
      error: (err) => {
        const detail = err?.error?.username?.[0] ?? err?.error?.email?.[0] ?? err?.error?.detail ?? 'Não foi possível criar o usuário.';
        this.feedback.notifyError(detail);
        this.actionLoading.set(false);
      }
    });
  }

  submitEdit(): void {
    const user = this.editingUser();
    if (!user || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const value = this.editForm.getRawValue();
    this.actionLoading.set(true);

    this.auth.updateUser(user.id, value).subscribe({
      next: () => {
        this.feedback.notifySuccess('Usuário atualizado com sucesso.');
        this.editingUser.set(null);
        this.editForm.reset();
        this.loadUsers();
        this.actionLoading.set(false);
      },
      error: (err) => {
        const detail = err?.error?.username?.[0] ?? err?.error?.email?.[0] ?? err?.error?.detail ?? 'Não foi possível atualizar o usuário.';
        this.feedback.notifyError(detail);
        this.actionLoading.set(false);
      }
    });
  }

  deleteUser(user: UserProfile): void {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${user.username}"?`)) {
      return;
    }

    this.actionLoading.set(true);
    this.auth.deleteUser(user.id).subscribe({
      next: () => {
        this.feedback.notifySuccess('Usuário excluído com sucesso.');
        this.loadUsers();
        this.actionLoading.set(false);
      },
      error: (err) => {
        const detail = err?.error?.detail ?? 'Não foi possível excluir o usuário.';
        this.feedback.notifyError(detail);
        this.actionLoading.set(false);
      }
    });
  }

  getCurrentUser(): UserProfile | null {
    return this.auth.getCurrentUser();
  }

  canDeleteUser(user: UserProfile): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser?.id !== user.id;
  }
}
