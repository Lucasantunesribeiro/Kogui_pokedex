# Pokédex Digital

Monorepo com backend em Django REST Framework e frontend em Angular 17 (standalone) para autenticação JWT, listagem filtrada de Pokémon, favoritos e equipe de batalha.

## Estrutura

- `backend/`: Projeto Django 5 com apps `accounts` (autenticação) e `api` (Pokédex, favoritos, equipe).
- `frontend/`: Aplicação Angular 17 com rotas para listagem, login, favoritos, equipe, segurança (alteração de senha) e gestão de usuários.
- `docker-compose.yml`: Sobe o serviço `api` em modo desenvolvimento.

## Requisitos

- Backend local: Python 3.12+, pip.
- Frontend local: Node.js 18+ (recomendado 20) e npm.
- Docker (opcional) para executar somente a API.

## Executando com Docker

```bash
docker compose up -d --build
```

Após subir os contêineres, aplique as migrações:

```bash
docker compose exec api python manage.py migrate
```

Usuário administrador (opcional):

```bash
docker compose exec api python manage.py createsuperuser
```

A API ficará disponível em `http://localhost:8000` (health check em `/health/`). O frontend segue rodando localmente (veja abaixo).

## Executando localmente

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### Frontend

```bash
cd frontend
npm install
npm start
```

O frontend usa `http://localhost:8000` como `apiBase` (definido em `src/environments/environment.ts`).

## Endpoints principais

| Método | Rota | Descrição |
| ------ | ---- | --------- |
| POST | `/auth/register/` | Registro de usuário (senha + confirmação opcional).
| POST | `/authtoken` | Login padrão SimpleJWT (`username` + `password`) gerando `{ "access", "refresh" }`.
| POST | `/authtokenrefresh` | Renovação de access token.
| GET | `/auth/me/` | Dados do usuário autenticado (nome, e-mail, perfil).
| POST | `/auth/password/change/` | Atualiza a senha do usuário autenticado (requer senha atual).
| GET | `/auth/users/` | Lista usuários cadastrados (acesso restrito a administradores).
| GET | `/api/pokemon/` | Listagem paginada de Pokémon (`generation`, `name`, `limit`, `offset`).
| GET/POST | `/api/favorites/` | Lista e cria favoritos do usuário logado.
| DELETE | `/api/favorites/{id}/` | Remove favorito.
| GET | `/api/team/` | Slots atuais da equipe (1..6).
| POST | `/api/team/set/` | Substitui a equipe (corpo `{ "pokemon_ids": [1, 2, ...] }`, máximo 6 e sem duplicados).
| GET | `/health/` | Health check com `{ "status": "ok" }`.

## Exemplos `curl`

> ⚠️ No Windows PowerShell o comando `curl` é apenas um alias para `Invoke-WebRequest`, o que ignora flags como `-H` e `-d`. Utilize `curl.exe` (o binário real) ou `Invoke-RestMethod` para reproduzir os exemplos.

### Health check
```bash
curl http://localhost:8000/health/
```

### Registrar usuário
```bash
curl -X POST http://localhost:8000/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
        "username": "ash",
        "password": "pikachu123",
        "password_confirm": "pikachu123",
        "email": "ash@pokedex.com"
      }'
```
(`password_confirm` é opcional; quando informado precisa bater com `password`.)

### Obter token JWT (login padrão SimpleJWT)
```bash
curl -X POST http://localhost:8000/authtoken \
  -H "Content-Type: application/json" \
  -d '{
        "username": "ash",
        "password": "pikachu123"
      }'
```

Resposta: `{ "refresh": "...", "access": "..." }`

### Renovar token
```bash
curl -X POST http://localhost:8000/authtokenrefresh \
  -H "Content-Type: application/json" \
  -d '{ "refresh": "<refresh_token>" }'
```

#### Login JWT no PowerShell

```powershell
# Usando o binário real do curl (atenção ao ^ para múltiplas linhas)
curl.exe -X POST http://localhost:8000/authtoken ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"ash\",\"password\":\"pikachu123\"}"
```

```powershell
# Usando Invoke-RestMethod (alternativa nativa do PowerShell)
Invoke-RestMethod -Uri "http://localhost:8000/authtoken" -Method Post `
  -ContentType "application/json" `
  -Body '{"username":"ash","password":"pikachu123"}'
```

### Listar Pokémon (geração + nome)
```bash
curl "http://localhost:8000/api/pokemon/?generation=1&name=bul&limit=12&offset=0"
```

### Favoritar Pokémon (autenticado)
```bash
token="<access_token>"
curl -X POST http://localhost:8000/api/favorites/ \
  -H "Authorization: Bearer ${token}" \
  -H "Content-Type: application/json" \
  -d '{ "pokemon_id": 25 }'
```

### Definir equipe completa
```bash
token="<access_token>"
curl -X POST http://localhost:8000/api/team/set/ \
  -H "Authorization: Bearer ${token}" \
  -H "Content-Type: application/json" \
  -d '{
        "pokemon_ids": [1, 6, 25]
      }'
```

## Boas práticas implementadas

- Autenticação JWT (SimpleJWT) com refresh automático via interceptor e redirecionamento seguro em respostas 401/403.
- Proxy da PokéAPI no backend (timeout + retries) com dados normalizados (tipos, sprites, estatísticas HP/Ataque/Defesa).
- Logs estruturados em JSON com `request_id` (header `X-Request-ID`) e health check exposto em `/health/`.
- Favoritos modelados via tabela dedicada (`Favorite`) com unicidade por `(user, pokemon_id)`.
- Equipe de batalha via `TeamSlot` (slots 1..6, sem duplicatas) atualizada por `POST /api/team/set/`.
- Layout responsivo com cabeçalho laranja, faixa roxa, contadores, chips coloridos por tipo, cards e barras normalizadas.
- Feedback acessível (toasts) para sucessos/erros, textos em pt-BR e contraste AA.
- CORS configurado para `http://localhost:4200` apenas em desenvolvimento.
- Scripts de inicialização simples (`npm start`, `python manage.py runserver`) e lint via `npm run lint` (type-check).

## Testes

- Execute `docker compose exec api python manage.py test` para validar integrações da PokéAPI (mockadas) e regras de equipe (`TeamSetSerializer`).
- Cobertura adicional em `accounts/tests` garante cadastro com confirmação opcional e login padrão SimpleJWT.
