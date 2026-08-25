# Design — Spec 08: UI Integrações / Financeiro

Data: 2026-08-23
Projeto: sic-ia (frontend HTML + vanilla JS + Bootstrap 5 + Vite, backend Express)
Status: aprovado pelo usuário (não commitado — ordem do usuário)
Depende de: specs 01-07 (APIs e dados já prontos nos backends)

## Objetivo

Interface responsiva (Bootstrap 5) para gerenciar integrações marketplaces e
consultar o financeiro: dashboard, fechamentos, reconciliação e logs. Segue as
convenções de UI já existentes no projeto.

## Páginas novas

### 1. `integracoes.html` (superadmin)

Cards por plataforma (iFood, 99Food, Keeta, Vendas próprias):

```
┌────────────────────────────┐
│ iFood    ● Conectado       │
│ Loja: SPACE BURGER         │
│ Última sync: 23/08 14:12   │
│ [Sincronizar agora] [Config]│
│ [Desconectar]              │
└────────────────────────────┘
┌────────────────────────────┐
│ 99Food   ○ Não conectado   │
│ [Conectar]                 │
└────────────────────────────┘
```

- Ações via `POST /api/integrations/:platform/connect|disconnect|sync|status`.
- Botões com estado (loading) + toast de feedback + atualização do status do card.

### 2. `financeiro.html` (superadmin + admin)

Abas Bootstrap 5 (`nav-tabs`):

| Aba | Conteúdo |
|---|---|
| **Dashboard** | Cards: Faturamento, Pedidos, Ticket médio, Taxas, Receita líquida, Custos, Lucro, Margem. Filtros: hoje/ontem/7d/30d/mês/mês anterior/personalizado. Gráficos Chart.js: por plataforma, por dia, lucro por dia, por hora, top produtos |
| **Fechamentos** | Tabela histórica (Data, Pedidos, Faturamento, Lucro, status) + ações `[Ver] [Reprocessar] [Reabrir]` em modais Bootstrap |
| **Reconciliação** | Executa por plataforma + lista divergências (tabela) |
| **Logs** | Tabela de eventos de integração (IntegrationEvent/AppLog) do tenant |

## Convenções

- `authGuard()` no topo de ambas.
- Nova `roleGuard(roles)` (helper pequeno) — integrações exige `['superadmin']`;
  financeiro `['superadmin','admin']`.
- Reusar `api()`, `toast()`, `theme.js` existentes.
- Tabelas com `overflow-x:auto` para mobile; cards empilham (`col-12 col-md-6 col-lg-4`).
- Chart.js via CDN.

## Navegação

- Adicionar links "Integrações" e "Financeiro" no menu/navbar das páginas admin
  (adicional; nada removido).
- Página nova segue template visual atual (navbar + container + Bootstrap).

## Verificação (manual)

1. Login superadmin → Financeiro carrega sem `undefined`.
2. Responsivo em 360px (tabelas com scroll horizontal, cards empilham).
3. Botão sync chama API e atualiza status com spinner/toast.
4. Sem login → redireciona via `authGuard`.
5. `roleGuard` bloqueia não-superadmin de integrações.

## Risco e mitigação

| Risco | Mitigação |
|---|---|
| Duplicar estilo | Reusa `api()`/`toast`/`theme`; Bootstrap 5 já presente |
| Quebrar navegação | Links aditivos; nada removido |
| Gráfico pesado | Chart.js CDN; agrupamento por dia/hora no servidor |

## Fora de escopo

- Exportação CSV/PDF/Excel (futuro).
- Alertas de saúde de integração (futuro).
- Ajustes visuais de temas avançados (tema existente já aplicado).
