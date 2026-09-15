# Railway Deployment Runbook

## Quick Reference

| Item | Value |
|------|-------|
| Backend URL | `https://<project>.up.railway.app` |
| Vercel frontend | `https://admin-sicia.vercel.app` |
| Supabase | `postgres.lfuhqoujzgenwwvuabez` |
| Health check | `GET /live` (liveness) + `GET /health` (readiness) |

## 1. Deploy

```bash
# Push to GitHub → Railway auto-deploys (main branch)
git push origin main

# Manual deploy via CLI
railway up --service backend
```

**Postinstall**: `npx prisma generate` runs automatically via `postinstall` script.

## 1b. Criação do repositório backend-only

O backend está no monorepo `sic-ia - Copy` mas será publicado como repo próprio.

```bash
# 1. Criar novo repo vazio no GitHub
# 2. Na pasta backend/, iniciar git:
git init
git add .
git status   # CONFERIR: .env e node_modules NÃO devem aparecer
git commit -m "chore: backend inicial para Railway"
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

**Checklist antes do push:**
- [ ] `.env` e `.env.local` aparecem em `git status`? (NÃO devem)
- [ ] `node_modules/` aparece? (NÃO deve)
- [ ] `api.js`, `nul`, `.vercel/` aparecem? (NÃO devem)
- [ ] `.env.example` aparece? (SIM, deve)

**Node version:** `.node-version` fixa `22.12.0`; o Railpack lê automaticamente.

**Healthcheck do Railway:** apontar para `/live` (liveness, sem DB). Não usar `/health` — ele depende do DB e do cold start do pooler.

**Startup:** o servidor aceita requests em t=0. `ensureColumns` roda ~26 DDLs sequenciais e leva ~30-40s no pooler frio; os cron jobs só registram após isso. Não é erro.

## 2. Environment Variables (Railway Dashboard)

Required:
- `DATABASE_URL` — Supabase pooler (pgbouncer=true)
- `DIRECT_URL` — Supabase direct (for migrations)
- `JWT_SECRET`
- `CORS_ORIGIN` — `https://admin-sicia.vercel.app`
- `CORS_BASE_DOMAIN` — `vercel.app`

Optional:
- `SENTRY_DSN` — enables error tracking
- `TRUSTED_HOSTS` — comma-separated additional allowed hostnames
- `LOG_FORMAT=json` — structured JSON logging for production

## 2b. Sentry (opcional)

Por padrão, Sentry está DESLIGADO. `@sentry/node` NÃO está em `package.json`; o `require('@sentry/node')` em `app.js` é engolido por `try/catch`. Para ativar:

```bash
cd backend
npm install @sentry/node
# Adicionar "@sentry/node" em dependencies do package.json
# Setar no Railway Dashboard: SENTRY_DSN=https://...@sentry.io/...
```

## 3. Webhook Migration (50-day window)

Evolution API webhooks remain on Vercel. Deadline: 50 days from deploy.

**To update webhook URL:**
1. Railway backend is live and stable
2. Go to Evolution API dashboard → Webhooks
3. Update URL from `https://admin-sicia.vercel.app/api/whatsapp/*` → `https://<railway>/api/whatsapp/*`
4. Verify with: `curl -X POST https://<railway>/api/whatsapp/evolution -H 'Content-Type: application/json' -d '{}'`
5. Should return 400 (bad payload) not 404

**Rollback**: revert webhook URL to Vercel.

## 4. Expand/Contract (Vercel → Railway)

**Expand** (current): Both Vercel backend and Railway run simultaneously.
- Vercel backend serves traffic
- Railway backend is idle (can test via direct URL)

**Contract** (after 50 days):
1. Verify Railway handles all traffic (smoke test, Playwright E2E)
2. Remove Vercel backend (`api/` directory from frontend repo)
3. Update `js/config.js` to point only to Railway
4. Monitor for 48 hours

## 5. Scaling

Railway defaults: 1 replica, 512MB RAM, 1 vCPU.

**To scale:**
- Dashboard → Settings → Resources → adjust RAM/CPU
- Or: `railway scale --memory 1GB --cpu 2`

**Warning**: Prisma connection pool is limited. If scaling to 2+ replicas, set `connection_limit` per replica.

## 6. Rollback

```bash
# Rollback to previous deployment
railway rollback

# Or redeploy specific commit
railway deploy --commit <sha>
```

**Database rollback**: NOT automated. Use Supabase point-in-time recovery if needed.

## 7. Monitoring

```bash
# Check logs
railway logs --service backend --tail

# Check status
railway status

# Smoke test
node scripts/smoke-test.mjs https://<railway>.up.railway.app
```

## 8. Troubleshooting

| Symptom | Check |
|---------|-------|
| 503 on /health | `railway logs` — Prisma connection error? |
| CORS error in browser | `CORS_ORIGIN` env var matches frontend domain |
| Jobs not running | Check `railway logs` for cron registration messages |
| Slow responses | Prisma pool exhaustion — check `connection_limit` |
| Webhook 404 | Evolution API still pointing to Vercel? |

## 9. Cleanup (post-50 days)

- [ ] Remove Vercel backend functions (`api/` dir)
- [ ] Remove `VERCEL` env var from Railway
- [ ] Update frontend `js/config.js` (remove Vercel backend fallback)
- [ ] Archive this runbook
