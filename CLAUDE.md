# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kogui Pokédx — a fullstack Pokédex app. Backend: Django 5.0 + DRF + SimpleJWT. Frontend: Angular 17 standalone components. Integrates with the external PokéAPI v2.

---

## Commands

### Docker (primary workflow)
```bash
docker compose up -d
docker compose exec api python manage.py migrate
docker compose exec api python manage.py test        # all backend tests
docker compose exec api python manage.py test api    # tests for the api app only
docker compose exec api python manage.py test accounts
```

### Backend (local)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend (local)
```bash
cd frontend
npm install
npm start            # dev server on :4200
npm run lint         # TypeScript type-check (tsc --noEmit)
npm run test:e2e     # Playwright E2E (requires backend on :8000 and frontend on :4200)
```

---

## Architecture

### Backend (`backend/`)

- **`kogui_pokedex/`** — Django project package: settings, root URLs, middleware, logging, request context.
- **`accounts/`** — Auth app: register, JWT login (delegated to SimpleJWT at `/api/token/`), `/auth/me/`, password change, admin user management (`/auth/users/`).
- **`api/`** — Core app:
  - `models.py` — `Favorite` (user + pokemon_id, unique) and `TeamSlot` (user + slot 1–6 + pokemon_id, two unique constraints).
  - `pokeapi_service.py` — All PokéAPI integration. Uses Django's cache backend (default: in-memory, TTL 1h via `POKEAPI_CACHE_TTL` env var) and exponential backoff retries. `list_pokemon()` is the central entry point; type-filter uses a batched fetch loop because PokéAPI has no server-side type filter.
  - `views.py` — `PokemonListView` (public), `FavoriteListCreateView`/`FavoriteDestroyView` (auth), `TeamListView`/`TeamSetView` (auth, atomic replace of entire team).
  - `serializers.py` — `TeamSetSerializer` enforces max 6 unique IDs.
  - `tests/` — Unit tests use `unittest.mock.patch` to mock `_fetch_json` and `get_pokemon`; no real HTTP calls.

URL layout:
```
/api/token/         POST  JWT obtain
/api/token/refresh/ POST  JWT refresh
/auth/register/     POST
/auth/me/           GET
/auth/password/change/ POST
/auth/users/        GET/POST  (admin only)
/api/pokemon/       GET   ?generation=&name=&type=&limit=&offset=
/api/favorites/     GET/POST
/api/favorites/{id}/ DELETE
/api/team/          GET
/api/team/set/      POST  {pokemon_ids: [...]}
/api/docs/          Swagger UI
/api/redoc/         ReDoc
```

### Frontend (`frontend/src/app/`)

- **No NgModules** — pure standalone components throughout.
- **`services/`**:
  - `ApiService` — all HTTP calls to the backend.
  - `AuthService` — JWT token storage, login/logout, `isLoggedIn` signal.
  - `UserCollectionsStore` — singleton store using Angular Signals + RxJS for favorites and team state. Reacts to `AuthService.isLoggedIn` changes to auto-load/clear collections.
  - `auth.interceptor.ts` — functional interceptor that attaches `Authorization: Bearer` header and handles 401 with token refresh.
  - `FeedbackService` — toast/snack notification service.
- **`pages/`**: `PokemonPage` (main listing + filters), `FavoritesPage`, `TeamPage`, `LoginPage`, `PasswordResetPage`, `AdminUsersPage`.
- **Guards**: `authGuard` (redirects to `/login`), `adminGuard` (requires staff/admin).
- **State pattern**: `UserCollectionsStore` exposes readonly signals (`favorites`, `team`). Components inject the store and call mutating methods (`addFavorite`, `removeFavorite`, `setTeam`), which update local signal state optimistically after API success.

### Key design constraints
- Team max 6 Pokémon — enforced both in `TeamSetSerializer` (backend) and the DB `CheckConstraint` on `TeamSlot.slot`.
- Type filtering is expensive: `pokeapi_service.list_pokemon()` must fetch individual Pokémon from PokéAPI to check types. Results are cached but first load is slow.
- The frontend uses `is_favorite` / `is_in_team` fields returned by `GET /api/pokemon/` (only when authenticated) to show card states without extra requests.
