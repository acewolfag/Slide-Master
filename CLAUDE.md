# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**2Grils.PPT** — bilingual (Vietnamese/English) e-commerce platform for selling premium PowerPoint templates and custom design services. Originally scaffolded for Replit; the workspace still carries Replit-specific assumptions (see "Windows / non-Replit gotchas" below).

## Workspace layout

pnpm workspace with three roles:

- `artifacts/api-server` — Express 5 API, bundled by esbuild, mounted at `/api`
- `artifacts/2grils-ppt` — React 19 + Vite 7 storefront (Wouter router, TanStack Query)
- `artifacts/mockup-sandbox` — separate sandbox surface
- `lib/db` — Drizzle ORM schema + connection (`@workspace/db`)
- `lib/api-spec` — OpenAPI contract (`openapi.yaml`) + Orval codegen config
- `lib/api-client-react` — generated React Query hooks + `customFetch` (auth + cart-id wiring)
- `lib/api-zod` — generated Zod schemas
- `scripts` — `tsx` runners for seed/hello

## Common commands (run from repo root)

```bash
pnpm install                                      # install all workspaces
pnpm --filter @workspace/api-server run dev       # build + start API on $API_PORT (default 8080)
pnpm --filter @workspace/2grils-ppt run dev       # Vite dev server on $PORT (default 5173)
pnpm --filter @workspace/db run push              # drizzle-kit push (no migrations dir; pushes schema directly)
pnpm --filter @workspace/db run push-force        # destructive variant
pnpm --filter @workspace/scripts run seed         # populate DB with demo data
pnpm --filter @workspace/api-spec run codegen     # regenerate api-client-react + api-zod from openapi.yaml
pnpm run typecheck                                # full project graph (libs first via tsc -b, then artifacts)
pnpm run typecheck:libs                           # just lib/* via tsc --build
pnpm run build                                    # typecheck + per-workspace build
```

There is no test runner wired up in any package — `pnpm test` does not exist.

## Required env vars (root `.env`)

| Var | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | `lib/db`, drizzle-kit | Postgres URL (Supabase pooler is supported, port 6543 or 5432) |
| `SESSION_SECRET` | api-server `auth.ts` | Pepper for `sha256(password + secret)` — must be set or login/register break |
| `API_PORT` | api-server | Falls back to `PORT` if unset (legacy) |
| `PORT` | Vite | Required, distinct from `API_PORT` |
| `BASE_PATH` | Vite | Required (use `/` for local dev) |
| `NODE_ENV` | both | `development` locally |

Both api-server and Vite read root `.env` explicitly: api-server via `node --env-file=../../.env`, Vite via `loadEnv(mode, rootEnvDir)` in `vite.config.ts`. drizzle-kit loads root `.env` via `process.loadEnvFile()` in `lib/db/drizzle.config.ts`. Adding new packages that need env should follow one of those patterns — there is no global dotenv autoload.

## Architecture: contract-first API

The OpenAPI spec is the single source of truth:

```
lib/api-spec/openapi.yaml
   |-- Orval --> lib/api-client-react/src/generated/api.ts   (React Query hooks)
   `-- Orval --> lib/api-zod/src/generated/api.ts            (Zod schemas)
```

After editing `openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` (codegen also runs `typecheck:libs` afterward). Generated files are checked in; do not edit them by hand — they will be overwritten.

The frontend always calls the API through generated hooks that delegate to `lib/api-client-react/src/custom-fetch.ts`. That fetcher:

- Prefixes requests with `/api` (Orval `baseUrl`)
- Pulls auth token from a configured `AuthTokenGetter` and attaches `Authorization: Bearer <token>`
- Persists/sends `X-Cart-Id` from `localStorage.cart_id` (creating one server-side on first cart write)

## Architecture: auth and cart

- **Auth token is base64-encoded JSON** `{userId, exp}` — not a JWT. Generated and parsed in `artifacts/api-server/src/routes/auth.ts`. Client stores it in `localStorage.auth_token`.
- **Password hashing** is `sha256(password + SESSION_SECRET)` — single round, no per-user salt. Don't change to bcrypt without a migration plan for existing seeded hashes.
- **Admin checks** rely on `user.role === "admin"` enforced server-side on every admin route; frontend route guards in `artifacts/2grils-ppt/src/App.tsx` are convenience only.
- **Cart is an in-memory `Map<cartId, CartSession>`** in `routes/cart.ts`. State resets on every API restart — there is intentionally no DB persistence for carts. Voucher logic (`WELCOME20`, `SALE50K`) is computed inline in `computeCart`.

## Schema and DB

- Schema modules live in `lib/db/src/schema/` (one file per domain: `users`, `templates`, `categories`, `orders`, `reviews`, `vouchers`, `blog-posts`, `wishlist`, `custom-requests`, `service-pricing`, `site-settings`). All re-exported through `schema/index.ts` and the package root.
- Workflow for schema changes: edit schema file -> `pnpm --filter @workspace/db run push` -> restart api-server. There are no SQL migration files — drizzle-kit pushes diffs directly. Use `push-force` only when you accept data loss.
- `drizzle.config.ts` uses a relative forward-slash schema path (`./src/schema/index.ts`) — drizzle-kit's globber treats backslashes as escapes, so don't switch to `path.join`.

## Frontend conventions

- Routing: **Wouter** (not React Router). `WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}` so the app honors `BASE_PATH`.
- Path aliases: `@/*` -> `artifacts/2grils-ppt/src/*`, `@assets/*` -> `attached_assets/*` (root-level demo assets, not bundled by default).
- UI is shadcn-style: Radix primitives + Tailwind 4 + `class-variance-authority`. Components in `src/components/ui/`.
- Brand: gradient `#00B14F -> #1E5FAF`, Be Vietnam Pro font, Vietnamese UI labels, no emojis in product UI.

## Windows / non-Replit gotchas

This repo was authored for Replit (linux-x64). Several Replit-isms have been patched but will reappear if files are reset from upstream:

- `pnpm-workspace.yaml` `overrides` excludes optional binary packages for every platform except linux-x64 (esbuild, lightningcss, @tailwindcss/oxide, rollup, @expo/ngrok-bin). On any other host, the matching `*-win32-x64` / `*-darwin-arm64` / etc. entries must be removed before `pnpm install` will produce a runnable build.
- Root `preinstall` guards against npm/yarn via `npm_config_user_agent`. pnpm 11 on Windows does not always populate that var inside scripts; the current implementation also checks `npm_execpath` to remain cross-platform.
- api-server's `dev` script and Vite config previously assumed the Replit env-injection model. They now read root `.env` explicitly — keep it that way when editing.

## Pointers

- Operational notes, demo accounts, and product-level decisions: `replit.md`
- Generated API surface: `lib/api-client-react/src/generated/api.ts` (do not edit)
- All Express routes are mounted in `artifacts/api-server/src/routes/index.ts`
