# Integrações Financeiras (Marketplaces)

## Como adicionar um novo marketplace

1. Criar `backend/src/integrations/<slug>/oauth.js` (wiring do env para o `core/oauthClient.js`).
2. Criar `backend/src/integrations/<slug>/<Nome>FinancialProvider.js` implementando o contrato (ver `core/interfaces.js`).
3. Registrar no `backend/src/integrations/index.js` (`registerAllProviders`).
4. Adicionar env vars em `backend/src/config/env.js` + `.env.example`.
5. Adicionar rotas webhook se aplicável em `marketplaceWebhookRoutes.js`.
6. Criar testes (normalizer, oauth, sync).

## Env necessárias (por marketplace)

- `<PLATAFORMA>_CLIENT_ID` / `<PLATAFORMA>_CLIENT_SECRET`
- `<PLATAFORMA>_AUTHORIZE_URL` / `<PLATAFORMA>_TOKEN_URL` / `<PLATAFORMA>_REVOKE_URL`
- `<PLATAFORMA>_SCOPE`
- `OAUTH_REDIRECT_BASE` (base pública, ex: https://salgadoscosta.vercel.app)
- `MARKETPLACE_ENV` (`sandbox` | `production`)

Sem credenciais, o provider fica dormente (`isConfigured() === false`), rotas respondem 503 e o sistema atual não é afetado.
