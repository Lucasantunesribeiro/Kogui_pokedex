import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import { AuthService, UserProfile } from '../../services/auth.service';
import { FeedbackService } from '../../services/feedback.service';

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.css'
})
export class AdminUsersPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly loading = signal(false);
  readonly users = signal<UserProfile[]>([]);

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
}
