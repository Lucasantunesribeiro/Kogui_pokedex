import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, switchMap, tap, throwError } from 'rxjs';
import { environment as env } from '../../environments/environment';

interface TokenResponse {
  access: string;
  refresh?: string;
}

interface StoredSession {
  access: string;
  refresh?: string;
  user?: UserProfile;
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
  // BUG-01 corrigido: chave alinhada com o que o E2E test espera
  private readonly storageKey = 'kogui.auth';

  private accessTokenSig = signal<string | null>(null);
  private refreshTokenSig = signal<string | null>(null);
  private profileSig = signal<UserProfile | null>(null);

  readonly isLoggedIn = computed(() => !!this.accessTokenSig());
  readonly profile = computed(() => this.profileSig());
  readonly isAdmin = computed(() => this.profileSig()?.is_staff ?? false);

  constructor() {
    // Restaura sessão sincronamente, incluindo o perfil do usuário
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredSession;
        if (parsed.access) this.accessTokenSig.set(parsed.access);
        if (parsed.refresh) this.refreshTokenSig.set(parsed.refresh);
        // BUG-02 corrigido: restaura o perfil salvo para evitar flash de "não logado"
        if (parsed.user) this.profileSig.set(parsed.user);

        // Valida o token contra o servidor em background
        this.fetchCurrentUser().subscribe({
          error: (err) => {
            if (err?.status === 401 && this.refreshTokenSig()) {
              return; // interceptor vai tentar refresh
            }
            if (err?.status === 403) {
              return; // sessão válida, sem permissão de perfil
            }
            this.clearTokens();
          }
        });
      }
    } catch {
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
        // BUG-02 corrigido: persiste sessão completa (com user) após buscar perfil
        tap(() => this.persistSession()),
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

  adminResetPassword(
    userId: number,
    payload: { new_password: string; new_password_confirm: string }
  ): Observable<void> {
    return this.http
      .post<{ detail: string }>(`${env.apiBase}/auth/users/${userId}/reset-password/`, payload)
      .pipe(map(() => void 0));
  }

  // ===== GESTÃO DE USUÁRIOS (ADMIN) =====
  listUsers(): Observable<UserProfile[]> {
    return this.http
      .get<{ count: number; results: UserProfile[] }>(`${env.apiBase}/auth/users/`)
      .pipe(map((response) => response.results ?? []));
  }

  createUser(payload: {
    username: string;
    email?: string;
    password: string;
    password_confirm?: string;
    is_staff?: boolean;
  }): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${env.apiBase}/auth/users/`, payload);
  }

  updateUser(
    userId: number,
    payload: { username?: string; email?: string; is_staff?: boolean }
  ): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${env.apiBase}/auth/users/${userId}/`, payload);
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${env.apiBase}/auth/users/${userId}/`);
  }

  // ===== HELPERS =====
  isAuthenticated(): boolean { return this.isLoggedIn(); }
  getCurrentUser(): UserProfile | null { return this.profileSig(); }
  isAdminUser(): boolean { return this.isAdmin(); }

  getAccessToken(): string | null { return this.accessTokenSig(); }
  getRefreshToken(): string | null { return this.refreshTokenSig(); }

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
    this.persistSession();
  }

  /** Persiste o estado completo da sessão (tokens + perfil) no localStorage. */
  private persistSession(): void {
    const access = this.accessTokenSig();
    if (!access) return;
    const payload: StoredSession = { access };
    const refresh = this.refreshTokenSig();
    if (refresh) payload.refresh = refresh;
    const user = this.profileSig();
    if (user) payload.user = user;
    localStorage.setItem(this.storageKey, JSON.stringify(payload));
  }

  private clearTokens(): void {
    this.accessTokenSig.set(null);
    this.refreshTokenSig.set(null);
    this.profileSig.set(null);
    localStorage.removeItem(this.storageKey);
  }
}
