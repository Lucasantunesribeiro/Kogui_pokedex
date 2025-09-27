# PLANO DE REESTRUTURAÇÃO E CORREÇÃO DO PROJETO **Kogui Pokedex** - AGENTS

> **Objetivo**  
> Fazer uma auditoria e refatoração sênior de _backend (Django/DRF + SimpleJWT)_ e _frontend (Angular 17+)_ para:
> 1) corrigir login que "desfaz" ao recarregar,  
> 2) corrigir erro de favoritos/equipe no Angular,  
> 3) alinhar APIs, segurança, testes, documentação e entrega,  
> 4) deixar o repositório pronto para avaliação técnica.

> **Premissas verificadas em fontes oficiais**  
> - **Endpoints canônicos do SimpleJWT** são `POST /api/token/` e `POST /api/token/refresh/`. Manter esses ou prover aliases compatíveis.   
> - **Angular recomenda interceptores funcionais** (`withInterceptors(...)`) e registra via `provideHttpClient(...)`.   
> - **Paginação no DRF** deve usar as classes nativas (ex.: `PageNumberPagination`) com configuração global.   
> - **Filtragem no DRF**: usar `django-filter` + `DjangoFilterBackend`.   
> - **Documentação do DRF** recomenda **drf-spectacular** (OpenAPI 3 + SwaggerUI/ReDoc).   
> - **PokéAPI (REST v2)**: API sem auth, **política de fair use exige _cache local_**.   
> - **Boas práticas de segurança de API**: OWASP API Security Top 10 (2023) como guia. 

---

## 0) Como o Codex deve operar

1. **Analisar o repo** e criar branch: `feat/refactor-senior-audit`.
2. **Executar** `docker compose up -d` e validar:
   - `docker compose exec api python manage.py migrate`
   - `docker compose exec api python manage.py test`
3. **Mapear** todos os arquivos listados abaixo; **refatorar um por um** com commits atômicos (Conventional Commits).
4. **Garantir** que _todos os testes_ (unitários + E2E) passam antes de cada push.
5. **Manter** aliases de rotas existentes por compatibilidade, **mas padronizar internamente** para os canônicos do SimpleJWT.
6. **Não quebrar layout**: UI já está correta; foque em lógica, estados, segurança, DX e testes.
7. **Adicionar documentação viva** com OpenAPI (drf-spectacular) e README final com fluxos.
8. **Aplicar linters/formatters** (Python: Ruff + Black; Angular: eslint/angular-eslint) antes de commitar.

---

## 1) Correções imediatas (bugs reportados)

### 1.1 Erro no Angular

```
core.mjs:6531 ERROR TypeError: this.favorites is not a function or its return value is not iterable
at Object.computation (...)
```

**Causa provável (padrões Angular 17):**
- `favorites` foi tratado como **função Signal** ou **Subject** mas consumido como **iterável** (ex.: `for...of` ou `...spread`), ou vice-versa.
- Em Signals, o valor é lido via **chamada** (`favorites()`), e para verificar favorito deve ser um `Set<number>` ou `string[]`.

**Correção (arquivo `frontend/src/app/services/auth.service.ts` e/ou store/feature service):**
- Tornar o estado **forte e consistente**:
  - `favoritesSig = signal<Set<number>>(new Set());`
  - APIs públicas:
    - `isFavorite = (id: number) => this.favoritesSig().has(id);`
    - `setFavorites = (ids: number[]) => this.favoritesSig(new Set(ids));`
    - `toggleFavorite = (id: number) => { const s=new Set(this.favoritesSig()); s.has(id)?s.delete(id):s.add(id); this.favoritesSig(s) }`
- No componente, **nunca** use `this.favorites` como função se ele não for Signal. Se for Signal, **sempre** `this.favorites()`.

**Caso esteja usando Observables:**
- Converter com `toSignal(favorites$, {initialValue: new Set<number>()})` e **usar `favorites()`**. (Mantém recomendação Angular atual por Signals + interceptors funcionais.)

### 1.2 Login "desfeito" ao recarregar

**Meta:** persistir sessão com **Access Token em memória** + **Refresh Token** em `localStorage` (ou cookie HttpOnly se o backend já suportar). Para a prova técnica, **aceitar `localStorage`** com renovação automática — simples e suficiente.

**Passos (Angular):**
- Criar `AuthState` (Signals):
  - `accessTokenSig = signal<string | null>(null)`
  - `userSig = signal<User | null>(null)`
- **APP_INITIALIZER** (ou `bootstrapApplication` async) para restaurar do `localStorage` ao iniciar:
  - Lê `refreshToken`, tenta `POST /api/token/refresh/` e reidrata `accessTokenSig`. (Rotas canônicas SimpleJWT.)
- **Interceptor funcional** (`auth.interceptor.ts`) com `withInterceptors([...])`:
  - Anexa `Authorization: Bearer <access>` exceto em rotas públicas (`/api/token/`, `/api/token/refresh/`, chamadas diretas ao `pokeapi.co`). 
  - Em `401`, **tenta refresh** uma vez; se falhar, faz `logout()` limpo.

**Passos (Django/DRF):**
- Garantir `REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']` inclui `rest_framework_simplejwt.authentication.JWTAuthentication`.
- Expor **rotas canônicas**:
  - `path("api/token/", TokenObtainPairView.as_view())`
  - `path("api/token/refresh/", TokenRefreshView.as_view())`  
- Manter aliases `/authtoken` e `/authtokenrefresh` (se já usados no front), **mas usar os canônicos no README e no interceptor** (padrão do ecossistema).

**PowerShell (para testar tokens) — use um dos dois:**
- `curl.exe -X POST http://localhost:8000/api/token/ -H "Content-Type: application/json" -d "{\"username\":\"ash\",\"password\":\"pikachu123\"}"`
- **OU** `Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/token/ -Headers @{ "Content-Type"="application/json" } -Body '{"username":"ash","password":"pikachu123"}'`

---

## 2) Backend (Django/DRF) — roteiro de refatoração

### 2.1 Autenticação & URLs
- **Padronizar** endpoints JWT (ver 1.2) e manter aliases temporários. 
- `SIMPLE_JWT` com `ACCESS_TOKEN_LIFETIME` curto (ex. 5–15min) e `ROTATE_REFRESH_TOKENS=true` se adotar rotação.
- `REST_FRAMEWORK`:
  - `DEFAULT_AUTHENTICATION_CLASSES = ("rest_framework_simplejwt.authentication.JWTAuthentication",)`
  - `DEFAULT_PERMISSION_CLASSES = ("rest_framework.permissions.IsAuthenticated",)` (abrir explicitamente as rotas públicas)
  - `DEFAULT_PAGINATION_CLASS = "rest_framework.pagination.PageNumberPagination"`
  - `PAGE_SIZE = 20` (exemplo)  
  - `DEFAULT_FILTER_BACKENDS = ("django_filters.rest_framework.DjangoFilterBackend",)` 

### 2.2 Modelo & Migrações (favoritos/equipe)
- **Migração 0002_restore_team_tables**: garantir criação de `api_favorite` e `api_teamslot`; remover tabela obsoleta `api_pokemonusuario` se existir.
- **Integridade**:
  - Unique `(user_id, pokemon_id)` em favoritos.
  - Para `teamslot`: chave única `(team_id, slot)` e FK com `on_delete=CASCADE`.
- **Seeds opcionais** para facilitar testes E2E.

### 2.3 Views/Serializers
- **ViewSets** com `ModelSerializer` e `filterset_fields` (django-filter). 
- **Paginação** consistente em todas as listas. 
- **Endpoints**:
  - `GET /favorites/` → lista paginada do usuário
  - `POST /favorites/` → cria (validação de duplicidade)
  - `DELETE /favorites/{pokemon_id}/`
  - `GET /team/` → time atual (slots)
  - `PUT /team/slots/{slot}/` → troca/define Pokémon
- **Validação** de ownership sempre (OWASP API1/BOLA). 

### 2.4 Documentação (OpenAPI)
- Adicionar **drf-spectacular**:
  - `INSTALLED_APPS += ["drf_spectacular", "drf_spectacular_sidecar"]`
  - `REST_FRAMEWORK["DEFAULT_SCHEMA_CLASS"] = "drf_spectacular.openapi.AutoSchema"`
  - URLs:
    - `/api/schema/` (OpenAPI)
    - `/api/docs/` (SwaggerUI)
    - `/api/redoc/`  
- Anotar operações específicas com `@extend_schema` se necessário.

### 2.5 Integração com PokéAPI
- **Nunca proxy sem cache**. Criar `services/pokeapi.py`:
  - `requests.get(..., timeout=(3.05, 10))` + **cache** (Redis/File/Django cache) por 1–24h para recursos estáticos. (Fair use da PokéAPI exige cache local.) 
- **Throttle** opcional para rotas que consultam PokéAPI.
- **Campos**: armazenar somente o necessário (ex.: IDs, nomes, sprites).

### 2.6 Segurança (OWASP API Top 10)
- **BOLA/BFLA**: checar `request.user` em toda operação de recurso do usuário.
- **Rate limit / throttling** nas rotas de login/refresh.
- **CORS** mínimo necessário.
- **Headers** de segurança no Nginx.
- **Logs** e correlação de request id. 

---

## 3) Frontend (Angular 17+) — roteiro de refatoração

### 3.1 Estado de Autenticação & Persistência
- **Service `AuthService`** com Signals:
  - `accessTokenSig`, `userSig`, `favoritesSig`, `teamSig`.
- **Boot** com `APP_INITIALIZER` ou `bootstrapApplication` assíncrono:
  - Ler `refreshToken` do `localStorage`, chamar `/api/token/refresh/`, reidratar estado. 
- **Logout** limpa Signals + storage.

### 3.2 Interceptor funcional (recomendado)
- Arquivo: `frontend/src/app/services/auth.interceptor.ts`
- `export const authInterceptor: HttpInterceptorFn = (req, next) => { ... }`
- Registro:  
  `provideHttpClient(withInterceptors([authInterceptor]))` em `app.config.ts`.  
  **Motivo**: ordem previsível e recomendação oficial. 
- **Exclusão de rotas públicas** (`/api/token/`, `/api/token/refresh/`, `https://pokeapi.co/*`).

### 3.3 Favoritos/Equipe (UI)
- **Normalizar** formatos:
  - **Favoritos** = `Set<number>` no estado; desenhar com `favorites().has(id)`.
  - **Time** = `{ slot: 1..6, pokemonId: number|null }[]`, com validação de slots.
- **Async**: se ainda existirem `Observable`s, converter com `toSignal()`.

### 3.4 Serviços de API
- `AuthApi`, `FavoritesApi`, `TeamApi`:
  - Retornos **tipados** (`HttpClient` genérico).
  - Erros tratados (toast/snackbar) e backoff simples quando offline.

### 3.5 Acessibilidade & UX
- Foco visível, rótulos (`aria-*`), leitura de erros.  
- Sem bloqueios de layout; lazy assets.

---

## 4) Testes

### 4.1 Python
- **pytest + pytest-django** (ou `manage.py test`), **factory_boy** para fixtures.
- **Testes de auth**:
  - `POST /api/token/` → 200 (credenciais válidas) / 401 (inválidas).
  - `POST /api/token/refresh/` → novo access. 
- **Testes de favoritos/equipe**: CRUD + regras (único por usuário, slots 1..6).

### 4.2 Angular
- **Unit tests** (Jest/Karma): serviços e componentes que usam `favoritesSig` e `teamSig`.
- **E2E (Playwright)**:
  - Fluxo: login → persistência após reload → favoritar → manter após nova sessão.
  - **Reusar estado autenticado** (storage state) para acelerar rodadas. (Padrão em Playwright docs.)

---

## 5) Observabilidade

- **Logging estruturado** (uvicorn/gunicorn + Django).
- **Covers** básicos (pytest-cov).
- **Healthcheck** `/healthz` (interno).

---

## 6) Entrega, Docker e CI

### 6.1 Docker
- **Backend**: imagem multi-stage (builder → slim) + Gunicorn.
- **Frontend**: build Angular → servir com Nginx (headers de cache e segurança).
- `docker-compose.yml`: serviços `api`, `web`, `db`, `cache` (se usar Redis).

### 6.2 CI (GitHub Actions)
- Jobs: **lint** (Ruff/Black/eslint), **test** (pytest + Angular), **e2e** (Playwright headless), **build** (Docker).
- Cache de deps (pip/npm).
- Artefato: `openapi.yaml` + preview do Swagger.

---

## 7) Linters, Formatters e Style Guides

- **Python**:  
  - **Ruff** (lint + format, super rápido); **Black** se preferir estilo Black (Ruff formatter também é suportado). 
  - `pyproject.toml` único para ambos.
- **Angular/TS**:  
  - `eslint` + `@angular-eslint/*` (regras de imports, members order, no `any`, etc.).
- **Commits**: Conventional Commits.

---

## 8) Política de uso da PokéAPI (importante)

- **Cache local obrigatório** para evitar banimento por fair use; a API não exige auth, mas o tráfego é alto.  
  **Ação**: implementar camada de cache nas chamadas ou armazenar recursos estáticos (sprites/metadados) por janela de tempo. 

---

## 9) Plano de commits (exemplo)

1. `chore(backend): add drf-spectacular + openapi urls`  
2. `feat(auth): adopt SimpleJWT canonical endpoints + aliases`    
3. `fix(db): restore favorites/team tables with constraints`  
4. `feat(api): pagination + filtering via django-filter`    
5. `feat(pokeapi): add caching layer to respect fair-use`    
6. `refactor(frontend): migrate to functional interceptor + app initializer`    
7. `fix(frontend): normalize favorites as Set + isFavorite signal`  
8. `test(e2e): add login persistence and favorites flow (Playwright)`  
9. `chore: add ruff+black, eslint, pre-commit`  
10. `docs: README + API docs link + usage examples`

---

## 10) Checklists de revisão por arquivo

### Backend
- `backend/kogui_pokedex/urls.py`  
  - [ ] Rotas **/api/token/** e **/api/token/refresh/** ativas (manter aliases).   
  - [ ] Rotas **/api/schema**, **/api/docs**, **/api/redoc** (drf-spectacular). 
- `backend/settings.py`  
  - [ ] `REST_FRAMEWORK` com auth/pagination/filter conforme seção.   
  - [ ] `SIMPLE_JWT` ajustado.  
- `backend/api/migrations/0002_restore_team_tables.py`  
  - [ ] Cria `api_favorite` (unique (user, pokemon_id)).  
  - [ ] Cria `api_teamslot` (unique (team, slot)).  
  - [ ] Drop `api_pokemonusuario` se existir.
- `backend/api/views.py / serializers.py`  
  - [ ] ViewSets com `filterset_fields` e paginação. 
- `backend/services/pokeapi.py`  
  - [ ] Função `get_pokemon(id_or_name)` **com cache** e timeout/backoff. 

### Frontend
- `frontend/src/app/app.config.ts`  
  - [ ] `provideHttpClient(withInterceptors([authInterceptor]))`.   
  - [ ] `APP_INITIALIZER`/bootstrap async para restaurar sessão.
- `frontend/src/app/services/auth.interceptor.ts`  
  - [ ] Interceptor **funcional** com exclusões corretas. 
- `frontend/src/app/services/auth.service.ts`  
  - [ ] Signals (`accessTokenSig`, `favoritesSig`, `teamSig`).  
  - [ ] Métodos `isFavorite`, `toggleFavorite`, `setFavorites`.  
  - [ ] Persistência de `refreshToken` e reidratação.
- Componentes de UI  
  - [ ] Usar `favoritesSig().has(id)` (não iterar Signal como função/array erroneamente).  
  - [ ] Time com slots validados.

---

## 11) Exemplos de código (trechos essenciais)

### 11.1 Django — URLs SimpleJWT + OpenAPI

```python
# backend/kogui_pokedex/urls.py
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),        # canônico
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),       # canônico
    path("authtoken", TokenObtainPairView.as_view()),                                   # alias compat.
    path("authtokenrefresh", TokenRefreshView.as_view()),                               # alias compat.

    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("api/", include("api.urls")),
]
```

*Refs: SimpleJWT endpoints; drf-spectacular recomendado pelo DRF.*

### 11.2 Django — DRF settings

```python
# backend/settings.py (trecho)
REST_FRAMEWORK = {
  "DEFAULT_AUTHENTICATION_CLASSES": (
    "rest_framework_simplejwt.authentication.JWTAuthentication",
  ),
  "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
  "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
  "PAGE_SIZE": 20,
  "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
}
```

*Refs: Paginação DRF; integração django-filter.*

### 11.3 Angular — Interceptor funcional

```typescript
// frontend/src/app/services/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

const PUBLIC_PATHS = [
  '/api/token/', '/api/token/refresh/', // SimpleJWT
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const isPublic = PUBLIC_PATHS.some(p => req.url.includes(p)) || req.url.includes('https://pokeapi.co/');

  if (isPublic) return next(req);

  const token = auth.accessToken();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    auth.handle401AndRefresh(authReq, next) // implementa tentativa de refresh uma vez
  );
};
```

*Refs: Interceptores funcionais + withInterceptors(...).*

### 11.4 Angular — Estado e persistência

```typescript
// frontend/src/app/services/auth.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessTokenSig = signal<string|null>(null);
  private favoritesSig = signal<Set<number>>(new Set());

  constructor(private http: HttpClient) {}

  accessToken = () => this.accessTokenSig();

  async restoreSession(): Promise<void> {
    const rt = localStorage.getItem('refresh_token');
    if (!rt) return;
    try {
      const { access } = await this.http.post<{access:string}>('/api/token/refresh/', { refresh: rt }).toPromise();
      this.accessTokenSig(access);
      // opcional: carregar favoritos do backend
    } catch { this.logout(); }
  }

  login(username: string, password: string) {
    return this.http.post<{access:string, refresh:string}>('/api/token/', { username, password })
      .subscribe(({ access, refresh }) => {
        this.accessTokenSig(access);
        localStorage.setItem('refresh_token', refresh);
      });
  }

  logout() {
    this.accessTokenSig(null);
    localStorage.removeItem('refresh_token');
    this.favoritesSig(new Set());
  }

  // favoritos
  isFavorite = (id: number) => this.favoritesSig().has(id);
  setFavorites = (ids: number[]) => this.favoritesSig(new Set(ids));
  toggleFavorite = (id: number) => {
    const s = new Set(this.favoritesSig());
    s.has(id) ? s.delete(id) : s.add(id);
    this.favoritesSig(s);
  };
}
```

---

## 12) README (pontos que devem constar ao final)

- Como subir (docker compose up -d) e migrar (manage.py migrate).
- Como obter token via rotas canônicas (exemplos curl.exe e Invoke-RestMethod).
- Fluxo de favoritos/equipe.
- Link /api/docs/ (Swagger), /api/schema/ (OpenAPI).
- Nota de fair use da PokéAPI + cache.

---

## 13) Critérios de aceite

- [ ] Recarregar a página não faz logout (refresh automático OK).
- [ ] Sem erro this.favorites is not a function....
- [ ] CRUD de favoritos/equipe funcionando com validações.
- [ ] /api/docs/ disponível e fiel aos endpoints.
- [ ] Linters/formatters sem erros; CI passando.
- [ ] Uso de PokéAPI com cache local.

---

## 14) Notas finais

Padrões escolhidos estão alinhados com recomendações oficiais (SimpleJWT, DRF, Angular) e guias de segurança (OWASP).

**Fontes-chave:** SimpleJWT endpoints; Angular interceptors funcionais; DRF paginação/filtragem; drf-spectacular; Fair use PokéAPI; OWASP Top 10.

---

## 15) Instruções específicas para Codex

### 15.1 Prioridade de execução
1. **Primeiro**: Corrigir bugs críticos (login persistente + erro favorites)
2. **Segundo**: Implementar endpoints canônicos JWT + aliases
3. **Terceiro**: Adicionar documentação OpenAPI
4. **Quarto**: Implementar cache PokéAPI
5. **Quinto**: Testes E2E e CI/CD

### 15.2 Comandos essenciais para Codex
```bash
# Backend
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py migrate
docker compose exec api python manage.py test
docker compose exec api python manage.py collectstatic

# Frontend
cd frontend && npm install
cd frontend && npm run build
cd frontend && npm test

# Docker
docker compose up -d
docker compose logs -f api
docker compose logs -f web
```

### 15.3 Validação de sucesso
- [ ] Login persiste após reload da página
- [ ] Favoritos funcionam sem erro "not a function"
- [ ] Swagger UI acessível em `/api/docs/`
- [ ] Todos os testes passam
- [ ] Build Docker sem erros

### 15.4 Arquivos críticos para monitorar
- `backend/kogui_pokedex/settings.py`
- `backend/kogui_pokedex/urls.py`
- `frontend/src/app/services/auth.service.ts`
- `frontend/src/app/services/auth.interceptor.ts`
- `frontend/src/app/app.config.ts`
