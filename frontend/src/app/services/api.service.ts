import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment as env } from '../../environments/environment';

export interface PokemonDetail {
  id: number;
  name: string;
  types: string[];
  sprite: string | null;
  stats: { hp: number; attack: number; defense: number };
}

export interface PokemonListItem {
  id: number;
  name: string;
  types: string[];
  sprite: string | null;
  stats: { hp: number; attack: number; defense: number };
  is_favorite?: boolean;
  is_in_team?: boolean;
}

export interface FavoriteItem {
  id: number;
  pokemon_id: number;
  pokemon?: PokemonDetail | null;
}

export interface TeamSlotItem {
  id: number;
  slot: number;
  pokemon_id: number;
  pokemon?: PokemonDetail | null;
}

export interface UserItem {
  id: number;
  username: string;
  email: string | null;
  is_staff: boolean;
  date_joined: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // ===== POKÉMON (público) =====
  listPokemon(params: {
    generation?: string | null;
    name?: string | null;
    type?: string | null;
    limit?: number;
    offset?: number;
  }): Observable<{ results: PokemonListItem[]; count: number }> {
    const q = new URLSearchParams();
    if (params.generation) q.set('generation', String(params.generation));
    if (params.name) q.set('name', String(params.name));
    if (params.type) q.set('type', String(params.type));
    q.set('limit', String(params.limit ?? 20));
    q.set('offset', String(params.offset ?? 0));
    return this.http.get<{ results: PokemonListItem[]; count: number }>(
      `${env.apiBase}/api/pokemon/?${q.toString()}`
    );
  }

  // ===== FAVORITOS =====
  listFavorites(): Observable<FavoriteItem[]> {
    return this.http.get<FavoriteItem[]>(`${env.apiBase}/api/favorites/`);
  }

  addFavorite(pokemonId: number): Observable<FavoriteItem> {
    return this.http.post<FavoriteItem>(`${env.apiBase}/api/favorites/`, { pokemon_id: pokemonId });
  }

  removeFavorite(favoriteId: number): Observable<void> {
    return this.http.delete<void>(`${env.apiBase}/api/favorites/${favoriteId}/`);
  }

  // ===== EQUIPE =====
  getTeam(): Observable<TeamSlotItem[]> {
    return this.http.get<TeamSlotItem[]>(`${env.apiBase}/api/team/`);
  }

  setTeam(pokemonIds: number[]): Observable<TeamSlotItem[]> {
    return this.http.post<TeamSlotItem[]>(`${env.apiBase}/api/team/set/`, { pokemon_ids: pokemonIds });
  }

  // ===== ADMIN: USUÁRIOS =====
  listUsers(): Observable<UserItem[]> {
    return this.http
      .get<{ count: number; results: UserItem[] }>(`${env.apiBase}/auth/users/`)
      .pipe(map((r) => r.results ?? []));
  }

  createUser(payload: {
    username: string;
    email?: string | null;
    password: string;
    password_confirm?: string | null;
    is_staff?: boolean;
  }): Observable<UserItem> {
    // Usa o endpoint admin que suporta is_staff
    return this.http.post<UserItem>(`${env.apiBase}/auth/users/`, payload);
  }

  // BUG-03 corrigido: usa o endpoint correto com userId
  adminResetPassword(
    userId: number,
    payload: { new_password: string; new_password_confirm: string }
  ): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(
      `${env.apiBase}/auth/users/${userId}/reset-password/`,
      payload
    );
  }
}
