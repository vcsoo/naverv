# Cloudflare setup

This project uses the existing D1 tables:

- `targets`
- `rankings`

The Pages project must have a D1 binding named `DB` pointing to `naverv-db`.

## Pages Functions

The site uses these endpoints:

- `GET /api/targets`
- `POST /api/targets`
- `DELETE /api/targets?query=...&place=...`
- `POST /api/ranking`
- `POST /api/search`
- `POST /api/collect`

After this branch is merged to `main`, Cloudflare Pages should redeploy automatically from GitHub.

## Daily auto collection

Cloudflare Pages Functions do not run scheduled cron jobs by themselves. The scheduled job is in `worker-cron/`.

Schedule:

```text
30 2 * * *
```

This is 02:30 UTC, which is 11:30 in Korea.

Before deploying the worker with Wrangler, replace this value in `worker-cron/wrangler.toml`:

```toml
database_id = "REPLACE_WITH_NAVERV_DB_DATABASE_ID"
```

You can find the D1 database ID in Cloudflare Dashboard > Storage & Databases > D1 > naverv-db.

Then deploy from the `worker-cron` folder:

```bash
npx wrangler deploy
```

Alternatively, create a Worker in the Cloudflare dashboard, paste `worker-cron/src/index.ts`, bind the same D1 database as `DB`, and add the Cron Trigger `30 2 * * *`.

## Important test

After Pages deploys, test manually:

1. Open `https://naverv.pages.dev`
2. Enter a keyword and place name
3. Click the ranking button
4. Check that rankings are saved into D1

If Cloudflare is blocked by Naver, the API will return an error. In that case, use the local collector or a separate VPS collector as the execution server.
