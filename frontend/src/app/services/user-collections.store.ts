import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, of, switchMap, tap } from 'rxjs';

import { ApiService, FavoriteItem, TeamSlotItem } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UserCollectionsStore {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private readonly favoritesState = signal<FavoriteItem[]>([]);
  private readonly teamState = signal<TeamSlotItem[]>([]);
  private readonly favoritesLoadingState = signal(false);
  private readonly teamLoadingState = signal(false);

  private readonly favoritesRefresh$ = new Subject<void>();
  private readonly teamRefresh$ = new Subject<void>();

  private readonly favoritesFromApi = toSignal(
    this.favoritesRefresh$.pipe(
      tap(() => this.favoritesLoadingState.set(true)),
      switchMap(() =>
        this.api.listFavorites().pipe(
          tap((favorites) => this.favoritesState.set(favorites)),
          catchError(() => {
            this.favoritesState.set([]);
            return of([]);
          }),
          finalize(() => this.favoritesLoadingState.set(false))
        )
      )
    ),
    { initialValue: [] }
  );

  private readonly teamFromApi = toSignal(
    this.teamRefresh$.pipe(
      tap(() => this.teamLoadingState.set(true)),
      switchMap(() =>
        this.api.getTeam().pipe(
          tap((team) => this.teamState.set(team)),
          catchError(() => {
            this.teamState.set([]);
            return of([]);
          }),
          finalize(() => this.teamLoadingState.set(false))
        )
      )
    ),
    { initialValue: [] }
  );
  constructor() {
    effect(() => {
      // Keep the toSignal subscriptions alive within the Angular injector context.
      this.favoritesFromApi();
      this.teamFromApi();
    });

    effect(
      () => {
        if (this.auth.isLoggedIn()) {
          this.refreshFavorites();
          this.refreshTeam();
        } else {
          this.resetCollections();
        }
      },
      { allowSignalWrites: true }
    );
  }

  readonly favorites = this.favoritesState.asReadonly();
  readonly team = this.teamState.asReadonly();
  readonly favoritesLoading = this.favoritesLoadingState.asReadonly();
  readonly teamLoading = this.teamLoadingState.asReadonly();

  refreshFavorites(): void {
    this.favoritesRefresh$.next();
  }

  refreshTeam(): void {
    this.teamRefresh$.next();
  }

  addFavorite(pokemonId: number) {
    return this.api.addFavorite(pokemonId).pipe(
      tap((favorite) => {
        this.favoritesState.update((current) => [...current, favorite]);
      })
    );
  }

  removeFavorite(favorite: FavoriteItem) {
    return this.api.removeFavorite(favorite.id).pipe(
      tap(() => {
        this.favoritesState.update((current) => current.filter((item) => item.id !== favorite.id));
      })
    );
  }

  setTeam(pokemonIds: number[]) {
    return this.api.setTeam(pokemonIds).pipe(
      tap((team) => {
        this.teamState.set(team);
      })
    );
  }

  clearTeam() {
    return this.setTeam([]);
  }

  resetCollections(): void {
    this.favoritesState.set([]);
    this.teamState.set([]);
    this.favoritesLoadingState.set(false);
    this.teamLoadingState.set(false);
  }
}
