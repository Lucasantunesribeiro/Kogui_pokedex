import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { FeedbackComponent } from './components/feedback/feedback.component';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';
import { FeedbackService } from './services/feedback.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FeedbackComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly auth = inject(AuthService);

  readonly pokemonCount = signal<number | null>(null);
  readonly typesCount = 18;
  readonly generationCount = 9;
  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly userProfile = this.auth.profile;
  readonly isAdminUser = this.auth.isAdmin;

  ngOnInit(): void {
    this.loadCounters();

    const currentUser = this.auth.getCurrentUser();
    if (this.auth.isAuthenticated() && !currentUser) {
      this.auth.fetchCurrentUser().subscribe({
        error: () => this.auth.logout()
      });
    }
  }

  loadCounters(): void {
    this.api.listPokemon({ limit: 1, offset: 0 }).subscribe({
      next: (response) => this.pokemonCount.set(response.count),
      error: () => {
        this.pokemonCount.set(null);
        this.feedback.notifyError('Não foi possível carregar os contadores.');
      }
    });
  }

  isAdmin(): boolean {
    return this.isAdminUser();
  }

  logout(): void {
    this.auth.logout();
    this.feedback.notifyInfo('Sessão encerrada.');
  }
}
