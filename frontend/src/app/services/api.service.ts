import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment as env } from '../../environments/environment';

export interface PokemonListItem {
  id: number;
  name: string;
  image: string | null;
  types: string[];
}

// Alias para compatibilidade com código existente
export type Pokemon = PokemonListItem;

export interface FavoriteItem {
  id: number;
  pokemon_id: number;
}

export interface TeamSlotItem {
  id: number;
  slot: number;
  pokemon_id: number;
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
  listPokemon(params: { generation?: string | null; name?: string | null; type?: string | null; limit?: number; offset?: number }) {
    const q = new URLSearchParams();
    if (params.generation) q.set('generation', String(params.generation));
    if (params.name) q.set('name', String(params.name));
    if (params.type) q.set('type', String(params.type));
    q.set('limit', String(params.limit ?? 12));
    q.set('offset', String(params.offset ?? 0));
    return this.http.get<{ results: PokemonListItem[]; count: number }>(`${env.apiBase}/api/pokemon/?${q.toString()}`);
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
    return this.http.get<UserItem[]>(`${env.apiBase}/auth/users/`);
  }

  createUser(payload: { username: string; email?: string | null; password: string; password_confirm?: string | null }): Observable<UserItem> {
    return this.http
      .post<UserItem>(`${env.apiBase}/auth/register/`, {
        username: payload.username,
        password: payload.password,
        ...(payload.password_confirm ? { password_confirm: payload.password_confirm } : {}),
        ...(payload.email ? { email: payload.email } : {}),
      })
      .pipe(
        // o endpoint de registro retorna o usuário criado
        map((user) => user as UserItem)
      );
  }

  /** Reset administrativo (sem e-mail) — usado pelo painel de admin */
  adminResetPassword(username: string, new_password: string, new_password_confirm: string) {
    return this.http.post<{ detail: string }>(`${env.apiBase}/auth/password/admin-reset/`, {
      username,
      new_password,
      new_password_confirm,
    });
  }
}
