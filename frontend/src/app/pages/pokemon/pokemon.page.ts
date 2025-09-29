import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ApiService,
  FavoriteItem,
  Pokemon,
  TeamSlotItem,
} from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { FeedbackService } from '../../services/feedback.service';
import { UserCollectionsStore } from '../../services/user-collections.store';

/**
 * Página principal de listagem de Pokémon.
 * Esta implementação mantém os filtros por tipo e geração, busca por nome
 * (via searchControl) e adiciona uma propriedade `statColors` para definir
 * as cores das barras de atributos via CSS variables. O objetivo é alinhar
 * o comportamento ao layout final.
 */
@Component({
  selector: 'app-pokemon-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './pokemon.page.html',
  styleUrl: './pokemon.page.css',
})
export class PokemonPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly collections = inject(UserCollectionsStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly limit = 12;
  readonly offset = signal(0);
  readonly totalCount = signal(0);
  readonly loading = signal(false);

  readonly pokemonList = signal<Pokemon[]>([]);
  readonly typeFilter = signal('all');
  readonly generationFilter = signal<number | null>(null);

  // Controle de busca por nome (não exposto na UI, mas utilizado para API)
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchTerm = signal('');

  /**
   * Cores das barras de atributos. Usamos CSS variables para facilitar a
   * personalização via estilos globais.
   */
  readonly statColors = {
    hp: 'var(--stat-orange)',
    attack: 'var(--stat-red)',
    defense: 'var(--stat-teal)',
  };

  readonly typeChips = [
    { label: 'Todos os Tipos', value: 'all' },
    { label: 'Planta', value: 'grass' },
    { label: 'Fogo', value: 'fire' },
    { label: 'Água', value: 'water' },
    { label: 'Elétrico', value: 'electric' },
    { label: 'Venenoso', value: 'poison' },
    { label: 'Voador', value: 'flying' },
    { label: 'Inseto', value: 'bug' },
    { label: 'Psíquico', value: 'psychic' },
    { label: 'Gelo', value: 'ice' },
    { label: 'Pedra', value: 'rock' },
    { label: 'Dragão', value: 'dragon' },
  ];

  readonly filteredPokemon = computed(() => {
    const type = this.typeFilter();
    if (type === 'all') {
      return this.pokemonList();
    }
    return this.pokemonList().filter((pokemon) =>
      pokemon.types.some((t) => t.toLowerCase() === type)
    );
  });

  readonly favoriteMap = computed(() => {
    const map = new Map<number, FavoriteItem>();
    const favorites = this.collections.favorites();
    if (Array.isArray(favorites)) {
      for (const item of favorites) {
        map.set(item.pokemon_id, item);
      }
    }
    return map;
  });

  readonly teamMap = computed(() => {
    const map = new Map<number, TeamSlotItem>();
    const team = this.collections.team();
    if (Array.isArray(team)) {
      for (const slot of team) {
        map.set(slot.pokemon_id, slot);
      }
    }
    return map;
  });

  constructor() {
    // Atualiza searchTerm quando o valor do campo de busca muda.
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        this.searchTerm.set(value.trim().toLowerCase());
        this.offset.set(0);
        this.fetchPokemon();
      });
  }

  ngOnInit(): void {
    this.fetchPokemon();
    if (this.auth.isAuthenticated()) {
      if (this.collections.favorites().length === 0) {
        this.collections.refreshFavorites();
      }
      if (this.collections.team().length === 0) {
        this.collections.refreshTeam();
      }
    }
  }

  /**
   * Chama a API para buscar a lista de Pokémon, aplicando filtros de geração,
   * nome e paginação. Emite sinais de carregamento para a UI.
   */
  fetchPokemon(): void {
    /**
     * Quando o filtro por tipo está ativo (diferente de "all"), carregamos todos
     * os Pokémon de uma vez, pois o backend não suporta filtragem por tipo. Isso
     * garante que o usuário veja resultados mesmo que não estejam na primeira
     * página. Caso contrário, usamos paginação normal.
     */
    this.loading.set(true);
    const isTypeFiltered = this.typeFilter() !== 'all';
    const limit = isTypeFiltered
      ? this.totalCount() || this.limit // carrega tudo quando conhecido
      : this.limit;
    const offset = isTypeFiltered ? 0 : this.offset();
    this.api
      .listPokemon({
        generation: this.generationFilter() ?? undefined,
        name: this.searchTerm() || undefined,
        limit,
        offset,
      })
      .subscribe({
        next: (response) => {
          this.totalCount.set(response.count);
          this.pokemonList.set(response.results);
          // Se carregamos todos os resultados, reposicionamos o offset para 0
          if (isTypeFiltered) {
            this.offset.set(0);
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.feedback.notifyError('Não foi possível carregar os Pokémon.');
        },
      });
  }

  onGenerationChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value ? Number(target.value) : null;
    this.setGeneration(value);
  }

  setGeneration(generation: number | null): void {
    this.generationFilter.set(generation);
    this.offset.set(0);
    this.fetchPokemon();
  }

  setTypeFilter(value: string): void {
    this.typeFilter.set(value);
    // ao mudar o tipo, recarregamos a lista. Quando um tipo específico é
    // selecionado, fetchPokemon irá carregar todos os resultados disponíveis.
    this.fetchPokemon();
  }

  clearFilters(): void {
    this.typeFilter.set('all');
    this.generationFilter.set(null);
    this.offset.set(0);
    this.searchTerm.set('');
    this.searchControl.setValue('', { emitEvent: false });
    this.fetchPokemon();
  }

  nextPage(): void {
    if (this.offset() + this.limit >= this.totalCount()) {
      return;
    }
    this.offset.set(this.offset() + this.limit);
    this.fetchPokemon();
  }

  previousPage(): void {
    if (this.offset() === 0) {
      return;
    }
    this.offset.set(Math.max(0, this.offset() - this.limit));
    this.fetchPokemon();
  }

  isFavorite(pokemonId: number): boolean {
    return this.favoriteMap().has(pokemonId);
  }

  onToggleFavorite(pokemon: Pokemon): void {
    if (!this.auth.isAuthenticated()) {
      this.feedback.notifyInfo('Faça login para favoritar seus Pokémon.');
      return;
    }
    const existing = this.favoriteMap().get(pokemon.id);
    if (existing) {
      this.collections.removeFavorite(existing).subscribe({
        next: () =>
          this.feedback.notifyInfo(
            `${this.formatName(pokemon.name)} removido dos favoritos.`,
          ),
        error: () => this.feedback.notifyError('Erro ao atualizar favoritos.'),
      });
      return;
    }
    this.collections.addFavorite(pokemon.id).subscribe({
      next: () =>
        this.feedback.notifySuccess(
          `${this.formatName(pokemon.name)} foi favoritado!`,
        ),
      error: (err) => {
        const message = err?.error?.pokemon_id?.[0] ?? 'Erro ao favoritar.';
        this.feedback.notifyError(message);
      },
    });
  }

  isInTeam(pokemonId: number): boolean {
    return this.teamMap().has(pokemonId);
  }

  onToggleTeam(pokemon: Pokemon): void {
    if (!this.auth.isAuthenticated()) {
      this.feedback.notifyInfo('Faça login para montar sua equipe.');
      return;
    }
    const existing = this.teamMap().get(pokemon.id);
    const currentIds = this.currentTeamIds();
    if (existing) {
      const updatedIds = currentIds.filter((id) => id !== pokemon.id);
      this.updateTeam(updatedIds, `${this.formatName(pokemon.name)} removido da equipe.`);
      return;
    }
    if (currentIds.length >= 6) {
      this.feedback.notifyError('Equipe cheia (máx. 6).');
      return;
    }
    const updatedIds = [...currentIds, pokemon.id];
    this.updateTeam(updatedIds, `${this.formatName(pokemon.name)} adicionado à equipe.`);
  }

  private updateTeam(pokemonIds: number[], successMessage: string): void {
    this.collections.setTeam(pokemonIds).subscribe({
      next: () => this.feedback.notifySuccess(successMessage),
      error: (err) => {
        const detail = err?.error?.detail ?? err?.error?.pokemon_ids?.[0];
        const message = detail ?? 'Erro ao atualizar equipe.';
        this.feedback.notifyError(message);
      },
    });
  }

  private currentTeamIds(): number[] {
    const team = this.collections.team();
    if (!Array.isArray(team)) {
      return [];
    }
    return [...team].sort((a, b) => a.slot - b.slot).map(({ pokemon_id }) => pokemon_id);
  }

  formatName(name: string): string {
    if (!name) {
      return '';
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  statWidth(value?: number): string {
    const base = Math.max(0, value ?? 0);
    const normalized = Math.min(100, Math.round(base * 1.5));
    return `${normalized}%`;
  }

  currentPage(): number {
    return Math.floor(this.offset() / this.limit) + 1;
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount() / this.limit));
  }

  generations(): number[] {
    return Array.from({ length: 9 }, (_, index) => index + 1);
  }

  formatId(id: number): string {
    return `#${String(id).padStart(3, '0')}`;
  }
}