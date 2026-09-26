# ft_transcendence

GLHF

## Module Status

| Status      | Module                                        | Type  | Points | Where to verify                                                                                                                                                                                                                                                                    |
| ----------- | --------------------------------------------- | ----- | -----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete    | Frontend and backend frameworks               | Major |      2 | Frontend: `frontend/package.json`, `frontend/vite.config.ts`, and `frontend/src/`. Backend: `backend/go.mod`, `backend/cmd/api/`, and `backend/internal/server/`.                                                                                                                  |
| Complete    | ORM for the database (Bun)                    | Minor |      1 | `backend/internal/database/database.go` and `backend/internal/todos/repository.go`; database migration: `backend/migrations/`.                                                                                                                                                     |
| Complete    | Server-Side Rendering (SSR)                   | Minor |      1 | SSR is enabled in `frontend/vite.config.ts`; request handling is in `frontend/server.ts`; document shell: `frontend/src/Document.tsx`.                                                                                                                                             |
| In progress | WAF/ModSecurity + HashiCorp Vault for secrets | Major |      2 | WAF/TLS proxy: `compose.yml` and `nginx/default.conf.template`. Vault configuration, policies, and dynamic database credentials: `vault/` and `backend/internal/vault/`. Production WAF blocking is enabled in `compose.yml`; hardening still needs evaluation-level verification. |
| In progress | Public API                                    | Major |      2 | Current five CRUD endpoints are in `backend/internal/todos/handler.go`, registered in `backend/internal/server/server.go`. API-key authentication, rate limiting, and API documentation are still required.                                                                        |
| In progress | Complete web-based game                       | Major |      2 | Browser integration: `frontend/src/components/Game.tsx` and `frontend/src/routes/game.tsx`. Game prototype: `game/src/`; simulation tests: `game/tests/`. It currently renders a bouncing ball only; live players, game rules, and win/loss conditions are still required.         |

**Currently claimable: 4 points** (one Major + two Minor modules).

**Expected total: 10 points** if every in-progress module is completed, demonstrated, and accepted during evaluation.
