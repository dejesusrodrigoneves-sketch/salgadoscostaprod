# Debug Cadastro — Testes com 3 Clientes Fictícios

## Clientes Criados

| # | Nome | Telefone | ID | Senha | Endereço |
|---|------|----------|----|-------|----------|
| 1 | João Silva | +5521999990001 | 4 | senha123 | Rua das Flores, 100, Centro |
| 2 | Maria Santos | +5521999990002 | 5 | senha456 | Av. Principal, 200, São Vicente |
| 3 | Carlos Pereira | +5521999990003 | 6 | senha789 | Rua do Comércio, 50, Heliópolis |

## Testes Realizados

### 1. Registro — ✅ Funciona
```
POST /api/public/clientes/register
→ 201 { token, cliente }
```
Todos os 3 registros retornaram sucesso com token e dados do cliente.

### 2. Login — ✅ Funciona
```
POST /api/public/clientes/login
→ 200 { token, cliente }
```
Login com telefone+senha funciona para todos os 3.

### 3. Perfil — ✅ Funciona (com ressalva)
```
GET /api/public/clientes/me  (Bearer token)
→ 200 { id, nome, telefone, endereco, ... }
```
Cada cliente vê apenas seus próprios dados.

### 4. Criar Pedido — ✅ Funciona (com ressalva)
```
POST /api/public/pedidos  (sem autenticação necessária)
→ 201 { id, status }
```
Pedidos criados: 004 (João), 005 (Maria), 006 (Carlos).

### 5. Listar Pedidos — ⚠️ Isolamento falho
```
GET /api/public/pedidos  (Bearer token)
```
Cada cliente vê apenas pedidos com seu `clienteWhatsapp` — **mas o token não é assinado**.

---

## 🔴 CONFLITOS ENCONTRADOS

### CONFLITO 1 — Token sem assinatura permite impersonação total

**Severidade:** 🔴 CRÍTICA

**Arquivo:** `backend/src/controllers/publicController.js:8-10`

**Problema:** O token de cliente é apenas Base64URL do JSON, sem assinatura HMAC, sem expiração.

```js
function generateToken(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}
```

**Payload decodificado:**
```json
{ "id": 4, "empresaId": 1, "telefone": "+5521999990001", "nome": "João Silva" }
```

**Teste de prova:** Um token forjado com `telefone` da Maria e `id` do João conseguiu acessar os pedidos da Maria.

```bash
# Token forjado: id=5, empresaId=1, telefone=+5521999990002, nome=João Silva
curl -s /api/public/pedidos -H "Authorization: Bearer <TOKEN_FORJADO>"
# → Retornou pedido 005 (da Maria)
```

**Impacto:**
- Qualquer cliente pode ver pedidos de qualquer outro cliente (sabendo o telefone)
- Qualquer cliente pode modificar perfil de outro (alterando o `id` no token)
- Não há expiração — um token vazado é válido para sempre

---

### CONFLITO 2 — Criação de pedido sem autenticação permite fraude

**Severidade:** 🔴 CRÍTICA

**Arquivo:** `backend/src/controllers/publicController.js:115-160` + `backend/src/routes/publicRoutes.js:15`

**Problema:** `POST /api/public/pedidos` não exige autenticação. Qualquer pessoa pode criar pedidos em nome de qualquer cliente.

**Teste de prova:**
```bash
# Pedido criado SEM token, em nome do João (whatsapp +5521999990001)
curl -s -X POST /api/public/pedidos \
  -d '{"slug":"salgadoscosta","clienteNome":"Hacker","clienteWhatsapp":"+5521999990001",...}'
# → Pedido 007 criado e associado ao João!
```

**Resultado no banco:**
```
ID: 007 | Cliente: Hacker | WhatsApp: +5521999990001 | Total: 1039.5
```

**Impacto:**
- Pedidos falsos aparecem na listagem do cliente (poluição visual, confusão)
- Possibilidade de ataques de negação de serviço (criar milhares de pedidos)
- Cliente pode ter que pagar por pedidos que não fez (se houver integração com pagamento)

---

### CONFLITO 3 — Isolamento por telefone é frágil

**Severidade:** 🟡 MÉDIA

**Arquivo:** `backend/src/controllers/publicController.js:106-113`

**Problema:** A listagem de pedidos filtra por `clienteWhatsapp`, que é apenas um campo texto. Não há vínculo com o `id` do cliente.

```js
where: { empresaId: req.cliente.empresaId, clienteWhatsapp: req.cliente.telefone }
```

**Cenário de conflito:** Se dois clientes diferentes tiverem o mesmo telefone (o schema previne via `@@unique([empresaId, telefone])`), mas o campo `clienteWhatsapp` no pedido é livre. Um pedido criado manualmente com telefone X aparece para o cliente que tem telefone X.

---

### CONFLITO 4 — Encoding de caracteres UTF-8 corrompido

**Severidade:** 🟡 MÉDIA

**Problema:** O nome "João" foi armazenado como "Jo�o" no banco de dados. Caracteres acentuados estão sendo corrompidos.

**Entrada enviada:**
```json
"nome": "João Silva"
```

**Armazenado no banco:**
```
Jo�o Silva
```

**Causa provável:** A string JSON contém o caractere Unicode `ã` (U+00E3), mas durante o processo de encoding/decoding há perda. O token decodificado mostra:
```
{ nome: 'Jo�o Silva' }
```
onde `\uFFFD` substituiu o `ã`. Isso pode ser um problema de encoding na comunicação com o banco PostgreSQL (Neon) ou no parsing do body.

---

### CONFLITO 5 — Sem validação de quantidade máxima de itens

**Severidade:** ⚪ LEVE

**Problema:** O pedido 007 foi criado com `quantidade: 99` sem nenhuma validação.

```json
"itens": [{"produtoId": 1, "quantidade": 99}]
```

**Resultado:** `valoresItens: 1039.5` (10.5 × 99)

**Impacto:** Possibilidade de valores inflados no banco, poluindo relatórios financeiros.

---

### CONFLITO 6 — Evolution API: nenhuma instância criada para clientes

**Severidade:** Informativo

**Arquivo:** `backend/src/controllers/publicController.js:59-76` (registrarCliente)

**Problema:** O registro de cliente não cria instância na Evolution API. Isso foi verificado:

- 6 clientes registrados no banco
- 0 instâncias Evolution criadas por esses registros
- 1 instância WhatsApp no banco (pré-existente ou criada por admin)

**Quanto à pergunta original:** "a cada cliente criado é criada uma instância na Evolution API?" → **Não.** Clientes são apenas registros no banco. Instâncias Evolution só são criadas manualmente por admins via `POST /api/whatsapp/criar`.

---

## Resumo do Isolamento entre Clientes

| Operação | Isolamento | Funciona? | Nota |
|----------|-----------|-----------|------|
| Login | Telefone + senha | ✅ | Cada um com suas credenciais |
| Ver perfil | `id` do token | ✅ | Vinculado ao ID no banco |
| Atualizar perfil | `id` do token | ✅ | Só altera o próprio registro |
| Criar pedido | Nenhum | ❌ | Sem autenticação — qualquer um cria em nome de qualquer um |
| Listar pedidos | `clienteWhatsapp` | ⚠️ | Filtro por telefone, mas token é forjável |
| Token seguro | Nenhum | ❌ | Base64URL sem assinatura — qualquer um modifica |

---

## Dados no Banco (pós-testes)

```
=== CLIENTES ===
ID: 1 | Nome: Teste | Telefone: +5521999993437
ID: 2 | Nome: Teste | Telefone: +5521999993713
ID: 3 | Nome: Teste | Telefone: +5521999995024
ID: 4 | Nome: João Atualizado | Telefone: +5521999990001
ID: 5 | Nome: Maria Santos | Telefone: +5521999990002
ID: 6 | Nome: Carlos Pereira | Telefone: +5521999990003

=== PEDIDOS ===
ID: 001 | Cliente: Teste | WhatsApp: +5521999993437 | Total: 21    | Status: pendente
ID: 002 | Cliente: Teste | WhatsApp: +5521999993713 | Total: 21    | Status: emRota
ID: 003 | Cliente: Teste | WhatsApp: +5521999995024 | Total: 21    | Status: finalizado
ID: 004 | Cliente: João Silva | WhatsApp: +5521999990001 | Total: 31.5  | Status: pendente
ID: 005 | Cliente: Maria Santos | WhatsApp: +5521999990002 | Total: 52.5  | Status: pendente
ID: 006 | Cliente: Carlos Pereira | WhatsApp: +5521999990003 | Total: 21    | Status: pendente
ID: 007 | Cliente: Hacker | WhatsApp: +5521999990001 | Total: 1039.5 | Status: pendente
ID: 008 | Cliente: Teste ID | WhatsApp: +5521999990099 | Total: 10.5  | Status: pendente

=== COUNTERS ===
pedidoId | EmpresaId: 1 | LastValue: 8

=== WHATSAPP INSTANCES ===
Total: 1 (criada por admin, não por cliente)
```
