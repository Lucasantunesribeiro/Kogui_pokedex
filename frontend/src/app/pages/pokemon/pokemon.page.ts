import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { FeedbackService } from '../../services/feedback.service';
import { UserCollectionsStore } from '../../services/user-collections.store';
import { FavoriteItem, TeamSlotItem } from '../../services/api.service';

type AnyPokemon = any;

interface CardPokemon {
  id: number;
  dex: string;
  name: string;
  img: string;
  types: string[];
  hp: number;
  attack: number;
  defense: number;
  favorite: boolean;
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

  // Escala para as barras da UI
  private readonly UI_MAX = 100;
  private readonly POKEAPI_MAX = 255;

  // cache completo (todos os pokémon)
  private _all = signal<CardPokemon[]>([]);
  // filtro atual
  readonly selectedType = signal<string>('all');

  // coleções do usuário (favoritos/equipe)
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

  // lista que a UI renderiza, filtrada por tipo
  readonly pokemons = computed(() => {
    const t = this.selectedType();
    if (t === 'all') return this._all();
    return this._all().filter(p => p.types.some(x => x.toLowerCase() === t));
  });

  // ordem dos chips (18 tipos)
  readonly typeList = [
    'all','normal','fire','water','electric','grass','ice','fighting','poison','ground',
    'flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'
  ] as const;

  // Cores dos tipos
  readonly typeColors: Record<string, string> = {
    normal:'#A8A878', fire:'#F08030', water:'#6890F0', electric:'#F8D030', grass:'#78C850', ice:'#98D8D8',
    fighting:'#C03028', poison:'#A040A0', ground:'#E0C068', flying:'#A890F0', psychic:'#F85888', bug:'#A8B820',
    rock:'#B8A038', ghost:'#705898', dragon:'#7038F8', dark:'#705848', steel:'#B8B8D0', fairy:'#EE99AC'
  };

  ngOnInit(): void {
    // carrega TODA a pokédex uma vez (com paginação automática)
    this.loadAllPokemon();

    // pre-carrega coleções do usuário, se logado
    if (this.auth.isAuthenticated()) {
      if (!this.collections.favorites()?.length) this.collections.refreshFavorites();
      if (!this.collections.team()?.length) this.collections.refreshTeam();
    }
  }

  /** Busca todas as páginas da API e mantém cache em memória */
  private async loadAllPokemon(): Promise<void> {
    const pageSize = 200; // tamanho razoável para reduzir idas e vindas
    let offset = 0;
    let total = Infinity;
    const acc: AnyPokemon[] = [];

    while (offset < total) {
      const resp: any = await firstValueFrom(
        this.api.listPokemon({ limit: pageSize, offset })
      );
      const count = Number(resp?.count ?? acc.length + (resp?.results?.length ?? 0));
      total = Number.isFinite(count) && count > 0 ? count : 1302; // fallback
      const results: AnyPokemon[] = Array.isArray(resp?.results)
        ? resp.results
        : Array.isArray(resp) ? resp
        : Array.isArray(resp?.data) ? resp.data
        : [];
      acc.push(...results);
      offset += pageSize;
      if (!results.length) break; // segurança
    }

    // normaliza para CardPokemon
    this._all.set(acc.map(p => this.mapToCard(p)));
  }

  /** Clique nos chips */
  onType(type: string) {
    this.selectedType.set(type);
  }

  /** Favoritar */
  toggleFavorite(p: CardPokemon) {
    if (!this.auth.isAuthenticated()) {
      this.feedback.notifyInfo('Faça login para favoritar.');
      return;
    }

    const existing = this.favoriteMap().get(p.id);
    if (existing) {
      this.collections.removeFavorite(existing).subscribe({
        next: () => this.feedback.notifyInfo(`${p.name} removido dos favoritos.`),
        error: () => this.feedback.notifyError('Erro ao atualizar favoritos.')
      });
      return;
    }

    this.collections.addFavorite(p.id).subscribe({
      next: () => this.feedback.notifySuccess(`${p.name} foi favoritado!`),
      error: (err) => this.feedback.notifyError(err?.error?.pokemon_id?.[0] ?? 'Erro ao favoritar.')
    });
  }

  /** Equipe (máximo 6) */
  isInTeam(id: number): boolean {
    return this.teamMap().has(id);
  }

  toggleTeam(p: CardPokemon) {
    if (!this.auth.isAuthenticated()) {
      this.feedback.notifyInfo('Faça login para montar sua equipe.');
      return;
    }

    const current = [...(this.collections.team() ?? [])]
      .sort((a, b) => a.slot - b.slot)
      .map(s => s.pokemon_id);

    if (this.isInTeam(p.id)) {
      const next = current.filter(id => id !== p.id);
      this.setTeam(next, `${p.name} removido da equipe.`);
      return;
    }

    if (current.length >= 6) { // regra do teste
      this.feedback.notifyError('Equipe cheia (máx. 6).');
      return;
    }

    const next = [...current, p.id];
    this.setTeam(next, `${p.name} adicionado à equipe.`);
  }

  private setTeam(ids: number[], okMsg: string) {
    this.collections.setTeam(ids).subscribe({
      next: () => this.feedback.notifySuccess(okMsg),
      error: (err) => {
        const msg = err?.error?.detail ?? err?.error?.pokemon_ids?.[0] ?? 'Erro ao atualizar equipe.';
        this.feedback.notifyError(msg);
      }
    });
  }

  // ======= helpers de UI =======

  getTypeColor(type: string) { return this.typeColors[type.toLowerCase()] || '#A8A878'; }
  trackById(_: number, p: CardPokemon) { return p.id; }
  sprite(p: CardPokemon) { return p.img || 'assets/placeholder.svg'; }

  /** 0–100 na UI; se >100, normaliza pela base 255 */
  pct(v: number) {
    const n = Number(v) || 0;
    if (n <= 0) return 0;
    if (n <= this.UI_MAX) return Math.min(100, Math.round(n));
    return Math.min(100, Math.round((n / this.POKEAPI_MAX) * 100));
  }

  private mapToCard(p: AnyPokemon): CardPokemon {
    const id = Number(p?.id ?? p?.pokemon_id ?? p?.order ?? 0);
    const name = this.cap(p?.name ?? p?.species?.name ?? '');
    const img =
      p?.sprite ?? p?.image ?? p?.img ??
      p?.sprites?.other?.['official-artwork']?.front_default ??
      p?.sprites?.front_default ?? '';

    const types = (p?.types ?? p?.type ?? p?.pokemon_v2_pokemontypes ?? [])
      .map((t: any) => typeof t === 'string' ? t : (t?.type?.name ?? t?.pokemon_v2_type?.name ?? ''))
      .filter(Boolean)
      .map((t: string) => this.cap(t));

    const hp = this.pickStat(p, 'hp');
    const attack = this.pickStat(p, 'attack');
    const defense = this.pickStat(p, 'defense');

    return { id, dex: id ? `#${String(id).padStart(3, '0')}` : '#—', name, img, types, hp, attack, defense, favorite: false };
  }

  private pickStat(p: any, key: 'hp'|'attack'|'defense'): number {
    const flat = p?.stats ?? p?.base_stats;
    if (flat && typeof flat === 'object' && !Array.isArray(flat)) {
      const v = Number(flat[key]); if (Number.isFinite(v)) return v;
    }
    const arr =
      Array.isArray(p?.stats) ? p.stats :
      Array.isArray(p?.pokemon_v2_pokemonstats) ? p.pokemon_v2_pokemonstats :
      null;
    if (arr) {
      const found = arr.find((s: any) => (s?.stat?.name ?? s?.pokemon_v2_stat?.name) === key);
      const base = Number(found?.base_stat ?? found?.base ?? 0);
      return Number.isFinite(base) ? base : 0;
    }
    return 0;
  }

  private cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
}
