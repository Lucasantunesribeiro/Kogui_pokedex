import { Injectable, computed, inject, signal } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
  HttpEvent
} from '@angular/common/http';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError
} from 'rxjs';

import { environment as env } from '../../environments/environment';

interface TokenResponse {
  access: string;
  refresh?: string;
}

interface AuthTokens {
  access: string;
  refresh: string;
}

interface PersistedAuthPayload {
  access: string;
  refresh: string;
  user: UserProfile | null;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string | null;
  is_staff: boolean;
  date_joined: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'kogui.auth';
  private readonly legacyStorageKey = 'kogui-auth';
  private readonly http = inject(HttpClient);

  private readonly tokens = signal<AuthTokens | null>(null);
  private readonly profileSignal = signal<UserProfile | null>(null);

  private refreshInFlight$: Observable<string | null> | null = null;

  readonly isLoggedIn = computed(() => !!this.tokens()?.access);
  readonly profile = computed(() => this.profileSignal());
  readonly isAdmin = computed(() => this.profileSignal()?.is_staff ?? false);

  async rehydrateFromStorage(): Promise<void> {
    const payload = this.readPersistedSession();
    if (!payload) {
      this.resetSession();
      return;
    }

    this.tokens.set({ access: payload.access, refresh: payload.refresh });
    if (payload.user) {
      this.profileSignal.set(payload.user);
    }
    this.persistSession();

    if (!payload.user) {
      try {
        await firstValueFrom(this.fetchCurrentUser());
      } catch {
        this.resetSession();
      }
    }
  }
  register(payload: {
    username: string;
    password: string;
    password_confirm?: string;
    email?: string;
  }): Observable<unknown> {
    const body: Record<string, string> = {
      username: payload.username,
      password: payload.password
    };
    if (payload.email) {
      body['email'] = payload.email;
    }
    if (payload.password_confirm) {
      body['password_confirm'] = payload.password_confirm;
    }
    return this.http.post(`${env.apiBase}/auth/register/`, body);
  }

  login(credentials: { username: string; password: string }): Observable<void> {
    const body: Record<string, string> = {
      username: credentials.username,
      password: credentials.password
    };

    return this.http
      .post<TokenResponse>(`${env.apiBase}/authtoken`, body)
      .pipe(
        tap((tokens) => this.updateTokens(tokens)),
        switchMap(() => this.fetchCurrentUser()),
        map(() => void 0),
        catchError((error) => {
          this.resetSession();
          return throwError(() => error);
        })
      );
  }

  logout(): void {
    this.resetSession();
  }

  fetchCurrentUser(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${env.apiBase}/auth/me/`).pipe(
      tap((profile) => {
        this.profileSignal.set(profile);
        this.persistSession();
      })
    );
  }

  changePassword(payload: {
    current_password: string;
    new_password: string;
    new_password_confirm: string;
  }): Observable<void> {
    return this.http
      .post<{ detail: string }>(`${env.apiBase}/auth/password/change/`, payload)
      .pipe(map(() => void 0));
  }

  listUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${env.apiBase}/auth/users/`);
  }

  getCurrentUser(): UserProfile | null {
    return this.profileSignal();
  }

  isAdminUser(): boolean {
    return this.isAdmin();
  }

  getAccessToken(): string | null {
    return this.tokens()?.access ?? null;
  }

  getRefreshToken(): string | null {
    return this.tokens()?.refresh ?? null;
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }
  handle401WithSingleFlightRefresh(
    request: HttpRequest<unknown>,
    next: HttpHandlerFn
  ): (source: Observable<HttpEvent<unknown>>) => Observable<HttpEvent<unknown>> {
    return (source: Observable<HttpEvent<unknown>>) =>
      source.pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status !== 401) {
            return throwError(() => error);
          }

          return this.enqueueRefresh().pipe(
            switchMap((token) => {
              if (!token) {
                this.resetSession();
                return throwError(() => error);
              }
              const retriedRequest = request.clone({
                setHeaders: { Authorization: `Bearer ${token}` }
              });
              return next(retriedRequest);
            })
          );
        })
      );
  }

  refreshAccessToken(): Observable<string | null> {
    return this.enqueueRefresh();
  }

  private enqueueRefresh(): Observable<string | null> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.triggerRefresh().pipe(
        shareReplay({ bufferSize: 1, refCount: false }),
        finalize(() => {
          this.refreshInFlight$ = null;
        })
      );
    }
    return this.refreshInFlight$;
  }

  private triggerRefresh(): Observable<string | null> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      return of(null);
    }

    return this.http
      .post<TokenResponse>(`${env.apiBase}/authtokenrefresh`, { refresh })
      .pipe(
        tap((tokens) => this.updateTokens(tokens)),
        map((tokens) => tokens.access ?? null),
        catchError((error) => {
          this.resetSession();
          return of(null);
        })
      );
  }

  private updateTokens(tokens: TokenResponse): void {
    const current = this.tokens();
    const refresh = tokens.refresh ?? current?.refresh;

    if (!tokens.access || !refresh) {
      this.resetSession();
      return;
    }

    this.tokens.set({ access: tokens.access, refresh });
    this.persistSession();
  }

  private persistSession(): void {
    const tokens = this.tokens();
    if (!tokens) {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.legacyStorageKey);
      return;
    }

    const payload: PersistedAuthPayload = {
      access: tokens.access,
      refresh: tokens.refresh,
      user: this.profileSignal()
    };
    localStorage.setItem(this.storageKey, JSON.stringify(payload));
    localStorage.removeItem(this.legacyStorageKey);
  }

  private readPersistedSession(): PersistedAuthPayload | null {
    const raw =
      localStorage.getItem(this.storageKey) || localStorage.getItem(this.legacyStorageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PersistedAuthPayload>;
      if (typeof parsed.access !== 'string' || typeof parsed.refresh !== 'string') {
        return null;
      }
      return {
        access: parsed.access,
        refresh: parsed.refresh,
        user: parsed.user ?? null
      };
    } catch {
      return null;
    }
  }

  private resetSession(): void {
    this.tokens.set(null);
    this.profileSignal.set(null);
    this.refreshInFlight$ = null;
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.legacyStorageKey);
  }
}
