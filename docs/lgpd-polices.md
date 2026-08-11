# LGPD — Política de Privacidade v1.0 + Plano de Implementação

> Status: **APROVADO (08/08/2026)**. Implementação concluída, sem commit.
> Braço de direito de vigilância: consultar `docs/security-test.md` para as 18 falhas de segurança relacionadas.

---

## 1. Mapeamento LGPD ← Sistema Atual

### 1.1 Dados pessoais tratados (inventário)

| Dado | Fonte | Onde fica | Finalidade |
|---|---|---|---|
| Nome | formulário cadastro | `Cliente.nome` | Identificação no pedido |
| Telefone (WhatsApp) | formulário cadastro | `Cliente.telefone` | Contato de entrega + confirmação |
| Endereço | formulário cadastro | `Cliente.endereco/numero/bairro/cep/pontoReferencia` | Entrega do pedido |
| Senha (hash bcrypt) | formulário cadastro | `Cliente.passwordHash` | Autenticação |
| CEP | formulário cadastro | `Cliente.cep` | Cálculo de frete/área de entrega |
| Pedido | cardápio → checkout | `Pedido` + `ItensPedido` | Execução de contrato (Art. 7º V) |
| Audit trail | server side | `AuditLog` | Segurança / Art. 37 |

### 1.2 Base legal por tratamento (Art. 7º)

| Tratamento | Base legal | Requer consentimento? |
|---|---|---|
| Processar pedidos | Art. 7º V — execução de contrato | Não |
| Comunicação WhatsApp do pedido | Art. 7º V + I | Não (contrato) |
| Perfil / cadastro completo | Art. 7º I — consentimento | **Sim** |
| Auditoria/segurança | Art. 7º X — legítimo interesse + proteção | Não |
| Dados de pagamento (Pix/cartão) | Fora do app (gateway externo) | Não coletado aqui |

### 1.3 Modalidade de conformidade — trato direto no próprio sistema

Não há transferência internacional opcional no controle do usuário: sistema usa Supabase (EUA) e provedor de e-mail/armazenamento. Cláusula de compartilhamento é informada na política (Art. 9º I-V).

---

## 2. Política de Privacidade — v1.0 (texto final)

> Página estática: `politicas.html` → rota `/politicas` no index. Requerido também no cadastro via link.

### 2.1. Controlador de dados

**Nome:** (definir — ex.: empresa controladora do site sic-ia)

### 2.2. Dados que coletamos

- Dados de cadastro: nome, telefone/WhatsApp, CEP, endereço, nº, bairro, ponto de referência.
- Dados de pedido: itens, quantidades, valores, forma de pagamento, status.
- Dados de uso log (anonimizados quando possível): IP, user-agent (Art. 6º X — segurança).

### 2.3. Finalidades (Art. 7º I, V + Art. 9º)

1. Processar e entregar seus pedidos (contrato).
2. Comunicar status via WhatsApp.
3. Melhorar o cadastro de entrega (facilidade de reposição/atualização).
4. Segurança e prevenção de fraude (log).

### 2.4. Base legal

- Consentimento (Art. 7º I) p/ dados de perfil.
- Execução de contrato (Art. 7º V) p/ pedidos.

### 2.5. Compartilhamento

- **Não vendemos, não comercializamos dados.**
- Supabase (hospedagem Postgres/armazenamento) — API + OT clearance.
- WhatsApp (via sua instância) para agendamento de entrega.
- Nenhum dado é transferido a terceiros fora do processamento necessário ao pedido.

### 2.6. Armazenamento e retenção (Art. 15, 16)

- Dados de pedido: conservados enquanto o contrato (conta) existir.
- Dados fiscais (pedidos finalizados): retidos por 5 anos (obrigação legal, Art. 16 I).
- Ao solicitar exclusão de conta: eliminamos perfil e dados não-necessários em até 15 dias (Art. 19), mantendo só o que a lei exige (5 anos p/ fiscal).
- Backups: rotativos, mesmo período de retenção das fontes de origem.

### 2.7. Seus direitos (Art. 18)

Você pode, a qualquer momento, solicitar:

| Direito | Como funciona |
|---|---|
| Confirmação + acesso | on-line, no perfil |
| Correção | perfil editável |
| Eliminação da conta | botão "Excluir conta" (art. 18 VI) |
| Revogação do consentimento | botão "Revogar" (funciona como exclusão dos dados de perfil, mantendo histórico fiscal) |
| Portabilidade | `GET /me/dados` exportação em JSON |
| Revisão de decisão automatizada | Não existe decisão automatizada no sistema (todas as decisões são manuais do operador) |

Prazo: acesso simplificado imediato; declaração completa em até 15 dias (Art. 19).

### 2.8. Menores (Art. 14 LGPD)

O serviço é destinado a maiores de 18 anos. Para menores de 16, o cadastro só é aceito com o **consentimento expresso do responsável legal** — durante o cadastro é requerida declaração nesse sentido.

### 2.9. Encarregado de dados — DPO (Art. 41)

**Contato do Encarregado:** (e-mail a definir) — responde em até 15 dias às solicitações de titular.

### 2.10. Responsável em incidentes

Se houver incidente de segurança com risco relevante, comunicaremos ao titular e à ANPD dentro de **72 horas** (Art. 48) — com endereço de e-mail: (definir).

### 2.11. Cookies e armazenamento local

- Usamos `localStorage` para login (token JWT) e carrinho. Não usamos cookies de rastreio de terceiros.
- Os dados locais são removidos ao sair/excluir conta.

### 2.12. Alterações desta política

Esta política será revisada quando houver mudanças de finalidade, uso ou compartilhamento (Art. 9º). Mudanças relevantes serão comunicadas por aviso no site no próximo acesso.

---

## 3. Texto do consentimento (cadastro — finalidade determinada, Art. 8° §4)

```
[ ] Ao criar minha conta, autorizo o tratamento dos meus dados pessoais
    (nome, telefone, endereço, CEP, bairro) para as finalidades de:
    (1) processar e entregar meus pedidos;
    (2) comunicação de status do pedido via WhatsApp;
    (3) melhoria do meu cadastro de entrega.
    Li a versão v1.0 da Política de Privacidade: [link].

    Declaro ser maior de 18 anos (ou, se menor de 16, portar o
    consentimento do meu responsável legal). (Art. 14)
```

- Checkbox **não pre-marcado** e **obrigatório** (Art. 8° §1, mutação livre).
- Desabilitado: se desmarcado, texto de erro claro.
- Ao marcar → `aceitePoliticas: true` é enviado ao backend com `consentVersion: "v1.0"`.

---

## 4. Esquema — alteração em `Cliente` (Art. 8° §2 — ônus da prova)

```prisma
model Cliente {
  ...
  consentimentoAt    DateTime? @map("consentimento_em")      // quando aceitou
  politicaVersao     String?   @map("politica_versao")      // "v1.0"
  consentimentoRevogadoAt DateTime? @map("consentimento_revogado_em") // Art. 8 §5
}
```

> **Ônus da prova** (Art. 8º §2): quem tem o timestamp e a versão é o controlador. Salvamos ambos.

---

## 5. Backend — endpoints (direitos do titular)

| Método | Rota | Ação | Art. |
|---|---|---|---|
| `POST` | `/api/public/clientes/register` | Valida `aceitePoliticas === true` (senão 400 `{ error: 'Consentimento da Política de Privacidade obrigatório' }`), salva consentimento | 8 |
| `GET` | `/api/public/me/dados` | Todos os dados pessoais do titular em JSON | 18 I/II, 19 |
| `PUT` | `/api/public/me/dados` | Correção de dados (e-mail/endereço) | 18 III |
| `POST` | `/api/public/consent/revogar` | Marca `consentimentoRevogadoAt`; a partir daí o usuário só usa dados essenciais p/ pedido obtenção | 8 §5, 15 |
| `DELETE` | `/api/public/me/dados` | Exclui conta + dados pessoais (mantém fiscal 5 anos) | 18 VI, 16 |

- Todas sob `authenticatePublic` (token JWT já usado em pedidos do cliente).
- AuditLog grava `cliente.consentir`, `cliente.revogar_consentimento`, `cliente.eliminar` (já infra existente).

---

## 6. Frontend — mudanças

1. **`index.html`**: dentro `#registerOverlay`, antes do botão `Cadastrar`: checkbox `#regConsent` + label com texto da seção 3 + link `politica.html`.
2. **`js/menu.js`** (handler `btnRegister`): valida `regConsent.checked` antes de chamar `register`; inclui `aceitePoliticas`, `consentVersion` no payload.
3. **`politica.html`**: página estática com a política v1.0 completa (seção 2). Link no rodapé + no cadastro.
4. **Edição de perfil**: quando `isEditing === true`, não pedir novamente consentimento (já concedido), apenas leva a política.

---

## 7. Análise de Risco — Implementação (verificada contra código real)

Risco geral: **baixo-médio**. Nenhuma quebra de núcleo de pedidos. O maior perigo é de **deploy**, não de código.

### 7.1 ALTO — Deploy acoplado (front + back juntos)
- `publicController.js:49-90` (`registrarCliente`) passa a exigir `aceitePoliticas === true` → 400 se ausente.
- Se backend sobe **antes** do frontend → **todo cadastro falha (400)** até o JS novo ser servido.
- **Guard**: deploy frontend+backend no **mesmo** deploy; incrementar cache-buster `menu.js?=8` (senão navegador usa JS velho sem checkbox e cadastros nunca conclamados).

### 7.2 ALTO — checkbox não deve bloquear edição de perfil
- Overlay de cadastro é **reutilizado** para edição (`js/menu.js:550 var isEditing = !!localStorage.getItem('clientToken')`).
- Se o checkbox for obrigatório incondicionalmente → **usuário existente não consegue editar perfil**.
- **Mitig**: checkbox e validação **só quando `!isEditing`**; no fluxo de edição (`updateMe`) não requerer consentimento.

### 7.3 Médio — DELETE não inválida JWT (7 dias)
- `authenticatePublic` (publicController.js:12) só decodifica o token; não consulta o banco.
- Após excluir conta/revogar, token antigo ainda acessa `listarPedidosCliente`/`atualizarCliente`.
- **Mitig**: no middleware, após decode, checar se o cliente ainda existe. `deletarCliente` já existe (sqlRepository.js:209) mas token permanece válido.

### 7.4 Médio — endpoint duplicado
- `GET /api/me/dados` e `PUT /api/me/dados` do plano **já existem** como `GET/PUT /api/clientes/me` (publicRoutes.js:12-13).
- **Mitig**: reutilizar `/clientes/me`; criar **somente `DELETE /api/clientes/me`** + rota de revogação de consentimento.

### 7.5 Médio — migration em tabela com dados
- Adicionar colunas de consentimento como **nullable** (`DateTime?`, `String?`). `NOT NULL` sem default → falha de migration em `clientes` já populada.

### 7.6 Baixo — clientes legados sem consentimento
- Contas cadastradas antes do deploy têm **0 registro de consentimento** (gap LGPD Art. 8 §2).
- **Mitig**: registrar estratégia de re-consentimento no próximo login OU documentar gap na política.

### Sem risco (verificado)
- `Pedido` guarda `clienteWhatsapp` como string — **sem FK para `Cliente`** → `deletarCliente` não quebra pedidos. ✔
- `politicas.html` no root é servido por `express.static` (app.js:37-38). ✔
- Testes existentes (`orderService.test.js`, `entregaService.test.js`) não cobrem registro → nada quebra. ✔

---

## 8. Plano de implementação (TDD)

### Fase 0 — Docs & consentimento (sem código)
- [x] `docs/lgpd-polices.md` (este)
- [x] Aprovação dos 6 itens LGPD + 5 safeguards

### Fase 1 — Backend + model
- [x] Migração Prisma: 3 colunas em `Cliente`
- [x] `publicController.registrarCliente`: validar `aceitePoliticas`, gravar `consentimentoAt` + `consentVersion`
- [x] Criação `clienteMeController` (GET/PUT/DELETE) + `consentimentoRevogar` (reutiliza GET/PUT existentes — S4)
- [x] rotas + middlewares de auth pública (S3: authenticatePublic checa DB)
- [x] Testes unit (validação consentimento → 400; PUT/DELETE com token; 401 sem token)

### Fase 2 — Frontend
- [x] `politica.html` — política v1.0 renderizada (texto seção 2)
- [x] `index.html` — div do checkbox + link
- [x] `js/menu.js` — leitura do checkbox + payload; bloqueia se desmarcado
- [x] Navegação das demandas de direitos (botão no perfil: "Meus dados / Excluir conta")

### Fase 3 — Testes fim-a-fim
- [ ] Cadastro sem checkbox → 400 (front bloqueia; backend rejeita) — pendente deploy + teste manual
- [ ] Cadastro com checkbox → 201, `userLogged` OK — pendente deploy + teste manual
- [ ] `GET/PUT me/dados` retorna e edita dados — pendente deploy + teste manual
- [ ] Revogar → flag setado; DELETE → conta apagada, pedidos fiscais retidos — pendente deploy + teste manual

### Fase 4 — Verificação
- [x] Rodar suite: `npm test` (backend) — 23/23 pass, incl. 5 novos consentimento
- [ ] Teste manual completo no browser (mobile class .subject) — pendente deploy

---

## 9. Autorização pendente — 6 pontos LGPD + 5 safeguards

### 9.1 LGPD — itens de conformidade

| # | Item | Confirma? |
|---|---|---|
| 1 | Checkbox text "Finalidades determinadas" (não "concordo com todas") | ✅ |
| 2 | 4 endpoints direitos do titular (GET/PUT/POST revogar/DELETE dados) | ✅ |
| 3 | Campos `consentimentoAt`, `consentimentoRevogadoAt` + versão no `Cliente` | ✅ |
| 4 | Política v1.0 no formato seções 2.1–2.12 | ✅ |
| 5 | Declaração 18+/responsável (Art. 14) no cadastro | ✅ |
| 6 | DPO/contato + retenção 5 anos + compartilhamento internacional informado | ✅ |

### 9.2 Safeguards de implementação (seção 7)

| # | Guard | Confirma? |
|---|---|---|
| S1 | Deploy único front+backend; incrementar `menu.js?=8` cache-buster | ✅ (feito: `?=9`) |
| S2 | Checkbox/validação só quando `!isEditing` (não bloquear edição de perfil) | ✅ (feito) |
| S3 | `authenticatePublic` checa existência do cliente no DB (invalida token pós-delete) | ✅ (feito) |
| S4 | Reutilizar `GET/PUT /api/clientes/me`; criar só `DELETE` + rota de revogação | ✅ (feito) |
| S5 | Novas colunas nullable; registrar estratégia p/ clientes legados sem consentimento | ✅ (nullable) — estratégia pendente: reconsentimento em login futuro |

> APROVADO 08/08/2026 — implementação concluída sem commit. Pendências: aplicar migration no banco + deploy único + teste manual E2E.