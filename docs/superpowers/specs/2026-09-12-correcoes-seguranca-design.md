# Design — Correções de Segurança (SIC-IA)

- **Data:** 2026-09-12
- **Projeto:** salgadoscosta-backend (SIC-IA)
- **Escopo analisado:** `backend/src/**`, `js/**`, `*.html`
- **Status:** aprovado (design) — nenhuma correção aplicada ainda
- **Skill:** security-audit (auditoria) + brainstorming (design)

---

## 1. Contexto

Auditoria de segurança estática executada sobre o projeto. Foram levantados 9 achados
reais após verificação anti-falso-positivo. O objetivo é corrigir todos, em fases,
com aprovação prévia — **sem alterar código antes do plano ser aprovado**.

### 1.1 Falsos positivos descartados (correção da auditoria inicial)

| Alegação inicial | Realidade |
| --- | --- |
| IDOR em clientes (admin A edita cliente B) | `adminRoutes.js:23` protege `/clientes/*` com `authorize('superadmin')`. Superadmin é global por design. |
| IDOR em CRUD de empresa | Mesmo gate de superadmin. |
| SQLi em `$queryRaw` | `superadminDashboardService.js` usa tagged templates Prisma parametrizados. |
| IDOR em produto/entregador/categoria/pedido | Controllers passam `empresaId(req)` ao service; repositórios filtram `where.empresaId`. Verificado seguro. |

Confirmações de contexto:
- `.env` **não** é rastreado pelo Git (`git ls-files` = 0 arquivos sensíveis).
- `.gitignore` cobre `.env*`, `*.pem`, `*.key`, `firebase-service-account.json`.
- Padrão multi-tenant (`empresaId(req)`) aplicado de forma consistente.

---

## 2. Decisões (travadas com o responsável)

| # | Decisão | Escolha |
| --- | --- | --- |
| P1 | Escopo de execução agora | **D — apenas o plano**, nada aplicado |
| P2 | Topologia de produção | **Vercel serverless hoje → VPS (Railway/Hostinger) depois** |
| P3 | Estratégia de deps | **A — `npm audit fix` (sem `--force`)** |
| P4 | Store de tokens | **A — tabelas Prisma no Postgres existente** |
| P5 | Rotação JWT | **A — rotacionar agora, aceitar re-login geral** |
| P6 | CSP | **A — endurecimento parcial** |
| P7 | Senha via WhatsApp | **A — manter envio; risco aceito documentado** |
| P8 | Verificação | **C — testes automatizados só para F2/F3; resto manual** |
| P9 | Rollout | **Abordagem 1 — fases por área, PR/deploy independentes** |

---

## 3. Achados e correções

| # | Severidade | Confiança | Local | Correção |
| --- | --- | --- | --- | --- |
| F1 | HIGH | HIGH | `backend/package.json` + lockfile | `npm audit fix` |
| F2 | MEDIUM | HIGH | `backend/src/app.js` | `app.set('trust proxy', 1)` |
| F3 | MEDIUM | HIGH | `backend/src/services/tokenService.js` | Persistir refresh/revogação no Postgres |
| F4 | LOW | HIGH | `backend/src/app.js:82-92` | Fallback dev explícito (sem `*`) |
| F5 | LOW | MEDIUM | `backend/src/app.js:55-73` | Endurecimento parcial de CSP |
| F6 | LOW | MEDIUM | `backend/.env` | Rotacionar secret aleatório |
| F7 | INFO | HIGH | `backend/src/controllers/adminController.js:69` | URL Asaas por env |
| F8 | INFO | MEDIUM | `backend/src/controllers/driverController.js:226-237` | Manter; risco aceito |
| F9 | LOW | LOW | `backend/src/middleware/auth.js:16-30` | Evicção LRU em vez de `clear()` |

### F1 — Dependências vulneráveis
`axios@1.17.0` (10 advisories), `multer@2.2.0` (4 DoS), `form-data@4.0.5` (CRLF),
`body-parser@2.2.2`, `qs@6.15.3`, `uuid@<11.1.1` (via firebase-admin).
Correção: `npm audit fix` no `backend/`, revalidar com `npm audit --omit=dev`,
rodar vitest. Se `uuid`/firebase-admin ficar residual, registrar.

### F2 — `trust proxy`
Sem `app.set('trust proxy', ...)`, atrás do proxy do Vercel `req.ip` vira o IP do proxy
→ rate limit global (não por cliente). Correção: `app.set('trust proxy', 1)` antes dos
limiters. Nota para a futura VPS: ajustar para `0`/`false` se acesso for direto.

### F3 — Token store persistente
`refreshTokens`/`revokedTokens` são `Set` em memória → quebrados em serverless e voláteis
em restart. Correção: tabelas `RefreshToken` e `RevokedToken`; ver §4.

### F4 — CORS dev
Fallback não-produção usa `*`. Correção: lista explícita de localhost
(`5173`, `5174`, `3000`). Produção continua exigindo `CORS_ORIGIN`.

### F5 — CSP parcial
Adicionar diretivas seguras que não quebram o app: `object-src 'none'`,
`base-uri 'self'`, `frame-ancestors 'none'`. Auditar usos de `onclick=` inline; se
inviável remover `scriptSrcAttr 'unsafe-inline'` sem refactor grande, manter e registrar
como risco aceito.

### F6 — Rotação do JWT secret
Gerar `crypto.randomBytes(32).toString('hex')`; atualizar `backend/.env` **e** env do
Vercel; deploy → **logout geral**. Nunca commitar. Executar por último.

### F7 — URL Asaas hardcoded
`adminController.js:69` grava em `https://api-sandbox.asaas.com` mesmo com
`ASAAS_ENV=production`. Correção: derivar base URL de `config.asaasEnv` via helper único.

### F8 — Senha por WhatsApp (aceito)
Reset de entregador envia senha em texto puro. Decisão: manter; documentar risco aceito.

### F9 — Cache de verificação
`tokenDecodeCache.clear()` zera tudo (thundering herd). Correção: evicção dos mais antigos.

---

## 4. Modelo de dados (F3)

```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  jti       String    @unique
  usuarioId Int
  tokenHash String              // armazenar hash, nunca token cru
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([usuarioId])
  @@index([expiresAt])
}

model RevokedToken {
  jti       String   @id
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([expiresAt])
}
```

Aplicação: `prisma db push` (ou migration nomeada) no ambiente alvo.

---

## 5. Fluxo de token (pós-F3)

```
login   → gerarToken (30m) + gerarRefreshToken
           └─ INSERT RefreshToken {jti, tokenHash, expiresAt}

refresh → verificarRefreshToken(refreshToken)
           └─ SELECT por jti → valida exp/revokedAt → marca revokedAt (rotate)
           └─ gera novo par access+refresh

logout  → revogarToken(access)  → INSERT RevokedToken {jti, expiresAt}
        → revogarRefreshToken   → UPDATE RefreshToken.revokedAt

verify  → verificarToken(access) → checa RevokedToken (cache TTL ≤ 60s)
```

Trade-off documentado: cache em memória de até 60s pode atrasar revogação em até 60s.

Limpeza de expirados: cron `node-cron` (já presente) removendo linhas vencidas.

---

## 6. Fases de implementação (rollout)

| Fase | Conteúdo | Depende de | Risco |
| --- | --- | --- | --- |
| 1 | F1 — deps (`npm audit fix`) | — | Baixo |
| 2 | F2, F4, F7 — config de infra | — | Baixo |
| 3 | F3 — token store + migration | Postgres | Médio |
| 4 | F5, F6 — CSP parcial + rotação JWT | — | Baixo / Médio (operacional) |
| 5 | F8, F9 — docs + cache LRU | — | Baixo |

Ordem de deploy: 1 → 2 → 3 → 4 (F5) → 5 → 4 (F6) — **F6 por último** (derruba sessões).
Cada fase = PR isolado, revertível. F3 exige rollback de migration. F6 exige reverter env var.

---

## 7. Verificação

- **F2/F3 (automatizado):**
  - vitest: `trust proxy` aplicado; persistência/rotação/revogação de token.
  - Playwright e2e: login → refresh → logout → token revogado é rejeitado.
- **Demais (manual + suíte existente):** rodar vitest/Playwright completos e checklist:
  - [ ] `npm audit --omit=dev` sem HIGH/CRITICAL (residuais documentados)
  - [ ] Rate limit por IP funciona atrás do proxy
  - [ ] Login/refresh/logout OK; token revogado rejeitado
  - [ ] Produto/pedido/entregador continuam escopados por empresa
  - [ ] Upload de arquivo OK após F1
  - [ ] CSP não quebra telas principais
  - [ ] Criação de empresa usa URL Asaas correta por ambiente
  - [ ] Após F6: todos os tokens antigos rejeitados

---

## 8. Riscos residuais / aceitos

- F5: `unsafe-inline` em `scriptSrc`/`scriptSrcAttr` mantido se refactor for grande.
- F8: senha provisória trafega por WhatsApp em texto puro.
- F3: janela de revogação de até 60s pelo cache de verificação.
- F1: advisories transitivos sem fix (ex.: `uuid` via `firebase-admin`) podem permanecer.

---

## 9. Fora de escopo

- Refactor completo de CSP para nonces / remoção de handlers inline.
- Migração para Redis.
- Mudanças de regra de negócio além de F7/F8.

---

## 10. Referências

- Relatório de auditoria (security-audit) desta sessão.
- OWASP API1:2023 — Broken Object Level Authorization (aplicado na verificação).
- `backend/src/services/tokenService.js`, `backend/src/middleware/auth.js`,
  `backend/src/app.js`, `backend/src/controllers/adminController.js`,
  `backend/src/controllers/driverController.js`.
