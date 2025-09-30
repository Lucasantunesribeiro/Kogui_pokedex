import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, switchMap, tap, throwError, catchError, Observable } from 'rxjs';
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
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'kogui-auth';

  private accessTokenSig = signal<string | null>(null);
  private refreshTokenSig = signal<string | null>(null);
  private profileSig = signal<UserProfile | null>(null);

  readonly isLoggedIn = computed(() => !!this.accessTokenSig());
  readonly profile = computed(() => this.profileSig());
  readonly isAdmin = computed(() => this.profileSig()?.is_staff ?? false);

  constructor() {
    // restaura sessão de forma síncrona (antes do primeiro HTTP do app)
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as TokenResponse;
        if (parsed.access) this.accessTokenSig.set(parsed.access);
        if (parsed.refresh) this.refreshTokenSig.set(parsed.refresh);

        // Tenta buscar perfil; se falhar com 401, o interceptor tentará refresh automaticamente
        // Só limpamos os tokens se não houver refresh token ou se o refresh falhar
        this.fetchCurrentUser().subscribe({
          error: (err) => {
            // Se for 401, deixamos o interceptor tentar refresh
            if (err?.status === 401 && this.refreshTokenSig()) {
              return; // interceptor vai tentar refresh
            }
            // Se for 403, é possível que o perfil seja inacessível mas sessão válida
            if (err?.status === 403) {
              console.warn('[Auth] Sem permissão para buscar perfil, mas sessão mantida');
              return;
            }
            // Para outros erros ou se não há refresh token, deslogamos
            console.warn('[Auth] Sessão inválida ao restaurar:', err?.status);
            this.clearTokens();
          }
        });
      }
    } catch (e) {
      console.error('[Auth] Erro ao restaurar sessão:', e);
      this.clearTokens();
    }
  }

  // ===== API PÚBLICA =====

  register(payload: {
    username: string;
    password: string;
    email?: string;
    password_confirm?: string;
  }): Observable<unknown> {
    return this.http.post(`${env.apiBase}/auth/register/`, {
      username: payload.username,
      password: payload.password,
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.password_confirm ? { password_confirm: payload.password_confirm } : {}),
    });
  }

  login(credentials: { username: string; password: string }): Observable<void> {
    return this.http
      .post<TokenResponse>(`${env.apiBase}/api/token/`, {
        username: credentials.username,
        password: credentials.password,
      })
      .pipe(
        tap((tokens) => this.persistTokens(tokens)),
        switchMap(() => this.fetchCurrentUser()),
        map(() => void 0),
        catchError((err) => {
          this.clearTokens();
          return throwError(() => err);
        })
      );
  }

  logout(): void {
    this.clearTokens();
  }

  fetchCurrentUser(): Observable<UserProfile> {
    return this.http
      .get<UserProfile>(`${env.apiBase}/auth/me/`)
      .pipe(tap((u) => this.profileSig.set(u)));
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

  /** Reset administrativo (sem e-mail) — usado na tela de Admin */
  adminResetPassword(userId: number, payload: { new_password: string; new_password_confirm: string }): Observable<void> {
    return this.http.post<{ detail: string }>(`${env.apiBase}/auth/users/${userId}/reset-password/`, payload)
      .pipe(map(() => void 0));
  }

  // ===== GESTÃO DE USUÁRIOS (ADMIN) =====
  listUsers(): Observable<UserProfile[]> {
    return this.http.get<{ count: number; results: UserProfile[] }>(`${env.apiBase}/auth/users/`)
      .pipe(map((response) => response.results || []));
  }

  createUser(payload: { username: string; email?: string; password: string; password_confirm?: string; is_staff?: boolean }): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${env.apiBase}/auth/users/`, payload);
  }

  updateUser(userId: number, payload: { username?: string; email?: string; is_staff?: boolean }): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${env.apiBase}/auth/users/${userId}/`, payload);
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${env.apiBase}/auth/users/${userId}/`);
  }

  // ===== HELPERS =====
  isAuthenticated(): boolean { return this.isLoggedIn(); }
  getCurrentUser(): UserProfile | null { return this.profileSig(); }
  isAdminUser(): boolean { return this.isAdmin(); }

  /** Getter usado pelo interceptor */
  getAccessToken(): string | null {
    return this.accessTokenSig();
  }

  /** Exposto caso precise em algum ponto do app */
  getRefreshToken(): string | null {
    return this.refreshTokenSig();
  }

  refreshAccessToken(): Observable<TokenResponse> {
    const refresh = this.refreshTokenSig();
    if (!refresh) return throwError(() => new Error('Sessão expirada'));
    return this.http
      .post<TokenResponse>(`${env.apiBase}/api/token/refresh/`, { refresh })
      .pipe(tap((t) => this.persistTokens(t)));
  }

  // ===== PRIVADOS =====

  private persistTokens(tokens: TokenResponse): void {
    if (!tokens?.access) {
      this.clearTokens();
      return;
    }
    this.accessTokenSig.set(tokens.access);
    if (tokens.refresh) this.refreshTokenSig.set(tokens.refresh);

    const payloadToStore: TokenResponse = {
      access: this.accessTokenSig()!,
      ...(this.refreshTokenSig() ? { refresh: this.refreshTokenSig()! } : {}),
    };
    localStorage.setItem(this.storageKey, JSON.stringify(payloadToStore));
  }

  private clearTokens(): void {
    this.accessTokenSig.set(null);
    this.refreshTokenSig.set(null);
    this.profileSig.set(null);
    localStorage.removeItem(this.storageKey);
  }
}
