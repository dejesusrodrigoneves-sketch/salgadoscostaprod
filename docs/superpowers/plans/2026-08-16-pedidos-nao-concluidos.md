# Plano: Nova Seção "Pedidos Não Concluídos" no Admin

## Decisões Confirmadas
| Item | Decisão |
|---|---|
| Motivo "Expirado" | Tempo decorrido (ex: "Expirado há 2h") |
| Limpeza | Apenas `superadmin` / `admin` |
| Soft delete schema | Aplicar agora no `schema.prisma` |
| Retenção | Configurável via `PEDIDO_RETENCAO_DIAS=30` |
| Ordenação | Data mais recente primeiro |
| Sem commit | Todas as mudanças sem commit |

---

## 1. Schema Prisma (`backend/prisma/schema.prisma`)

**Model `Pedido`:**
```prisma
model Pedido {
  ...
  paymentStatus String?    @map("payment_status")
  paymentMethod String?  @map("payment_method")
  paymentId     Int?      @map("payment_id")
  deletedAt     DateTime? @map("deleted_em")

  @@index([paymentStatus])
  @@index([deletedAt])
  @@map("pedidos")
}
```

**Models `ItensPedido` / `Pagamento`:**
```prisma
model ItensPedido {
  ...
  pedido   Pedido @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
  @@map("itens_pedido")
}

model Pagamento {
  ...
  pedido   Pedido @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
  @@map("pagamentos")
}
```

> **Migração**: Rodar `npx prisma db push` após alterar schema.

---

## 2. Config (`backend/src/config/env.js`)

```js
pedidoRetencaoDias: Number(process.env.PEDIDO_RETENCAO_DIAS) || 30,
```

---

## 3. Repository (`backend/src/repositories/sqlRepository.js`)

**Mudanças em métodos existentes:**
- Adicionar `deletedAt: null` em **todos** os `where` de busca de pedidos (filtro global implícito)

**Novos métodos:**
```js
// Lista pedidos não concluídos (expirado + rejeitado)
async listarNaoConcluidos(filtros = {}) {
  const where = {
    empresaId: EMPRESA_ID,
    paymentStatus: { in: ['expirado', 'rejeitado'] },
    deletedAt: null,
    ...(filtros?.dias ? { createdAt: { gte: new Date(Date.now() - filtros.dias * 24*60*60*1000) } } : {}),
  };
  return prisma.pedido.findMany({ where, orderBy: { createdAt: 'desc' }, include: { itens: true, pagamentos: true } });
}

// Hard delete em lote (cascade via Prisma)
async hardDeletePedidos(ids) {
  return prisma.$transaction(ids.map(id => prisma.pedido.delete({ where: { id } })));
}

// Preview: pedidos elegíveis para limpeza (deletedAt < N dias)
async listarParaLimpeza(dias = 30) {
  const cutoff = new Date(Date.now() - dias * 24*60*60*1000);
  return prisma.pedido.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, paymentStatus: true, deletedAt: true, total: true, clienteNome: true },
    orderBy: { deletedAt: 'asc' },
  });
}
```

---

## 4. Service (`backend/src/services/orderService.js`)

```js
async listarNaoConcluidos(filtros) {
  return sql.listarNaoConcluidos(filtros);
}

async limparPedidosAntigos(dias = 30) {
  const paraDeletar = await sql.listarParaLimpeza(dias);
  if (!paraDeletar.length) return { deletados: 0, ids: [] };
  const ids = paraDeletar.map(p => p.id);
  await sql.hardDeletePedidos(ids);
  // Log auditoria
  for (const p of paraDeletar) {
    await auditService.appLog({
      level: 'info',
      message: 'PEDIDO_LIMPO',
      module: 'pedidos',
      meta: { pedidoId: p.id, motivo: p.paymentStatus, diasRetencao: dias }
    });
  }
  return { deletados: ids.length, ids };
}
```

---

## 5. Controller (`backend/src/controllers/orderController.js`)

```js
exports.listarNaoConcluidos = asyncHandler(async (req, res) => {
  const pedidos = await orderService.listarNaoConcluidos(req.query);
  const formatado = pedidos.map(p => ({
    ...p,
    motivo: p.paymentStatus === 'expirado'
      ? `Expirado há ${formatarTempoDecorrido(new Date(), p.updatedAt || p.createdAt)}`
      : `Rejeitado: ${p.pagamentos?.[0]?.refundReason || 'motivo não informado'}`,
    dataExpiracao: p.updatedAt || p.createdAt,
  }));
  res.json(formatado);
});

exports.previewLimpeza = asyncHandler(async (req, res) => {
  const dias = Number(req.query.dias) || config.pedidoRetencaoDias;
  const preview = await sql.listarParaLimpeza(dias);
  res.json({ dias, total: preview.length, pedidos: preview });
});

exports.executarLimpeza = asyncHandler(async (req, res) => {
  const dias = Number(req.body?.dias) || config.pedidoRetencaoDias;
  const resultado = await orderService.limparPedidosAntigos(dias);
  res.json(resultado);
});
```

> Helper `formatarTempoDecorrido(agora, entao)`: retorna string "2h", "1d 3h", etc.

---

## 6. Routes (`backend/src/routes/orderRoutes.js`)

```js
router.get('/nao-concluidos', authenticate, controller.listarNaoConcluidos);
```

**Admin Routes (`backend/src/routes/adminRoutes.js`):**
```js
router.get('/pedidos/preview-limpeza', authenticate, authorize('superadmin','admin'), controller.previewLimpeza);
router.post('/pedidos/limpar-expirados', authenticate, authorize('superadmin','admin'), controller.executarLimpeza);
```

---

## 7. Frontend — `admin.html`

**Tabs:**
```html
<div class="tab" data-tab="naoConcluidos">
  <i class="fas fa-ban"></i> Não Concluídos <span class="tab-count" id="tabCountNaoConcluidos">0</span>
</div>
```

**Tab Content:**
```html
<div id="naoConcluidos" class="tab-content" style="padding:8px;"></div>
```

**Event Listener:**
```js
if (tab.dataset.tab === 'naoConcluidos') carregarNaoConcluidos();
```

**`carregarNaoConcluidos()` — Tabela:**
| Coluna | Conteúdo |
|---|---|
| ID | `p.id` |
| Cliente | `p.clienteNome` + whatsapp |
| Total | `formatCurrency(p.total)` |
| **Motivo** | Badge: <br>• `expirado` → `🟠 Expirado há ${tempoDecorrido}`<br>• `rejeitado` → `🔴 Rejeitado: ${motivo}` |
| Data | `formatDateTime(p.dataExpiracao)` |
| Ações | — |

**Botão "Limpar (>30 dias)":**
```html
<button class="btn btn-danger" onclick="abrirModalLimpeza()">
  <i class="fas fa-broom"></i> Limpar (>30 dias)
</button>
```

**Modal de Preview:**
1. Chama `GET /api/admin/pedidos/preview-limpeza?dias=30`
2. Mostra: "X pedidos serão removidos permanentemente (Itens + Pagamentos)"
3. Lista resumo (ID, Cliente, Motivo, Data, Total)
4. Botão "Confirmar Limpeza" → `POST /api/admin/pedidos/limpar-expirados { dias: 30 }`
5. Feedback toast: "X pedidos removidos" / "Nenhum pedido elegível"

---

## 8. Checklist de Implementação

| Fase | Arquivos | Status |
|---|---|---|
| 1. Schema | `schema.prisma` | ⏳ |
| 2. Config | `env.js` | ⏳ |
| 3. Repository | `sqlRepository.js` | ⏳ |
| 4. Service | `orderService.js` | ⏳ |
| 5. Controller | `orderController.js` | ⏳ |
| 6. Routes | `orderRoutes.js`, `adminRoutes.js` | ⏳ |
| 7. Frontend | `admin.html` (tabs, tabela, modal) | ⏳ |
| 8. Migração DB | `npx prisma db push` | ⏳ |