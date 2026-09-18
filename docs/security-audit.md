# Security Audit — SIC-IA

Data: 2026-09-16
Scope: Backend (Railway) + Frontend (Vercel) + Cart flow

---

## Finding 1: IDOR em `buscarPedido` público (CRÍTICO)

**Rota:** `GET /api/public/pedidos/:id`
**Auth:** NENHUMA (sem authenticatePublic)

**O que expõe:**
- clienteNome, clienteWhatsapp, clienteEndereco, clienteNumero
- clienteBairro, clienteCep, clienteReferencia
- itens do pedido, preços, forma pagamento, status

**IDs sequenciais:** `{empresaId}-{001, 002, 003...}` — enumerável em segundos

**Exemplo de exploração:**
```
GET /api/public/pedidos/7-001?slug=salgadoscosta → dados do cliente
GET /api/public/pedidos/7-002?slug=salgadoscosta → dados do cliente
... (brute force)
```

**Mitigação:** Adicionar `authenticatePublic` OU criar token de rastreamento por pedido.

---

## Finding 2: Tokens JWT no localStorage (ALTO)

**Onde:** `localStorage.authUser` contém token + refreshToken + dados user

**Risco:** Qualquer XSS rouba tokens completos

**Mitigação (Opção A — Curto prazo):**
- Adicionar CSP mais restritivo (remover `unsafe-inline`)
- Sanitizar todo innerHTML com dados de usuário

**Mitigação (Opção B — Longo prazo):**
- Migrar tokens para httpOnly cookies
- Backend seta cookie `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`

---

## Finding 3: `fetchCache.js` cacheia dados sensíveis em localStorage (MÉDIO)

**Onde:** `fetchCache.js` salva respostas de API no localStorage

**Risco:** Respostas de `/api/public/pedidos/*` ou `/api/public/clientes/*` ficam cached com PII

**Mitigação:**
- Não cachear endpoints de dados pessoais (clientes, pedidos)
- OU usar sessionStorage em vez de localStorage para dados sensíveis

---

## Finding 4: CSP com `unsafe-inline` (MÉDIO)

**Onde:** `app.js:75` — `scriptSrc: ["'self'", "'unsafe-inline'", ...]`

**Risco:** Permite XSS via inline scripts

**Mitigação:**
- Remover `'unsafe-inline'` de scriptSrc
- Usar nonces ou hashes para scripts inline

---

## Finding 5: `scriptSrcAttr: ["'unsafe-inline'"]` (MÉDIO)

**Onde:** `app.js:76`

**Risco:** Permite injeção em atributos de eventos (onclick, onerror, etc.)

**Mitigação:**
- Remover `scriptSrcAttr: ["'unsafe-inline'"]`
- Mover event handlers para addEventListener no JS

---

## Finding 6: `buscarPedido` público sem autenticação (BAIXO — pelo IDOR)

**Rota:** `GET /api/public/pedidos/:id`

**Risco:** Cross-order data leakage entre usuários

**Mitigação:** Adicionar `authenticatePublic` e filtrar por `clienteWhatsapp`

---

## Finding 7: Mensagens de erro verbose em dev (BAIXO)

**Onde:** `errorHandler.js:12` — retorna requestId em dev

**Risco:** Information disclosure em ambiente de teste

**Mitigação:** Já mitigado em production (`NODE_ENV !== 'production'`). OK.

---

## Finding 8: Proxy routes sem auth (INFO)

**Rota:** `GET/POST /api/proxy/:service`

**Status:** OK — allowlist de paths + rate limit + serviços hardcoded

**Risco:** Baixo — SSRF mitigado

---

## Finding 9: Webhooks sem auth (INFO)

**Rota:** `POST /webhooks/asaas`, `POST /api/webhooks/ifoood`, etc.

**Status:** OK — tokens de verificação em header

**Risco:** Baixo

---

## Resumo de Prioridades

| # | Finding | Severidade | Esforço | Prioridade |
|---|---------|-----------|---------|------------|
| 1 | IDOR buscarPedido | CRÍTICO | Baixo | P0 |
| 2 | JWT no localStorage | ALTO | Médio | P1 |
| 3 | fetchCache.js PII | MÉDIO | Baixo | P1 |
| 4 | CSP unsafe-inline | MÉDIO | Médio | P2 |
| 5 | scriptSrcAttr unsafe-inline | MÉDIO | Baixo | P2 |
| 6 | buscarPedido sem auth | BAIXO | Baixo | P2 |

---

## Plano de Correção

### Fix 1: Adicionar `authenticatePublic` ao `buscarPedido` (P0)

**Arquivo:** `backend/src/controllers/publicController.js:462-468`

**Mudança:** Envolver `buscarPedido` com `authenticatePublic` + filtrar por `clienteWhatsapp`

**Antes:**
```js
exports.buscarPedido = asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const pedido = await sql.buscarPedido(req.params.id, empId);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  res.json(pedido);
});
```

**Depois:**
```js
exports.buscarPedido = [authenticatePublic, asyncHandler(async (req, res) => {
  const empId = requireTenant(req, res);
  if (!empId) return;
  const pedido = await sql.buscarPedido(req.params.id, empId);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  // Ensure customer can only see their own order
  if (pedido.clienteWhatsapp !== req.cliente.telefone) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }
  res.json(pedido);
})];
```

### Fix 2: Adicionar `authenticatePublic` ao `validarCupom` (P0)

**Arquivo:** `backend/src/controllers/publicController.js:470-477`

**Mudança:** Envolver com `authenticatePublic`

### Fix 3: CSP restritivo (P1)

**Arquivo:** `backend/src/app.js:72-80`

**Mudança:** Remover `'unsafe-inline'` de `scriptSrc` e `scriptSrcAttr`

### Fix 4: fetchCache.js — não cachear dados sensíveis (P1)

**Arquivo:** `js/fetchCache.js`

**Mudança:** Adicionar check: se URL contém `/clientes/` ou `/pedidos`, não cachear

---

## NOTA

O Finding 1 (IDOR) é **crítico** — qualquer pessoa pode enumerar pedidos e obter dados de clientes (nome, telefone, endereço). Recomendação: corrigir ANTES de deploy em produção.
