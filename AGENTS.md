# SIC-IA Project Summary

## Goal
- Migrar para single-tenant + Supabase concluído (F1-F5). Redesign visual do index.html conforme `docs/designer.md` concluído (F6-F10). Status bar com textos fixos. Banco rodando no Neon temporariamente.

## Constraints & Preferences
- **Não alterar**: APIs, regras de negócio, fluxos, navegação, lógica de carrinho, IDs do DOM usados por outras páginas
- Paleta verde: `#1FA58D`, `#188A75`, `#E8F5F2`
- Radius: cards 8px, imagens 6px, botões 8px — sem pill
- Status bar: texto fixo "Faça agora seu pedido" (aberto/verde) / "Estamos Fechados !! Faça seus agendamento pelo nosso Whatsapp" (fechado/vermelho)
- Novo Supabase project ref: `nxvkocdfpezvmzajtbxu`

## Progress
### Done
- **F1 a F10**: todas as 10 fases de redesign concluídas (design tokens, header, search, categorias, cards +/-, estados loading/empty/error, bottom/order bar, footer/mapa, responsivo + animações, cart.css)
- **Status bar texto fixo**: `atualizarStatusBar()` em menu.js usa `textContent` fixo ignorando `data.message` da API
- **Bug fix menu.js:73**: `});` → `}));` (fechamento de `addEventListener` + `debounce`)
- **Bug fix navbar.js:11**: guard `if (btnMobile)` no `addEventListener`
- **express.static**: adicionado `app.use(express.static(...))` em `backend/src/app.js` para servir frontend via `localhost:3000`
- **Git push**: commit `7971470` enviado para `https://github.com/jesusneves/salgadoscosta.git`
- **.env atualizado**: todas as chaves Supabase substituídas → novo project ref `nxvkocdfpezvmzajtbxu`
- **Deploy DB concluído**: `deploy_db.js` rodou com sucesso no Neon — 5 migrations + seed (empresa + usuario djesus/tsa110594)
- **Prisma generate**: OK com client v6.5.0
- **Login testado**: authService retorna token para djesus/tsa110594 (role: superadmin)
- **CA chain Supabase extraída**: pooler_cert_0.pem a pooler_cert_10.pem; root CA = "Supabase Root 2021 CA"

### Blocked
- **Pooler Supabase não reconhece tenant**: `(ENOTFOUND) tenant/user postgres.nxvkocdfpezvmzajtbxu not found` — banco existe (porta 5432 conecta) mas pooler transaction mode (porta 6543) não tem entrada para este projeto. Precisa de ativação manual no dashboard Supabase ou contato com suporte.
- **CA chain programática quebra TLS**: fornecer `ca` ao pg module (ou `NODE_EXTRA_CA_CERTS`/`NODE_TLS_REJECT_UNAUTHORIZED=0`) altera TLS handshake e faz pooler retornar "tenant not found" em vez de prosseguir com autenticação.

## Key Decisions
- Status bar usa texto estático no frontend (não mais `data.message` da API)
- Deploy DB via `pg` module (deploy_db.js) — contorna P1001 do Prisma engine com pooler
- **Neon ativo como banco principal temporariamente** (`.env` linhas 14-15) enquanto pooler Supabase não provisiona
- Supabase URLs comentadas (`.env` linhas 17-18) — reativar quando pooler funcionar
- Chaves Supabase (service_role, anon, publishable) mantidas — storage e auth continuam no Supabase mesmo com banco no Neon

## Next Steps
1. **Reativar Supabase**: descomentar DATABASE_URL/DIRECT_URL no `.env` quando pooler reconhecer projeto
2. Rodar `node deploy_db.js` novamente após reativar Supabase
3. Se pooler continuar não reconhecendo, contactar suporte Supabase

## Critical Context
- **Banco ativo**: Neon (`postgresql://neondb_owner:npg_Odx3kwGqc8eW@ep-floral-breeze-ac92m14j.sa-east-1.aws.neon.tech/neondb?sslmode=require`)
- **Supabase project**: `nxvkocdfpezvmzajtbxu` — URL `https://nxvkocdfpezvmzajtbxu.supabase.co`
- Database password: `26Rod&ciaTai` (URL-encoded `26Rod%26ciaTai`)
- Pooler host: `aws-0-us-east-1.pooler.supabase.com:6543` (transaction mode) / `:5432` (direct)
- Neon server: `ep-floral-breeze-ac92m14j.sa-east-1.aws.neon.tech`
- `.env`: Neon URLs ativas (linhas 14-15), Supabase comentadas (linhas 17-18)
- `deploy_db.js` no backend/ — executa migrations + seed via `pg`

## Relevant Files
- `backend/.env`: Neon DATABASE_URL ativo, Supabase comentado
- `backend/deploy_db.js`: script de deploy que roda migrations + seed via `pg`
- `backend/src/app.js`: adicionado `express.static()` + `path` require
- `backend/prisma/schema.prisma`: `directUrl` comentado temporariamente
- `js/menu.js`: `atualizarStatusBar()` com textos fixos; `});` → `}));`
- `js/navbar.js`: guard `if (btnMobile)`
- `css/style.css`: seção responsive com breakpoints 320-412px + animações fadeInUp
- `css/cart.css`: font inherit, paleta verde, radius 8px
