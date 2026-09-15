# Backend Railway Deploy Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar a pasta `backend/` como repositório GitHub independente, limpo e deployável na Railway, sem commitar nada no repositório pai.

**Architecture:** O backend é um app Express híbrido CJS/ESM rodando em Node 22.12+ (`require(esm)` habilitado). Será extraído do monorepo `sic-ia - Copy` para um novo repo contendo apenas `backend/`. A limpeza remove arquivos lixo/secrets do escopo de tracking, corrige `.gitignore`, fixa a versão de Node lida pelo Railpack, e valida boot local antes do push.

**Tech Stack:** Node.js >=22.12.0, Express 5, Prisma 6, node-cron, vitest, Railpack (Railway builder).

## Global Constraints

- **SEM COMMITS** em qualquer repositório (instrução explícita do usuário). Onde o skill pede "Commit", o passo é "NÃO commitar — checkpoint apenas".
- Node engine: `>=22.12.0` (obrigatório — `require(esm)` depende disso).
- Secrets NUNCA vão para o repo: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `FIREBASE_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_*`.
- Env vars vão para o Railway Dashboard, não para arquivos commitados.
- Arquivos permitidos no novo repo: `package.json`, `package-lock.json`, `server.js`, `prisma/`, `src/`, `scripts/`, `migrations/`, `.env.example`, `.gitignore`, `.node-version`, `README.md`.
- Arquivos PROIBIDOS no novo repo: `.env`, `.env.local`, `node_modules/`, `.vercel/`, `api.js`, `nul`, `.git/` (aninhado), `tests/` (apagado).

---

### Task 1: Corrigir `.gitignore` do backend

**Files:**
- Modify: `backend/.gitignore`

**Interfaces:**
- Consumes: nada
- Produces: `.gitignore` correto que protege secrets e exclui `node_modules/`, `tests/`, `.vercel/`, `nul`

- [ ] **Step 1: Ler estado atual**

Run: `cat -A "C:/Users/djesus/Desktop/sic-ia - Copy/backend/.gitignore"`
Expected: linhas com `^M$` (CRLF) mostrando `.vercel`, `.env*`, `.node_modules`, `.tests` — dois patterns bugados (`.node_modules` e `.tests` são tratados como NOMES de arquivo, não diretórios).

- [ ] **Step 2: Substituir o conteúdo completo**

Escrever em `backend/.gitignore` exatamente:

```gitignore
# Dependencies
node_modules/

# Env / secrets
.env
.env.local
.env.*.local
.env.production

# Build / Vercel
.vercel/
dist/
build/

# Junk
nul
*.log
npm-debug.log*

# Tests (não versionar no repo de deploy)
tests/
coverage/
```

- [ ] **Step 3: Verificar que os patterns funcionam**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
git --no-pager check-ignore -v .env .env.local node_modules/foo .vercel/x nul tests/foo.test.js 2>&1
```
Expected: cada caminho listado com a regra que o ignora (exit 0). Se algum não aparecer, o pattern está errado.

- [ ] **Step 4: NÃO commitar — checkpoint apenas**

Nenhum `git add`/`git commit`. Apenas confirmar que `.gitignore` está correto.

---

### Task 2: Remover arquivos lixo do backend

**Files:**
- Delete: `backend/nul`
- Delete: `backend/api.js`
- Delete: `backend/.vercel/` (diretório)

**Interfaces:**
- Consumes: Task 1 (`.gitignore` não deve mais protegê-los — eles são removidos)
- Produces: diretório backend sem entry-point Vercel nem junk

- [ ] **Step 1: Confirmar que `api.js` não é referenciado**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
grep -rn "require.*api\.js\|from.*api\.js" src/ server.js 2>/dev/null || echo "NENHUMA REFERENCIA"
```
Expected: `NENHUMA REFERENCIA` (o `api.js` é só entry-point do Vercel serverless).

- [ ] **Step 2: Confirmar conteúdo de `api.js`**

Run: `cat "C:/Users/djesus/Desktop/sic-ia - Copy/backend/api.js"`
Expected: `const app = require('./src/app');` + `module.exports = app;` — nada essencial.

- [ ] **Step 3: Remover os arquivos**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
rm -f nul api.js
rm -rf .vercel
```

- [ ] **Step 4: Verificar remoção**

Run: `ls -la "C:/Users/djesus/Desktop/sic-ia - Copy/backend" | grep -E "nul|api.js|.vercel"`
Expected: nenhuma linha (todos removidos).

- [ ] **Step 5: Verificar que o app ainda carrega**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
node -e "require('./src/app'); console.log('APP OK'); process.exit(0)" 2>&1 | tail -1
```
Expected: `APP OK`.

- [ ] **Step 6: NÃO commitar — checkpoint apenas**

---

### Task 3: Confirmar que secrets estão fora do tracking

**Files:**
- Verify: `backend/.env` (não rastrear)
- Verify: `backend/.env.local` (não rastrear)
- Verify: `backend/.env.example` (rastrear — já existe, 56 linhas)

**Interfaces:**
- Consumes: Task 1
- Produces: garantia documentada de que só `.env.example` entra no repo

- [ ] **Step 1: Verificar que `.env` e `.env.local` são ignorados**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
git check-ignore -v .env .env.local 2>&1
```
Expected: ambos listados com a regra do `.gitignore` (exit 0).

- [ ] **Step 2: Verificar que `.env.example` NÃO é ignorado**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
git check-ignore .env.example && echo "IGNORADO (BUG)" || echo "NAO IGNORADO (correto)"
```
Expected: `NAO IGNORADO (correto)`.

- [ ] **Step 3: Confirmar `.env.example` cobre todas as vars obrigatórias**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
for v in PORT JWT_SECRET EVOLUTION_URL EVOLUTION_API_KEY EVOLUTION_INSTANCE DATABASE_URL DIRECT_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY ASAAS_ACCESS_TOKEN ASAAS_WEBHOOK_TOKEN ASAAS_SUBCONTA_KEY FIREBASE_PROJECT_ID FIREBASE_PRIVATE_KEY FIREBASE_CLIENT_EMAIL; do
  grep -q "^$v=" .env.example && echo "OK $v" || echo "FALTA $v"
done
```
Expected: todas as 16 linhas com `OK`. Se alguma `FALTA`, adicionar ao `.env.example` (sem valor real).

- [ ] **Step 4: NÃO commitar — checkpoint apenas**

---

### Task 4: Remover repositório git aninhado `backend/.git`

**Files:**
- Delete: `backend/.git/` (repo vazio, sem commits)

**Interfaces:**
- Consumes: nada
- Produces: pasta backend sem `.git` interno (evita conflito ao criar o novo repo)

> ⚠️ **Operação destrutiva.** `backend/.git` é um repositório vazio (`master` sem commits), criado acidentalmente. Removê-lo é seguro. Nenhum histórico é perdido.

- [ ] **Step 1: Confirmar que `backend/.git` está vazio**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
git log --oneline 2>&1
```
Expected: `fatal: your current branch 'master' does not have any commits yet` (repo vazio).

- [ ] **Step 2: Confirmar que não há remote configurado**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
git remote -v 2>&1 || echo "SEM REMOTE"
```
Expected: `SEM REMOTE` ou nenhuma linha (nada a preservar).

- [ ] **Step 3: Remover**

Run: `rm -rf "C:/Users/djesus/Desktop/sic-ia - Copy/backend/.git"`

- [ ] **Step 4: Verificar remoção**

Run: `ls -la "C:/Users/djesus/Desktop/sic-ia - Copy/backend/.git" 2>&1 || echo "REMOVIDO"`
Expected: `REMOVIDO`.

- [ ] **Step 5: NÃO commitar — checkpoint apenas**

---

### Task 5: Fixar versão de Node para o Railpack

**Files:**
- Create: `backend/.node-version`
- Verify: `backend/package.json` (engines.node)

**Interfaces:**
- Consumes: nada
- Produces: `.node-version` com `22.12.0` (Railpack lê este arquivo) + `engines` confirmado

- [ ] **Step 1: Criar `.node-version`**

Escrever em `backend/.node-version` exatamente:

```
22.12.0
```

- [ ] **Step 2: Confirmar `engines` no package.json**

Run: `grep -A2 '"engines"' "C:/Users/djesus/Desktop/sic-ia - Copy/backend/package.json"`
Expected:
```
"engines": {
  "node": ">=22.12.0"
},
```

- [ ] **Step 3: Verificar que o Node local suporta `require(esm)`**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
node -e "require('./src/middleware/resolveEmpresa.js'); console.log('REQUIRE-ESM OK')" 2>&1 | tail -1
```
Expected: `REQUIRE-ESM OK` (Node 22.12+ habilita `require()` de ESM por padrão).

- [ ] **Step 4: NÃO commitar — checkpoint apenas**

---

### Task 6: Resolver dependência `@sentry/node`

**Files:**
- Modify: `backend/src/app.js:1-7` (bloco Sentry) OU `backend/package.json` (dependencies)

**Interfaces:**
- Consumes: nada
- Produces: boot sem crash se `SENTRY_DSN` setado; sem dependência fantasma

> Contexto: `app.js` faz `require('@sentry/node')` dentro de `try/catch` condicionado a `SENTRY_DSN`. `@sentry/node` NÃO está instalado nem no `package.json`. O `try/catch` engole o erro, então não crasha — mas o Sentry fica silenciosamente inativo.

- [ ] **Step 1: Verificar que não está instalado**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
node -e "try{require.resolve('@sentry/node');console.log('INSTALADO')}catch{console.log('AUSENTE')}"
```
Expected: `AUSENTE`.

- [ ] **Step 2: Escolher opção — manter opcional (padrão)**

Manter como está (Sentry desligado por padrão; só ativa se `SENTRY_DSN` + pacote instalado). Nenhuma mudança de código necessária.

Documentar no runbook (Task 8): "Para ativar Sentry: `npm i @sentry/node` e setar `SENTRY_DSN`."

- [ ] **Step 3: Confirmar boot sem SENTRY_DSN**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
unset SENTRY_DSN
node -e "require('./src/app'); console.log('BOOT SEM SENTRY OK'); process.exit(0)" 2>&1 | tail -1
```
Expected: `BOOT SEM SENTRY OK`.

- [ ] **Step 4: Confirmar boot COM SENTRY_DSN (não deve crashar)**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
SENTRY_DSN=https://fake@example.com/1 node -e "require('./src/app'); console.log('BOOT COM SENTRY OK'); process.exit(0)" 2>&1 | tail -1
```
Expected: `BOOT COM SENTRY OK` (erro do require engolido pelo try/catch).

- [ ] **Step 5: NÃO commitar — checkpoint apenas**

---

### Task 7: Smoke test local de boot + endpoints

**Files:**
- Verify: `backend/server.js`, `backend/src/app.js`
- Uses: `backend/scripts/smoke-test.mjs`

**Interfaces:**
- Consumes: Tasks 1–6
- Produces: evidência de que o servidor sobe, responde `/live` e `/health`, e encerra gracioso

- [ ] **Step 1: Subir o servidor em background**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
node server.js > /tmp/railway-prefix.log 2>&1 &
echo $! > /tmp/railway-prefix.pid
sleep 8
```
Expected: processo em background iniciado.

- [ ] **Step 2: Checar log de boot**

Run: `cat /tmp/railway-prefix.log | tail -20`
Expected (aproximado): `Servidor iniciado na porta 3000`, mensagens de jobs registrados (PIX sync, settlement, filial billing). Erros de DB são toleráveis se o `.env` local não conectar.

- [ ] **Step 3: Testar `/live`**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/live`
Expected: `200`.

- [ ] **Step 4: Testar `/health`**

Run: `curl -s http://localhost:3000/health`
Expected: `{"status":"ok","db":"up"}` (200) OU `{"status":"unavailable","db":"down"}` (503). Ambos provam que o endpoint funciona; `db:up` confirma conexão Supabase.

- [ ] **Step 5: Testar header `X-Request-Id`**

Run: `curl -s -D - http://localhost:3000/live -o /dev/null | grep -i x-request-id`
Expected: linha `X-Request-Id: <uuid>`.

- [ ] **Step 6: Testar CORS — Origin desconhecido é rejeitado**

Run:
```bash
curl -s -D - -H "Origin: https://evil.com" http://localhost:3000/live -o /dev/null | grep -i "access-control-allow-origin" || echo "SEM ACAO (correto)"
```
Expected: `SEM ACAO (correto)`.

- [ ] **Step 7: Encerrar e verificar shutdown gracioso**

Run:
```bash
kill -TERM $(cat /tmp/railway-prefix.pid) 2>/dev/null
sleep 3
cat /tmp/railway-prefix.log | tail -8
```
Expected: mensagens `SIGTERM recebido. Encerrando jobs...` + `Prisma desconectado`.

- [ ] **Step 8: NÃO commitar — checkpoint apenas**

---

### Task 8: Atualizar runbook com fluxo "repo backend-only"

**Files:**
- Modify: `docs/railway-runbook.md`

**Interfaces:**
- Consumes: Tasks 1–7
- Produces: runbook atualizado com (a) criação do novo repo, (b) `.node-version`, (c) ativação do Sentry, (d) lista final de env vars

- [ ] **Step 1: Ler runbook atual**

Run: `cat "C:/Users/djesus/Desktop/sic-ia - Copy/docs/railway-runbook.md" | head -40`

- [ ] **Step 2: Adicionar seção "Criação do repo backend-only"**

Inserir após a seção "## 1. Deploy":

```markdown
## 1b. Criação do repositório backend-only

O backend está no monorepo `sic-ia - Copy` mas será publicado como repo próprio.

```bash
# Copiar SEM secrets/junk (copiar para uma pasta temporária)
# 1. Novo repo no GitHub (vazio)
# 2. Na pasta backend/, rodar:
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
```

- [ ] **Step 3: Adicionar seção "Ativação do Sentry (opcional)"**

Inserir após a seção "## 2. Environment Variables":

```markdown
## 2b. Sentry (opcional)

Por padrão, Sentry está DESLIGADO. Para ativar:

```bash
cd backend
npm install @sentry/node
# Adicionar ao package.json dependencies
# Setar no Railway: SENTRY_DSN=https://...@sentry.io/...
```
```

- [ ] **Step 4: Confirmar seções criadas**

Run: `grep -n "1b. Criação\|2b. Sentry" "C:/Users/djesus/Desktop/sic-ia - Copy/docs/railway-runbook.md"`
Expected: duas linhas com os headings.

- [ ] **Step 5: NÃO commitar — checkpoint apenas**

---

### Task 9: Verificação final do repo limpo (dry-run)

**Files:**
- Verify: todos os arquivos de `backend/`

**Interfaces:**
- Consumes: Tasks 1–8
- Produces: lista exata do que será versionado no novo repo

- [ ] **Step 1: Simular o que entraria no novo repo**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
find . -type f \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  -not -path "./.vercel/*" \
  -not -name ".env" \
  -not -name ".env.local" \
  -not -name "nul" \
  | sort
```
Expected: lista contendo `package.json`, `package-lock.json`, `server.js`, `.gitignore`, `.node-version`, `.env.example`, `README.md`, `api.js` NÃO deve aparecer, `nul` NÃO deve aparecer, todos os `src/**`, `prisma/**`, `scripts/**`, `migrations/**`.

- [ ] **Step 2: Verificação explícita de ausências**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
for f in .env .env.local nul api.js; do
  [ -e "$f" ] && echo "PRESENTE (BUG): $f" || echo "ausente (ok): $f"
done
[ -d .vercel ] && echo "PRESENTE (BUG): .vercel/" || echo "ausente (ok): .vercel/"
[ -d .git ] && echo "PRESENTE (BUG): .git/" || echo "ausente (ok): .git/"
```
Expected: todos `ausente (ok)`, exceto `.env`/`.env.local` que devem estar `ausente` APENAS se removidos — mas eles PODEM permanecer no disco (são locais). Ver Task 3: eles ficam no disco mas fora do git.

> Nota: `.env` e `.env.local` podem existir no disco (uso local). O importante é que o `.gitignore` os exclua (Task 3).

- [ ] **Step 3: Gerar relatório final**

Run:
```bash
cd "C:/Users/djesus/Desktop/sic-ia - Copy/backend"
echo "=== engines ==="; grep -A2 engines package.json
echo "=== node-version ==="; cat .node-version
echo "=== postinstall ==="; grep postinstall package.json
echo "=== gitignore lines ==="; wc -l .gitignore
echo "=== src files count ==="; find src -name "*.js" | wc -l
```
Expected: engines `>=22.12.0`, node-version `22.12.0`, postinstall presente, contagens consistentes.

- [ ] **Step 4: NÃO commitar — checkpoint final**

---

## Verificação Pós-Implementação

Após todas as tasks, o backend estará pronto para:
1. Criar novo repo GitHub com a pasta `backend/`
2. Configurar env vars no Railway Dashboard
3. Push → deploy automático
4. Rodar `node scripts/smoke-test.mjs https://<railway-url>`

**Nenhum commit foi feito no repositório pai** (restrição do usuário).

## Self-Review

**1. Spec coverage:**
- `.gitignore` bug → Task 1 ✓
- Arquivos lixo (`nul`, `api.js`, `.vercel/`) → Task 2 ✓
- Secrets fora do tracking → Task 3 ✓
- Repo git aninhado → Task 4 ✓
- Node version para Railpack → Task 5 ✓
- Dependência Sentry fantasma → Task 6 ✓
- Boot + endpoints validados → Task 7 ✓
- Runbook atualizado → Task 8 ✓
- Dry-run final → Task 9 ✓

**2. Placeholder scan:** Nenhum "TBD"/"TODO". Todos os passos têm comandos exatos.

**3. Type consistency:** Nomes de arquivos e paths consistentes entre tasks (`backend/.gitignore`, `backend/.node-version`, `docs/railway-runbook.md`).