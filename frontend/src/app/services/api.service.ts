import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  sprite: string | null;
  stats?: {
    hp: number;
    attack: number;
    defense: number;
  };
}

export interface PokemonListResponse {
  count: number;
  results: Pokemon[];
}

export interface FavoriteItem {
  id: number;
  pokemon_id: number;
  pokemon?: Pokemon | null;
}

export interface TeamSlotItem {
  id: number;
  slot: number;
  pokemon_id: number;
  pokemon?: Pokemon | null;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  listPokemon(params: {
    generation?: number;
    name?: string;
    limit?: number;
    offset?: number;
  }): Observable<PokemonListResponse> {
    let httpParams = new HttpParams();
    if (params.generation) {
      httpParams = httpParams.set('generation', String(params.generation));
    }
    if (params.name) {
      httpParams = httpParams.set('name', params.name);
    }
    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params.offset !== undefined) {
      httpParams = httpParams.set('offset', String(params.offset));
    }
    return this.http.get<PokemonListResponse>(`${environment.apiBase}/api/pokemon/`, {
      params: httpParams
    });
  }

  listFavorites(): Observable<FavoriteItem[]> {
    return this.http.get<FavoriteItem[]>(`${environment.apiBase}/api/favorites/`);
  }

  addFavorite(pokemonId: number): Observable<FavoriteItem> {
    return this.http.post<FavoriteItem>(`${environment.apiBase}/api/favorites/`, {
      pokemon_id: pokemonId
    });
  }

  removeFavorite(favoriteId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiBase}/api/favorites/${favoriteId}/`);
  }

  getTeam(): Observable<TeamSlotItem[]> {
    return this.http.get<TeamSlotItem[]>(`${environment.apiBase}/api/team/`);
  }

  setTeam(pokemonIds: number[]): Observable<TeamSlotItem[]> {
    return this.http.post<TeamSlotItem[]>(`${environment.apiBase}/api/team/set/`, {
      pokemon_ids: pokemonIds
    });
  }
}
