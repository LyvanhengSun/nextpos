# POS System

POS-first platform for physical shops, with optional e-commerce added later.

## Apps

- `apps/web` — cashier POS and manager dashboard (Next.js)
- `apps/api` — business rules and API (NestJS)
- `packages/types` — shared TypeScript contracts

## Start locally

1. Run `docker compose up -d` to start PostgreSQL.
2. Run `pnpm install`.
3. Run `pnpm --filter @pos/api db:generate`.
4. Run `pnpm dev`.

See `docs/architecture.md` for the domain rules and system boundaries.

## Team test deployment

The recommended hosted architecture is:

- Vercel: `apps/web` (Next.js)
- Render Singapore: `apps/api` (NestJS)
- Render Singapore: PostgreSQL
- Cloudflare R2: product images

### 1. Render API and database

Create a Render Blueprint from `render.yaml`. Before the first deploy, provide the
five `R2_*` values from the Cloudflare R2 bucket. Set `WEB_ORIGIN` to the final
Vercel HTTPS URL after creating the Vercel project. The Blueprint runs committed
Prisma migrations before each API deployment.

The free Render database is only appropriate for temporary team testing and
expires according to Render's current free-database policy. Upgrade it before
storing production sales.

### 2. Vercel web app

Import this repository into Vercel and set the project Root Directory to
`apps/web`. Keep "Include source files outside of the Root Directory" enabled so
the workspace dependency in `packages/types` is available. Add:

```text
API_PROXY_TARGET=https://kn-pos-api.onrender.com
```

Replace that example with the URL assigned to the Render API, then redeploy the
Vercel project. Finally, copy the Vercel production URL into the Render API's
`WEB_ORIGIN` variable and redeploy the API.

### 3. Cloudflare R2

Create a bucket and an R2 API token with object read/write permission. Configure
a public custom domain (recommended) and use it as `R2_PUBLIC_URL`. The API uses
the S3-compatible endpoint and stores new uploads under `products/`.
