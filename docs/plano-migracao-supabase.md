# Plano de Migração — Single-Tenant + Supabase

> **Data:** 2026-07-09 | **Projeto:** SIC D'Jesus | **Status:** Planejado

---

## Sumário Executivo

Migrar o sistema atual (PostgreSQL Neon multi-tenant + auth caseiro + upload local) para um **monolito single-tenant no Supabase** com banco PostgreSQL, Storage para imagens e RLS para segurança. O auth caseiro é mantido inicialmente.

| Item | Atual | Futuro |
|---|---|---|
| Banco | PostgreSQL Neon (serverless) | PostgreSQL Supabase (pooler) |
| Tenancy | Multi-tenant via `empresaId` | Single-tenant (`empresaId=1` fixo) |
| Upload | Multer → disco local (efêmero no Vercel) | Supabase Storage (S3 + CDN) |
| Segurança | Filtro manual `empresaId` no código | RLS + filtro manual (defesa em profundidade) |
| Auth | base64url (admin) + JWT (cliente) | Mantido (Supabase Auth opcional como Fase 7) |

### Esforço Total

| Fase | Descrição | Esforço |
|---|---|---|
| **F1** | Migrar banco Neon → Supabase | 2h |
| **F2** | Implementar RLS | 6h |
| **F3** | Migrar upload para Supabase Storage | 4h |
| **F4** | Hardcodar `empresaId=1` no backend | 4h |
| **F5** | Remover multi-tenant do frontend | 3h |
| **F6** | Testes e deploy | 4h |
| **F7** (opcional) | Migrar auth para Supabase Auth | 3d |
| | **Total obrigatório** | **~23h (3 dias)** |

---

## Fase 1 — Migrar Banco Neon → Supabase

### 1.1 Criar Projeto no Supabase

1. Acessar [supabase.com](https://supabase.com) e criar projeto
2. Região: `sa-east-1` (mesma do Neon atual)
3. Anotar:
   - Project ref (ex: `abcdefghijklm`)
   - Database password
   - Supabase URL: `https://[ref].supabase.co`
   - Anon key
   - Service role key

### 1.2 Obter Connection Strings

| Tipo | Porta | Finalidade |
|---|---|---|
| Session mode (pooler) | `5432` | Prisma Studio, `prisma db push`, migrations |
| Transaction mode (pooler) | `6543` | **Produção** — Vercel serverless + Prisma |
| Direct | `5432` | Backup via `pg_dump`/`psql` |

Formato:
```
DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

### 1.3 Exportar Dados do Neon

```bash
pg_dump "postgresql://neondb_owner:npg_xxx@ep-floral-breeze-ac92m14j.sa-east-1.aws.neon.tech/neondb?sslmode=require" \
  --no-owner --no-privileges --clean --if-exists \
  --format=plain \
  > neon_dump.sql
```

### 1.4 Importar no Supabase

```bash
psql "postgresql://postgres.[REF]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" \
  -f neon_dump.sql
```

### 1.5 Atualizar Schema Prisma

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Verificar com `prisma db pull` e rodar `prisma generate`.

### 1.6 Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `backend/.env` | Trocar `DATABASE_URL` por Supabase, adicionar `DIRECT_URL` |
| `backend/prisma/schema.prisma` | Adicionar `directUrl` no datasource |
| Vercel env vars | Atualizar `DATABASE_URL`, adicionar `DIRECT_URL` |
| `.env.example` | Atualizar templates |
| `backend/src/config/env.js` | Exportar `directUrl` se necessário |

---

## Fase 2 — Implementar RLS (Row Level Security)

Embora o sistema se torne single-tenant, RLS garante que nenhum dado vaze entre tenants (defesa em profundidade).

### 2.1 Ativar RLS em Todas as Tabelas

```sql
-- Todas as 12 tabelas filhas
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
```

### 2.2 Criar Políticas de Isolamento por Tenant

```sql
-- Template para cada tabela
CREATE POLICY tenant_isolation ON produtos
  FOR ALL
  USING (empresa_id = current_setting('app.current_empresa_id')::int)
  WITH CHECK (empresa_id = current_setting('app.current_empresa_id')::int);
```

Repetir para cada tabela com `empresa_id`.

### 2.3 Configurar `current_setting` no Middleware

Em `backend/src/middleware/auth.js`, após decodificar o token:

```js
// Se single-tenant, empresaId é sempre 1
const empresaId = 1; // ou decoded.empresaId
await prisma.$executeRaw`SELECT set_config('app.current_empresa_id', ${empresaId}::text, true)`;
```

### 2.4 Política para Rotas Públicas (sem auth)

```sql
CREATE POLICY public_read ON produtos
  FOR SELECT USING (true);
-- Repetir para categorias, loja settings, horários...
```

### 2.5 Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `backend/src/middleware/auth.js` | Injetar `set_config` após autenticar |
| `backend/prisma/schema.prisma` | Nenhuma (RLS não altera schema) |
| SQL scripts | Script de migração com políticas |

---

## Fase 3 — Migrar Upload para Supabase Storage

### 3.1 Criar Bucket

No Supabase Dashboard → Storage → Create bucket:
- Nome: `produtos`
- Público: **Sim** (imagens são acessadas anonimamente)
- Limite de upload: 5MB (manter o mesmo do multer)

### 3.2 Instalar SDK

```bash
cd backend
npm install @supabase/supabase-js
```

### 3.3 Refatorar `uploadRoutes.js`

```js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const ext = req.file.originalname.split('.').pop();
    const path = `produtos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from('produtos')
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('produtos')
      .getPublicUrl(path);

    res.json({
      filename: path,
      url: urlData.publicUrl
    });
  } catch (err) {
    next(err);
  }
});
```

### 3.4 Remover `express.static` de `/img`

Em `backend/src/app.js`, remover:
```js
app.use('/img', express.static(path.join(__dirname, '..', '..', 'img')));
```

As imagens agora são servidas diretamente pelo Supabase CDN.

### 3.5 Migrar Imagens Existentes

Criar script `backend/scripts/migrateImages.js`:

```js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const prisma = new PrismaClient();

async function migrate() {
  const produtos = await prisma.produto.findMany();
  for (const p of produtos) {
    if (!p.img || p.img.startsWith('http')) continue;
    const filePath = path.join(__dirname, '..', '..', 'img', p.img);
    if (!fs.existsSync(filePath)) continue;
    
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(p.img);
    const newPath = `produtos/${Date.now()}_${p.id}${ext}`;
    
    const { error } = await supabase.storage.from('produtos').upload(newPath, buffer, {
      contentType: `image/${ext.replace('.', '')}`,
      upsert: true
    });
    
    if (!error) {
      const { data: urlData } = supabase.storage.from('produtos').getPublicUrl(newPath);
      await prisma.produto.update({ where: { id: p.id }, data: { img: urlData.publicUrl } });
    }
  }
}
migrate();
```

### 3.6 Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `backend/src/routes/uploadRoutes.js` | Reescrever multer → Supabase Storage |
| `backend/src/app.js` | Remover `express.static('/img')` |
| `backend/src/config/env.js` | Adicionar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` |
| `backend/.env` | Adicionar variáveis Supabase |
| Vercel env vars | Adicionar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `backend/scripts/migrateImages.js` | Novo script de migração |
| `backend/package.json` | Adicionar `@supabase/supabase-js` |

---

## Fase 4 — Hardcodar `empresaId=1` no Backend

Estratégia: substituir todas as referências dinâmicas a `empresaId` por `1` fixo. Não alterar o schema (tabelas continuam com coluna `empresa_id`).

### 4.1 Repositório SQL

**`backend/src/repositories/sqlRepository.js`**

20 funções de leitura: remover parâmetro `empresaId`, usar `empresaId: 1` no `where`.

**Antes:**
```js
async listarProdutos(empresaId) {
  return prisma.produto.findMany({ where: { empresaId }, include: { categoria: true } });
}
```

**Depois:**
```js
async listarProdutos() {
  return prisma.produto.findMany({ where: { empresaId: 1 }, include: { categoria: true } });
}
```

Aplicar mesmo padrão em: `buscarProduto`, `listarPedidos`, `listarEntregadores`, `buscarUsuario`, `listarUsuarios`, `buscarCaixaHoje`, `relatoriosCaixa`, `buscarHorarios`, `upsertHorarios`, `nextPedidoId`, `listarCategorias`, `buscarCategoria`, `listarWhatsAppInstances`, `buscarInstanciaAtiva`, `buscarWhatsAppInstance`, `listarClientes`, `buscarCliente`, `buscarCupom`, `listarCupons`.

### 4.2 Services

| Arquivo | Funções | Mudança |
|---|---|---|
| `orderService.js` | `listar`, `deletarPedido`, `finalizarPedido`, `listarFiltrado` | Remover `empresaId` param |
| `productService.js` | `listar`, `buscar`, `atualizar`, `deletar` | Remover `empresaId` param |
| `lojaService.js` | `getSettings`, `updateSettings` | `empresaId: 1` |
| `whatsappInstanceService.js` | 6 funções | Remover `empresaId` param |
| `whatsappService.js` | `enviarMensagem`, `notificarStatus` | Remover `empresaId` param |
| `entregaService.js` | 4 funções | Remover `empresaId` param |
| `categoriaService.js` | 4 funções | Remover `empresaId` param |

### 4.3 Controllers

| Arquivo | Ocorrências | Mudança |
|---|---|---|
| `orderController.js` | 5 | `req.user.empresaId` → `1` |
| `productController.js` | 5 | `req.user.empresaId` → `1` |
| `cashierController.js` | 4 | `req.user.empresaId` → `1` |
| `entregaController.js` | 4 | `req.user.empresaId` → `1` |
| `driverController.js` | 5 | `req.user.empresaId` → `1` |
| `categoriaController.js` | 5 | `req.user.empresaId` → `1` |
| `whatsappController.js` | 7 | `req.user.empresaId` → `1` |
| `lojaController.js` | 2 | `req.user.empresaId` → `1` |

### 4.4 Auth

**`authController.js`:**
- Remover `empresaId` do `req.body`
- `authService.login(username, password, empresaId || 1)` → `authService.login(username, password)`

**`authService.js`:**
- `login`: remover `empresaId` param, usar `sql.buscarUsuario(username, 1)`
- `criarConta`: remover criação de empresa, sempre usar `empresaId: 1`

**`publicController.js`:**
- `resolveEmpresa(slug)`: simplificar para sempre retornar `{ id: 1 }`
- Remover slug de todas as chamadas públicas

### 4.5 Rotas

| Arquivo | Mudança |
|---|---|
| `scheduleRoutes.js` | `req.user.empresaId` → `1` |
| `userRoutes.js` | `empresaId || 1` → `1` |
| `adminRoutes.js` | Simplificar: remover criação de empresa, retornar empresa 1 |

### 4.6 Total de Linhas

**~165 linhas alteradas em 22 arquivos.** Mudanças mecânicas e repetitivas, baixo risco.

---

## Fase 5 — Remover Multi-tenant do Frontend

### 5.1 Remover `data-slug` dos HTMLs

| Arquivo | Linha | Mudança |
|---|---|---|
| `index.html` | 16 | `<body data-slug="salgadoscosta">` → `<body>` |
| `view/cart.html` | 114 | `<body data-slug="salgadoscosta">` → `<body>` |

### 5.2 Simplificar `js/apiHelper.js`

- Remover função `storeSlug()`
- Remover parâmetro `slug` de todos os métodos (`listarProdutos`, `listarCategorias`, `lojaStatus`, `lojaSettings`)
- Remover `?slug=` das URLs

### 5.3 Simplificar `js/menu.js`

| Linha | Mudança |
|---|---|
| 215 | `fetch('/api/loja/status?slug=salgadoscosta')` → `fetch('/api/loja/status')` |
| 380 | Remover `var slug = document.body.getAttribute('data-slug')` |
| 419 | Remover extração de slug no registro |
| 441 | Remover `slug: slug` do payload de registro |
| 383 | Remover `slug: slug` do payload de login |

### 5.4 Simplificar `js/cart.js`

| Linha | Mudança |
|---|---|
| 856 | Remover `slug: document.body.getAttribute('data-slug')` do payload |

### 5.5 Simplificar `js/theme.js`

| Linha | Mudança |
|---|---|
| 64-67 | Unificar `loadThemeFromAPI()`: sempre chamar `/api/loja/settings` (sem slug) |
| 91-108 | Simplificar `init()`: sempre carregar tema da loja única |

### 5.6 Atualizar `login.html`

| Linha | Mudança |
|---|---|
| 204 | Remover `empresaId: 1` do payload de login |
| 122-164 | Remover tab/form de registro público (não faz sentido em single-tenant) |

### 5.7 Atualizar `entregador.html`

| Linha | Mudança |
|---|---|
| 201 | `authUser.empresaId || 1` → `1` |

### 5.8 Atualizar `dashboard.html`

| Linha | Mudança |
|---|---|
| 593-595 | Remover hack `localStorage.setItem('authUser', { role: 'superadmin' })` |

### 5.9 Atualizar `superadmin.html`

- Remover aba "Empresas" (criação de novas empresas não faz sentido)
- Remover funções `carregarEmpresas()` e `criarEmpresa()`
- Manter abas "Usuários" e "Gerenciar Senhas"

### 5.10 Atualizar Service Worker

`public/sw.js`: `const CACHE = 'salgadoscosta-v1'` → `const CACHE = 'app-v1'`

### 5.11 Total de Pontos

**~120 linhas alteradas em 10 arquivos.**

---

## Fase 6 — Testes e Deploy

### 6.1 Testes a Realizar

| Área | Teste | Critério |
|---|---|---|
| Banco | Verificar dados no Supabase Studio | Tabelas populadas, sequences corretas |
| API | CRUD produtos, categorias, pedidos | 200 OK, dados corretos |
| Auth | Login admin, login cliente | Token gerado, acesso permitido |
| Upload | Enviar imagem | URL pública do Supabase retornada |
| RLS | Query direta no banco sem `current_setting` | Deve retornar 0 linhas |
| Frontend | Navegar cardápio, carrinho, pedido | Funcional sem slug |
| Frontend | Dashboard, painel, relatórios | Funcionando sem `empresaId` |
| Deploy | Build Vercel | `prisma generate` + `prisma db push` OK |

### 6.2 Ordem de Deploy

1. **Staging/Preview**: Vercel preview deployment com variáveis Supabase
2. **Migração offline**: Executar dump/import em horário de baixo uso
3. **Produção**: Atualizar env vars no Vercel, fazer deploy
4. **Monitoramento**: Verificar logs por 24h

### 6.3 Rollback

Manter projeto Neon ativo por 30 dias. Rollback = restaurar env vars + redeploy.

---

## Fase 7 (Opcional) — Migrar Auth para Supabase Auth

### 7.1 O que Supabase Auth Oferece

| Funcionalidade | Atual | Supabase Auth |
|---|---|---|
| Login admin | username + password + base64url | email + password + JWT RS256 |
| Login cliente | telefone + password (opcional) | telefone + OTP SMS |
| Expiração | Admin: nenhuma; Cliente: 7 dias | Configurável + refresh token |
| Recuperação senha | Manual (via alterar-senha.html) | Built-in (email recovery) |
| OAuth | Não | Google, Facebook, Apple, etc. |
| MFA | Não | Sim (TOTP, SMS) |
| Row Level Security | Manual (current_setting) | Integrado via `auth.uid()` |
| Rate limiting | 10 req/15min | Built-in |

### 7.2 Esforço Estimado

**3 dias de trabalho**:
- Criar tabela `user_profiles` (metadados: role, empresaId, lojaNome)
- Migrar usuários admin existentes para `auth.users` (script de re-hash)
- Migrar clientes existentes para `auth.users` (telefone como identificador)
- Substituir `middleware/auth.js` por validação JWT do Supabase
- Substituir `tokenService.js` por `@supabase/supabase-js`
- Atualizar frontend para usar `supabase.auth.signInWithPassword()` / `signInWithOtp()`
- Atualizar RLS para usar `auth.jwt()`

**Não recomendado para a migração inicial.** Manter auth caseiro e migrar como melhoria futura.

---

## Resumo de Arquivos Alterados

### Backend (Fases 1-4)

| # | Arquivo | Fase | Tipo |
|---|---|---|---|
| 1 | `backend/.env` | F1 | Substituir DATABASE_URL |
| 2 | `backend/src/config/env.js` | F1, F3 | Adicionar DIRECT_URL, SUPABASE vars |
| 3 | `backend/prisma/schema.prisma` | F1 | Adicionar directUrl |
| 4 | `backend/src/repositories/sqlRepository.js` | F4 | Hardcodar empresaId=1 |
| 5 | `backend/src/services/orderService.js` | F4 | Remover empresaId param |
| 6 | `backend/src/services/productService.js` | F4 | Remover empresaId param |
| 7 | `backend/src/services/lojaService.js` | F4 | Remover empresaId param |
| 8 | `backend/src/services/whatsappInstanceService.js` | F4 | Remover empresaId param |
| 9 | `backend/src/services/whatsappService.js` | F4 | Remover empresaId param |
| 10 | `backend/src/services/entregaService.js` | F4 | Remover empresaId param |
| 11 | `backend/src/services/categoriaService.js` | F4 | Remover empresaId param |
| 12 | `backend/src/controllers/orderController.js` | F4 | req.user.empresaId → 1 |
| 13 | `backend/src/controllers/productController.js` | F4 | req.user.empresaId → 1 |
| 14 | `backend/src/controllers/cashierController.js` | F4 | req.user.empresaId → 1 |
| 15 | `backend/src/controllers/entregaController.js` | F4 | req.user.empresaId → 1 |
| 16 | `backend/src/controllers/driverController.js` | F4 | req.user.empresaId → 1 |
| 17 | `backend/src/controllers/categoriaController.js` | F4 | req.user.empresaId → 1 |
| 18 | `backend/src/controllers/whatsappController.js` | F4 | req.user.empresaId → 1 |
| 19 | `backend/src/controllers/lojaController.js` | F4 | req.user.empresaId → 1 |
| 20 | `backend/src/controllers/authController.js` | F4 | Remover empresaId do body |
| 21 | `backend/src/controllers/publicController.js` | F4 | Hardcodar empresa=1 |
| 22 | `backend/src/services/authService.js` | F4 | Remover criação de empresa |
| 23 | `backend/src/routes/scheduleRoutes.js` | F4 | req.user.empresaId → 1 |
| 24 | `backend/src/routes/userRoutes.js` | F4 | empresaId → 1 |
| 25 | `backend/src/routes/adminRoutes.js` | F4 | Simplificar rotas de empresa |
| 26 | `backend/src/middleware/auth.js` | F2 | Injetar current_setting |
| 27 | `backend/src/routes/uploadRoutes.js` | F3 | Reescrever para Supabase Storage |
| 28 | `backend/src/config/prisma.js` | F1 | Nenhuma (já usa DATABASE_URL) |
| 29 | `backend/package.json` | F3 | Adicionar @supabase/supabase-js |
| 30 | `backend/scripts/migrateImages.js` | F3 | Novo script |

### Frontend (Fase 5)

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `index.html` | Remover `data-slug` |
| 2 | `view/cart.html` | Remover `data-slug` |
| 3 | `js/apiHelper.js` | Remover função slug, parâmetros slug |
| 4 | `js/menu.js` | Remover 5 referências a slug |
| 5 | `js/cart.js` | Remover slug do payload |
| 6 | `js/theme.js` | Simplificar init() |
| 7 | `js/entregador.html` | Hardcodar empresaId |
| 8 | `login.html` | Remover empresaId, remover registro público |
| 9 | `dashboard.html` | Remover hack superadmin |
| 10 | `superadmin.html` | Remover aba Empresas |
| 11 | `public/sw.js` | Renomear cache |

---

## Checklist de Deploy

- [ ] Projeto Supabase criado em `sa-east-1`
- [ ] Dump Neon gerado
- [ ] Import Supabase bem-sucedido
- [ ] `prisma db pull` confere schema
- [ ] RLS ativado em todas as tabelas
- [ ] Políticas RLS criadas e testadas
- [ ] Bucket Storage `produtos` criado
- [ ] Script de migração de imagens executado
- [ ] `empresaId` hardcodado no backend
- [ ] Frontend sem referências a slug/empresaId
- [ ] Env vars atualizadas no Vercel
- [ ] Deploy preview testado
- [ ] Deploy produção
- [ ] Monitoramento 24h
- [ ] Projeto Neon desativado (após 30 dias de segurança)
