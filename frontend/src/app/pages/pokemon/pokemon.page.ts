import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiService, FavoriteItem, PokemonListItem, TeamSlotItem } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { FeedbackService } from '../../services/feedback.service';
import { UserCollectionsStore } from '../../services/user-collections.store';

interface CardPokemon {
  id: number;
  dex: string;
  name: string;
  img: string;
  types: string[];
  hp: number;
  attack: number;
  defense: number;
}

@Component({
  selector: 'app-pokemon-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pokemon.page.html',
  styleUrls: ['./pokemon.page.css'],
})
export class PokemonPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly collections = inject(UserCollectionsStore);

  private readonly PAGE_SIZE = 20;

  // Estado de paginação server-side
  readonly pokemons = signal<CardPokemon[]>([]);
  readonly isLoading = signal(false);
  readonly total = signal(0);
  private currentOffset = 0;

  readonly hasMore = computed(() => this.pokemons().length < this.total());

  // Filtro de tipo (server-side)
  readonly selectedType = signal<string>('all');

  // Coleções do usuário
  readonly favoriteMap = computed(() => {
    const map = new Map<number, FavoriteItem>();
    for (const it of this.collections.favorites() ?? []) map.set(it.pokemon_id, it);
    return map;
  });

  readonly teamMap = computed(() => {
    const map = new Map<number, TeamSlotItem>();
    for (const it of this.collections.team() ?? []) map.set(it.pokemon_id, it);
    return map;
  });

  readonly typeList = [
    'all', 'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting',
    'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon',
    'dark', 'steel', 'fairy',
  ] as const;

  readonly typeColors: Record<string, string> = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
    grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
    ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
    rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
    steel: '#B8B8D0', fairy: '#EE99AC',
  };

  ngOnInit(): void {
    this.loadPage(false);

    if (this.auth.isAuthenticated()) {
      if (!this.collections.favorites()?.length) this.collections.refreshFavorites();
      if (!this.collections.team()?.length) this.collections.refreshTeam();
    }
  }

  /** Seleciona filtro de tipo e recarrega do início */
  onType(type: string): void {
    if (this.selectedType() === type) return;
    this.selectedType.set(type);
    this.pokemons.set([]);
    this.currentOffset = 0;
    this.total.set(0);
    this.loadPage(false);
  }

  /** Carrega próxima página e acumula na lista */
  loadMore(): void {
    if (!this.hasMore() || this.isLoading()) return;
    this.loadPage(true);
  }

  private loadPage(append: boolean): void {
    const type = this.selectedType() === 'all' ? null : this.selectedType();
    const offset = append ? this.currentOffset : 0;

    this.isLoading.set(true);
    this.api.listPokemon({ type, limit: this.PAGE_SIZE, offset }).subscribe({
      next: (res) => {
        const cards = res.results.map((p) => this.mapToCard(p));
        if (append) {
          this.pokemons.update((current) => [...current, ...cards]);
        } else {
          this.pokemons.set(cards);
        }
        this.total.set(res.count);
        this.currentOffset = offset + cards.length;
        this.isLoading.set(false);
      },
      error: () => {
        this.feedback.notifyError('Erro ao carregar Pokémon.');
        this.isLoading.set(false);
      },
    });
  }

  // ===== FAVORITOS =====

  toggleFavorite(p: CardPokemon): void {
    if (!this.auth.isAuthenticated()) {
      this.feedback.notifyInfo('Faça login para favoritar.');
      return;
    }
    const existing = this.favoriteMap().get(p.id);
    if (existing) {
      this.collections.removeFavorite(existing).subscribe({
        next: () => this.feedback.notifyInfo(`${p.name} removido dos favoritos.`),
        error: () => this.feedback.notifyError('Erro ao atualizar favoritos.'),
      });
    } else {
      this.collections.addFavorite(p.id).subscribe({
        next: () => this.feedback.notifySuccess(`${p.name} foi favoritado!`),
        error: (err) =>
          this.feedback.notifyError(err?.error?.pokemon_id?.[0] ?? 'Erro ao favoritar.'),
      });
    }
  }

  // ===== EQUIPE =====

  isInTeam(id: number): boolean {
    return this.teamMap().has(id);
  }

  toggleTeam(p: CardPokemon): void {
    if (!this.auth.isAuthenticated()) {
      this.feedback.notifyInfo('Faça login para montar sua equipe.');
      return;
    }
    const current = [...(this.collections.team() ?? [])]
      .sort((a, b) => a.slot - b.slot)
      .map((s) => s.pokemon_id);

    if (this.isInTeam(p.id)) {
      this.setTeam(
        current.filter((id) => id !== p.id),
        `${p.name} removido da equipe.`
      );
      return;
    }
    if (current.length >= 6) {
      this.feedback.notifyError('Equipe cheia (máx. 6).');
      return;
    }
    this.setTeam([...current, p.id], `${p.name} adicionado à equipe.`);
  }

  private setTeam(ids: number[], okMsg: string): void {
    this.collections.setTeam(ids).subscribe({
      next: () => this.feedback.notifySuccess(okMsg),
      error: (err) => {
        const msg =
          err?.error?.detail ?? err?.error?.pokemon_ids?.[0] ?? 'Erro ao atualizar equipe.';
        this.feedback.notifyError(msg);
      },
    });
  }

  // ===== HELPERS DE UI =====

  getTypeColor(type: string): string {
    return this.typeColors[type.toLowerCase()] || '#A8A878';
  }

  trackById(_: number, p: CardPokemon): number {
    return p.id;
  }

  sprite(p: CardPokemon): string {
    return p.img || 'assets/placeholder.svg';
  }

  pct(v: number): number {
    const n = Number(v) || 0;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  private mapToCard(p: PokemonListItem): CardPokemon {
    return {
      id: p.id,
      dex: `#${String(p.id).padStart(3, '0')}`,
      name: this.cap(p.name),
      img: p.sprite ?? '',
      types: (p.types ?? []).map((t) => this.cap(t)),
      hp: p.stats?.hp ?? 0,
      attack: p.stats?.attack ?? 0,
      defense: p.stats?.defense ?? 0,
    };
  }

  private cap(s: string): string {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }
}
