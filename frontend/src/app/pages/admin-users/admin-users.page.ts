import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, UserProfile } from '../../services/auth.service';
import { FeedbackService } from '../../services/feedback.service';

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.css'
})
export class AdminUsersPageComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FeedbackService);

  users = signal<UserProfile[]>([]);
  loading = signal(false);
  resetRow = signal<number | null>(null);

  createForm: FormGroup = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    email: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirm: ['', [Validators.required]],
    is_staff: [false],
  });

  resetForm: FormGroup = this.fb.nonNullable.group({
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    new_password_confirm: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.load();
  }

  trackById = (_: number, u: UserProfile) => u.id;

  isCurrentUser(userId: number): boolean {
    const currentUser = this.auth.getCurrentUser();
    return currentUser?.id === userId;
  }

  load(): void {
    this.loading.set(true);
    console.log('[AdminUsers] Carregando usuários...');
    this.auth.listUsers().subscribe({
      next: (data: UserProfile[]) => {
        console.log('[AdminUsers] Resposta recebida:', data);
        const users = Array.isArray(data) ? data : [];
        console.log('[AdminUsers] Usuários processados:', users);
        this.users.set([...users]);
      },
      error: (err: any) => {
        console.error('[AdminUsers] Erro ao carregar usuários:', err);
        console.error('[AdminUsers] Status:', err?.status);
        console.error('[AdminUsers] Mensagem:', err?.error);
        this.feedback.notifyError('Falha ao carregar usuários.');
      },
      complete: () => {
        console.log('[AdminUsers] Requisição concluída');
        this.loading.set(false);
      },
    });
  }

  openReset(userId: number): void {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      this.feedback.notifyError('Não é possível redefinir sua própria senha por este painel. Use a opção "Alterar Senha" no menu.');
      return;
    }
    this.resetRow.set(userId);
    this.resetForm.reset();
  }

  closeReset(): void {
    this.resetRow.set(null);
  }

  submitCreate(): void {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }

    const { password, password_confirm, ...rest } = this.createForm.getRawValue();
    if (password !== password_confirm) {
      this.feedback.notifyError('As senhas não conferem.');
      return;
    }

    this.loading.set(true);
    this.auth.createUser({ ...rest, password, password_confirm }).subscribe({
      next: () => {
        this.feedback.notifySuccess('Usuário criado.');
        this.createForm.reset({ is_staff: false });
        this.load();
      },
      error: (err: any) => this.feedback.notifyError(err?.error?.detail || 'Falha ao criar usuário.'),
      complete: () => this.loading.set(false),
    });
  }

  toggleAdmin(u: UserProfile): void {
    this.loading.set(true);
    this.auth.updateUser(u.id, { is_staff: !u.is_staff }).subscribe({
      next: () => {
        this.feedback.notifySuccess('Perfil atualizado.');
        // Atualiza local sem mais uma chamada:
        this.users.set(this.users().map(x => x.id === u.id ? { ...x, is_staff: !u.is_staff } : x));
      },
      error: () => this.feedback.notifyError('Falha ao atualizar perfil.'),
      complete: () => this.loading.set(false),
    });
  }

  remove(u: UserProfile): void {
    if (this.isCurrentUser(u.id)) {
      this.feedback.notifyError('Não é possível excluir sua própria conta.');
      return;
    }
    if (!confirm(`Remover usuário ${u.username}?`)) return;
    this.loading.set(true);
    this.auth.deleteUser(u.id).subscribe({
      next: () => {
        this.feedback.notifySuccess('Usuário removido.');
        this.users.set(this.users().filter(x => x.id !== u.id));
      },
      error: () => this.feedback.notifyError('Falha ao remover usuário.'),
      complete: () => this.loading.set(false),
    });
  }

  submitReset(userId: number): void {
    if (this.resetForm.invalid) { this.resetForm.markAllAsTouched(); return; }

    const payload = this.resetForm.getRawValue();
    if (payload.new_password !== payload.new_password_confirm) {
      this.feedback.notifyError('As senhas não conferem.');
      return;
    }

    this.loading.set(true);
    this.auth.adminResetPassword(userId, payload).subscribe({
      next: () => {
        this.feedback.notifySuccess('Senha redefinida.');
        this.closeReset();
      },
      error: () => this.feedback.notifyError('Falha ao redefinir senha.'),
      complete: () => this.loading.set(false),
    });
  }
}
