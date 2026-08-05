# Parar População de Dados Inúteis + Remover Histórico de Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parar o backend de gravar dados inúteis no banco (login_logs cresce a cada login e a única aba que os exibia será removida), remover a aba "Histórico de Login" do superadmin, e fazer limpeza ÚNICA dos dados de teste remanescentes, preservando dados reais.

**Architecture:** Três frentes. (1) Frontend: remover aba "Histórico de Login" do `superadmin.html` (botão, bloco `#tabLogs`, mapa do `switchTab`, função `carregarLogs`). (2) Backend: remover a escrita `prisma.loginLog.create` em `authService.js:50-52` — a única fonte de inserção em `login_logs`; endpoint `/api/usuarios/logs` (leitura, `userService.js:105`) fica órfão retornando vazio — fora de escopo removê-lo. (3) Limpeza única via script `backend/scripts/depopulate.js` com `--dry-run` e confirmação, cobrindo apenas tabelas de teste; reais ficam protegidas.

**Tech Stack:** Node 24, Express/vanilla HTML, Prisma/PostgreSQL (Supabase), Vitest, Playwright stand-alone.

## Global Constraints

- Sem commit — usuário valida e commita manualmente (regra da sessão).
- Arquivos backend alterados: `backend/src/services/authService.js` (remover 3 linhas) + novo `backend/scripts/depopulate.js`. Nada mais.
- **Reais — NUNCA apagados pelo script:** `empresas`, `usuarios` (djesus/taina/simone), `clientes` (Rodrigo Neves +5521994235059, tai +5521982103529), `produtos` (2), `entregadores` (Rodrigo), `categorias` (verificar FK dos produtos — se produtos reais referenciam, manter).
- **Teste — limpar:** `entregas_diarias` (4), `caixa_diario` (2), `counters` (1), `horarios` (0), `cupons` (0), `pedidos` (0), `itens_pedido` (0), `login_logs` (59), `audit_logs` (5 — só os atuais, de teste), `app_logs` (0).
- `whatsapp_instances` (1): possível credencial real da Evolution API — NÃO limpar por default; só com `--incluir-whatsapp` + confirmação.
- Script nunca apaga sem `--dry-run` prévio OU confirmação `Y/n` (quando `--tudo`). Usa `DELETE` (sem lock de tabela, seguro com servidor rodando).
- Escrita de `audit_logs` (feature "Registros" da Etapa 4) é ÚTIL e continua ativa.

---

### Task 1: Remover aba "Histórico de Login" do superadmin.html

**Files:**
- Modify: `superadmin.html:19` (botão tab), `superadmin.html:64-75` (bloco `#tabLogs`), `superadmin.html:150-152` (mapa + case do `switchTab`), `superadmin.html:226-243` (função `carregarLogs`)

**Interfaces:**
- Consumes: nada (HTML estático existente)
- Produces: `superadmin.html` com exatamente 3 tabs — Usuários, Gerenciar Senhas, Registros; `switchTab` sem referência a `'logs'`/`tabLogs`/`carregarLogs`

- [ ] **Step 1: Remover o botão da aba**

Remover a linha 19 do `superadmin.html`:
```html
  <button class="tab" onclick="switchTab('logs',this)"><i class="fas fa-history"></i> Histórico de Login</button>
```
Resultado: `<div class="tabs">` fica com 3 botões (Usuários, Gerenciar Senhas, Registros).

- [ ] **Step 2: Remover o bloco `#tabLogs`**

Remover o bloco completo (linhas 64-75):
```html
<!-- Login Logs tab -->
<div class="tab-content" id="tabLogs">
  <div class="card">
    <h2><i class="fas fa-history"></i> Histórico de Login</h2>
    <div style="overflow-x:auto">
    <table class="user-table">
      <thead><tr><th>Usuário</th><th>IP</th><th>User-Agent</th><th>Data/Hora</th></tr></thead>
      <tbody id="logTableBody"></tbody>
    </table>
    </div>
  </div>
</div>
```
Deixar intacto o comentário `<!-- Audit logs tab -->` e o bloco `#tabRegistros` (linhas 79-127).

- [ ] **Step 3: Limpar o `switchTab`**

Na função `switchTab` (linhas 146-154), remover `logs: 'tabLogs'` do mapa e a linha do `if (tab === 'logs')`:
```js
  const map = { usuarios: 'tabUsuarios', senhas: 'tabSenhas', empresas: 'tabEmpresas', registros: 'tabRegistros' };
  document.getElementById(map[tab]).classList.add('active');
  if (tab === 'registros') superadminAudit.carregarAudit(1);
```
(`empresas: 'tabEmpresas'` permanece — entrada morta da aba Empresas removida em etapa anterior; não pertence a esta task.)

- [ ] **Step 4: Remover a função `carregarLogs`**

Remover o bloco inteiro (linhas 226-243):
```js
async function carregarLogs() {
  const tbody = document.getElementById('logTableBody');
  try {
    const logs = await api('/usuarios/logs');
    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:#94a3b8;text-align:center;">Nenhum login registrado</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    logs.forEach(function(l) {
      const ua = l.userAgent ? l.userAgent.substring(0, 80) : '-';
      const data = l.loggedAt ? new Date(l.loggedAt).toLocaleString('pt-BR') : '-';
      tbody.innerHTML += '<tr><td>' + l.username + '</td><td>' + (l.ip || '-') + '</td><td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(l.userAgent || '') + '">' + escapeHtml(ua) + '</td><td>' + data + '</td></tr>';
    });
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#94a3b8;text-align:center;">Erro ao carregar logs</td></tr>';
  }
}
```
Não remover `carregarUsuarios();` (linha 245) — a aba Usuários continua ativa por padrão.

- [ ] **Step 5: Verificar ausência de referências**

```bash
grep -n "logs\|carregarLogs\|logTableBody\|Histórico" superadmin.html
```
Expected: apenas o comentário `<!-- Audit logs tab -->` (linha 79) contém "logs"; nenhuma outra ocorrência.

- [ ] **Step 6: E2E — abas corretas sem erros de console**

Script Playwright stand-alone (`C:/Users/djesus/AppData/Local/Temp/opencode/e2e-remover-logs.js`):

```js
const { chromium } = require('C:/Users/djesus/AppData/Roaming/npm/node_modules/playwright');
const BASE = 'http://localhost:3000';
(async () => {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'djesus', password: 'tsa110594' }) });
  const token = (await r.json()).token;
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((t) => localStorage.setItem('authUser', JSON.stringify({ token: t, username: 'djesus', role: 'superadmin' })), token);
  const page = await ctx.newPage();
  const consoleErros = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErros.push(m.text()); });
  await page.goto(BASE + '/superadmin.html', { waitUntil: 'networkidle' });
  const tabs = await page.locator('.tab').allTextContents();
  console.log('TABS:', JSON.stringify(tabs));
  if (tabs.some(t => /Histórico de Login/.test(t))) throw new Error('Aba Histórico de Login ainda presente!');
  if (tabs.length !== 3) throw new Error('Esperado 3 tabs, tem ' + tabs.length);
  await page.click('text=Registros');
  await page.waitForSelector('.audit-card', { timeout: 8000 }).catch(() => {});
  await page.click('text=Usuários');
  await page.waitForSelector('#userTableBody tr', { timeout: 8000 });
  const errosReais = consoleErros.filter(e => !/favicon/i.test(e));
  if (errosReais.length) throw new Error('Console errors: ' + JSON.stringify(errosReais));
  console.log('E2E OK — 3 tabs, aba Registros e Usuários funcionando, sem console errors');
  await browser.close();
})().catch((e) => { console.error('E2E FAIL:', e.message); process.exit(1); });
```

Run: `node C:/Users/djesus/AppData/Local/Temp/opencode/e2e-remover-logs.js`
Expected: `E2E OK — 3 tabs, aba Registros e Usuários funcionando, sem console errors`

- [ ] **Step 7: Suite de testes existente**

Run: `npm test` (no diretório backend)
Expected: 1 file, 10 tests passed (suite da Etapa 4 não referencia a aba logs)

---

### Task 2: Parar escrita de login_logs no backend

**Files:**
- Modify: `backend/src/services/authService.js:50-52` (remover)

**Interfaces:**
- Consumes: nada (o código ao redor — login, token, auditService.audit de `auth.login` — permanece intacto)
- Produces: login autenticado NÃO grava mais em `login_logs`; `audit_logs` continua registrando `auth.login` (feature "Registros")

- [ ] **Step 1: Remover a escrita de loginLog**

No `authService.js`, remover exatamente (linhas 50-52):
```js
  await prisma.loginLog.create({
    data: { usuarioId: user.id, username: user.username, ip, userAgent },
  }).catch(() => {});
```
O que fica ao redor (linhas 47-54):
```js
  const payload = { id: user.id, username: user.username, role: user.role, empresaId: 1, lojaNome: user.lojaNome };
  const token = tokenService.gerarToken(payload);

  auditService.audit({
```
Manter intacto `auditService.audit` (auth.login) e o `return { token, user: ... }` (linha 64).

- [ ] **Step 2: Verificar que não sobrou referência a loginLog no authService**

```bash
grep -n "loginLog" src/services/authService.js
```
Expected: nenhuma linha (exit 1, sem output).

- [ ] **Step 3: Verificar que login NÃO popula mais login_logs**

Servidor dev na porta 3000 roda o código antigo até reiniciar. Reiniciar:
```bash
netstat -ano | grep ":3000" | head -2   # achar PID LISTENING
taskkill //F //PID <PID>
node server.js > /tmp/sic-server.log 2>&1 &
```
Depois, contagem antes e após 2 logins:
```bash
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:(process.env.DIRECT_URL||process.env.DATABASE_URL||'').replace(/(\?.*)$/,''),ssl:{rejectUnauthorized:false}}); (async()=>{const r=await p.query('SELECT count(*)::int c FROM login_logs');console.log('login_logs:',r.rows[0].c);await p.end();})();"
curl -s -o /dev/null -w "login1: HTTP %{http_code}\n" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"tsa110594"}'
curl -s -o /dev/null -w "login2: HTTP %{http_code}\n" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"tsa110594"}'
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:(process.env.DIRECT_URL||process.env.DATABASE_URL||'').replace(/(\?.*)$/,''),ssl:{rejectUnauthorized:false}}); (async()=>{const r=await p.query('SELECT count(*)::int c FROM login_logs');console.log('login_logs após 2 logins:',r.rows[0].c);await p.end();})();"
```
Expected: HTTP 200 nos dois logins; contagem login_logs **inalterada** (não cresce).

- [ ] **Step 4: Audit continua registrando login (feature Registros intacta)**

```bash
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:(process.env.DIRECT_URL||process.env.DATABASE_URL||'').replace(/(\?.*)$/,''),ssl:{rejectUnauthorized:false}}); (async()=>{const r=await p.query(\"SELECT action, count(*)::int c FROM audit_logs WHERE action LIKE 'auth.login%' GROUP BY action\");console.log(JSON.stringify(r.rows));await p.end();})();"
```
Expected: linhas `auth.login` presentes (2 novas dos curls do Step 3) — auditoria viva.

---

### Task 3: Script `depopulate.js` — limpeza única dos dados de teste

**Files:**
- Create: `backend/scripts/depopulate.js`

**Interfaces:**
- Consumes: `process.env.DIRECT_URL || process.env.DATABASE_URL` (mesmo padrão de `deploy_db.js`)
- Produces: script node com 3 modos:
  - `node scripts/depopulate.js --dry-run` — contagens por tabela, NÃO apaga (exit 0)
  - `node scripts/depopulate.js` — apaga só tabelas de LOG: `login_logs`, `audit_logs`, `app_logs` (sem confirmação — logs, não negócio)
  - `node scripts/depopulate.js --tudo` — logs + teste: `entregas_diarias`, `caixa_diario`, `counters`, `horarios`, `cupons`, `pedidos`, `itens_pedido` (confirma `Y/n`)
  - `--incluir-whatsapp` — também `whatsapp_instances` (flag adicional, com confirmação)
  - Protegidas SEMPRE (assert interno + erro): `empresas`, `usuarios`, `clientes`, `produtos`, `categorias`, `entregadores`

- [ ] **Step 1: Verificar FK antes de decidir sobre categorias**

```bash
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:(process.env.DIRECT_URL||process.env.DATABASE_URL||'').replace(/(\?.*)$/,''),ssl:{rejectUnauthorized:false}}); (async()=>{const r=await p.query(\"SELECT p.id, p.nome, p.categoriaId FROM produtos p\");console.log(JSON.stringify(r.rows));await p.end();})();"
```
Expected: produtos com `categoriaId` preenchido → categorias são reais, manter protegidas (caso contrário, mover categorias para a lista de teste na Step 2).

- [ ] **Step 2: Escrever o script**

Criar `backend/scripts/depopulate.js` (ajustar `NEGOCIO` se o Step 1 mostrar categorias órfãs):

```js
// Script de depopulação única — limpa dados de TESTE do banco
// Uso:
//   node scripts/depopulate.js --dry-run          # mostra contagens, não apaga
//   node scripts/depopulate.js                     # apaga apenas tabelas de LOG
//   node scripts/depopulate.js --tudo              # logs + dados de teste (confirma Y/n)
//   node scripts/depopulate.js --tudo --incluir-whatsapp  # + whatsapp_instances
// Protegidas SEMPRE: empresas, usuarios, clientes, produtos, categorias, entregadores (reais)

require('dotenv').config();
const readline = require('readline');
const { Pool } = require('pg');

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/(\?.*)$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const PROTEGIDAS = ['empresas', 'usuarios', 'clientes', 'produtos', 'categorias', 'entregadores'];
const LOGS = ['login_logs', 'audit_logs', 'app_logs'];
const TESTE = [
  'entregas_diarias', 'caixa_diario', 'counters',
  'horarios', 'cupons', 'pedidos', 'itens_pedido',
];
const OPCIONAL = ['whatsapp_instances'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tudo = args.includes('--tudo');
const incluirWhatsapp = args.includes('--incluir-whatsapp');

let alvo = LOGS.slice();
if (tudo) alvo = alvo.concat(TESTE);
if (incluirWhatsapp) alvo = alvo.concat(OPCIONAL);
for (const p of PROTEGIDAS) {
  if (alvo.includes(p)) throw new Error('Tabela protegida (dados reais) não pode ser limpa: ' + p);
}

async function contagem(tabela) {
  const r = await pool.query('SELECT count(*)::int c FROM "' + tabela + '"');
  return r.rows[0].c;
}

async function pedirConfirmacao(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(texto + ' (s/N): ', (resp) => { rl.close(); resolve(/^s$/i.test(resp.trim())); }));
}

(async () => {
  console.log('Alvo' + (dryRun ? ' (DRY-RUN — nada será apagado)' : '') + ': ' + alvo.join(', '));
  const antes = {};
  for (const t of alvo) antes[t] = await contagem(t);
  const total = Object.values(antes).reduce((a, b) => a + b, 0);
  for (const t of alvo) console.log('  ' + t.padEnd(20) + antes[t]);
  console.log('TOTAL: ' + total + ' linhas');

  if (dryRun) { await pool.end(); process.exit(0); }
  if (tudo && total > 0) {
    const ok = await pedirConfirmacao('Apagar ' + total + ' linhas de dados de teste + logs?');
    if (!ok) { console.log('Cancelado.'); await pool.end(); process.exit(0); }
  }
  if (total === 0) { console.log('Nada a apagar.'); await pool.end(); process.exit(0); }

  for (const t of alvo) {
    const r = await pool.query('DELETE FROM "' + t + '"');
    console.log('  limpa: ' + t + ' (' + r.rowCount + ' linhas)');
  }
  console.log('Depopulação concluída.');
  await pool.end();
})().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
```

- [ ] **Step 3: Verificar dry-run (não destrutivo)**

Run: `node scripts/depopulate.js --dry-run`
Expected: lista `login_logs`, `audit_logs`, `app_logs` com contagens (59/5/0) e TOTAL. Rodar de novo: contagens idênticas (nada foi apagado).

- [ ] **Step 4: Rodar limpeza default (só logs)**

Run: `node scripts/depopulate.js`
Expected:
```
Alvo: login_logs, audit_logs, app_logs
  login_logs           59
  audit_logs           5
  app_logs             0
TOTAL: 64 linhas
  limpa: login_logs (59 linhas)
  limpa: audit_logs (5 linhas)
  limpa: app_logs (0 linhas)
Depopulação concluída.
```

- [ ] **Step 5: Limpeza dos dados de teste (--tudo, com confirmação)**

Run: `node scripts/depopulate.js --tudo`
Expected: pede confirmação (`s`), limpa `entregas_diarias` (4), `caixa_diario` (2), `counters` (1), `horarios` (0), `cupons` (0), `pedidos` (0), `itens_pedido` (0) + logs (já zerados: 0).

- [ ] **Step 6: Verificar estado final**

```bash
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:(process.env.DIRECT_URL||process.env.DATABASE_URL||'').replace(/(\?.*)$/,''),ssl:{rejectUnauthorized:false}}); (async()=>{for(const t of ['login_logs','audit_logs','app_logs','entregas_diarias','caixa_diario','counters','horarios','cupons','pedidos','itens_pedido','empresas','usuarios','clientes','produtos','entregadores','categorias','whatsapp_instances']){const r=await p.query('SELECT count(*)::int c FROM \"'+t+'\"');console.log(t.padEnd(20), r.rows[0].c);}await p.end();})();"
```
Expected: zeradas todas de teste; **intactas**: `empresas 1`, `usuarios 3`, `clientes 2`, `produtos 2`, `entregadores 1`, `categorias 2` (ou 0 se Step 1 mostrou órfãs), `whatsapp_instances 1`.

---

### Task 4: Validação final integrada

**Files:**
- Nenhum (verificação)

**Interfaces:**
- Consumes: resultado das Tasks 1-3

- [ ] **Step 1: Suite automatizada**

Run: `npm test` (backend)
Expected: 1 file, 10 tests passed.

- [ ] **Step 2: E2E final completo**

Run: `node C:/Users/djesus/AppData/Local/Temp/opencode/e2e-remover-logs.js` (Task 1, Step 6)
Expected: `E2E OK — 3 tabs, aba Registros e Usuários funcionando, sem console errors`

- [ ] **Step 3: Sanidade pós-limpeza com login real**

```bash
curl -s -o /dev/null -w "login: HTTP %{http_code}\n" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"djesus","password":"tsa110594"}'
curl -s -o /dev/null -w "superadmin.html: HTTP %{http_code}\n" http://localhost:3000/superadmin.html
```
Expected: login HTTP 200 (e login_logs NÃO cresceu — Task 2 provou), página 200.

- [ ] **Step 4: Deixar servidor rodando + entregar**

Servidor dev continua na porta 3000. Sem commit. Resumo final com:
- aba "Histórico de Login" removida; 3 abas restantes
- `login_logs` parou de ser gravado (authService.js:50-52 removido); auditoria `auth.login` em `audit_logs` mantida
- dados de teste limpos; reais intactos (clientes, produtos, entregador, categorias, usuários, empresa)
- uso futuro: `node scripts/depopulate.js --dry-run` / `--tudo` para limpezas pontuais

---

## Self-Review

**Spec coverage:**
- "Parar de entrar dados ocupando o banco com dados inúteis" → Task 2 (única fonte de inserção em login_logs removida — verificado por grep: `loginLog` só existe em authService.js:50 e userService.js:105 leitura). ✓
- "Retirar Histórico de Login do frontend" → Task 1. ✓
- "Limpar o resto que é teste" → Task 3 com lista TESTE = entregas_diarias, caixa_diario, counters, horarios, cupons, pedidos, itens_pedido + logs; reais protegidos. ✓
- Reais confirmados pelo usuário: clientes (rodrigo/taina/simone), entregador rodrigo, produtos 2 → PROTEGIDAS. ✓
- `whatsapp_instances` fora do default (possível credencial real). ✓

**Placeholder scan:** nenhum TBD; passos com comandos completos e contagens baseline reais. ✓

**Type consistency:** nomes de tabela idênticos ao `schema.prisma` (`@@map`: login_logs, audit_logs, app_logs, entregas_diarias, caixa_diario, counters, horarios, cupons, pedidos, itens_pedido, whatsapp_instances, empresas, usuarios, clientes, produtos, categorias, entregadores). `authService.js` linhas 50-52 confirmadas por leitura. ✓
