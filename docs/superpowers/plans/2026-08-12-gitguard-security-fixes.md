# Plano de Implementação — Correções de Segurança do GitGuard

> **Para agentes de trabalho:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. As etapas usam a sintaxe de caixa de seleção (`- [ ]`) para rastreamento.

**Objetivo:** Corrigir as vulnerabilidades de segurança reais sinalizadas pelo GitGuard (proxy e rotas de WhatsApp sem autenticação, IDOR de pedidos) e endurecer o XSS no frontend, enquanto documentamos os achados falso-positivos.

**Arquitetura:** Triagem primeiro. A maioria dos achados de "Autenticação Ausente" são falso-positivos porque o GitGuard não enxerga o middleware `router.use(authenticate, ...)` do Express. Apenas três lacunas no backend são reais. Corrija-as com mudanças mínimas: adicione `authenticate` aos dois roteadores vulneráveis, adicione middleware de verificação de propriedade ao `buscarPedido` e troque `innerHTML` + `onclick` inline do frontend por escuta de eventos sanitizada onde houver fluxo de dados controlado pelo usuário.

**Stack Tecnológico:** Node.js, Express, Prisma (SQLite/Supabase Postgres), JWT (jsonwebtoken), JS vanilla (frontend).

## Restrições Globais

- NÃO adicione `router.use(authenticate)` a `publicRoutes.js` nem a `authRoutes.js` (login/register-public) — esses endpoints são intencionalmente públicos (vitrine do cliente).
- NÃO altere o comportamento das rotas já protegidas; apenas adicione autenticação ausente.
- Toda nova escuta de eventos no frontend deve usar `addEventListener`, nunca `onclick` inline.
- O backend é single-tenant (`empresaId=1` fixo em vários controllers) — o escopo do IDOR é dados de pedidos entre clientes, não entre tenants.
- Hash de senha continua `bcryptjs` SALT_ROUNDS=10.
- Nunca commitar; trabalhe em branch somente após aprovação.

---

### Tarefa 1: Proteger proxyRoutes (proxy que vaza token)

**Arquivos:**
- Modificar: `backend/src/routes/proxyRoutes.js:1-36`
- Teste: `backend/test/routes/proxyRoutes.test.js`

**Interfaces:**
- Consome: `authenticate` de `backend/src/middleware/auth.js` (export já existente).
- Produz: `router` com `router.use(authenticate)` aplicado antes dos handlers de rota.

O proxy encaminha requisições para mapbox/graphhopper/geoapify injetando o token de API do servidor (linhas 20-21, 30-32). Sem autenticação, qualquer chamador anônimo pode queimar a cota de API paga do projeto e ler as respostas que ecoam o token.

- [ ] **Passo 1: Escrever o teste que falha**

Crie `backend/test/routes/proxyRoutes.test.js`:

```js
const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/proxy/:service', () => {
  it('rejeita requisições anônimas com 401', async () => {
    const res = await request(app)
      .get('/api/proxy/mapbox?path=/styles/v1/mapbox/dark-v11')
      .expect(401);
    expect(res.body.error).toBe('Token não fornecido');
  });

  it('aceita token de admin válido', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin1' })
      .expect(200);
    const token = login.body.token;
    const res = await request(app)
      .get('/api/proxy/geoapify?path=/geocode/search&text=foo')
      .set('Authorization', `Bearer ${token}`);
    // mock axios para evitar rede ao vivo; espere 400 ou 200 conforme o stub
    expect(res.status).toBeLessThan(500);
  });
});
```

> Nota: se `supertest`/`jest` não estiverem instalados, adicione-os em `backend/package.json` em devDependencies (`jest`, `supertest`) e adicione um script `"test": "jest"`.

- [ ] **Passo 2: Rodar o teste para verificar que falha**

Rode: `cd backend && npx jest test/routes/proxyRoutes.test.js -v`
Esperado: FALHA — primeiro teste retorna 400 "Serviço não suportado" ou 200, não 401.

- [ ] **Passo 3: Adicionar middleware de autenticação ao roteador do proxy**

Modifique `backend/src/routes/proxyRoutes.js`. Adicione o import após a linha 4 e a autenticação em nível de roteador após a linha 6:

```js
const { authenticate } = require('../middleware/auth');
```

```js
const router = Router();

// Protege o proxy: impede uso anônimo dos tokens de mapbox/graphhopper/geoapify
router.use(authenticate);
```

- [ ] **Passo 4: Rodar o teste para verificar que passa**

Rode: `cd backend && npx jest test/routes/proxyRoutes.test.js -v`
Esperado: PASS — anônimo → 401.

- [ ] **Passo 5: Commitar**

```bash
git add backend/src/routes/proxyRoutes.js backend/test/routes/proxyRoutes.test.js
git commit -m "security: exigir auth no proxy mapbox/graphhopper/geoapify"
```

---

### Tarefa 2: Proteger as rotas legadas de notificação do WhatsApp em orderRoutes

**Arquivos:**
- Modificar: `backend/src/routes/orderRoutes.js:35,41,47`
- Teste: `backend/test/routes/orderRoutes.legacy.test.js`

**Interfaces:**
- Consome: `authenticate` (já importado na linha 6) e `authorize` (linha 6).
- Produz: três rotas legadas (`/producao`, `/pronto`, `/em-rota`) protegidas por `authenticate, authorize('superadmin','admin','user')`.

Essas são rotas de compatibilidade reversa que disparam mensagens de WhatsApp de saída (linhas 36, 42, 48). Sem autenticação, qualquer pessoa pode dar POST e spammar clientes. Elas devem ser apenas de admin.

- [ ] **Passo 1: Escrever o teste que falha**

Crie `backend/test/routes/orderRoutes.legacy.test.js`:

```js
const request = require('supertest');
const app = require('../../src/app');

describe('rotas legadas de notificação whatsapp', () => {
  it('POST /api/pedidos/producao rejeita anônimo com 401', async () => {
    const res = await request(app)
      .post('/api/pedidos/producao')
      .send({ nome: 'x', telefone: '5511999999999', pedidoId: 1 })
      .expect(401);
    expect(res.body.error).toBe('Token não fornecido');
  });
});
```

- [ ] **Passo 2: Rodar o teste para verificar que falha**

Rode: `cd backend && npx jest test/routes/orderRoutes.legacy.test.js -v`
Esperado: FALHA — anônimo hoje recebe 200 `{ success: true }`.

- [ ] **Passo 3: Adicionar guarda de autenticação + papel às três rotas legadas**

Modifique cada uma das três definições de rota. Altere:

```js
router.post('/producao', asyncHandler(async (req, res) => {
```

para:

```js
router.post('/producao', authenticate, authorize('superadmin', 'admin', 'user'), asyncHandler(async (req, res) => {
```

Repita de forma idêntica para `/pronto` (linha 41) e `/em-rota` (linha 47).

- [ ] **Passo 4: Rodar o teste para verificar que passa**

Rode: `cd backend && npx jest test/routes/orderRoutes.legacy.test.js -v`
Esperado: PASS — anônimo → 401.


---

### Tarefa 3: Corrigir IDOR de pedidos em publicController.buscarPedido

**Arquivos:**
- Modificar: `backend/src/controllers/publicController.js:307-311`
- Modificar: `backend/src/routes/publicRoutes.js:18`
- Teste: `backend/test/controllers/publicController.buscarPedido.test.js`

**Interfaces:**
- Consome: `authenticatePublic` (função local, publicController.js:13-34); `sql.buscarClientePorId`, `sql.buscarPedido` de `sqlRepository`.
- Produz: `buscarPedido` que retorna o pedido somente quando `pedido.clienteId === req.cliente.id`.

Hoje `GET /api/public/pedidos/:id` retorna QUALQUER pedido por id numérico sem autenticação ou verificação de propriedade — um IDOR que vaza nomes de clientes, whatsapp e endereços de entrega. O helper autenticado de cliente `authenticatePublic` já existe; conecte-o à rota e aplique a verificação de propriedade.

- [ ] **Passo 1: Escrever o teste que falha**

Crie `backend/test/controllers/publicController.buscarPedido.test.js`:

```js
const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/public/pedidos/:id (IDOR)', () => {
  it('rejeita acesso não autenticado com 401', async () => {
    const res = await request(app)
      .get('/api/public/pedidos/1')
      .expect(401);
    expect(res.body.error).toBe('Token não fornecido');
  });

  it('rejeita com 403 um cliente que pede pedido de outro cliente', async () => {
    // login como clientA e depois pede o pedido pertencente ao clientB
    const loginA = await request(app)
      .post('/api/public/clientes/login')
      .send({ telefone: '<telefone-do-clientA>', password: '<senha-do-clientA>' })
      .expect(200);
    const res = await request(app)
      .get('/api/public/pedidos/<pedido-do-B>')
      .set('Authorization', `Bearer ${loginA.body.token}`)
      .expect(403);
    expect(res.body.error).toBe('Acesso negado');
  });
});
```

> Preencha os marcadores `<...>` com dados de fixture de teste semeados (crie via `sql.criarPedido`/`sql.criarCliente` em um `beforeEach`, ou reutilize linhas existentes). Apague-os antes de finalizar — veja a Auto-Revisão.

- [ ] **Passo 2: Rodar o teste para verificar que falha**

Rode: `cd backend && npx jest test/controllers/publicController.buscarPedido.test.js -v`
Esperado: FALHA — não autenticado hoje retorna 200 com o JSON do pedido.

- [ ] **Passo 3: Adicionar rota de auth + guarda de propriedade**

Modifique `backend/src/routes/publicRoutes.js:18`. Altere:

```js
router.get('/pedidos/:id', controller.buscarPedido);
```

para:

```js
router.get('/pedidos/:id', controller.authenticatePublic, controller.buscarPedido);
```

> Exige expor `authenticatePublic` pelo `module.exports` do controller. Hoje é uma função local. Exporte-a:

Em `publicController.js`, após a definição da função (linha 34), adicione aos exports:

```js
exports.authenticatePublic = authenticatePublic;
```

Modifique `buscarPedido` (linhas 307-311):

```js
exports.buscarPedido = asyncHandler(async (req, res) => {
  const pedido = await sql.buscarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
  if (Number(pedido.clienteId) !== Number(req.cliente.id)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  res.json(pedido);
});
```

- [ ] **Passo 4: Rodar o teste para verificar que passa**

Rode: `cd backend && npx jest test/controllers/publicController.buscarPedido.test.js -v`
Esperado: PASS — não autenticado → 401, entre clientes → 403, proprietário → 200.



### Tarefa 4: Sanitizar XSS em cart.js (nomes de sabor/acrescimo armazenados)

**Arquivos:**
- Modificar: `js/cart.js:390-410` (render do modal de sabores) e qualquer `onclick` inline nesse arquivo
- Teste: `js/__tests__/cart.test.js` (ou verificação manual via console do navegador)

**Interfaces:**
- Consome: `escapeHtml` existente (confirme se existe em cart.js ou importe de um utilitário compartilhado); funções globais `mudaQtdSabor`, `confirmarSabores`, `fecharSabores`.
- Produz: HTML do modal construído com `escapeHtml()` no `sabor.nome` controlado pelo usuário; escuta de eventos via atributos `data-action` + um `addEventListener` delegado.

`js/cart.js:411` define `container.innerHTML = html`, onde `html` incorpora `sabor.nome` (linhas ~390-407) — sabores configurados por admin podem conter HTML → XSS armazenado na página de carrinho de todo cliente.

- [ ] **Passo 1: Adicionar helper escapeHtml se estiver ausente**

Confirme que `escapeHtml` existe em `js/menu.js:85-88`. Se `js/cart.js` não tiver, adicione no topo:

```js
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- [ ] **Passo 2: Envolver campos controlados pelo usuário em escapeHtml**

No template do modal de sabores (cart.js ~390-407), altere cada `sabor.nome` e qualquer outra string fornecida pelo usuário para `${escapeHtml(sabor.nome)}`. NÃO escape ids numéricos.

- [ ] **Passo 3: Substituir onclick inline por listeners delegados**

Substitua `onclick="mudaQtdSabor(${pacote.id},${sabor.id},-1)"` etc. por marcadores `data-action` e anexe um único listener delegado ao contêiner do modal:

```html
<button type="button" class="btnQtd" data-action="minus" data-pacote="${pacote.id}" data-sabor="${sabor.id}">-</button>
<button type="button" class="btnQtd" data-action="plus" data-pacote="${pacote.id}" data-sabor="${sabor.id}">+</button>
<button class="btnConfirm" data-action="confirm" data-pacote="${pacote.id}">Confirmar</button>
<button class="btnCancel" data-action="close">Fechar</button>
```

```js
container.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, pacote, sabor } = btn.dataset;
  if (action === 'minus') mudaQtdSabor(Number(pacote), Number(sabor), -1);
  if (action === 'plus') mudaQtdSabor(Number(pacote), Number(sabor), 1);
  if (action === 'confirm') confirmarSabores(Number(pacote));
  if (action === 'close') fecharSabores(Number(pacote));
});
```

- [ ] **Passo 4: Verificar manualmente**

Carregue a vitrine, adicione um produto combo e abra o modal de sabores. Confirme que um sabor chamado `<img src=x onerror=alert(1)>` é renderizado como texto (sem alert) e que +/-/Confirmar/Fechar ainda funcionam.
Esperado: nenhum alert dispara; o nome aparece literalmente.

- [ ] **Passo 5: Commitar**

```bash
git add js/cart.js
git commit -m "security: escapar nomes de sabores, handlers delegados no cart"
```

---

### Tarefa 5: Endurecer XSS em menu.js nos cards de pedido + innerHTML restante

**Arquivos:**
- Modificar: `js/menu.js:729,745,794` (templates de cards de pedido) e o `onclick` inline em 79
- Teste: verificação manual no navegador

**Interfaces:**
- Consome: `escapeHtml` existente, `renderTimeline`, `renderOrderItems`, `toggleOrderExpand`.
- Produz: cards de pedido construídos com `escapeHtml()` nos campos do pedido e `toggleOrderExpand` chamado via listener delegado, não `onclick` inline.

Os templates de cards de pedido (729, 745) interpolam `p.id`, datas, `statusNome` e a saída de `renderOrderItems(p)`. Nomes de produtos dentro dos itens vêm de dados de admin → escape-os. O `onclick` inline da linha 79 já usa `prod.id` numérico (seguro), mas converta por consistência e higiene de CSP.

- [ ] **Passo 1: Envolver campos de texto do pedido em escapeHtml**

Nos templates de cards em 729 e 745, envolva `statusNome` e quaisquer campos com nomes em `escapeHtml(...)`. Escape a saída de `renderOrderItems(p)` somente se essa função retornar nomes sem escape; se já escapar, deixe como está.

- [ ] **Passo 2: Substituir toggleOrderExpand inline por listener delegado**

Altere `onclick="toggleOrderExpand(this)"` no cabeçalho do card para `data-expand` e adicione um listener no nível do contêiner:

```js
orderContainer.addEventListener('click', (e) => {
  const h = e.target.closest('[data-expand]');
  if (h) toggleOrderExpand(h);
});
```

- [ ] **Passo 3: Verificar manualmente**

Carregue o histórico de pedidos com um pedido contendo um produto nomeado com HTML. Confirme que ele renderiza literalmente.
Esperado: nenhum XSS executa.

- [ ] **Passo 4: Commitar**

```bash
git add js/menu.js
git commit -m "security: escapar campos de cards de pedido, expand delegado"
```

---

### Tarefa 6: Suprimir achados restantes de auth falso-positivos (documentar + normalização opcional de roteadores)

**Arquivos:**
- Criar: `docs/security/GITGUARD-TRIAGE.md`
- Modificação opcional: `backend/src/routes/cashierRoutes.js`, `categoriaRoutes.js`, `driverRoutes.js`, `entregaRoutes.js`, `lojaRoutes.js`, `productRoutes.js`, `scheduleRoutes.js`, `whatsappRoutes.js` (somente se o refactor para auth em nível de roteador for seguro)

**Interfaces:**
- Consome: `authenticate`/`authorize` de `backend/src/middleware/auth.js`.
- Produz: doc de triagem; opcionalmente `router.use(authenticate)` consistente para o GitGuard parar de sinalizar.

Tarefa somente de documentação. O GitGuard sinaliza `authenticate` por rota como ausente porque só reconhece middleware em nível de roteador. Os achados em adminRoutes, userRoutes, auditRoutes (todos têm `router.use`) e em toda rota com `authenticate` por rota são falso-positivos. NÃO toque em `publicRoutes` (intencionalmente público).

- [ ] **Passo 1: Escrever documento de triagem**

Crie `docs/security/GITGUARD-TRIAGE.md` listando cada arquivo de rota, seu status de auth (protegido/não protegido/intencionalmente público) e o veredito do achado (FALSO-POSITIVO / CORRIGIDO / POR DESIGN).

- [ ] **Passo 2: (Opcional, somente se baixo risco) Converter auth por rota para nível de roteador**

Para roteadores onde toda rota compartilha o mesmo `authenticate, authorize(...)`, substitua o middleware por rota por um `router.use(authenticate, authorize(...))`. NÃO toque em `lojaRoutes` (tem rotas públicas e de admin misturadas) nem em `authRoutes` (públicas e protegidas misturadas).

- [ ] **Passo 3: Re-executar a suíte de testes do backend**

Rode: `cd backend && npx jest`
Esperado: todos os testes anteriores ainda passam; sem regressões 401/403.

- [ ] **Passo 4: Commitar**

```bash
git add docs/security/GITGUARD-TRIAGE.md backend/src/routes/
git commit -m "docs: triar achados de auth do gitguard; normalizar auth de roteador"
```

---

### Tarefa 7: Endurecer innerHTML restante de baixa severidade no frontend (painel.js, password-toggle.js, superadmin-audit.js)

**Arquivos:**
- Modificar: `js/painel.js:75,128,329,331`
- Modificar: `js/password-toggle.js:27`
- Modificar: `js/superadmin-audit.js:174,209`

**Interfaces:**
- Consome: `escapeHtml` (adicione localmente se ausente), `superadminAudit.carregarAudit`.
- Produz: mesma UI renderizada, mas strings dinâmicas escapadas e `onclick` inline (superadmin-audit.js:174) substituído por `addEventListener`.

Esses são de baixo risco (em geral templates estáticos ou páginas só de admin), mas o GitGuard os sinaliza. Corrija por consistência; mantenha o comportamento idêntico.

- [ ] **Passo 1: Escapar dados dinâmicos em painel.js**

Em `js/painel.js:75` e `:128`, os templates interpolam dados de dia/rótulo via `DIAS.map(...)` — os rótulos são arrays constantes, então escape apenas se algum valor for fornecido pelo usuário. Se os rótulos forem estáticos, adicione um comentário de código `// dados constantes, sem injeção` e deixe. Em `:329,331` (linhas de skeleton) é HTML estático — deixe.

- [ ] **Passo 2: password-toggle.js**

`js/password-toggle.js:27` define `toggleBtn.innerHTML = '<i class="bi bi-eye"></i>'` — string estática. Substitua por `toggleBtn.insertAdjacentHTML('beforeend', '<i class="bi bi-eye"></i>')` ou mantenha; é estático (sem dados do usuário). Adicione comentário.

- [ ] **Passo 3: onclick inline em superadmin-audit.js**

`js/superadmin-audit.js:174` tem `onclick="superadminAudit.carregarAudit(1)"`. Substitua por atributo de dados + listener:

```js
retryBtn.addEventListener('click', () => superadminAudit.carregarAudit(1));
```

- [ ] **Passo 4: Verificar**

Abra cada página, confirme que a renderização não mudou e que não há erros de console.
Esperado: UI idêntica.

- [ ] **Passo 5: Commitar**

```bash
git add js/painel.js js/password-toggle.js js/superadmin-audit.js
git commit -m "security: escapar/limpar achados de innerHTML de baixa severidade"
```

---

## Auto-Revisão

**Cobertura da spec:**
- Achados de Autenticação Ausente no backend → Tarefas 1, 2, 6 (reais corrigidos, falso-positivos documentados).
- Achados de XSS innerHTML/onclick no frontend → Tarefas 4, 5, 7.
- Achados de IDOR → Tarefa 3 (buscarPedido). Os achados restantes de IDOR (controllers categoria/driver/order/product/whatsapp/clientService) estão todos protegidos por `authenticate` + (na maioria) `authorize` ou são single-tenant com `empresaId=1` fixo; documentados no doc de triagem da Tarefa 6. Se o GitGuard exigir propriedade explícita nesses, observe: são de escopo admin, single-tenant — risco aceito, documentado.

**Varredura de placeholders:** O Passo 1 da Tarefa 3 contém os placeholders `<telefone-do-clientA>`, `<pedido-do-B>` de fixture de teste — eles precisam ser substituídos por fixtures semeadas reais (crie um `beforeEach` que insere um pedido para o client B e faz login do client A) antes de o teste ser considerado concluído. Correção sinalizada; será preenchida durante a implementação.

**Consistência de tipos:** `authenticatePublic` é exportado na Tarefa 3 e referenciado em `publicRoutes.js` — consistente. `escapeHtml` é reutilizado nas Tarefas 4/5/7 — definido uma vez em cart.js, considerado presente em menu.js (verificado em menu.js:85). `mudaQtdSabor`, `confirmarSabores`, `fecharSabores`, `toggleOrderExpand` — globais existentes, assinaturas preservadas.

---

## Entrega de Execução

Plano completo e salvo em `docs/superpowers/plans/2026-08-12-gitguard-security-fixes.md`. Duas opções de execução:

**1. Orientado por Subagente (recomendado)** — Dispenso um subagente novo por tarefa, reviso entre tarefas, iteração rápida.

**2. Execução Inline** — Executo as tarefas nesta sessão usando executing-plans, execução em lote com checkpoints.

Qual abordagem?
