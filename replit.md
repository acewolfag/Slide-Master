# 2Grils.PPT

A bilingual (Vietnamese/English) e-commerce platform for selling premium PowerPoint templates and custom design services.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/scripts run seed` — seed the database with initial data
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `DATABASE_URL` (Postgres), `SESSION_SECRET` (password hashing salt)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifact `2grils-ppt`, preview path `/`)
- API: Express 5 (artifact `api-server`, preview path `/api`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Auth: Simple base64 token (not JWT), SHA256+SESSION_SECRET password hashing
- Cart: In-memory Map keyed by `X-Cart-Id` header

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth for codegen)
- `lib/db/src/schema/` — Drizzle schema files (users, templates, categories, orders, reviews, vouchers, blog-posts, wishlist, custom-requests)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/2grils-ppt/src/pages/` — React page components
- `artifacts/2grils-ppt/src/components/` — Shared UI components

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks used throughout frontend
- Cart stored in server-side in-memory Map (no DB); keyed by `X-Cart-Id` header that frontend must persist
- Auth token is base64-encoded JSON `{userId, exp}` — simple but stateless; client stores in `localStorage.auth_token`
- Admin pages check `user.role === "admin"` server-side on every request; frontend also guards routes client-side
- Template thumbnails use Unsplash URLs for seeded demo data

## Product

- Template catalog with category/price/style/tag filters, sorting, pagination
- Template detail with preview gallery, reviews, and add-to-cart
- Cart with voucher support (WELCOME20 = 20% off, SALE50K = 50k fixed)
- VietQR payment checkout with 15-minute countdown timer
- Custom design request: 5-step wizard form
- User dashboard: library, orders, custom requests, wishlist, profile
- Admin: dashboard stats, template management, order confirmation, kanban for custom requests, user list, voucher management
- Blog with Vietnamese and English content

## User preferences

- Brand gradient: #00B14F (green) → #1E5FAF (blue)
- UI language: Vietnamese (labels, buttons, headings)
- No emojis in UI
- Font: Be Vietnam Pro

## Gotchas

- Cart state resets on API server restart (in-memory); must re-add items
- Always run `pnpm install` after adding new workspace dependencies
- After DB schema changes, run `pnpm --filter @workspace/db run push` before starting the server
- The `auth/me` 401 errors in logs are expected when no user is logged in (not an error)

## Pointers

- See `.local/skills/pnpm-workspace/references/` for workspace, server, and DB setup details
- Demo accounts: admin@2grils.com / admin123, demo@example.com / demo123
