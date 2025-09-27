import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, switchMap, tap, throwError } from 'rxjs';

import { environment as env } from '../../environments/environment';

interface TokenResponse {
  access: string;
  refresh?: string;
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
  private readonly storageKey = 'kogui-auth';
  private readonly http = inject(HttpClient);

  private accessTokenSignal = signal<string | null>(null);
  private refreshTokenSignal = signal<string | null>(null);
  private profileSignal = signal<UserProfile | null>(null);

  readonly isLoggedIn = computed(() => !!this.accessTokenSignal());
  readonly profile = computed(() => this.profileSignal());
  readonly isAdmin = computed(() => this.profileSignal()?.is_staff ?? false);

  constructor() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as TokenResponse;
        if (parsed.access) {
          this.accessTokenSignal.set(parsed.access);
        }
        if (parsed.refresh) {
          this.refreshTokenSignal.set(parsed.refresh);
        }
        if (parsed.access) {
          this.fetchCurrentUser().subscribe({
            error: () => this.clearTokens()
          });
        }
      } catch {
        localStorage.removeItem(this.storageKey);
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
        tap((tokens) => this.persistTokens(tokens)),
        switchMap(() => this.fetchCurrentUser()),
        map(() => void 0),
        catchError((error) => {
          this.clearTokens();
          return throwError(() => error);
        })
      );
  }

  logout(): void {
    this.clearTokens();
  }

  fetchCurrentUser(): Observable<UserProfile> {
    return this.http
      .get<UserProfile>(`${env.apiBase}/auth/me/`)
      .pipe(tap((profile) => this.profileSignal.set(profile)));
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
    return this.accessTokenSignal();
  }

  getRefreshToken(): string | null {
    return this.refreshTokenSignal();
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  refreshAccessToken(): Observable<TokenResponse> {
    const refresh = this.refreshTokenSignal();
    if (!refresh) {
      return throwError(() => new Error('Sessão expirada.'));
    }

    return this.http
      .post<TokenResponse>(`${env.apiBase}/authtokenrefresh`, { refresh })
      .pipe(tap((tokens) => this.persistTokens(tokens)));
  }

  private persistTokens(tokens: TokenResponse): void {
    const refresh = tokens.refresh ?? this.refreshTokenSignal();
    if (tokens.access) {
      this.accessTokenSignal.set(tokens.access);
      if (refresh) {
        this.refreshTokenSignal.set(refresh);
        localStorage.setItem(
          this.storageKey,
          JSON.stringify({ access: tokens.access, refresh })
        );
      } else {
        localStorage.setItem(
          this.storageKey,
          JSON.stringify({ access: tokens.access })
        );
      }
    } else {
      this.clearTokens();
    }
  }

  private clearTokens(): void {
    this.accessTokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.profileSignal.set(null);
    localStorage.removeItem(this.storageKey);
  }
}
