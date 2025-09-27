import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';

import { FavoriteItem } from '../../services/api.service';
import { FeedbackService } from '../../services/feedback.service';
import { UserCollectionsStore } from '../../services/user-collections.store';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './favorites.page.html',
  styleUrl: './favorites.page.css'
})
export class FavoritesPageComponent implements OnInit {
  private readonly collections = inject(UserCollectionsStore);
  private readonly feedback = inject(FeedbackService);

  readonly favorites = this.collections.favorites;
  readonly loading = this.collections.favoritesLoading;

  ngOnInit(): void {
    if (!this.loading() && this.favorites().length === 0) {
      this.collections.refreshFavorites();
    }
  }

  removeFavorite(favorite: FavoriteItem): void {
    this.collections.removeFavorite(favorite).subscribe({
      next: () => this.feedback.notifyInfo('Favorito removido.'),
      error: () => this.feedback.notifyError('Erro ao remover favorito.')
    });
  }

  formatName(name?: string | null): string {
    if (!name) {
      return '';
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  formatId(id: number): string {
    return `#${String(id).padStart(3, '0')}`;
  }
}
